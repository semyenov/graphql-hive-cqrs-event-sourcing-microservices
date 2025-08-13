/**
 * ResolverService - Effect-based GraphQL resolver management
 * 
 * Provides resolver composition, batching, error handling,
 * and middleware support using Effect patterns
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Data from "effect/Data"
import * as Cache from "effect/Cache"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import {
  GraphQLResolveInfo,
  GraphQLFieldResolver
} from "graphql"

// ============================================================================
// Error Types
// ============================================================================

export class ResolverError extends Data.TaggedError("ResolverError")<{
  readonly field: string
  readonly type: string
  readonly reason: "NotFound" | "Unauthorized" | "ValidationFailed" | "ExecutionFailed"
  readonly message: string
  readonly cause?: unknown
}> {}

export class BatchingError extends Data.TaggedError("BatchingError")<{
  readonly keys: ReadonlyArray<string>
  readonly message: string
  readonly cause?: unknown
}> {}

export class MiddlewareError extends ResolverError {
  constructor(
    readonly field: string,
    readonly type: string,
    readonly reason: "ExecutionFailed",
    readonly message: string,
    readonly cause?: unknown
  ) {
    super({
      field,
      type,
      reason: "ExecutionFailed",
      message,
      cause: cause
    })
  }
}

// ============================================================================
// Types
// ============================================================================

export type ResolverFn<TSource = any, TContext = any, TArgs = any, TResult = any> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Effect.Effect<TResult, ResolverError>

export type MiddlewareFn<TContext = any> = <TSource, TArgs, TResult>(
  resolver: ResolverFn<TSource, TContext, TArgs, TResult>,
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Effect.Effect<TResult, ResolverError | MiddlewareError>

export interface ResolverConfig {
  readonly timeout?: Duration.Duration
  readonly retries?: number
  readonly cache?: CacheConfig
  readonly middleware?: ReadonlyArray<MiddlewareFn>
  readonly errorHandler?: (error: unknown) => ResolverError
}

export interface CacheConfig {
  readonly ttl: Duration.Duration
  readonly capacity: number
  readonly strategy?: "LRU" | "LFU" | "FIFO"
}

export interface BatchConfig<_K, _V> {
  readonly maxBatchSize: number
  readonly window: Duration.Duration
  readonly cache?: CacheConfig
}

export interface ResolverMap {
  readonly [typeName: string]: {
    readonly [fieldName: string]: ResolverFn
  }
}

// ============================================================================
// Service Interface
// ============================================================================

export interface ResolverService {
  readonly createResolver: <TSource, TContext, TArgs, TResult>(
    fn: ResolverFn<TSource, TContext, TArgs, TResult>,
    config?: ResolverConfig
  ) => GraphQLFieldResolver<TSource, TContext, TArgs>
  
  readonly createBatchResolver: <K, V>(
    batchFn: (keys: ReadonlyArray<K>) => Effect.Effect<ReadonlyArray<V>, BatchingError>,
    config?: BatchConfig<K, V>
  ) => (key: K) => Effect.Effect<V, BatchingError>
  
  readonly applyMiddleware: <TContext>(
    resolver: ResolverFn,
    middleware: ReadonlyArray<MiddlewareFn<TContext>>
  ) => ResolverFn
  
  readonly wrapResolvers: (
    resolvers: ResolverMap,
    config?: ResolverConfig
  ) => Record<string, Record<string, GraphQLFieldResolver<any, any>>>
  
  readonly createDataLoader: <K, V>(
    batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V>>,
    config?: BatchConfig<K, V>
  ) => {
    readonly load: (key: K) => Effect.Effect<V, BatchingError>
    readonly loadMany: (keys: ReadonlyArray<K>) => Effect.Effect<ReadonlyArray<V>, BatchingError>
    readonly clear: (key: K) => Effect.Effect<void>
    readonly clearAll: () => Effect.Effect<void>
  }
}

export const ResolverService = Context.GenericTag<ResolverService>("@federation/ResolverService")

// ============================================================================
// Middleware Implementations
// ============================================================================

export const loggingMiddleware: MiddlewareFn = (resolver, source, args, context, info) =>
  Effect.gen(function* () {
    const startTime = Date.now()
    
    yield* Effect.log(`Resolving ${info.parentType.name}.${info.fieldName}`)
    
    const result = yield* resolver(source, args, context, info).pipe(
      Effect.tapBoth({
        onFailure: (error) =>
          Effect.log(`Failed ${info.parentType.name}.${info.fieldName}: ${error.message}`),
        onSuccess: () =>
          Effect.log(`Resolved ${info.parentType.name}.${info.fieldName} in ${Date.now() - startTime}ms`)
      })
    )
    
    return result
  })

export const authMiddleware = (requiredRole?: string): MiddlewareFn =>
  (resolver, source, args, context, info) =>
    Effect.gen(function* () {
      // Check authentication
      if (!context.user) {
        return yield* Effect.fail(
          new ResolverError({
            field: info.fieldName,
            type: info.parentType.name,
            reason: "Unauthorized",
            message: "Authentication required"
          })
        )
      }
      
      // Check authorization
      if (requiredRole && context.user.role !== requiredRole) {
        return yield* Effect.fail(
          new ResolverError({
            field: info.fieldName,
            type: info.parentType.name,
            reason: "Unauthorized",
            message: `Role ${requiredRole} required`
          })
        )
      }
      
      return yield* resolver(source, args, context, info)
    })

export const cachingMiddleware = (ttl: Duration.Duration): MiddlewareFn =>
  (resolver, source, args, context, info) =>
    Effect.gen(function* () {
      const cacheKey = `${info.parentType.name}.${info.fieldName}:${JSON.stringify(args)}`
      
      // Try to get from cache
      const cache = yield* Cache.make({
        capacity: 100,
        timeToLive: ttl,
        lookup: () => resolver(source, args, context, info)
      })
      
      return yield* cache.get(cacheKey)
    })

// ============================================================================
// Service Implementation
// ============================================================================

const makeResolverService = Effect.gen(function* () {
  // Create a resolver with Effect support
  const createResolver = <TSource, TContext, TArgs, TResult>(
    fn: ResolverFn<TSource, TContext, TArgs, TResult>,
    config: ResolverConfig = {}
  ): GraphQLFieldResolver<TSource, TContext, TArgs> => {
    return async (source, args, context, info) => {
      const effect = pipe(
        fn(source, args, context, info),
        // Apply timeout
        config.timeout ? Effect.timeout(config.timeout) : (x) => x,
        // Apply retries
        config.retries ? Effect.retry({ times: config.retries }) : (x) => x,
        // Handle errors
        Effect.catchAll((error) => {
          if (config.errorHandler) {
            return Effect.fail(config.errorHandler(error))
          }
          return Effect.fail(error)
        })
      )
      
      // Convert to Promise for GraphQL
      return Effect.runPromise(effect).catch((error) => {
        throw new Error(error.message || "Resolver execution failed")
      })
    }
  }

  // Create a batch resolver with DataLoader-like functionality
  const createBatchResolver = <K, V>(
    batchFn: (keys: ReadonlyArray<K>) => Effect.Effect<ReadonlyArray<V>, BatchingError>,
    config: BatchConfig<K, V> = {
      maxBatchSize: 100,
      window: Duration.millis(10)
    }
  ) => {
    const pending = new Map<K, {
      resolve: (value: V) => void
      reject: (error: unknown) => void
    }>()
    let timeout: NodeJS.Timeout | null = null
    
    const flush = () => {
      if (pending.size === 0) return
      
      const keys = Array.from(pending.keys())
      const promises = Array.from(pending.values())
      pending.clear()
      
      Effect.runPromise(batchFn(keys))
        .then((values) => {
          values.forEach((value, index) => {
            promises[index].resolve(value)
          })
        })
        .catch((error) => {
          promises.forEach((promise) => {
            promise.reject(error)
          })
        })
    }
    
    return (key: K): Effect.Effect<V, BatchingError> =>
      Effect.async<V, BatchingError>((resume) => {
        pending.set(key, {
          resolve: (value) => resume(Effect.succeed(value)),
          reject: (error) => resume(Effect.fail(
            new BatchingError({
              keys: [String(key)],
              message: "Batch execution failed",
              cause: error
            })
          ))
        })
        
        if (pending.size >= config.maxBatchSize) {
          flush()
        } else if (!timeout) {
          timeout = setTimeout(() => {
            timeout = null
            flush()
          }, Duration.toMillis(config.window))
        }
      })
  }

  // Apply middleware to a resolver
  const applyMiddleware = <TContext>(
    resolver: ResolverFn,
    middleware: ReadonlyArray<MiddlewareFn<TContext>>
  ): ResolverFn => {
    return middleware.reduceRight(
      (acc, mw) => (source, args, context, info) =>
        mw(acc, source, args, context, info),
      resolver
    )
  }

  // Wrap all resolvers with Effect support
  const wrapResolvers = (
    resolvers: ResolverMap,
    config: ResolverConfig = {}
  ): Record<string, Record<string, GraphQLFieldResolver<any, any>>> => {
    const wrapped: Record<string, Record<string, GraphQLFieldResolver<any, any>>> = {}
    
    Object.entries(resolvers).forEach(([typeName, typeResolvers]) => {
      wrapped[typeName] = {}
      Object.entries(typeResolvers).forEach(([fieldName, resolver]) => {
        const withMiddleware = config.middleware
          ? applyMiddleware(resolver, config.middleware)
          : resolver
        wrapped[typeName][fieldName] = createResolver(withMiddleware, config)
      })
    })
    
    return wrapped
  }

  // Create a DataLoader-compatible interface
  const createDataLoader = <K, V>(
    batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V>>,
    config: BatchConfig<K, V> = {
      maxBatchSize: 100,
      window: Duration.millis(10)
    }
  ) => {
    const effectBatchFn = (keys: ReadonlyArray<K>) =>
      Effect.tryPromise({
        try: () => batchFn(keys),
        catch: (error) => new BatchingError({
          keys: keys.map(String),
          message: "Batch function failed",
          cause: error
        })
      })
    
    const loader = createBatchResolver(effectBatchFn, config)
    const cache = new Map<K, Effect.Effect<V, BatchingError>>()
    
    return {
      load: (key: K) => {
        if (!cache.has(key)) {
          cache.set(key, loader(key))
        }
        return cache.get(key)!
      },
      loadMany: (keys: ReadonlyArray<K>) =>
        Effect.all(keys.map((key) => {
          if (!cache.has(key)) {
            cache.set(key, loader(key))
          }
          return cache.get(key)!
        })),
      clear: (key: K) => Effect.sync(() => { cache.delete(key) }),
      clearAll: () => Effect.sync(() => { cache.clear() })
    }
  }

  return {
    createResolver,
    createBatchResolver,
    applyMiddleware,
    wrapResolvers,
    createDataLoader
  } satisfies ResolverService
})

// ============================================================================
// Service Layer
// ============================================================================

export const ResolverServiceLive = Layer.effect(
  ResolverService,
  makeResolverService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const resolver = <TSource, TContext, TArgs, TResult>(
  fn: (
    source: TSource,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
  ) => TResult | Promise<TResult>
): ResolverFn<TSource, TContext, TArgs, TResult> =>
  (source, args, context, info) =>
    Effect.tryPromise({
      try: () => Promise.resolve(fn(source, args, context, info)),
      catch: (error) => new ResolverError({
        field: info.fieldName,
        type: info.parentType.name,
        reason: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Unknown error",
        cause: error
      })
    })

export const resolverPure = <TSource, TContext, TArgs, TResult>(
  fn: (source: TSource, args: TArgs, context: TContext, info: GraphQLResolveInfo) => TResult
): ResolverFn<TSource, TContext, TArgs, TResult> =>
  (source, args, context, info) =>
    Effect.try({
      try: () => fn(source, args, context, info),
      catch: (error) => new ResolverError({
        field: info.fieldName,
        type: info.parentType.name,
        reason: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Unknown error",
        cause: error
      })
    })

// ============================================================================
// Resolver Combinators
// ============================================================================

export const withAuth = <TContext extends { user?: any }>(
  resolver: ResolverFn<any, TContext, any, any>,
  requiredRole?: string
): ResolverFn<any, TContext, any, any> =>
  authMiddleware(requiredRole)(resolver, undefined as any, undefined as any, undefined as any, undefined as any) as any

export const withCache = <T>(
  resolver: ResolverFn<any, any, any, T>,
  ttl: Duration.Duration
): ResolverFn<any, any, any, T> =>
  cachingMiddleware(ttl)(resolver, undefined as any, undefined as any, undefined as any, undefined as any) as any

export const withLogging = <T>(
  resolver: ResolverFn<any, any, any, T>
): ResolverFn<any, any, any, T> =>
  loggingMiddleware(resolver, undefined as any, undefined as any, undefined as any, undefined as any) as any