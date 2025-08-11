/**
 * Redis Cache Layer
 * 
 * Distributed caching with Redis for performance optimization
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as Duration from "effect/Duration"
import * as Data from "effect/Data"
import * as Config from "effect/Config"
import * as HashMap from "effect/HashMap"
import * as Ref from "effect/Ref"
import { pipe } from "effect/Function"

// ============================================================================
// Cache Errors
// ============================================================================

export class CacheError extends Data.TaggedError("CacheError")<{
  readonly operation: string
  readonly key?: string
  readonly cause: unknown
}> {}

export class CacheConnectionError extends Data.TaggedError("CacheConnectionError")<{
  readonly host: string
  readonly port: number
  readonly cause: unknown
}> {}

export type CacheErrorType = CacheError | CacheConnectionError

// ============================================================================
// Cache Interface
// ============================================================================

export interface CacheService {
  readonly get: <T>(key: string) => Effect.Effect<Option.Option<T>, CacheError>
  
  readonly set: <T>(
    key: string,
    value: T,
    ttl?: Duration.Duration
  ) => Effect.Effect<void, CacheError>
  
  readonly delete: (key: string) => Effect.Effect<void, CacheError>
  
  readonly exists: (key: string) => Effect.Effect<boolean, CacheError>
  
  readonly expire: (
    key: string,
    ttl: Duration.Duration
  ) => Effect.Effect<void, CacheError>
  
  readonly increment: (
    key: string,
    by?: number
  ) => Effect.Effect<number, CacheError>
  
  readonly flush: () => Effect.Effect<void, CacheError>
  
  readonly keys: (pattern: string) => Effect.Effect<ReadonlyArray<string>, CacheError>
}

export class CacheService extends Context.Tag("CacheService")<
  CacheService,
  CacheService
>() {}

// ============================================================================
// Redis Configuration
// ============================================================================

export interface RedisConfig {
  readonly host: string
  readonly port: number
  readonly password?: string
  readonly database: number
  readonly keyPrefix: string
  readonly defaultTTL: Duration.Duration
  readonly maxRetries: number
  readonly retryDelay: Duration.Duration
}

export class RedisConfig extends Context.Tag("RedisConfig")<
  RedisConfig,
  RedisConfig
>() {
  static readonly live = Layer.effect(
    RedisConfig,
    Effect.gen(function* () {
      const host = yield* Config.string("REDIS_HOST").pipe(
        Config.withDefault("localhost")
      )
      const port = yield* Config.number("REDIS_PORT").pipe(
        Config.withDefault(6379)
      )
      const password = yield* Config.string("REDIS_PASSWORD").pipe(
        Config.optional
      )
      const database = yield* Config.number("REDIS_DATABASE").pipe(
        Config.withDefault(0)
      )
      const keyPrefix = yield* Config.string("REDIS_KEY_PREFIX").pipe(
        Config.withDefault("cqrs:")
      )
      
      return {
        host,
        port,
        password: Option.getOrUndefined(password),
        database,
        keyPrefix,
        defaultTTL: Duration.minutes(5),
        maxRetries: 3,
        retryDelay: Duration.millis(100),
      }
    })
  )
}

// ============================================================================
// Redis Cache Implementation
// ============================================================================

export class RedisCache implements CacheService {
  constructor(
    private readonly client: any, // Would be Redis client in real implementation
    private readonly config: RedisConfig
  ) {}
  
  get<T>(key: string): Effect.Effect<Option.Option<T>, CacheError> {
    const fullKey = this.getFullKey(key)
    
    return Effect.tryPromise({
      try: async () => {
        const value = await this.client.get(fullKey)
        if (value === null) {
          return Option.none<T>()
        }
        return Option.some(JSON.parse(value) as T)
      },
      catch: (error) =>
        new CacheError({
          operation: "get",
          key,
          cause: error,
        }),
    })
  }
  
  set<T>(
    key: string,
    value: T,
    ttl?: Duration.Duration
  ): Effect.Effect<void, CacheError> {
    const fullKey = this.getFullKey(key)
    const ttlSeconds = ttl
      ? Math.floor(Duration.toMillis(ttl) / 1000)
      : Math.floor(Duration.toMillis(this.config.defaultTTL) / 1000)
    
    return Effect.tryPromise({
      try: async () => {
        const serialized = JSON.stringify(value)
        if (ttlSeconds > 0) {
          await this.client.setex(fullKey, ttlSeconds, serialized)
        } else {
          await this.client.set(fullKey, serialized)
        }
      },
      catch: (error) =>
        new CacheError({
          operation: "set",
          key,
          cause: error,
        }),
    })
  }
  
  delete(key: string): Effect.Effect<void, CacheError> {
    const fullKey = this.getFullKey(key)
    
    return Effect.tryPromise({
      try: async () => {
        await this.client.del(fullKey)
      },
      catch: (error) =>
        new CacheError({
          operation: "delete",
          key,
          cause: error,
        }),
    })
  }
  
  exists(key: string): Effect.Effect<boolean, CacheError> {
    const fullKey = this.getFullKey(key)
    
    return Effect.tryPromise({
      try: async () => {
        const result = await this.client.exists(fullKey)
        return result === 1
      },
      catch: (error) =>
        new CacheError({
          operation: "exists",
          key,
          cause: error,
        }),
    })
  }
  
  expire(
    key: string,
    ttl: Duration.Duration
  ): Effect.Effect<void, CacheError> {
    const fullKey = this.getFullKey(key)
    const ttlSeconds = Math.floor(Duration.toMillis(ttl) / 1000)
    
    return Effect.tryPromise({
      try: async () => {
        await this.client.expire(fullKey, ttlSeconds)
      },
      catch: (error) =>
        new CacheError({
          operation: "expire",
          key,
          cause: error,
        }),
    })
  }
  
  increment(
    key: string,
    by: number = 1
  ): Effect.Effect<number, CacheError> {
    const fullKey = this.getFullKey(key)
    
    return Effect.tryPromise({
      try: async () => {
        const result = await this.client.incrby(fullKey, by)
        return result as number
      },
      catch: (error) =>
        new CacheError({
          operation: "increment",
          key,
          cause: error,
        }),
    })
  }
  
  flush(): Effect.Effect<void, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        // In production, might want to only flush keys with prefix
        const pattern = `${this.config.keyPrefix}*`
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(...keys)
        }
      },
      catch: (error) =>
        new CacheError({
          operation: "flush",
          cause: error,
        }),
    })
  }
  
  keys(pattern: string): Effect.Effect<ReadonlyArray<string>, CacheError> {
    const fullPattern = `${this.config.keyPrefix}${pattern}`
    
    return Effect.tryPromise({
      try: async () => {
        const keys = await this.client.keys(fullPattern)
        return keys.map((k: string) => k.slice(this.config.keyPrefix.length))
      },
      catch: (error) =>
        new CacheError({
          operation: "keys",
          cause: error,
        }),
    })
  }
  
  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }
}

// ============================================================================
// In-Memory Cache Implementation (for testing)
// ============================================================================

export class InMemoryCache implements CacheService {
  private readonly store: Ref.Ref<HashMap.HashMap<string, { value: any; expires?: number }>>
  
  constructor() {
    this.store = Ref.unsafeMake(HashMap.empty())
  }
  
  get<T>(key: string): Effect.Effect<Option.Option<T>, CacheError> {
    return Effect.gen(function* () {
      const map = yield* Ref.get(this.store)
      const entry = HashMap.get(map, key)
      
      if (Option.isNone(entry)) {
        return Option.none<T>()
      }
      
      const { value, expires } = Option.getOrThrow(entry)
      
      if (expires && expires < Date.now()) {
        yield* Ref.update(this.store, HashMap.remove(key))
        return Option.none<T>()
      }
      
      return Option.some(value as T)
    }.bind(this))
  }
  
  set<T>(
    key: string,
    value: T,
    ttl?: Duration.Duration
  ): Effect.Effect<void, CacheError> {
    return Ref.update(this.store, (map) => {
      const expires = ttl
        ? Date.now() + Duration.toMillis(ttl)
        : undefined
      
      return HashMap.set(map, key, { value, expires })
    })
  }
  
  delete(key: string): Effect.Effect<void, CacheError> {
    return Ref.update(this.store, HashMap.remove(key))
  }
  
  exists(key: string): Effect.Effect<boolean, CacheError> {
    return pipe(
      Ref.get(this.store),
      Effect.map(HashMap.has(key))
    )
  }
  
  expire(
    key: string,
    ttl: Duration.Duration
  ): Effect.Effect<void, CacheError> {
    return Ref.update(this.store, (map) => {
      const entry = HashMap.get(map, key)
      
      if (Option.isNone(entry)) {
        return map
      }
      
      const { value } = Option.getOrThrow(entry)
      const expires = Date.now() + Duration.toMillis(ttl)
      
      return HashMap.set(map, key, { value, expires })
    })
  }
  
  increment(
    key: string,
    by: number = 1
  ): Effect.Effect<number, CacheError> {
    return Effect.gen(function* () {
      let newValue = by
      
      yield* Ref.update(this.store, (map) => {
        const entry = HashMap.get(map, key)
        
        if (Option.isSome(entry)) {
          const { value, expires } = Option.getOrThrow(entry)
          newValue = (typeof value === "number" ? value : 0) + by
          return HashMap.set(map, key, { value: newValue, expires })
        }
        
        return HashMap.set(map, key, { value: newValue })
      })
      
      return newValue
    }.bind(this))
  }
  
  flush(): Effect.Effect<void, CacheError> {
    return Ref.set(this.store, HashMap.empty())
  }
  
  keys(pattern: string): Effect.Effect<ReadonlyArray<string>, CacheError> {
    return pipe(
      Ref.get(this.store),
      Effect.map((map) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"))
        return Array.from(HashMap.keys(map)).filter((k) => regex.test(k))
      })
    )
  }
}

// ============================================================================
// Cache Patterns
// ============================================================================

/**
 * Cache-aside pattern
 */
export const cacheAside = <T, E>(
  key: string,
  loader: () => Effect.Effect<T, E>,
  ttl?: Duration.Duration
): Effect.Effect<T, E | CacheError, CacheService> =>
  Effect.gen(function* () {
    const cache = yield* CacheService
    
    // Try to get from cache
    const cached = yield* cache.get<T>(key)
    
    if (Option.isSome(cached)) {
      return Option.getOrThrow(cached)
    }
    
    // Load from source
    const value = yield* loader()
    
    // Store in cache
    yield* cache.set(key, value, ttl).pipe(
      Effect.catchAll(() => Effect.succeed(undefined)) // Ignore cache errors
    )
    
    return value
  })

/**
 * Cache invalidation helper
 */
export const invalidatePattern = (
  pattern: string
): Effect.Effect<void, CacheError, CacheService> =>
  Effect.gen(function* () {
    const cache = yield* CacheService
    const keys = yield* cache.keys(pattern)
    
    yield* Effect.all(
      keys.map((key) => cache.delete(key)),
      { concurrency: "unbounded", discard: true }
    )
  })

/**
 * Distributed lock using Redis
 */
export const withDistributedLock = <R, E, A>(
  key: string,
  ttl: Duration.Duration,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | CacheError, R | CacheService> =>
  Effect.gen(function* () {
    const cache = yield* CacheService
    const lockKey = `lock:${key}`
    const lockValue = Math.random().toString(36)
    
    // Try to acquire lock
    const acquired = yield* Effect.retry(
      cache.set(lockKey, lockValue, ttl),
      {
        times: 10,
        schedule: Schedule.exponential(Duration.millis(100)),
      }
    )
    
    try {
      // Execute effect with lock
      return yield* effect
    } finally {
      // Release lock
      yield* cache.delete(lockKey).pipe(
        Effect.catchAll(() => Effect.succeed(undefined))
      )
    }
  })

// ============================================================================
// Service Layers
// ============================================================================

export const RedisCacheLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const config = yield* RedisConfig
    
    // In real implementation, would use redis client
    const client = {
      get: async () => null,
      set: async () => "OK",
      setex: async () => "OK",
      del: async () => 1,
      exists: async () => 0,
      expire: async () => 1,
      incrby: async () => 1,
      keys: async () => [],
    }
    
    return new RedisCache(client, config)
  })
).pipe(Layer.provide(RedisConfig.live))

export const InMemoryCacheLive = Layer.succeed(
  CacheService,
  new InMemoryCache()
)

// ============================================================================
// Cache Monitoring
// ============================================================================

export interface CacheMetrics {
  readonly hits: number
  readonly misses: number
  readonly sets: number
  readonly deletes: number
  readonly hitRate: number
}

export const collectCacheMetrics = (
  cache: CacheService
): Effect.Effect<CacheMetrics, never> =>
  Effect.succeed({
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  })