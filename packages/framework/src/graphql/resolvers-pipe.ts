/**
 * GraphQL Resolvers - Pipe Pattern Implementation
 * 
 * Effect-based resolvers using functional composition
 * Superior error handling and dependency injection with pipes
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import type { GraphQLResolveInfo, GraphQLFieldResolver } from "graphql"
import type { Command, Query as QueryMessage } from "../schema/core/messages"
import type { AggregateId } from "../schema/core/primitives"
import { EventStore, CommandBus } from "../effects/services"

// ============================================================================
// GraphQL Context Types
// ============================================================================

export interface GraphQLContext {
  readonly userId?: string
  readonly token?: string
  readonly correlationId: string
  readonly requestId: string
}

export interface ResolverDependencies {
  readonly eventStore: EventStore
  readonly commandBus: CommandBus
}

// ============================================================================
// Resolver Errors
// ============================================================================

export class ResolverError {
  readonly _tag = "ResolverError"
  constructor(
    readonly code: "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_ERROR",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

export class ValidationError {
  readonly _tag = "ValidationError"
  constructor(
    readonly field: string,
    readonly message: string
  ) {}
}

type ResolverErrors = ResolverError | ValidationError

// ============================================================================
// Effect-based Resolver Builder - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create Effect resolver - PIPE PATTERN
 * Converts Effect to GraphQL resolver with error handling
 */
export const createEffectResolver = <Args, Result, Requirements>(
  handler: (
    args: Args,
    context: GraphQLContext
  ) => Effect.Effect<Result, ResolverErrors, Requirements>
): GraphQLFieldResolver<any, GraphQLContext, Args, Result | null> =>
  (parent, args, context, info) =>
    pipe(
      handler(args, context),
      Effect.catchAll((error) =>
        pipe(
          Effect.logError(`Resolver error: ${error}`),
          Effect.flatMap(() => {
            // Map errors to GraphQL errors
            switch (error._tag) {
              case "ResolverError":
                throw new Error(`${error.code}: ${error.message}`)
              case "ValidationError":
                throw new Error(`Validation failed for ${error.field}: ${error.message}`)
              default:
                throw new Error("Internal server error")
            }
          })
        )
      ),
      Effect.runPromise
    )

/**
 * 🎯 Authorize resolver - PIPE PATTERN
 * Add authorization check to resolver
 */
export const withAuthorization = <Args, Result, Requirements>(
  authorizer: (context: GraphQLContext) => Effect.Effect<void, ResolverError>,
  handler: (args: Args, context: GraphQLContext) => Effect.Effect<Result, ResolverErrors, Requirements>
) => (args: Args, context: GraphQLContext) =>
  pipe(
    authorizer(context),
    Effect.flatMap(() => handler(args, context))
  )

/**
 * 🎯 Validate input - PIPE PATTERN
 * Add input validation to resolver
 */
export const withValidation = <Args, Result, Requirements>(
  validator: (args: Args) => Effect.Effect<void, ValidationError>,
  handler: (args: Args, context: GraphQLContext) => Effect.Effect<Result, ResolverErrors, Requirements>
) => (args: Args, context: GraphQLContext) =>
  pipe(
    validator(args),
    Effect.flatMap(() => handler(args, context))
  )

// ============================================================================
// Query Resolvers - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create query resolver - PIPE PATTERN
 * Execute read operations with caching
 */
export const createQueryResolver = <Args, Result>(
  queryBuilder: (args: Args) => QueryMessage,
  processor: (query: QueryMessage) => Effect.Effect<Result, ResolverError, EventStore>
) =>
  createEffectResolver<Args, Result, EventStore>((args, context) =>
    pipe(
      Effect.succeed(queryBuilder(args)),
      Effect.tap((query) =>
        Effect.log(`Processing query: ${query.type} by user: ${context.userId}`)
      ),
      Effect.flatMap(processor),
      Effect.mapError((error) =>
        new ResolverError(
          "INTERNAL_ERROR",
          `Query failed: ${error.message}`,
          error
        )
      )
    )
  )

/**
 * 🎯 Paginated query resolver - PIPE PATTERN
 * Handle pagination with cursor-based approach
 */
export const createPaginatedResolver = <Args extends { first?: number; after?: string }, Item>(
  fetcher: (args: Args) => Effect.Effect<ReadonlyArray<Item>, ResolverError, EventStore>
) =>
  createEffectResolver<Args, { edges: Array<{ node: Item; cursor: string }>; pageInfo: any }, EventStore>(
    (args, context) =>
      pipe(
        fetcher(args),
        Effect.map((items) => {
          const edges = items.map((item, index) => ({
            node: item,
            cursor: Buffer.from(`${index}`).toString("base64"),
          }))
          
          return {
            edges,
            pageInfo: {
              hasNextPage: items.length === (args.first || 10),
              hasPreviousPage: !!args.after,
              startCursor: edges[0]?.cursor,
              endCursor: edges[edges.length - 1]?.cursor,
            },
          }
        })
      )
  )

// ============================================================================
// Mutation Resolvers - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create mutation resolver - PIPE PATTERN
 * Execute commands with automatic error handling
 */
export const createMutationResolver = <Args, Result>(
  commandBuilder: (args: Args, context: GraphQLContext) => Command,
  resultMapper: (command: Command) => Effect.Effect<Result, ResolverError, CommandBus>
) =>
  createEffectResolver<Args, Result, CommandBus>((args, context) =>
    pipe(
      // Build command
      Effect.succeed(commandBuilder(args, context)),
      Effect.tap((command) =>
        Effect.log(`Executing command: ${command.type} by user: ${context.userId}`)
      ),
      // Send via command bus
      Effect.flatMap((command) =>
        pipe(
          CommandBus,
          Effect.flatMap((bus) => bus.send(command.metadata.aggregateId, command)),
          Effect.flatMap(() => resultMapper(command))
        )
      ),
      Effect.mapError((error) =>
        new ResolverError(
          "INTERNAL_ERROR",
          `Mutation failed: ${error}`,
          error
        )
      )
    )
  )

/**
 * 🎯 Optimistic mutation resolver - PIPE PATTERN
 * Return immediately with optimistic response
 */
export const createOptimisticMutationResolver = <Args, Result>(
  commandBuilder: (args: Args, context: GraphQLContext) => Command,
  optimisticResponse: (args: Args) => Result
) =>
  createEffectResolver<Args, Result, CommandBus>((args, context) =>
    pipe(
      // Build and send command asynchronously
      Effect.succeed(commandBuilder(args, context)),
      Effect.tap((command) =>
        pipe(
          CommandBus,
          Effect.flatMap((bus) => bus.send(command.metadata.aggregateId, command)),
          Effect.fork // Fire and forget
        )
      ),
      // Return optimistic response immediately
      Effect.map(() => optimisticResponse(args))
    )
  )

// ============================================================================
// Subscription Resolvers - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create subscription resolver - PIPE PATTERN
 * Stream events to GraphQL subscriptions
 */
export const createSubscriptionResolver = <Args, Result>(
  filter: (args: Args, event: any) => boolean,
  mapper: (event: any) => Result
) => ({
  subscribe: createEffectResolver<Args, AsyncIterator<Result>, EventStore>((args, context) =>
    pipe(
      EventStore,
      Effect.flatMap((store) => store.subscribe()),
      Effect.map((eventStream) => {
        const iterator = {
          async next() {
            // This would connect to actual event stream
            const event = await eventStream.next()
            if (filter(args, event)) {
              return { value: { data: mapper(event) }, done: false }
            }
            return this.next()
          },
          async return() {
            await eventStream.close()
            return { value: undefined, done: true }
          },
          async throw(error: any) {
            await eventStream.close()
            throw error
          },
        }
        return iterator
      })
    )
  ),
})

// ============================================================================
// Field Resolvers - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Lazy field resolver - PIPE PATTERN
 * Load field data only when requested
 */
export const createLazyFieldResolver = <Parent, Result>(
  loader: (parent: Parent) => Effect.Effect<Result, ResolverError, any>
) =>
  createEffectResolver<{}, Result, any>((args, context, parent) =>
    pipe(
      loader(parent as Parent),
      Effect.catchTag("ResolverError", (error) =>
        Effect.succeed(null as any)
      )
    )
  )

/**
 * 🎯 Batch field resolver - PIPE PATTERN
 * Batch multiple field resolutions
 */
export const createBatchFieldResolver = <Parent, Result>(
  batchLoader: (parents: ReadonlyArray<Parent>) => Effect.Effect<Map<string, Result>, ResolverError, any>,
  keyExtractor: (parent: Parent) => string
) => {
  const batch: Parent[] = []
  let batchPromise: Promise<Map<string, Result>> | null = null

  return createEffectResolver<{}, Result | null, any>((args, context, parent) =>
    pipe(
      Effect.sync(() => {
        batch.push(parent as Parent)
        
        if (!batchPromise) {
          batchPromise = pipe(
            Effect.sleep("1 millis"),
            Effect.flatMap(() => batchLoader([...batch])),
            Effect.runPromise
          ).finally(() => {
            batch.length = 0
            batchPromise = null
          })
        }
        
        return batchPromise
      }),
      Effect.flatMap((promise) => Effect.promise(() => promise)),
      Effect.map((results) => results.get(keyExtractor(parent as Parent)) || null)
    )
  )
}

// ============================================================================
// Resolver Composition - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Compose resolvers - PIPE PATTERN
 * Chain multiple resolvers together
 */
export const composeResolvers = <Args, Intermediate, Result, R1, R2>(
  first: (args: Args, context: GraphQLContext) => Effect.Effect<Intermediate, ResolverErrors, R1>,
  second: (intermediate: Intermediate, context: GraphQLContext) => Effect.Effect<Result, ResolverErrors, R2>
) => (args: Args, context: GraphQLContext) =>
  pipe(
    first(args, context),
    Effect.flatMap((intermediate) => second(intermediate, context))
  )

/**
 * 🎯 Cache resolver - PIPE PATTERN
 * Add caching to any resolver
 */
export const withCache = <Args, Result, Requirements>(
  cacheKey: (args: Args) => string,
  ttl: number,
  handler: (args: Args, context: GraphQLContext) => Effect.Effect<Result, ResolverErrors, Requirements>
) => {
  const cache = new Map<string, { value: Result; expiry: number }>()

  return (args: Args, context: GraphQLContext) =>
    pipe(
      Effect.sync(() => {
        const key = cacheKey(args)
        const cached = cache.get(key)
        
        if (cached && cached.expiry > Date.now()) {
          return Either.right(cached.value)
        }
        
        return Either.left(key)
      }),
      Effect.flatMap(
        Either.match({
          onRight: (value) => Effect.succeed(value),
          onLeft: (key) =>
            pipe(
              handler(args, context),
              Effect.tap((result) =>
                Effect.sync(() => {
                  cache.set(key, {
                    value: result,
                    expiry: Date.now() + ttl,
                  })
                })
              )
            ),
        })
      )
    )
}

// ============================================================================
// Example: User Resolvers - PIPE PATTERN
// ============================================================================

interface User {
  id: string
  email: string
  username: string
  isActive: boolean
}

/**
 * 🎯 User query resolvers using pipe pattern
 */
export const userResolvers = {
  Query: {
    user: createQueryResolver<{ id: string }, User>(
      (args) => ({
        type: "GetUser",
        payload: { userId: args.id },
        metadata: {} as any,
      }),
      (query) =>
        pipe(
          EventStore,
          Effect.flatMap((store) =>
            store.read(`user-${query.payload.userId}` as any)
          ),
          Effect.map(() => ({
            id: query.payload.userId,
            email: "user@example.com",
            username: "username",
            isActive: true,
          }))
        )
    ),

    users: createPaginatedResolver<{ first?: number; after?: string }, User>(
      (args) =>
        pipe(
          EventStore,
          Effect.flatMap((store) => store.readAll()),
          Effect.map(() => [
            { id: "1", email: "user1@example.com", username: "user1", isActive: true },
            { id: "2", email: "user2@example.com", username: "user2", isActive: true },
          ])
        )
    ),
  },

  Mutation: {
    createUser: createMutationResolver<
      { email: string; username: string; password: string },
      User
    >(
      (args, context) => ({
        type: "CreateUser",
        payload: args,
        metadata: {
          commandId: `cmd-${Date.now()}`,
          aggregateId: `user-${Date.now()}` as AggregateId,
          correlationId: context.correlationId,
          causationId: context.requestId,
          timestamp: Date.now(),
          actor: { type: "user" as const, id: context.userId as AggregateId },
        },
      }),
      (command) =>
        Effect.succeed({
          id: command.metadata.aggregateId,
          email: command.payload.email,
          username: command.payload.username,
          isActive: false,
        })
    ),

    activateUser: withAuthorization(
      (context) =>
        context.userId
          ? Effect.void
          : Effect.fail(new ResolverError("UNAUTHORIZED", "Must be logged in")),
      createOptimisticMutationResolver<{ userId: string }, { success: boolean }>(
        (args, context) => ({
          type: "ActivateUser",
          payload: { userId: args.userId },
          metadata: {
            commandId: `cmd-${Date.now()}`,
            aggregateId: args.userId as AggregateId,
            correlationId: context.correlationId,
            causationId: context.requestId,
            timestamp: Date.now(),
            actor: { type: "user" as const, id: context.userId as AggregateId },
          },
        }),
        () => ({ success: true })
      )
    ),
  },

  User: {
    posts: createLazyFieldResolver<User, Array<{ id: string; title: string }>>((user) =>
      pipe(
        EventStore,
        Effect.flatMap((store) =>
          store.read(`user-posts-${user.id}` as any)
        ),
        Effect.map(() => [
          { id: "1", title: "First Post" },
          { id: "2", title: "Second Post" },
        ])
      )
    ),
  },
}

// ============================================================================
// Export Summary
// ============================================================================

export {
  // Types
  type GraphQLContext,
  type ResolverDependencies,
  type ResolverErrors,
  
  // Builders
  createEffectResolver,
  withAuthorization,
  withValidation,
  
  // Query resolvers
  createQueryResolver,
  createPaginatedResolver,
  
  // Mutation resolvers
  createMutationResolver,
  createOptimisticMutationResolver,
  
  // Subscription resolvers
  createSubscriptionResolver,
  
  // Field resolvers
  createLazyFieldResolver,
  createBatchFieldResolver,
  
  // Composition
  composeResolvers,
  withCache,
}