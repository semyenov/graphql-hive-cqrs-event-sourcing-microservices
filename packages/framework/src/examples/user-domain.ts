/**
 * User Domain Example
 * 
 * Complete domain implementation using the ultra-clean architecture
 * Demonstrates schema-first, pure functional, and Effect-native patterns
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { pipe } from "effect/Function"
import { match, P } from "ts-pattern"

// Import core schemas
import {
  AggregateId,
  Email,
  Username,
  Timestamp,
  Version,
  createAggregateId,
  createEventId,
  createCommandId,
  now
} from "../schema/core/primitives"

import {
  createEventSchema,
  createCommandSchema,
  createQuerySchema,
  EventMetadata,
  CommandMetadata,
  createPaginatedResultSchema
} from "../schema/core/messages"

// Import pure functions
import {
  createAggregate,
  createEventApplicator,
  createCommandHandler,
  executeCommand,
  loadFromEvents,
  createProjection,
  type EventSourcedAggregate,
  type CommandDecision
} from "../functions/event-sourcing"

// Import Effect services
import {
  EventStore,
  CommandBus,
  QueryBus,
  ProjectionStore,
  createRepository,
  type CommandHandler as ServiceCommandHandler,
  type QueryHandler as ServiceQueryHandler
} from "../effects/services"

// Import GraphQL
import {
  createEntityResolver,
  type FederationEntity
} from "../graphql/federation"

// ============================================================================
// Domain Schemas (Single Source of Truth)
// ============================================================================

/**
 * User State Schema
 */
const UserState = Schema.Struct({
  id: AggregateId,
  email: Email,
  username: Username,
  emailVerified: Schema.Boolean,
  status: Schema.Literal("active", "suspended", "deleted"),
  createdAt: Timestamp,
  updatedAt: Timestamp
})
export type UserState = Schema.Schema.Type<typeof UserState>

/**
 * User Events
 */
export const UserCreated = createEventSchema(
  "UserCreated",
  Schema.Struct({
    email: Email,
    username: Username
  })
)

export const EmailVerified = createEventSchema(
  "EmailVerified",
  Schema.Struct({
    verifiedAt: Timestamp
  })
)

export const UserSuspended = createEventSchema(
  "UserSuspended",
  Schema.Struct({
    reason: Schema.String,
    suspendedAt: Timestamp
  })
)

export const UserDeleted = createEventSchema(
  "UserDeleted",
  Schema.Struct({
    deletedAt: Timestamp
  })
)

// Union of all user events
export const UserEvent = Schema.Union(
  UserCreated,
  EmailVerified,
  UserSuspended,
  UserDeleted
)
export type UserEvent = Schema.Schema.Type<typeof UserEvent>

/**
 * User Commands
 */
export const CreateUser = createCommandSchema(
  "CreateUser",
  Schema.Struct({
    email: Email,
    username: Username
  })
)

export const VerifyEmail = createCommandSchema(
  "VerifyEmail",
  Schema.Struct({
    verificationToken: Schema.String
  })
)

export const SuspendUser = createCommandSchema(
  "SuspendUser",
  Schema.Struct({
    reason: Schema.String
  })
)

export const DeleteUser = createCommandSchema(
  "DeleteUser",
  Schema.Struct({
    confirmation: Schema.Literal("DELETE")
  })
)

// Union of all user commands
export const UserCommand = Schema.Union(
  CreateUser,
  VerifyEmail,
  SuspendUser,
  DeleteUser
)
export type UserCommand = Schema.Schema.Type<typeof UserCommand>

/**
 * User Queries
 */
export const GetUserById = createQuerySchema(
  "GetUserById",
  Schema.Struct({
    userId: AggregateId
  })
)

export const FindUserByEmail = createQuerySchema(
  "FindUserByEmail",
  Schema.Struct({
    email: Email
  })
)

export const ListUsers = createQuerySchema(
  "ListUsers",
  Schema.Struct({
    status: Schema.optional(Schema.Literal("active", "suspended", "deleted")),
    emailVerified: Schema.optional(Schema.Boolean)
  })
)

export const UserQuery = Schema.Union(
  GetUserById,
  FindUserByEmail,
  ListUsers
)
export type UserQuery = Schema.Schema.Type<typeof UserQuery>

// ============================================================================
// Domain Errors
// ============================================================================

export class UserNotFound {
  readonly _tag = "UserNotFound"
  constructor(readonly userId: AggregateId) {}
}

export class EmailAlreadyExists {
  readonly _tag = "EmailAlreadyExists"
  constructor(readonly email: Email) {}
}

export class InvalidVerificationToken {
  readonly _tag = "InvalidVerificationToken"
  constructor(readonly token: string) {}
}

export class UserAlreadyVerified {
  readonly _tag = "UserAlreadyVerified"
  constructor(readonly userId: AggregateId) {}
}

export type UserError = 
  | UserNotFound
  | EmailAlreadyExists
  | InvalidVerificationToken
  | UserAlreadyVerified

// ============================================================================
// Pure Event Application
// ============================================================================

/**
 * Apply user events to state
 */
export const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    username: event.data.username,
    emailVerified: false,
    status: "active" as const,
    createdAt: event.metadata.timestamp,
    updatedAt: event.metadata.timestamp
  }),
  
  EmailVerified: (state, event) =>
    state ? {
      ...state,
      emailVerified: true,
      updatedAt: event.data.verifiedAt
    } : null,
  
  UserSuspended: (state, event) =>
    state ? {
      ...state,
      status: "suspended" as const,
      updatedAt: event.data.suspendedAt
    } : null,
  
  UserDeleted: (state, _event) => null // Soft delete returns null
})

// ============================================================================
// Pure Command Handling
// ============================================================================

/**
 * Handle user commands
 */
export const handleUserCommand = createCommandHandler<
  UserState,
  UserCommand,
  UserEvent,
  UserError
>({
  CreateUser: (state, command) =>
    Effect.gen(function* () {
      // Check if user already exists
      if (state !== null) {
        return {
          type: "failure" as const,
          error: new EmailAlreadyExists(command.payload.email)
        }
      }
      
      // Create user created event
      const event: Schema.Schema.Type<typeof UserCreated> = {
        type: "UserCreated" as const,
        data: {
          email: command.payload.email,
          username: command.payload.username
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 0 as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: command.metadata.commandId,
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    }),
  
  VerifyEmail: (state, command) =>
    Effect.gen(function* () {
      if (!state) {
        return {
          type: "failure" as const,
          error: new UserNotFound(command.aggregateId)
        }
      }
      
      if (state.emailVerified) {
        return {
          type: "failure" as const,
          error: new UserAlreadyVerified(command.aggregateId)
        }
      }
      
      // In real app, would validate token
      if (command.payload.verificationToken !== "valid-token") {
        return {
          type: "failure" as const,
          error: new InvalidVerificationToken(command.payload.verificationToken)
        }
      }
      
      const event: Schema.Schema.Type<typeof EmailVerified> = {
        type: "EmailVerified" as const,
        data: {
          verifiedAt: now()
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any).version + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: command.metadata.commandId,
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    }),
  
  SuspendUser: (state, command) =>
    Effect.succeed({
      type: "success" as const,
      events: [] // Implementation omitted for brevity
    }),
  
  DeleteUser: (state, command) =>
    Effect.succeed({
      type: "success" as const,
      events: [] // Implementation omitted for brevity
    })
})

// ============================================================================
// User Aggregate
// ============================================================================

export type UserAggregate = EventSourcedAggregate<UserState, UserEvent>

export const createUserAggregate = (
  id: AggregateId = createAggregateId()
): UserAggregate =>
  createAggregate<UserState, UserEvent>({
    id,
    email: "" as Email,
    username: "" as Username,
    emailVerified: false,
    status: "active",
    createdAt: now(),
    updatedAt: now()
  })

export const loadUserFromEvents = (events: ReadonlyArray<UserEvent>): UserAggregate =>
  loadFromEvents(applyUserEvent)(events)

export const executeUserCommand = (
  aggregate: UserAggregate,
  command: UserCommand
): Effect.Effect<UserAggregate, UserError, never> =>
  executeCommand(handleUserCommand, applyUserEvent)(aggregate, command)

// ============================================================================
// Projections
// ============================================================================

/**
 * User list projection
 */
export const UserListProjection = createProjection(
  "UserList",
  [] as Array<{
    id: AggregateId
    email: Email
    username: Username
    status: string
    emailVerified: boolean
    createdAt: Timestamp
  }>,
  {
    UserCreated: (state, event) => [
      ...state,
      {
        id: event.metadata.aggregateId,
        email: event.data.email,
        username: event.data.username,
        status: "active",
        emailVerified: false,
        createdAt: event.metadata.timestamp
      }
    ],
    
    EmailVerified: (state, event) =>
      state.map(user =>
        user.id === event.metadata.aggregateId
          ? { ...user, emailVerified: true }
          : user
      ),
    
    UserSuspended: (state, event) =>
      state.map(user =>
        user.id === event.metadata.aggregateId
          ? { ...user, status: "suspended" }
          : user
      ),
    
    UserDeleted: (state, event) =>
      state.filter(user => user.id !== event.metadata.aggregateId)
  }
)

/**
 * Email index projection
 */
export const EmailIndexProjection = createProjection(
  "EmailIndex",
  new Map<Email, AggregateId>(),
  {
    UserCreated: (state, event) => {
      const newState = new Map(state)
      newState.set(event.data.email, event.metadata.aggregateId)
      return newState
    },
    
    UserDeleted: (state, event) => {
      const newState = new Map(state)
      // Would need to know email to remove from index
      return newState
    }
  }
)

// ============================================================================
// Service Layer
// ============================================================================

/**
 * User command handlers for command bus
 */
export const UserCommandHandlers = {
  CreateUser: ((command: Schema.Schema.Type<typeof CreateUser>) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const aggregate = createUserAggregate(command.aggregateId)
      const result = yield* executeUserCommand(aggregate, command)
      
      const streamName = `User-${command.aggregateId}` as any
      yield* eventStore.append(
        streamName,
        result.uncommittedEvents,
        result.version
      )
      
      return { success: true, aggregateId: command.aggregateId }
    })) as ServiceCommandHandler<any, any>,
  
  VerifyEmail: ((command: Schema.Schema.Type<typeof VerifyEmail>) =>
    Effect.succeed({ success: true })) as ServiceCommandHandler<any, any>
}

/**
 * User query handlers for query bus
 */
export const UserQueryHandlers = {
  GetUserById: ((query: Schema.Schema.Type<typeof GetUserById>) =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore
      const userList = yield* projectionStore.load<any>("UserList")
      
      return Option.match(userList, {
        onNone: () => null,
        onSome: (list) =>
          list.find((u: any) => u.id === query.params.userId) || null
      })
    })) as ServiceQueryHandler<any, any>,
  
  ListUsers: ((query: Schema.Schema.Type<typeof ListUsers>) =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore
      const userList = yield* projectionStore.load<any>("UserList")
      
      return Option.match(userList, {
        onNone: () => [],
        onSome: (list) => {
          let filtered = list
          
          if (query.params.status) {
            filtered = filtered.filter((u: any) => u.status === query.params.status)
          }
          
          if (query.params.emailVerified !== undefined) {
            filtered = filtered.filter((u: any) => 
              u.emailVerified === query.params.emailVerified
            )
          }
          
          return filtered
        }
      })
    })) as ServiceQueryHandler<any, any>
}

// ============================================================================
// GraphQL Federation Entity
// ============================================================================

export const UserEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  
  resolveReference: (reference) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const streamName = `User-${reference.id}` as any
      
      const events = yield* pipe(
        eventStore.read<UserEvent>(streamName),
        Effect.map(Array.from),
        Effect.orElseSucceed(() => [])
      )
      
      if (events.length === 0) {
        return yield* Effect.fail(
          new UserNotFound(reference.id)
        )
      }
      
      const aggregate = loadUserFromEvents(events)
      return aggregate.state
    }),
  
  fields: {
    fullName: (user) => `${user.username}`,
    isActive: (user) => user.status === "active"
  }
}

// ============================================================================
// Service Layer Configuration
// ============================================================================

/**
 * Register all user domain handlers
 */
export const registerUserDomain = Effect.gen(function* () {
  const commandBus = yield* CommandBus
  const queryBus = yield* QueryBus
  
  // Register command handlers
  yield* commandBus.register("CreateUser", UserCommandHandlers.CreateUser)
  yield* commandBus.register("VerifyEmail", UserCommandHandlers.VerifyEmail)
  
  // Register query handlers
  yield* queryBus.register("GetUserById", UserQueryHandlers.GetUserById)
  yield* queryBus.register("ListUsers", UserQueryHandlers.ListUsers)
})

/**
 * User domain layer
 */
export const UserDomainLive = Layer.effectDiscard(registerUserDomain)