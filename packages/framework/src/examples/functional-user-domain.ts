/**
 * Functional User Domain Example
 * 
 * Demonstrates the new functional approach without classes or 'this' context
 * Pure functions, typed interfaces, and Effect-native patterns
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

import {
  // Primitives
  AggregateId,
  Email,
  Username,
  NonEmptyString,
  Version,
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
  nonEmptyString,
  
  // Messages
  createEventSchema,
  createCommandSchema,
  
  // Functional domain
  type Aggregate,
  type EventApplicator,
  createAggregate,
  applyEvent,
  markEventsAsCommitted,
  createCommandHandler,
  createRepository,
  type Repository,
  
  // Services
  CoreServicesLive,
  EventStore,
} from "../index"

// ============================================================================
// User Domain Model
// ============================================================================

/**
 * User state - pure data structure
 */
const UserState = Schema.Struct({
  email: Email,
  username: Username,
  firstName: NonEmptyString,
  lastName: NonEmptyString,
  isActive: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
type UserState = Schema.Schema.Type<typeof UserState>

/**
 * User aggregate type
 */
type UserAggregate = Aggregate<UserState | null, UserEvent>

// ============================================================================
// User Events - Schema-First
// ============================================================================

const UserRegistered = createEventSchema(
  "UserRegistered",
  Schema.Struct({
    email: Email,
    username: Username,
    firstName: NonEmptyString,
    lastName: NonEmptyString,
  })
)

const UserActivated = createEventSchema(
  "UserActivated",
  Schema.Struct({})
)

const UserDeactivated = createEventSchema(
  "UserDeactivated",
  Schema.Struct({
    reason: Schema.String,
  })
)

const UserProfileUpdated = createEventSchema(
  "UserProfileUpdated",
  Schema.Struct({
    firstName: Schema.optional(NonEmptyString),
    lastName: Schema.optional(NonEmptyString),
  })
)

type UserEvent =
  | Schema.Schema.Type<typeof UserRegistered>
  | Schema.Schema.Type<typeof UserActivated>
  | Schema.Schema.Type<typeof UserDeactivated>
  | Schema.Schema.Type<typeof UserProfileUpdated>

// ============================================================================
// User Commands - Schema-First
// ============================================================================

const RegisterUser = createCommandSchema(
  "RegisterUser",
  Schema.Struct({
    email: Email,
    username: Username,
    firstName: NonEmptyString,
    lastName: NonEmptyString,
  })
)

const ActivateUser = createCommandSchema(
  "ActivateUser",
  Schema.Struct({})
)

const DeactivateUser = createCommandSchema(
  "DeactivateUser",
  Schema.Struct({
    reason: Schema.String,
  })
)

const UpdateUserProfile = createCommandSchema(
  "UpdateUserProfile",
  Schema.Struct({
    firstName: Schema.optional(NonEmptyString),
    lastName: Schema.optional(NonEmptyString),
  })
)

type UserCommand =
  | Schema.Schema.Type<typeof RegisterUser>
  | Schema.Schema.Type<typeof ActivateUser>
  | Schema.Schema.Type<typeof DeactivateUser>
  | Schema.Schema.Type<typeof UpdateUserProfile>

// ============================================================================
// Domain Errors
// ============================================================================

class UserAlreadyExistsError {
  readonly _tag = "UserAlreadyExistsError"
  constructor(readonly email: Email) {}
}

class UserNotFoundError {
  readonly _tag = "UserNotFoundError"
  constructor(readonly id: AggregateId) {}
}

class UserAlreadyActiveError {
  readonly _tag = "UserAlreadyActiveError"
  constructor(readonly id: AggregateId) {}
}

class UserNotActiveError {
  readonly _tag = "UserNotActiveError"
  constructor(readonly id: AggregateId) {}
}

type UserError =
  | UserAlreadyExistsError
  | UserNotFoundError
  | UserAlreadyActiveError
  | UserNotActiveError

// ============================================================================
// Pure Event Applicator Function
// ============================================================================

/**
 * Apply user events to state - pure function, no 'this'
 */
const applyUserEvent: EventApplicator<UserState, UserEvent> = (state, event) =>
  match(event)
    .with({ type: "UserRegistered" }, (e) => ({
      email: e.data.email,
      username: e.data.username,
      firstName: e.data.firstName,
      lastName: e.data.lastName,
      isActive: false,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
    }))
    .with({ type: "UserActivated" }, (e) =>
      state ? { ...state, isActive: true, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserDeactivated" }, (e) =>
      state ? { ...state, isActive: false, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserProfileUpdated" }, (e) =>
      state
        ? {
            ...state,
            firstName: e.data.firstName ?? state.firstName,
            lastName: e.data.lastName ?? state.lastName,
            updatedAt: e.metadata.timestamp,
          }
        : null
    )
    .exhaustive()

// ============================================================================
// Command Handlers - Pure Functions
// ============================================================================

/**
 * Register user command handler - no 'this', no classes
 */
const registerUserHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof RegisterUser>,
  UserEvent,
  UserError
>({
  name: "RegisterUser",
  commandType: "RegisterUser",
  
  validate: (command) =>
    Effect.gen(function* () {
      // Additional validation could go here
      // For example, check if email is already taken
    }),
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // Check if user already exists
      if (aggregate.state !== null) {
        return yield* Effect.fail(
          new UserAlreadyExistsError(command.payload.email)
        )
      }
      
      // Create registration event
      const event: Schema.Schema.Type<typeof UserRegistered> = {
        type: "UserRegistered",
        data: {
          email: command.payload.email,
          username: command.payload.username,
          firstName: command.payload.firstName,
          lastName: command.payload.lastName,
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.id,
          version: (aggregate.version + 1) as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      }
      
      return [event]
    }),
  
  applicator: applyUserEvent,
})

/**
 * Activate user command handler
 */
const activateUserHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof ActivateUser>,
  UserEvent,
  UserError
>({
  name: "ActivateUser",
  commandType: "ActivateUser",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // Check if user exists
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      // Check if already active
      if (aggregate.state.isActive) {
        return yield* Effect.fail(new UserAlreadyActiveError(aggregate.id))
      }
      
      // Create activation event
      const event: Schema.Schema.Type<typeof UserActivated> = {
        type: "UserActivated",
        data: {},
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.id,
          version: (aggregate.version + 1) as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      }
      
      return [event]
    }),
  
  applicator: applyUserEvent,
})

/**
 * Deactivate user command handler
 */
const deactivateUserHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof DeactivateUser>,
  UserEvent,
  UserError
>({
  name: "DeactivateUser",
  commandType: "DeactivateUser",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // Check if user exists
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      // Check if active
      if (!aggregate.state.isActive) {
        return yield* Effect.fail(new UserNotActiveError(aggregate.id))
      }
      
      // Create deactivation event
      const event: Schema.Schema.Type<typeof UserDeactivated> = {
        type: "UserDeactivated",
        data: {
          reason: command.payload.reason,
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.id,
          version: (aggregate.version + 1) as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      }
      
      return [event]
    }),
  
  applicator: applyUserEvent,
})

/**
 * Update profile command handler
 */
const updateProfileHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof UpdateUserProfile>,
  UserEvent,
  UserError
>({
  name: "UpdateUserProfile",
  commandType: "UpdateUserProfile",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // Check if user exists
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      // Create update event
      const event: Schema.Schema.Type<typeof UserProfileUpdated> = {
        type: "UserProfileUpdated",
        data: {
          firstName: command.payload.firstName,
          lastName: command.payload.lastName,
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.id,
          version: (aggregate.version + 1) as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      }
      
      return [event]
    }),
  
  applicator: applyUserEvent,
})

// ============================================================================
// Repository - Functional Pattern
// ============================================================================

/**
 * Create user repository - no classes, just functions
 */
const createUserRepository = (): Repository<UserState, UserEvent> =>
  createRepository("User", applyUserEvent, null)

// ============================================================================
// Demo Usage - Functional Composition
// ============================================================================

/**
 * Demonstrate the functional approach
 */
const runFunctionalDemo = Effect.gen(function* () {
  console.log("🚀 Functional User Domain Demo\n")
  console.log("✨ No classes, no 'this', just pure functions!\n")
  
  // Create repository
  const repository = createUserRepository()
  
  // Create a new user
  const userId = createAggregateId()
  console.log(`📝 Creating user with ID: ${userId}`)
  
  // Start with empty aggregate
  let userAggregate = createAggregate<UserState, UserEvent>(userId)
  
  // Register user - functional command handling
  const registerCommand: Schema.Schema.Type<typeof RegisterUser> = {
    type: "RegisterUser",
    payload: {
      email: "alice@example.com" as Email,
      username: "alice" as Username,
      firstName: nonEmptyString("Alice"),
      lastName: nonEmptyString("Johnson"),
    },
    metadata: {
      commandId: createEventId(),
      aggregateId: userId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", userId: "system" as AggregateId },
    },
  }
  
  // Handle command - pure function, no 'this'
  userAggregate = yield* registerUserHandler(userAggregate, registerCommand)
  console.log("✅ User registered:", userAggregate.state)
  
  // Save to repository
  yield* repository.save(userAggregate)
  userAggregate = markEventsAsCommitted(userAggregate) // Mark events as committed after save
  console.log("💾 User saved to repository")
  
  // Activate user
  const activateCommand: Schema.Schema.Type<typeof ActivateUser> = {
    type: "ActivateUser",
    payload: {},
    metadata: {
      commandId: createEventId(),
      aggregateId: userId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", userId: "admin" as AggregateId },
    },
  }
  
  userAggregate = yield* activateUserHandler(userAggregate, activateCommand)
  console.log("✅ User activated:", userAggregate.state)
  
  // Save activation
  yield* repository.save(userAggregate)
  userAggregate = markEventsAsCommitted(userAggregate)
  
  // Update profile
  const updateCommand: Schema.Schema.Type<typeof UpdateUserProfile> = {
    type: "UpdateUserProfile",
    payload: {
      firstName: nonEmptyString("Alicia"),
    },
    metadata: {
      commandId: createEventId(),
      aggregateId: userId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", userId },
    },
  }
  
  userAggregate = yield* updateProfileHandler(userAggregate, updateCommand)
  console.log("✅ Profile updated:", userAggregate.state)
  
  // Save profile update
  yield* repository.save(userAggregate)
  userAggregate = markEventsAsCommitted(userAggregate)
  console.log("💾 All changes saved")
  
  // Load from repository to verify
  const loadedAggregate = yield* repository.load(userId)
  console.log("\n📖 Loaded from repository:", loadedAggregate.state)
  console.log("   Version:", loadedAggregate.version)
  console.log("   Uncommitted events:", loadedAggregate.uncommittedEvents.length)
  
  console.log("\n🎉 Functional approach benefits:")
  console.log("   ✅ No 'this' context issues")
  console.log("   ✅ Pure functions are easy to test")
  console.log("   ✅ Clear data flow")
  console.log("   ✅ Better type inference")
  console.log("   ✅ Composable and modular")
})

// ============================================================================
// Run the Demo
// ============================================================================

if (import.meta.main) {
  pipe(
    runFunctionalDemo,
    Effect.provide(CoreServicesLive),
    Effect.runPromise
  ).then(
    () => console.log("\n✨ Demo completed successfully!"),
    (error) => console.error("❌ Demo failed:", error)
  )
}

export {
  // Types
  type UserState,
  type UserAggregate,
  type UserEvent,
  type UserCommand,
  type UserError,
  
  // Event schemas
  UserRegistered,
  UserActivated,
  UserDeactivated,
  UserProfileUpdated,
  
  // Command schemas
  RegisterUser,
  ActivateUser,
  DeactivateUser,
  UpdateUserProfile,
  
  // Pure functions
  applyUserEvent,
  registerUserHandler,
  activateUserHandler,
  deactivateUserHandler,
  updateProfileHandler,
  createUserRepository,
  
  // Demo
  runFunctionalDemo,
}