/**
 * Query Handler - Application layer query processing
 * 
 * Using Effect for dependency injection and caching
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import { pipe } from "effect/Function"
import type { Query } from "../schema/core/messages"
import type { ReadModelStore } from "./projection"

// ============================================================================
// Query Handler Errors
// ============================================================================

export class QueryValidationError extends Data.TaggedError("QueryValidationError")<{
  readonly query: Query
  readonly errors: ReadonlyArray<string>
}> {}

export class QueryExecutionError extends Data.TaggedError("QueryExecutionError")<{
  readonly query: Query
  readonly cause: unknown
}> {}

export class QueryTimeoutError extends Data.TaggedError("QueryTimeoutError")<{
  readonly query: Query
  readonly duration: Duration.Duration
}> {}

export class QueryNotFoundError extends Data.TaggedError("QueryNotFoundError")<{
  readonly queryType: string
}> {}

export type QueryError =
  | QueryValidationError
  | QueryExecutionError
  | QueryTimeoutError
  | QueryNotFoundError

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  readonly items: ReadonlyArray<T>
  readonly total: number
  readonly offset: number
  readonly limit: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean
}

/**
 * Query result with metadata
 */
export interface QueryResult<T> {
  readonly data: T
  readonly metadata: {
    readonly executionTime: number
    readonly cached: boolean
    readonly timestamp: Date
  }
}

// ============================================================================
// Query Handler Interface
// ============================================================================

/**
 * Query handler configuration
 */
export interface QueryHandlerConfig<Q extends Query, R> {
  readonly queryType: Q["type"]
  readonly validate?: (query: Q) => Effect.Effect<void, QueryValidationError>
  readonly execute: (query: Q) => Effect.Effect<R, QueryError>
  readonly cache?: {
    readonly key: (query: Q) => string
    readonly ttl: Duration.Duration
  }
  readonly timeout?: Duration.Duration
}

/**
 * Query handler implementation
 */
export class QueryHandler<Q extends Query, R> {
  constructor(readonly config: QueryHandlerConfig<Q, R>) {}
  
  /**
   * Handle query
   */
  handle(query: Q): Effect.Effect<QueryResult<R>, QueryError> {
    const config = this.config
    const self = this
    
    return Effect.gen(function* () {
      const startTime = Date.now()
      
      // Validate query
      if (config.validate) {
        yield* config.validate(query)
      }
      
      // Execute query (caching would be handled externally)
      const data = yield* self.executeQuery(query)
      
      const executionTime = Date.now() - startTime
      
      return {
        data,
        metadata: {
          executionTime,
          cached: false,
          timestamp: new Date(),
        },
      }
    })
  }
  
  /**
   * Execute query
   */
  private executeQuery(query: Q): Effect.Effect<R, QueryError> {
    let effect = this.config.execute(query)
    
    // Add timeout if configured
    if (this.config.timeout) {
      effect = pipe(
        effect,
        Effect.timeoutFail({
          duration: this.config.timeout,
          onTimeout: () =>
            new QueryTimeoutError({
              query,
              duration: this.config.timeout!,
            }),
        })
      )
    }
    
    return effect
  }
  
  /**
   * Invalidate cache
   */
  invalidateCache(): Effect.Effect<void, never> {
    // Cache invalidation would be handled externally
    return Effect.succeed(undefined)
  }
}

// ============================================================================
// Query Bus
// ============================================================================

/**
 * Query bus for routing queries to handlers
 */
export interface QueryBus {
  readonly execute: <Q extends Query, R>(
    query: Q
  ) => Effect.Effect<QueryResult<R>, QueryError>
  
  readonly register: <Q extends Query, R>(
    handler: QueryHandler<Q, R>
  ) => Effect.Effect<void, never>
}

export class QueryBus extends Context.Tag("QueryBus")<QueryBus, QueryBus>() {}

/**
 * In-memory query bus implementation
 */
export class InMemoryQueryBus {
  private readonly handlers = new Map<string, QueryHandler<any, any>>()
  
  execute<Q extends Query, R>(
    query: Q
  ): Effect.Effect<QueryResult<R>, QueryError> {
    const handlers = this.handlers
    
    return Effect.gen(function* () {
      const handler = handlers.get(query.type)
      
      if (!handler) {
        return yield* Effect.fail(
          new QueryNotFoundError({ queryType: query.type })
        )
      }
      
      return yield* handler.handle(query)
    })
  }
  
  register<Q extends Query, R>(
    handler: QueryHandler<Q, R>
  ): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.handlers.set(handler.config.queryType, handler)
    })
  }
}

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Builder for creating query handlers
 */
export class QueryHandlerBuilder<Q extends Query, R> {
  private config: QueryHandlerConfig<Q, R>
  
  constructor() {
    this.config = {} as QueryHandlerConfig<Q, R>
  }
  
  forQuery(queryType: Q["type"]): this {
    this.config = { ...this.config, queryType }
    return this
  }
  
  withValidation(
    validate: (query: Q) => Effect.Effect<void, QueryValidationError>
  ): this {
    this.config = { ...this.config, validate }
    return this
  }
  
  withExecution(
    execute: (query: Q) => Effect.Effect<R, QueryError>
  ): this {
    this.config = { ...this.config, execute }
    return this
  }
  
  withCache(key: (query: Q) => string, ttl: Duration.Duration): this {
    this.config = { ...this.config, cache: { key, ttl } }
    return this
  }
  
  withTimeout(duration: Duration.Duration): this {
    this.config = { ...this.config, timeout: duration }
    return this
  }
  
  build(): QueryHandler<Q, R> {
    if (!this.config.queryType) {
      throw new Error("Query type is required")
    }
    if (!this.config.execute) {
      throw new Error("Query execution is required")
    }
    
    return new QueryHandler(this.config as QueryHandlerConfig<Q, R>)
  }
}

// ============================================================================
// Common Query Patterns
// ============================================================================

/**
 * Get by ID query handler
 */
export const getByIdQueryHandler = <T>(
  queryType: string,
  store: ReadModelStore<T>,
  getId: (query: Query) => string
) =>
  new QueryHandlerBuilder<Query, Option.Option<T>>()
    .forQuery(queryType)
    .withExecution((query) => 
      pipe(
        store.get(getId(query)),
        Effect.mapError(() => new QueryExecutionError({ query, cause: "Not found" }))
      )
    )
    .withCache(getId, Duration.minutes(5))
    .build()

/**
 * List query handler with pagination
 */
export const listQueryHandler = <T>(
  queryType: string,
  store: ReadModelStore<T>,
  filter?: (item: T, query: Query) => boolean
) =>
  new QueryHandlerBuilder<Query, PaginatedResult<T>>()
    .forQuery(queryType)
    .withExecution((query) =>
      pipe(
        store.getAll(),
        Effect.map((items) => {
          const filtered = filter ? items.filter((item) => filter(item, query)) : items
          
          const metadata = query.metadata.pagination ?? { offset: 0, limit: 20 }
          const paginatedItems = filtered.slice(
            metadata.offset,
            metadata.offset + metadata.limit
          )
          
          return {
            items: paginatedItems,
            total: filtered.length,
            offset: metadata.offset,
            limit: metadata.limit,
            hasNext: metadata.offset + metadata.limit < filtered.length,
            hasPrevious: metadata.offset > 0,
          }
        }),
        Effect.mapError(() => new QueryExecutionError({ query, cause: "List failed" }))
      )
    )
    .build()

/**
 * Search query handler
 */
export const searchQueryHandler = <T>(
  queryType: string,
  store: ReadModelStore<T>,
  search: (query: string, items: ReadonlyArray<T>) => ReadonlyArray<T>
) =>
  new QueryHandlerBuilder<Query<string, { query: string }>, ReadonlyArray<T>>()
    .forQuery(queryType)
    .withExecution((query) =>
      pipe(
        store.getAll(),
        Effect.map((items) => search(query.payload.query, items)),
        Effect.mapError(() => new QueryExecutionError({ query, cause: "Search failed" }))
      )
    )
    .withCache((q) => q.payload.query, Duration.minutes(1))
    .build()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create query handler builder
 */
export const queryHandler = <Q extends Query, R>() =>
  new QueryHandlerBuilder<Q, R>()

/**
 * Execute query with retry
 */
export const executeWithRetry = <Q extends Query, R>(
  handler: QueryHandler<Q, R>,
  query: Q,
  maxRetries: number = 3
): Effect.Effect<QueryResult<R>, QueryError> =>
  pipe(
    handler.handle(query),
    Effect.retry({
      times: maxRetries,
      schedule: Schedule.exponential(Duration.millis(100)),
    })
  )

/**
 * Execute multiple queries in parallel
 */
export const executeParallel = <Q extends Query, R>(
  handlers: ReadonlyArray<[QueryHandler<Q, R>, Q]>
): Effect.Effect<ReadonlyArray<QueryResult<R>>, QueryError> =>
  Effect.all(
    handlers.map(([handler, query]) => handler.handle(query)),
    { concurrency: "unbounded" }
  )

/**
 * Create cached query handler
 */
export const cachedQuery = <Q extends Query, R>(
  handler: QueryHandler<Q, R>,
  _cacheKey: (query: Q) => string,
  _ttl: Duration.Duration
): QueryHandler<Q, R> => {
  // Simplified - would need proper cache implementation
  return handler
}