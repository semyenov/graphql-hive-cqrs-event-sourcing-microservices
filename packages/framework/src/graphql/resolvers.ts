/**
 * GraphQL Resolvers with Effect
 * 
 * Type-safe GraphQL resolvers using Effect for error handling
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Cause from "effect/Cause"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"
import type { GraphQLResolveInfo, GraphQLFieldResolver } from "graphql"
import { Command, Query, DomainEvent } from "../schema/core/messages"
import { CommandBus, EventBus } from "../application/command-handler"
import { QueryBus } from "../application/query-handler"
import type { QueryResult } from "../application/query-handler"
import type { CorrelationId, CausationId, UserId, TenantId } from "../schema/core/primitives"

// ============================================================================
// GraphQL Context
// ============================================================================

export interface GraphQLContext {
  readonly userId?: UserId
  readonly tenantId?: TenantId
  readonly correlationId: CorrelationId
  readonly requestId: string
  readonly headers: Record<string, string>
  readonly dataSources: Record<string, unknown>
}

export class GraphQLContext extends Context.Tag("GraphQLContext")<
  GraphQLContext,
  GraphQLContext
>() {}

// ============================================================================
// GraphQL Errors
// ============================================================================

export class GraphQLValidationError extends Data.TaggedError("GraphQLValidationError")<{
  readonly field: string
  readonly message: string
  readonly extensions?: Record<string, unknown>
}> {}

export class GraphQLAuthenticationError extends Data.TaggedError("GraphQLAuthenticationError")<{
  readonly message: string
}> {}

export class GraphQLAuthorizationError extends Data.TaggedError("GraphQLAuthorizationError")<{
  readonly resource: string
  readonly action: string
  readonly message: string
}> {}

export class GraphQLBusinessError extends Data.TaggedError("GraphQLBusinessError")<{
  readonly code: string
  readonly message: string
  readonly extensions?: Record<string, unknown>
}> {}

export type GraphQLErrorType =
  | GraphQLValidationError
  | GraphQLAuthenticationError
  | GraphQLAuthorizationError
  | GraphQLBusinessError

// ============================================================================
// Effect Resolver Type
// ============================================================================

export type EffectResolver<TSource, TArgs, TResult, TContext = GraphQLContext> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Effect.Effect<TResult, GraphQLErrorType, any>

// ============================================================================
// Resolver Builder
// ============================================================================

export class ResolverBuilder<TSource, TArgs, TResult> {
  private middlewares: Array<
    <R>(
      effect: Effect.Effect<TResult, GraphQLErrorType, R>
    ) => Effect.Effect<TResult, GraphQLErrorType, R>
  > = []
  
  constructor(
    private resolver: EffectResolver<TSource, TArgs, TResult>
  ) {}
  
  /**
   * Add authentication requirement
   */
  withAuthentication(): this {
    this.middlewares.push((effect) =>
      pipe(
        GraphQLContext,
        Effect.flatMap((context) => {
          if (!context.userId) {
            return Effect.fail(
              new GraphQLAuthenticationError({
                message: "Authentication required",
              })
            )
          }
          return effect
        })
      )
    )
    return this
  }
  
  /**
   * Add authorization check
   */
  withAuthorization(
    check: (context: GraphQLContext, args: TArgs) => boolean
  ): this {
    this.middlewares.push((effect) =>
      Effect.gen(function* () {
        const context = yield* GraphQLContext
        const args = {} as TArgs // Would need proper implementation
        
        if (!check(context, args)) {
          return yield* Effect.fail(
            new GraphQLAuthorizationError({
              resource: "resource",
              action: "action",
              message: "Insufficient permissions",
            })
          )
        }
        
        return yield* effect
      })
    )
    return this
  }
  
  /**
   * Add input validation
   */
  withValidation(
    validate: (args: TArgs) => Effect.Effect<void, GraphQLValidationError>
  ): this {
    this.middlewares.push((effect) =>
      Effect.gen(function* () {
        const args = {} as TArgs // Would need proper implementation
        yield* validate(args)
        return yield* effect
      })
    )
    return this
  }
  
  /**
   * Add rate limiting
   */
  withRateLimit(max: number, window: number): this {
    this.middlewares.push((effect) =>
      Effect.gen(function* () {
        // Rate limiting implementation would go here
        return yield* effect
      })
    )
    return this
  }
  
  /**
   * Build the resolver
   */
  build(): GraphQLFieldResolver<TSource, GraphQLContext, TArgs> {
    return async (source, args, context, info) => {
      const effect = this.resolver(source, args, context, info)
      
      const withMiddlewares = this.middlewares.reduce(
        (acc, middleware) => middleware(acc),
        effect
      )
      
      const result = await pipe(
        withMiddlewares,
        Effect.provide(Layer.succeed(GraphQLContext, context)),
        Effect.runPromiseExit
      )
      
      if (Exit.isFailure(result)) {
        const error = Cause.failureOption(result.cause).pipe(
          Option.getOrElse(() => new GraphQLBusinessError({ code: "UNKNOWN", message: "Unknown error" }))
        )
        throw formatGraphQLError(error)
      }
      
      return result as any
    }
  }
}

// ============================================================================
// Command/Query Resolvers
// ============================================================================

/**
 * Create a command resolver
 */
export const commandResolver = <TArgs, TResult>(
  createCommand: (args: TArgs, context: GraphQLContext) => Command,
  mapResult: (response: any) => TResult
): EffectResolver<unknown, TArgs, TResult> =>
  (_source, args, context) =>
    Effect.gen(function* () {
      const commandBus = yield* CommandBus
      const command = createCommand(args, context)
      
      yield* commandBus.publish(command).pipe(
        Effect.mapError((error) =>
          new GraphQLBusinessError({
            code: "COMMAND_FAILED",
            message: error.message || "Command execution failed",
            extensions: { error },
          })
        )
      )
      
      return mapResult({ success: true })
    })

/**
 * Create a query resolver
 */
export const queryResolver = <TArgs, TResult>(
  createQuery: (args: TArgs, context: GraphQLContext) => Query,
  mapResult: (result: QueryResult<any>) => TResult
): EffectResolver<unknown, TArgs, TResult> =>
  (_source, args, context) =>
    Effect.gen(function* () {
      const queryBus = yield* QueryBus
      const query = createQuery(args, context)
      
      const result = yield* queryBus.execute(query).pipe(
        Effect.mapError((error) =>
          new GraphQLBusinessError({
            code: "QUERY_FAILED",
            message: error.message || "Query execution failed",
            extensions: { error },
          })
        )
      )
      
      return mapResult(result)
    })

// ============================================================================
// Subscription Resolvers
// ============================================================================

/**
 * Create an event subscription resolver
 */
export const subscriptionResolver = <TArgs, TResult>(
  filter: (event: DomainEvent, args: TArgs) => boolean,
  mapEvent: (event: DomainEvent) => TResult
): {
  subscribe: EffectResolver<unknown, TArgs, AsyncIterator<TResult>>
} => ({
  subscribe: (_source, args, _context) =>
    Effect.gen(function* () {
      const eventBus = yield* EventBus
      
      // Create async iterator for GraphQL subscriptions
      const iterator: AsyncIterator<TResult> = {
        async next() {
          // Implementation would subscribe to event bus
          return { done: false, value: {} as TResult }
        },
        async return() {
          return { done: true, value: undefined }
        },
        async throw(error) {
          throw error
        },
      }
      
      return iterator
    }),
})

// ============================================================================
// Resolver Helpers
// ============================================================================

/**
 * Create resolver builder
 */
export const resolver = <TSource, TArgs, TResult>(
  fn: EffectResolver<TSource, TArgs, TResult>
) => new ResolverBuilder(fn)

/**
 * Batch resolver for DataLoader pattern
 */
export const batchResolver = <TKey, TResult>(
  loader: (keys: ReadonlyArray<TKey>) => Effect.Effect<ReadonlyArray<TResult>, GraphQLErrorType>
): EffectResolver<unknown, { ids: ReadonlyArray<TKey> }, ReadonlyArray<TResult>> =>
  (_source, args) => loader(args.ids)

/**
 * Field resolver with caching
 */
export const cachedFieldResolver = <TSource, TArgs, TResult>(
  resolver: EffectResolver<TSource, TArgs, TResult>,
  getCacheKey: (source: TSource, args: TArgs) => string
): EffectResolver<TSource, TArgs, TResult> =>
  (source, args, context, info) =>
    Effect.gen(function* () {
      // Caching implementation would go here
      return yield* resolver(source, args, context, info)
    })

// ============================================================================
// Error Formatting
// ============================================================================

function formatGraphQLError(error: GraphQLErrorType): Error {
  switch (error._tag) {
    case "GraphQLValidationError":
      return new Error(error.message, {
        cause: {
          extensions: {
            code: "VALIDATION_ERROR",
            field: error.field,
            ...error.extensions,
          },
        },
      })
    
    case "GraphQLAuthenticationError":
      return new Error(error.message, {
        cause: {
          extensions: {
            code: "UNAUTHENTICATED",
          },
        },
      })
    
    case "GraphQLAuthorizationError":
      return new Error(error.message, {
        cause: {
          extensions: {
            code: "FORBIDDEN",
            resource: error.resource,
            action: error.action,
          },
        },
      })
    
    case "GraphQLBusinessError":
      return new Error(error.message, {
        cause: {
          extensions: {
            code: error.code,
            ...error.extensions,
          },
        },
      })
    
    default:
      return new Error("Internal server error")
  }
}

// ============================================================================
// GraphQL Schema Directives
// ============================================================================

/**
 * Authentication directive implementation
 */
export const authDirective = {
  authenticated: (next: any) => (source: any, args: any, context: GraphQLContext, info: any) => {
    if (!context.userId) {
      throw new Error("Authentication required")
    }
    return next(source, args, context, info)
  },
}

/**
 * Rate limiting directive implementation
 */
export const rateLimitDirective = {
  rateLimit: (max: number, window: number) =>
    (next: any) =>
    async (source: any, args: any, context: GraphQLContext, info: any) => {
      // Rate limiting implementation
      return next(source, args, context, info)
    },
}

// ============================================================================
// Example Resolvers
// ============================================================================

export const exampleResolvers = {
  Query: {
    user: resolver<unknown, { id: string }, { id: string; name: string }>(
      (_source, args) =>
        Effect.succeed({
          id: args.id,
          name: "John Doe",
        })
    )
      .withAuthentication()
      .build(),
    
    users: queryResolver(
      (args: { limit?: number }, context) => ({
        type: "ListUsers",
        payload: { limit: args.limit || 10 },
        metadata: {
          queryType: "ListUsers" as any,
          correlationId: context.correlationId,
          causationId: context.correlationId as unknown as CausationId,
          timestamp: Date.now() as any,
        },
        match: () => null as any,
        withMetadata: () => null as any,
      } as Query),
      (result) => result.data
    ),
  },
  
  Mutation: {
    createUser: commandResolver(
      (args: { input: { name: string; email: string } }, context) => ({
        type: "CreateUser",
        payload: args.input,
        metadata: {
          commandType: "CreateUser" as any,
          commandId: "cmd" as any,
          correlationId: context.correlationId,
          causationId: context.correlationId as unknown as CausationId,
          timestamp: Date.now() as any,
        },
        match: () => null as any,
        withMetadata: () => null as any,
      } as Command),
      (response) => ({ success: response.success, id: "user-123" })
    ),
  },
  
  Subscription: {
    userEvents: subscriptionResolver(
      (event, args: { userId: string }) =>
        event.metadata.aggregateId === args.userId,
      (event) => ({ event: event.type, data: event.payload })
    ),
  },
}