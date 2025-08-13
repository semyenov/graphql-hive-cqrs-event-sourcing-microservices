/**
 * Resolver Middleware System
 * 
 * Composable middleware for GraphQL resolvers using Effect
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Metric from "effect/Metric"
import * as Data from "effect/Data"
import { GraphQLResolveInfo } from "graphql"
import { pipe } from "effect/Function"
import * as MetricBoundaries from "effect/MetricBoundaries"

// ============================================================================
// Context & Types
// ============================================================================

export interface ResolverContext {
  readonly userId?: string
  readonly traceId: string
  readonly startTime: number
  readonly permissions?: string[]
  readonly cache?: Map<string, any>
}

export const ResolverContextTag = Context.GenericTag<ResolverContext>("@federation/ResolverContext")

export type ResolverMiddleware<A = any, E = never, R = never> = <Args>(
  next: (args: Args) => Effect.Effect<A, E, R>
) => (args: Args) => Effect.Effect<A, E | ResolverMiddlewareError, R | ResolverContext>

// ============================================================================
// Error Types
// ============================================================================

export class ResolverMiddlewareError extends Data.TaggedError("ResolverMiddlewareError")<{
  readonly middleware: string
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Metrics
// ============================================================================

const resolverDuration = Metric.histogram(
  "graphql_resolver_duration",
  MetricBoundaries.exponential({
    start: 1,
    factor: 2,
    count: 10
  })
)

const resolverErrors = Metric.counter("graphql_resolver_errors")
const resolverCacheHits = Metric.counter("graphql_resolver_cache_hits")
const resolverCacheMisses = Metric.counter("graphql_resolver_cache_misses")

// ============================================================================
// Core Middleware
// ============================================================================

/**
 * Timing middleware - measures resolver execution time
 */
export const timingMiddleware: ResolverMiddleware = (next) => (args: any) =>
  Effect.gen(function* () {
    yield* ResolverContextTag
    const startTime = Date.now()
    
    const result = yield* pipe(
      next(args),
      Effect.tap(() => {
        const duration = Date.now() - startTime
        return Metric.update(resolverDuration, duration)
      })
    )
    
    return result
  })

/**
 * Logging middleware - logs resolver calls
 */
export const loggingMiddleware = (
  options: { logLevel?: "debug" | "info" | "warn" | "error" } = {}
): ResolverMiddleware => (next) => (args: any) =>
  Effect.gen(function* () {
    const ctx = yield* ResolverContextTag
    const { info } = args as { info: GraphQLResolveInfo }
    
    yield* Effect.log(
      `Resolver: ${info.parentType.name}.${info.fieldName}`,
      { traceId: ctx.traceId, userId: ctx.userId }
    )
    
    return yield* pipe(
      next(args),
      Effect.tapBoth({
        onFailure: (error) =>
          Effect.log(
            `Resolver failed: ${info.parentType.name}.${info.fieldName}`,
            { error, traceId: ctx.traceId }
          ),
        onSuccess: () =>
          options.logLevel === "debug"
            ? Effect.log(
                `Resolver succeeded: ${info.parentType.name}.${info.fieldName}`,
                { traceId: ctx.traceId }
              )
            : Effect.succeed(undefined)
      })
    )
  })

/**
 * Caching middleware - caches resolver results
 */
export const cachingMiddleware = (
  options: {
    ttl?: Duration.Duration
    keyGenerator?: (args: any) => string
  } = {}
): ResolverMiddleware => (next) => (args: any) =>
  Effect.gen(function* () {
    const ctx = yield* ResolverContextTag
    const { info } = args as { info: GraphQLResolveInfo }
    
    if (!ctx.cache) {
      return yield* next(args)
    }
    
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(args)
      : `${info.parentType.name}.${info.fieldName}:${JSON.stringify(args.args)}`
    
    // Check cache
    const cached = ctx.cache.get(cacheKey)
    if (cached) {
      yield* Metric.increment(resolverCacheHits)
      return cached
    }
    
    yield* Metric.increment(resolverCacheMisses)
    
    // Execute and cache
    const result = yield* next(args)
    ctx.cache.set(cacheKey, result)
    
    // Set TTL if specified
    if (options.ttl) {
      setTimeout(
        () => ctx.cache?.delete(cacheKey),
        Duration.toMillis(options.ttl)
      )
    }
    
    return result
  })

/**
 * Authorization middleware - checks permissions
 */
export const authorizationMiddleware = (
  requiredPermission: string
): ResolverMiddleware => (next) => (args: any) =>
  Effect.gen(function* () {
    const ctx = yield* ResolverContextTag
    
    if (!ctx.userId) {
      return yield* Effect.fail(
        new ResolverMiddlewareError({
          middleware: "authorization",
          message: "Unauthorized: No user context"
        })
      )
    }
    
    if (!ctx.permissions?.includes(requiredPermission)) {
      return yield* Effect.fail(
        new ResolverMiddlewareError({
          middleware: "authorization",
          message: `Forbidden: Missing permission ${requiredPermission}`
        })
      )
    }
    
    return yield* next(args)
  })

/**
 * Error handling middleware - standardizes error responses
 */
export const errorHandlingMiddleware: ResolverMiddleware = (next) => (args: any) =>
  pipe(
    next(args),
    Effect.catchAll((error) => {
      const { info } = args as { info: GraphQLResolveInfo }
      
      return pipe(
        Metric.increment(resolverErrors),
        Effect.flatMap(() =>
          Effect.fail(
            new ResolverMiddlewareError({
              middleware: "errorHandling",
              message: `Error in ${info.parentType.name}.${info.fieldName}`,
              cause: error
            })
          )
        )
      )
    })
  )

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = (
  options: {
    maxRequests: number
    window: Duration.Duration
  }
): ResolverMiddleware => {
  const requests = new Map<string, number[]>()
  
  return (next) => (args: any) =>
    Effect.gen(function* () {
      const ctx = yield* ResolverContextTag
      const now = Date.now()
      const windowMs = Duration.toMillis(options.window)
      
      const key = ctx.userId || ctx.traceId
      const userRequests = requests.get(key) || []
      
      // Remove old requests outside window
      const validRequests = userRequests.filter(
        (time) => now - time < windowMs
      )
      
      if (validRequests.length >= options.maxRequests) {
        return yield* Effect.fail(
          new ResolverMiddlewareError({
            middleware: "rateLimit",
            message: "Rate limit exceeded"
          })
        )
      }
      
      validRequests.push(now)
      requests.set(key, validRequests)
      
      return yield* next(args)
    })
}

// ============================================================================
// Middleware Composition
// ============================================================================

/**
 * Compose multiple middleware into a single middleware
 */
export const composeMiddleware = (
  ...middlewares: ResolverMiddleware[]
): ResolverMiddleware => {
  return (next) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      next
    )
  }
}

/**
 * Apply middleware to a resolver function
 */
export const applyMiddleware = <A, E, R>(
  resolver: (args: any) => Effect.Effect<A, E, R>,
  middleware: ResolverMiddleware<A, E, R>
): ((args: any) => Effect.Effect<A, E | ResolverMiddlewareError, R | ResolverContext>) => {
  return middleware(resolver)
}

// ============================================================================
// Preset Middleware Stacks
// ============================================================================

/**
 * Development middleware stack
 */
export const developmentMiddleware = composeMiddleware(
  errorHandlingMiddleware,
  timingMiddleware,
  loggingMiddleware({ logLevel: "debug" })
)

/**
 * Production middleware stack
 */
export const productionMiddleware = composeMiddleware(
  errorHandlingMiddleware,
  timingMiddleware,
  loggingMiddleware({ logLevel: "error" }),
  cachingMiddleware({ ttl: Duration.minutes(5) }),
  rateLimitMiddleware({
    maxRequests: 100,
    window: Duration.minutes(1)
  })
)

/**
 * Authenticated middleware stack
 */
export const authenticatedMiddleware = (permission?: string) =>
  composeMiddleware(
    errorHandlingMiddleware,
    timingMiddleware,
    permission
      ? authorizationMiddleware(permission)
      : (next) => next,
    loggingMiddleware({ logLevel: "info" })
  )