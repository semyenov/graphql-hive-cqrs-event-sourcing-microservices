/**
 * User Domain Command Handlers - Pipe Pattern Implementation
 * 
 * Demonstrates superior pipe pattern approach for domain logic
 * Clean functional composition without Effect.gen
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type { Aggregate } from "../aggregate"
import type { DomainEvent } from "../../schema/core/messages"
import { 
  createEventSchema, 
  createCommandSchema,
  type EventMetadata,
  type CommandMetadata
} from "../../schema/core/messages"
import {
  Email,
  Username,
  NonEmptyString,
  AggregateId,
  Version,
  createEventId,
  createCausationId,
  now,
} from "../../schema/core/primitives"

// ============================================================================
// Domain Model
// ============================================================================

const UserState = Schema.Struct({
  email: Email,
  username: Username,
  passwordHash: NonEmptyString,
  isActive: Schema.Boolean,
  isVerified: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  lastLoginAt: Schema.optional(Schema.Number),
})
type UserState = Schema.Schema.Type<typeof UserState>

// ============================================================================
// Events
// ============================================================================

const UserRegistered = createEventSchema(
  "UserRegistered",
  Schema.Struct({
    email: Email,
    username: Username,
    passwordHash: NonEmptyString,
  })
)

const UserActivated = createEventSchema(
  "UserActivated",
  Schema.Struct({
    activatedBy: NonEmptyString,
  })
)

const UserDeactivated = createEventSchema(
  "UserDeactivated",
  Schema.Struct({
    reason: NonEmptyString,
  })
)

const UserVerified = createEventSchema(
  "UserVerified",
  Schema.Struct({
    verificationCode: NonEmptyString,
  })
)

const UserLoggedIn = createEventSchema(
  "UserLoggedIn",
  Schema.Struct({
    ipAddress: NonEmptyString,
    userAgent: Schema.optional(NonEmptyString),
  })
)

type UserEvent =
  | Schema.Schema.Type<typeof UserRegistered>
  | Schema.Schema.Type<typeof UserActivated>
  | Schema.Schema.Type<typeof UserDeactivated>
  | Schema.Schema.Type<typeof UserVerified>
  | Schema.Schema.Type<typeof UserLoggedIn>

// ============================================================================
// Commands
// ============================================================================

const RegisterUser = createCommandSchema(
  "RegisterUser",
  Schema.Struct({
    email: Email,
    username: Username,
    passwordHash: NonEmptyString,
  })
)

const ActivateUser = createCommandSchema(
  "ActivateUser",
  Schema.Struct({
    activatedBy: NonEmptyString,
  })
)

const DeactivateUser = createCommandSchema(
  "DeactivateUser",
  Schema.Struct({
    reason: NonEmptyString,
  })
)

const VerifyUser = createCommandSchema(
  "VerifyUser",
  Schema.Struct({
    verificationCode: NonEmptyString,
  })
)

const LoginUser = createCommandSchema(
  "LoginUser",
  Schema.Struct({
    ipAddress: NonEmptyString,
    userAgent: Schema.optional(NonEmptyString),
  })
)

type UserCommand =
  | Schema.Schema.Type<typeof RegisterUser>
  | Schema.Schema.Type<typeof ActivateUser>
  | Schema.Schema.Type<typeof DeactivateUser>
  | Schema.Schema.Type<typeof VerifyUser>
  | Schema.Schema.Type<typeof LoginUser>

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

class UserAlreadyVerifiedError {
  readonly _tag = "UserAlreadyVerifiedError"
  constructor(readonly id: AggregateId) {}
}

class InvalidVerificationCodeError {
  readonly _tag = "InvalidVerificationCodeError"
  constructor(readonly code: NonEmptyString) {}
}

type UserError =
  | UserAlreadyExistsError
  | UserNotFoundError
  | UserAlreadyActiveError
  | UserNotActiveError
  | UserAlreadyVerifiedError
  | InvalidVerificationCodeError

// ============================================================================
// Pure Event Applicator
// ============================================================================

export const applyUserEvent = (state: UserState | null, event: UserEvent): UserState | null =>
  match(event)
    .with({ type: "UserRegistered" }, (e) => ({
      email: e.data.email,
      username: e.data.username,
      passwordHash: e.data.passwordHash,
      isActive: false,
      isVerified: false,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
      lastLoginAt: undefined,
    }))
    .with({ type: "UserActivated" }, (e) =>
      state ? { ...state, isActive: true, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserDeactivated" }, (e) =>
      state ? { ...state, isActive: false, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserVerified" }, (e) =>
      state ? { ...state, isVerified: true, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserLoggedIn" }, (e) =>
      state ? { ...state, lastLoginAt: e.metadata.timestamp, updatedAt: e.metadata.timestamp } : null
    )
    .exhaustive()

// ============================================================================
// Command Handlers - PIPE PATTERN Implementation
// ============================================================================

/**
 * Create event with metadata - helper function
 */
const createEvent = <T extends { type: string; data: any }>(
  type: T["type"],
  data: T["data"],
  aggregate: Aggregate<any, any>,
  command: { metadata: CommandMetadata }
): T => ({
  type,
  data,
  metadata: {
    eventId: createEventId(),
    aggregateId: aggregate.id,
    version: (aggregate.version + 1) as Version,
    timestamp: now(),
    correlationId: command.metadata.correlationId,
    causationId: createCausationId(),
    actor: command.metadata.actor,
  },
} as T)

/**
 * 🎯 Register User Handler - PIPE PATTERN
 * Clean validation pipeline without nested generators
 */
export const handleRegisterUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: Schema.Schema.Type<typeof RegisterUser>
): Effect.Effect<ReadonlyArray<UserEvent>, UserError> =>
  pipe(
    // Validate user doesn't exist
    aggregate.state !== null
      ? Effect.fail(new UserAlreadyExistsError(command.payload.email))
      : Effect.void,
    // Create registration event
    Effect.map(() => [
      createEvent(
        "UserRegistered",
        {
          email: command.payload.email,
          username: command.payload.username,
          passwordHash: command.payload.passwordHash,
        },
        aggregate,
        command
      ),
    ])
  )

/**
 * 🎯 Activate User Handler - PIPE PATTERN
 * Stateful validation with functional composition
 */
export const handleActivateUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: Schema.Schema.Type<typeof ActivateUser>
): Effect.Effect<ReadonlyArray<UserEvent>, UserError> =>
  pipe(
    // Validate user exists
    aggregate.state === null
      ? Effect.fail(new UserNotFoundError(aggregate.id))
      : Effect.void,
    // Validate not already active
    Effect.flatMap(() =>
      aggregate.state?.isActive
        ? Effect.fail(new UserAlreadyActiveError(aggregate.id))
        : Effect.void
    ),
    // Create activation event
    Effect.map(() => [
      createEvent(
        "UserActivated",
        { activatedBy: command.payload.activatedBy },
        aggregate,
        command
      ),
    ])
  )

/**
 * 🎯 Deactivate User Handler - PIPE PATTERN
 * Business rule validation through pipes
 */
export const handleDeactivateUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: Schema.Schema.Type<typeof DeactivateUser>
): Effect.Effect<ReadonlyArray<UserEvent>, UserError> =>
  pipe(
    // Validate user exists
    aggregate.state === null
      ? Effect.fail(new UserNotFoundError(aggregate.id))
      : Effect.void,
    // Validate is active
    Effect.flatMap(() =>
      !aggregate.state?.isActive
        ? Effect.fail(new UserNotActiveError(aggregate.id))
        : Effect.void
    ),
    // Create deactivation event
    Effect.map(() => [
      createEvent(
        "UserDeactivated",
        { reason: command.payload.reason },
        aggregate,
        command
      ),
    ])
  )

/**
 * 🎯 Verify User Handler - PIPE PATTERN
 * Multi-step validation pipeline
 */
export const handleVerifyUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: Schema.Schema.Type<typeof VerifyUser>
): Effect.Effect<ReadonlyArray<UserEvent>, UserError> =>
  pipe(
    // Validate user exists
    aggregate.state === null
      ? Effect.fail(new UserNotFoundError(aggregate.id))
      : Effect.void,
    // Validate not already verified
    Effect.flatMap(() =>
      aggregate.state?.isVerified
        ? Effect.fail(new UserAlreadyVerifiedError(aggregate.id))
        : Effect.void
    ),
    // Validate verification code (simplified for demo)
    Effect.flatMap(() =>
      command.payload.verificationCode !== "VALID_CODE"
        ? Effect.fail(new InvalidVerificationCodeError(command.payload.verificationCode))
        : Effect.void
    ),
    // Create verification event
    Effect.map(() => [
      createEvent(
        "UserVerified",
        { verificationCode: command.payload.verificationCode },
        aggregate,
        command
      ),
    ])
  )

/**
 * 🎯 Login User Handler - PIPE PATTERN
 * Audit event creation with clean flow
 */
export const handleLoginUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: Schema.Schema.Type<typeof LoginUser>
): Effect.Effect<ReadonlyArray<UserEvent>, UserError> =>
  pipe(
    // Validate user exists
    aggregate.state === null
      ? Effect.fail(new UserNotFoundError(aggregate.id))
      : Effect.void,
    // Validate user is active
    Effect.flatMap(() =>
      !aggregate.state?.isActive
        ? Effect.fail(new UserNotActiveError(aggregate.id))
        : Effect.void
    ),
    // Create login event
    Effect.map(() => [
      createEvent(
        "UserLoggedIn",
        {
          ipAddress: command.payload.ipAddress,
          userAgent: command.payload.userAgent,
        },
        aggregate,
        command
      ),
    ])
  )

// ============================================================================
// Command Router - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Route commands to handlers using pipe pattern
 * Pattern matching with functional composition
 */
export const routeUserCommand = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  command: UserCommand
): Effect.Effect<Aggregate<UserState | null, UserEvent>, UserError> =>
  pipe(
    // Match command type and execute handler
    match(command)
      .with({ type: "RegisterUser" }, (cmd) => handleRegisterUser(aggregate, cmd))
      .with({ type: "ActivateUser" }, (cmd) => handleActivateUser(aggregate, cmd))
      .with({ type: "DeactivateUser" }, (cmd) => handleDeactivateUser(aggregate, cmd))
      .with({ type: "VerifyUser" }, (cmd) => handleVerifyUser(aggregate, cmd))
      .with({ type: "LoginUser" }, (cmd) => handleLoginUser(aggregate, cmd))
      .exhaustive(),
    // Apply events to aggregate
    Effect.map((events) =>
      events.reduce(
        (agg, event) => ({
          ...agg,
          state: applyUserEvent(agg.state, event),
          version: (agg.version + 1) as Version,
          uncommittedEvents: [...agg.uncommittedEvents, event],
        }),
        aggregate
      )
    )
  )

// ============================================================================
// Business Logic Pipelines
// ============================================================================

/**
 * 🎯 User registration workflow - PIPE PATTERN
 * Complete registration with activation in one pipeline
 */
export const registerAndActivateUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  email: Email,
  username: Username,
  passwordHash: NonEmptyString
): Effect.Effect<Aggregate<UserState | null, UserEvent>, UserError> =>
  pipe(
    // Create registration command
    Effect.succeed({
      type: "RegisterUser" as const,
      payload: { email, username, passwordHash },
      metadata: {
        commandId: createEventId(),
        aggregateId: aggregate.id,
        correlationId: createEventId(),
        causationId: createCausationId(),
        timestamp: now(),
        actor: { type: "system" as const },
      },
    }),
    // Register user
    Effect.flatMap((cmd) => routeUserCommand(aggregate, cmd)),
    // Auto-activate
    Effect.flatMap((updatedAggregate) =>
      pipe(
        Effect.succeed({
          type: "ActivateUser" as const,
          payload: { activatedBy: "system" as NonEmptyString },
          metadata: {
            commandId: createEventId(),
            aggregateId: updatedAggregate.id,
            correlationId: createEventId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "system" as const },
          },
        }),
        Effect.flatMap((cmd) => routeUserCommand(updatedAggregate, cmd))
      )
    )
  )

/**
 * 🎯 User verification workflow - PIPE PATTERN
 * Multi-step verification process
 */
export const verifyAndLoginUser = (
  aggregate: Aggregate<UserState | null, UserEvent>,
  verificationCode: NonEmptyString,
  ipAddress: NonEmptyString
): Effect.Effect<Aggregate<UserState | null, UserEvent>, UserError> =>
  pipe(
    // Verify user
    Effect.succeed({
      type: "VerifyUser" as const,
      payload: { verificationCode },
      metadata: {
        commandId: createEventId(),
        aggregateId: aggregate.id,
        correlationId: createEventId(),
        causationId: createCausationId(),
        timestamp: now(),
        actor: { type: "system" as const },
      },
    }),
    Effect.flatMap((cmd) => routeUserCommand(aggregate, cmd)),
    // Log them in
    Effect.flatMap((verifiedAggregate) =>
      pipe(
        Effect.succeed({
          type: "LoginUser" as const,
          payload: { ipAddress, userAgent: undefined },
          metadata: {
            commandId: createEventId(),
            aggregateId: verifiedAggregate.id,
            correlationId: createEventId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "system" as const },
          },
        }),
        Effect.flatMap((cmd) => routeUserCommand(verifiedAggregate, cmd))
      )
    )
  )

// ============================================================================
// Export Summary
// ============================================================================

export {
  // Types
  type UserState,
  type UserEvent,
  type UserCommand,
  type UserError,
  
  // Event Schemas
  UserRegistered,
  UserActivated,
  UserDeactivated,
  UserVerified,
  UserLoggedIn,
  
  // Command Schemas
  RegisterUser,
  ActivateUser,
  DeactivateUser,
  VerifyUser,
  LoginUser,
  
  // Errors
  UserAlreadyExistsError,
  UserNotFoundError,
  UserAlreadyActiveError,
  UserNotActiveError,
  UserAlreadyVerifiedError,
  InvalidVerificationCodeError,
}