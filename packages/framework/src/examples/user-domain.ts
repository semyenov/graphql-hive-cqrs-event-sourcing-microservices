/**
 * Complete User Domain Example
 * 
 * Demonstrates CQRS/Event Sourcing with the framework
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as S from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import {
  // Core
  AggregateId,
  EventId,
  CommandId,
  UserId,
  Version,
  Timestamp,
  CorrelationId,
  CausationId,
  
  // Messages
  event,
  command,
  query,
  DomainEvent,
  Command,
  Query,
  EventMetadata,
  CommandMetadata,
  QueryMetadata,
  
  // Domain
  aggregate,
  Aggregate,
  AggregateState,
  BusinessRuleViolationError,
  InvalidStateError,
  validateRule,
  
  // Application
  commandHandler,
  CommandHandler,
  queryHandler,
  QueryHandler,
  projection,
  Projection,
  readModel,
  ReadModelProjection,
  PaginatedResult,
  
  // Infrastructure
  InMemoryEventStore,
  InMemoryEventStoreLive,
  EventStore,
  StreamName,
  
  // Effect exports
  Data,
  Context,
  Schedule,
} from "@cqrs/framework"

// ============================================================================
// Domain Types
// ============================================================================

interface UserState extends AggregateState {
  readonly email: string
  readonly username: string
  readonly fullName: string
  readonly emailVerified: boolean
  readonly active: boolean
  readonly roles: ReadonlyArray<string>
  readonly lastLogin?: Timestamp
}

// ============================================================================
// Domain Events
// ============================================================================

const UserRegisteredEvent = event(
  "UserRegistered",
  S.Struct({
    userId: S.String,
    email: S.String,
    username: S.String,
    fullName: S.String,
  })
).createClass()

const UserEmailVerifiedEvent = event(
  "UserEmailVerified",
  S.Struct({
    userId: S.String,
    verifiedAt: S.Number,
  })
).createClass()

const UserProfileUpdatedEvent = event(
  "UserProfileUpdated",
  S.Struct({
    userId: S.String,
    fullName: S.String,
    updatedAt: S.Number,
  })
).createClass()

const UserRoleGrantedEvent = event(
  "UserRoleGranted",
  S.Struct({
    userId: S.String,
    role: S.String,
    grantedBy: S.String,
  })
).createClass()

const UserDeactivatedEvent = event(
  "UserDeactivated",
  S.Struct({
    userId: S.String,
    reason: S.String,
    deactivatedAt: S.Number,
  })
).createClass()

const UserLoggedInEvent = event(
  "UserLoggedIn",
  S.Struct({
    userId: S.String,
    loginAt: S.Number,
    ipAddress: S.String,
  })
).createClass()

type UserEvent =
  | InstanceType<typeof UserRegisteredEvent>
  | InstanceType<typeof UserEmailVerifiedEvent>
  | InstanceType<typeof UserProfileUpdatedEvent>
  | InstanceType<typeof UserRoleGrantedEvent>
  | InstanceType<typeof UserDeactivatedEvent>
  | InstanceType<typeof UserLoggedInEvent>

// ============================================================================
// Domain Commands
// ============================================================================

interface RegisterUserCommand {
  type: "RegisterUser"
  email: string
  username: string
  fullName: string
}

interface VerifyEmailCommand {
  type: "VerifyEmail"
  verificationToken: string
}

interface UpdateProfileCommand {
  type: "UpdateProfile"
  fullName: string
}

interface GrantRoleCommand {
  type: "GrantRole"
  role: string
  grantedBy: string
}

interface DeactivateUserCommand {
  type: "DeactivateUser"
  reason: string
}

interface RecordLoginCommand {
  type: "RecordLogin"
  ipAddress: string
}

type UserCommand =
  | RegisterUserCommand
  | VerifyEmailCommand
  | UpdateProfileCommand
  | GrantRoleCommand
  | DeactivateUserCommand
  | RecordLoginCommand

// ============================================================================
// User Aggregate
// ============================================================================

const UserAggregate = aggregate<UserState, UserEvent, UserCommand>({
  name: "User",
  
  initialState: (id) => ({
    aggregateId: id,
    version: Version.initial(),
    email: "",
    username: "",
    fullName: "",
    emailVerified: false,
    active: false,
    roles: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }),
  
  eventHandlers: {
    UserRegistered: (state, event) => ({
      ...state,
      email: event.payload.email,
      username: event.payload.username,
      fullName: event.payload.fullName,
      active: true,
      updatedAt: Timestamp.now(),
    }),
    
    UserEmailVerified: (state, event) => ({
      ...state,
      emailVerified: true,
      updatedAt: event.payload.verifiedAt as Timestamp,
    }),
    
    UserProfileUpdated: (state, event) => ({
      ...state,
      fullName: event.payload.fullName,
      updatedAt: event.payload.updatedAt as Timestamp,
    }),
    
    UserRoleGranted: (state, event) => ({
      ...state,
      roles: [...state.roles, event.payload.role],
      updatedAt: Timestamp.now(),
    }),
    
    UserDeactivated: (state, event) => ({
      ...state,
      active: false,
      updatedAt: event.payload.deactivatedAt as Timestamp,
    }),
    
    UserLoggedIn: (state, event) => ({
      ...state,
      lastLogin: event.payload.loginAt as Timestamp,
      updatedAt: Timestamp.now(),
    }),
  },
  
  commandHandlers: {
    RegisterUser: {
      validate: (state, cmd) =>
        state.email
          ? Effect.fail(
              new InvalidStateError({
                aggregateId: state.aggregateId,
                reason: "User already registered",
              })
            )
          : Effect.succeed(undefined),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserRegisteredEvent.create(
            {
              userId: state.aggregateId,
              email: cmd.email,
              username: cmd.username,
              fullName: cmd.fullName,
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
    
    VerifyEmail: {
      validate: (state, cmd) =>
        pipe(
          validateRule(
            state.active,
            state.aggregateId,
            "User must be active to verify email"
          ),
          Effect.flatMap(() =>
            validateRule(
              !state.emailVerified,
              state.aggregateId,
              "Email already verified"
            )
          )
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserEmailVerifiedEvent.create(
            {
              userId: state.aggregateId,
              verifiedAt: Date.now(),
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
    
    UpdateProfile: {
      validate: (state, cmd) =>
        validateRule(
          state.active,
          state.aggregateId,
          "User must be active to update profile"
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserProfileUpdatedEvent.create(
            {
              userId: state.aggregateId,
              fullName: cmd.fullName,
              updatedAt: Date.now(),
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
    
    GrantRole: {
      validate: (state, cmd) =>
        pipe(
          validateRule(
            state.active,
            state.aggregateId,
            "User must be active to grant roles"
          ),
          Effect.flatMap(() =>
            validateRule(
              !state.roles.includes(cmd.role),
              state.aggregateId,
              `User already has role: ${cmd.role}`
            )
          )
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserRoleGrantedEvent.create(
            {
              userId: state.aggregateId,
              role: cmd.role,
              grantedBy: cmd.grantedBy,
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
    
    DeactivateUser: {
      validate: (state, cmd) =>
        validateRule(
          state.active,
          state.aggregateId,
          "User is already deactivated"
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserDeactivatedEvent.create(
            {
              userId: state.aggregateId,
              reason: cmd.reason,
              deactivatedAt: Date.now(),
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
    
    RecordLogin: {
      validate: (state, cmd) =>
        pipe(
          validateRule(
            state.active,
            state.aggregateId,
            "User must be active to login"
          ),
          Effect.flatMap(() =>
            validateRule(
              state.emailVerified,
              state.aggregateId,
              "Email must be verified to login"
            )
          )
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          UserLoggedInEvent.create(
            {
              userId: state.aggregateId,
              loginAt: Date.now(),
              ipAddress: cmd.ipAddress,
            },
            createEventMetadata(state.aggregateId)
          ),
        ]),
    },
  },
}).build()

// ============================================================================
// Read Models
// ============================================================================

interface UserReadModel {
  readonly id: string
  readonly email: string
  readonly username: string
  readonly fullName: string
  readonly emailVerified: boolean
  readonly active: boolean
  readonly roles: ReadonlyArray<string>
  readonly lastLogin?: Date
  readonly createdAt: Date
  readonly updatedAt: Date
}

const userProjection = projection<UserReadModel, UserEvent>()
  .withName("UserProjection")
  .withInitialState({
    id: "",
    email: "",
    username: "",
    fullName: "",
    emailVerified: false,
    active: false,
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  .on("UserRegistered", (state, event) =>
    Effect.succeed({
      ...state,
      id: event.payload.userId,
      email: event.payload.email,
      username: event.payload.username,
      fullName: event.payload.fullName,
      active: true,
      createdAt: new Date(event.metadata.timestamp),
      updatedAt: new Date(),
    })
  )
  .on("UserEmailVerified", (state, event) =>
    Effect.succeed({
      ...state,
      emailVerified: true,
      updatedAt: new Date(event.payload.verifiedAt),
    })
  )
  .on("UserProfileUpdated", (state, event) =>
    Effect.succeed({
      ...state,
      fullName: event.payload.fullName,
      updatedAt: new Date(event.payload.updatedAt),
    })
  )
  .on("UserRoleGranted", (state, event) =>
    Effect.succeed({
      ...state,
      roles: [...state.roles, event.payload.role],
      updatedAt: new Date(),
    })
  )
  .on("UserDeactivated", (state, event) =>
    Effect.succeed({
      ...state,
      active: false,
      updatedAt: new Date(event.payload.deactivatedAt),
    })
  )
  .on("UserLoggedIn", (state, event) =>
    Effect.succeed({
      ...state,
      lastLogin: new Date(event.payload.loginAt),
      updatedAt: new Date(),
    })
  )
  .build()

// ============================================================================
// Queries
// ============================================================================

const GetUserByIdQuery = query(
  "GetUserById",
  S.Struct({ userId: S.String }),
  S.Union(S.Struct({ found: S.Literal(true), user: S.Any }), S.Struct({ found: S.Literal(false) }))
).createClass()

const ListActiveUsersQuery = query(
  "ListActiveUsers",
  S.Struct({ 
    offset: S.Number,
    limit: S.Number,
  }),
  S.Array(S.Any)
).createClass()

const SearchUsersQuery = query(
  "SearchUsers",
  S.Struct({ searchTerm: S.String }),
  S.Array(S.Any)
).createClass()

// ============================================================================
// Helper Functions
// ============================================================================

function createEventMetadata(aggregateId: AggregateId): EventMetadata {
  return {
    eventId: EventId.generate(),
    eventType: "" as any, // Will be set by event class
    aggregateId,
    aggregateVersion: Version.initial(),
    correlationId: CorrelationId.generate(),
    causationId: CausationId.generate(),
    timestamp: Timestamp.now(),
  }
}

// ============================================================================
// Example Usage
// ============================================================================

const example = Effect.gen(function* () {
  // Create user aggregate
  const userId = AggregateId.generate()
  const user = UserAggregate.create(userId)
  
  // Register user
  yield* user.handle({
    type: "RegisterUser",
    email: "john@example.com",
    username: "johndoe",
    fullName: "John Doe",
  })
  
  // Verify email
  yield* user.handle({
    type: "VerifyEmail",
    verificationToken: "token123",
  })
  
  // Grant admin role
  yield* user.handle({
    type: "GrantRole",
    role: "admin",
    grantedBy: "system",
  })
  
  // Record login
  yield* user.handle({
    type: "RecordLogin",
    ipAddress: "192.168.1.1",
  })
  
  // Get uncommitted events
  const events = user.getUncommittedEvents()
  console.log(`Generated ${events.length} events`)
  
  // Get current state
  const state = user.getState()
  console.log("Current user state:", state)
  
  return state
})

// Run the example
if (import.meta.main) {
  Effect.runPromise(example)
    .then((state) => console.log("Success:", state))
    .catch((error) => console.error("Error:", error))
}

export {
  UserAggregate,
  UserState,
  UserEvent,
  UserCommand,
  UserReadModel,
  userProjection,
}