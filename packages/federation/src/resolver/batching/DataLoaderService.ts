/**
 * DataLoader Service
 * 
 * Effect-based DataLoader implementation for batching and caching
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Cache from "effect/Cache"
import * as Duration from "effect/Duration"
import * as Queue from "effect/Queue"
import * as Fiber from "effect/Fiber"
import * as Deferred from "effect/Deferred"
import * as Data from "effect/Data"
import * as Option from "effect/Option"
import { pipe } from "effect/Function"

// ============================================================================
// Error Types
// ============================================================================

export class DataLoaderError extends Data.TaggedError("DataLoaderError")<{
  readonly loader: string
  readonly key: string
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Types
// ============================================================================

export interface BatchFunction<K, V> {
  (keys: ReadonlyArray<K>): Effect.Effect<ReadonlyArray<V | Error>, DataLoaderError>
}

export interface DataLoaderOptions {
  readonly batch?: boolean
  readonly maxBatchSize?: number
  readonly batchWindow?: Duration.Duration
  readonly cache?: boolean
  readonly cacheKeyFn?: <K>(key: K) => string
  readonly cacheMap?: Cache.Cache<string, any>
}

export interface DataLoader<K, V> {
  readonly load: (key: K) => Effect.Effect<V, DataLoaderError>
  readonly loadMany: (keys: ReadonlyArray<K>) => Effect.Effect<ReadonlyArray<V | Error>, DataLoaderError>
  readonly clear: (key: K) => Effect.Effect<void>
  readonly clearAll: () => Effect.Effect<void>
  readonly prime: (key: K, value: V) => Effect.Effect<void>
}

// ============================================================================
// Service Interface
// ============================================================================

export interface DataLoaderService {
  readonly create: <K, V>(
    name: string,
    batchFn: BatchFunction<K, V>,
    options?: DataLoaderOptions
  ) => Effect.Effect<DataLoader<K, V>, never>
  
  readonly createCached: <K, V>(
    name: string,
    batchFn: BatchFunction<K, V>,
    ttl: Duration.Duration
  ) => Effect.Effect<DataLoader<K, V>, never>
}

export const DataLoaderService = Context.GenericTag<DataLoaderService>("@federation/DataLoaderService")

// ============================================================================
// Implementation
// ============================================================================

interface LoadRequest<K, V> {
  readonly key: K
  readonly deferred: Deferred.Deferred<V, DataLoaderError>
}

class DataLoaderImpl<K, V> implements DataLoader<K, V> {
  constructor(
    readonly name: string,
    readonly batchFn: BatchFunction<K, V>,
    readonly options: DataLoaderOptions,
    readonly queue: Queue.Queue<LoadRequest<K, V>>,
    readonly cache: Cache.Cache<string, V> | undefined,
    readonly batchProcessor: Fiber.RuntimeFiber<never, never>
  ) {}
  
  readonly load = (key: K): Effect.Effect<V, DataLoaderError> => {
    const self = this
    return Effect.gen(function* () {
      // Check cache first
      if (self.cache && self.options.cache !== false) {
        const cacheKey = self.options.cacheKeyFn ? self.options.cacheKeyFn(key) : String(key)
        const cached = yield* Effect.option(self.cache.get(cacheKey))
        
        if (Option.isSome(cached)) {
          return cached.value
        }
      }
      
      // Create deferred for result
      const deferred = yield* Deferred.make<V, DataLoaderError>()
      
      // Add to queue
      yield* Queue.offer(self.queue, { key, deferred })
      
      // Wait for result
      return yield* Deferred.await(deferred)
    })
  }
  
  readonly loadMany = (keys: ReadonlyArray<K>): Effect.Effect<ReadonlyArray<V | Error>, DataLoaderError> =>
    Effect.all(keys.map(this.load), { concurrency: "unbounded" })
  
  readonly clear = (key: K): Effect.Effect<void> => {
    const self = this
    return Effect.gen(function* () {
      if (self.cache) {
        const cacheKey = self.options.cacheKeyFn ? self.options.cacheKeyFn(key) : String(key)
        yield* self.cache.invalidate(cacheKey)
      }
    })
  }
  
  readonly clearAll = (): Effect.Effect<void> => {
    const self = this
    return Effect.gen(function* () {
      if (self.cache) {
        yield* self.cache.invalidateAll
      }
    })
  }
  
  readonly prime = (key: K, value: V): Effect.Effect<void> => {
    const self = this
    return Effect.gen(function* () {
      if (self.cache && self.options.cache !== false) {
        const cacheKey = self.options.cacheKeyFn ? self.options.cacheKeyFn(key) : String(key)
        yield* self.cache.set(cacheKey, value)
      }
    })
  }
}

const processBatch = <K, V>(
  name: string,
  batchFn: BatchFunction<K, V>,
  requests: ReadonlyArray<LoadRequest<K, V>>,
  cache: Cache.Cache<string, V> | undefined,
  options: DataLoaderOptions
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const keys = requests.map(r => r.key)
    
    const results = yield* pipe(
      batchFn(keys),
      Effect.catchAll((error) =>
        Effect.succeed(keys.map(() => error))
      )
    )
    
    // Resolve all deferreds
    yield* Effect.all(
      requests.map((request, index) => {
        const result = results[index]
        
        if (result instanceof Error) {
          return Deferred.fail(
            request.deferred,
            new DataLoaderError({
              loader: name,
              key: String(request.key),
              message: result.message,
              cause: result
            })
          )
        }
        
        // Cache successful result
        if (cache && options.cache !== false) {
          const cacheKey = options.cacheKeyFn
            ? options.cacheKeyFn(request.key)
            : String(request.key)
          
          return pipe(
            cache.set(cacheKey, result),
            Effect.flatMap(() => Deferred.succeed(request.deferred, result))
          )
        }
        
        return Deferred.succeed(request.deferred, result)
      }),
      { concurrency: "unbounded" }
    )
  })

const createBatchProcessor = <K, V>(
  name: string,
  batchFn: BatchFunction<K, V>,
  queue: Queue.Queue<LoadRequest<K, V>>,
  cache: Cache.Cache<string, V> | undefined,
  options: DataLoaderOptions
): Effect.Effect<Fiber.RuntimeFiber<never, never>, never> =>
  Effect.gen(function* () {
    const maxBatchSize = options.maxBatchSize || 100
    const batchWindow = options.batchWindow || Duration.millis(10)
    
    const processor = Effect.forever(
      Effect.gen(function* () {
        // Collect batch
        const batch: LoadRequest<K, V>[] = []
        const now = yield* Effect.clock.pipe(
          Effect.flatMap(clock => clock.currentTimeMillis)
        )
        const deadline = now + Duration.toMillis(batchWindow)
        
        // Collect requests until batch is full or window expires
        while (batch.length < maxBatchSize) {
          const now = yield* Effect.clock.pipe(
            Effect.flatMap(clock => clock.currentTimeMillis)
          )
          if (now >= deadline) break
          
          const remaining = deadline - now
          const request = yield* pipe(
            Queue.take(queue),
            Effect.timeout(Duration.millis(remaining)),
            Effect.option
          )
          
          if (request._tag === "Some") {
            batch.push(request.value)
          } else {
            break
          }
        }
        
        // Process batch if not empty
        if (batch.length > 0) {
          yield* processBatch(name, batchFn, batch, cache, options)
        }
      })
    )
    
    return yield* Effect.forkDaemon(processor)
  })

// ============================================================================
// Service Implementation
// ============================================================================

const makeDataLoaderService = Effect.gen(function* () {
  const create = <K, V>(
    name: string,
    batchFn: BatchFunction<K, V>,
    options: DataLoaderOptions = {}
  ): Effect.Effect<DataLoader<K, V>, never> =>
    Effect.gen(function* () {
      // Create queue for requests
      const queue = yield* Queue.unbounded<LoadRequest<K, V>>()
      
      // Create cache if needed
      const cache = options.cache !== false
        ? yield* Cache.make<string, V, never>({
            capacity: 1000,
            timeToLive: Duration.infinity,
            lookup: () => Effect.fail("Not found" as never)
          })
        : undefined
      
      // Start batch processor
      const processor = yield* createBatchProcessor(
        name,
        batchFn,
        queue,
        cache,
        options
      )
      
      return new DataLoaderImpl(
        name,
        batchFn,
        options,
        queue,
        cache,
        processor
      )
    })
  
  const createCached = <K, V>(
    name: string,
    batchFn: BatchFunction<K, V>,
    ttl: Duration.Duration
  ): Effect.Effect<DataLoader<K, V>, never> =>
    create(name, batchFn, {
      cache: true,
      batch: true,
      maxBatchSize: 100,
      batchWindow: Duration.millis(10)
    }).pipe(
      Effect.map(loader => ({
        ...loader,
        load: (key: K) =>
          pipe(
            loader.load(key),
            Effect.tap(() =>
              // Auto-expire cache after TTL
              Effect.sleep(ttl).pipe(
                Effect.flatMap(() => loader.clear(key)),
                Effect.fork
              )
            )
          )
      }))
    )
  
  return {
    create,
    createCached
  } satisfies DataLoaderService
})

// ============================================================================
// Service Layer
// ============================================================================

export const DataLoaderServiceLive = Layer.effect(
  DataLoaderService,
  makeDataLoaderService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const createDataLoader = <K, V>(
  name: string,
  batchFn: BatchFunction<K, V>,
  options?: DataLoaderOptions
) =>
  Effect.gen(function* () {
    const service = yield* DataLoaderService
    return yield* service.create(name, batchFn, options)
  })

export const createCachedDataLoader = <K, V>(
  name: string,
  batchFn: BatchFunction<K, V>,
  ttl: Duration.Duration
) =>
  Effect.gen(function* () {
    const service = yield* DataLoaderService
    return yield* service.createCached(name, batchFn, ttl)
  })