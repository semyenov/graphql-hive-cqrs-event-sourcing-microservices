/**
 * ✅ FIXED User Domain - Functional Approach
 * 
 * Replaces the class-based UserAggregate that has "this" keyword issues
 * with pure functional patterns that work perfectly with Effect.gen
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

// Import functional framework components (NO classes)
import {
  type Aggregate,
  type EventApplicator,
  createAggregate,
  createCommandHandler,
  createRepository,
  createEventSchema,
  createCommandSchema,
  AggregateId,
  Version,
  Email,
  Username,
  NonEmptyString,
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
  nonEmptyString,
  email,
  username,
} from "@cqrs/framework"

// ============================================================================
// Domain Types (using proper branded types)
// ============================================================================

type UserId = AggregateId
type HashedPassword = NonEmptyString
type VerificationToken = NonEmptyString
type IPAddress = NonEmptyString

/**
 * User state - pure data structure (NO classes)
 */
const UserState = Schema.Struct({
  email: Email,
  username: Username,
  passwordHash: NonEmptyString,
  firstName: Schema.optional(NonEmptyString),
  lastName: Schema.optional(NonEmptyString),
  isActive: Schema.Boolean,
  isEmailVerified: Schema.Boolean,
  twoFactorEnabled: Schema.Boolean,
  loginAttempts: Schema.Number,
  lastLoginAt: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  suspendedUntil: Schema.optional(Schema.Number),
})
type UserState = Schema.Schema.Type<typeof UserState>

/**
 * User aggregate - functional interface (NO classes)
 */
type UserAggregate = Aggregate<UserState | null, UserEvent>

// ============================================================================
// Events - Schema-First (replacing class-based events)
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
    activatedBy: Schema.optional(NonEmptyString),
  })
)

const UserDeleted = createEventSchema(
  "UserDeleted",
  Schema.Struct({
    deletedBy: Schema.optional(NonEmptyString),
    reason: Schema.optional(Schema.String),
    scheduledPurgeDate: Schema.Number,
  })
)

const UserSuspended = createEventSchema(
  "UserSuspended",
  Schema.Struct({
    suspendedBy: NonEmptyString,
    reason: Schema.String,
    suspendedUntil: Schema.optional(Schema.String),
  })
)

const EmailVerified = createEventSchema(
  "EmailVerified",
  Schema.Struct({
    verificationToken: NonEmptyString,
  })
)

const PasswordChanged = createEventSchema(
  "PasswordChanged",
  Schema.Struct({
    newPasswordHash: NonEmptyString,
    changedBy: Schema.Literal("USER", "ADMIN", "SYSTEM"),
  })
)

const ProfileUpdated = createEventSchema(
  "ProfileUpdated",
  Schema.Struct({
    firstName: Schema.optional(NonEmptyString),
    lastName: Schema.optional(NonEmptyString),
  })
)

const LoginRecorded = createEventSchema(
  "LoginRecorded",
  Schema.Struct({
    ipAddress: NonEmptyString,
    userAgent: Schema.optional(Schema.String),
    twoFactorUsed: Schema.Boolean,
  })
)

type UserEvent =
  | Schema.Schema.Type<typeof UserRegistered>
  | Schema.Schema.Type<typeof UserActivated>
  | Schema.Schema.Type<typeof UserDeleted>
  | Schema.Schema.Type<typeof UserSuspended>
  | Schema.Schema.Type<typeof EmailVerified>
  | Schema.Schema.Type<typeof PasswordChanged>
  | Schema.Schema.Type<typeof ProfileUpdated>
  | Schema.Schema.Type<typeof LoginRecorded>

// ============================================================================
// Commands - Schema-First
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
    activatedBy: Schema.optional(NonEmptyString),
  })
)

const DeleteUser = createCommandSchema(
  "DeleteUser",
  Schema.Struct({
    deletedBy: Schema.optional(NonEmptyString),
    reason: Schema.optional(Schema.String),
  })
)

const SuspendUser = createCommandSchema(
  "SuspendUser",
  Schema.Struct({
    suspendedBy: NonEmptyString,
    reason: Schema.String,
    suspendedUntil: Schema.optional(Schema.String),
  })
)

const VerifyEmail = createCommandSchema(
  "VerifyEmail",
  Schema.Struct({
    verificationToken: NonEmptyString,
  })
)

const ChangePassword = createCommandSchema(
  "ChangePassword",
  Schema.Struct({
    newPasswordHash: NonEmptyString,
    changedBy: Schema.optional(Schema.Literal("USER", "ADMIN", "SYSTEM")),
  })
)

const UpdateProfile = createCommandSchema(
  "UpdateProfile",
  Schema.Struct({
    firstName: Schema.optional(NonEmptyString),
    lastName: Schema.optional(NonEmptyString),
  })
)

const RecordLogin = createCommandSchema(
  "RecordLogin",
  Schema.Struct({
    ipAddress: NonEmptyString,
    userAgent: Schema.optional(Schema.String),
    twoFactorUsed: Schema.optional(Schema.Boolean),
  })
)

type UserCommand =
  | Schema.Schema.Type<typeof RegisterUser>
  | Schema.Schema.Type<typeof ActivateUser>
  | Schema.Schema.Type<typeof DeleteUser>
  | Schema.Schema.Type<typeof SuspendUser>
  | Schema.Schema.Type<typeof VerifyEmail>
  | Schema.Schema.Type<typeof ChangePassword>
  | Schema.Schema.Type<typeof UpdateProfile>
  | Schema.Schema.Type<typeof RecordLogin>

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

class UserDeletedError {
  readonly _tag = "UserDeletedError"
  constructor(readonly id: AggregateId) {}
}

class InvalidUserStatusError {
  readonly _tag = "InvalidUserStatusError"
  constructor(readonly id: AggregateId, readonly status: string) {}
}

class EmailAlreadyVerifiedError {
  readonly _tag = "EmailAlreadyVerifiedError"
  constructor(readonly id: AggregateId) {}
}

type UserError =
  | UserAlreadyExistsError
  | UserNotFoundError
  | UserAlreadyActiveError
  | UserDeletedError
  | InvalidUserStatusError
  | EmailAlreadyVerifiedError

// ============================================================================
// Pure Event Applicator - ✅ NO "this" keyword
// ============================================================================

/**
 * ✅ Pure function that applies events to user state
 * Replaces the class method that had "this" issues
 */
const applyUserEvent: EventApplicator<UserState, UserEvent> = (state, event) =>
  match(event)
    .with({ type: "UserRegistered" }, (e) => ({
      email: e.data.email,
      username: e.data.username,
      passwordHash: e.data.passwordHash,
      firstName: undefined,
      lastName: undefined,
      isActive: false, // Users start inactive until verified/activated
      isEmailVerified: false,
      twoFactorEnabled: false,
      loginAttempts: 0,
      lastLoginAt: undefined,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
      suspendedUntil: undefined,
    }))
    .with({ type: "UserActivated" }, (e) =>
      state ? { ...state, isActive: true, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "UserDeleted" }, (e) =>
      // User is deleted - state becomes null
      null
    )
    .with({ type: "UserSuspended" }, (e) =>
      state ? {
        ...state,
        isActive: false,
        suspendedUntil: e.data.suspendedUntil ? new Date(e.data.suspendedUntil).getTime() : undefined,
        updatedAt: e.metadata.timestamp,
      } : null
    )
    .with({ type: "EmailVerified" }, (e) =>
      state ? { ...state, isEmailVerified: true, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "PasswordChanged" }, (e) =>
      state ? { ...state, passwordHash: e.data.newPasswordHash, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "ProfileUpdated" }, (e) =>
      state ? {
        ...state,
        firstName: e.data.firstName ?? state.firstName,
        lastName: e.data.lastName ?? state.lastName,
        updatedAt: e.metadata.timestamp,
      } : null
    )
    .with({ type: "LoginRecorded" }, (e) =>
      state ? {
        ...state,
        lastLoginAt: e.metadata.timestamp,
        loginAttempts: 0, // Reset failed attempts on successful login
        updatedAt: e.metadata.timestamp,
      } : null
    )
    .exhaustive()

// ============================================================================
// Command Handlers - ✅ Pure Functions with Effect.gen (NO "this" issues)
// ============================================================================

/**
 * ✅ Register user handler - functional approach
 * REPLACES: The class method that used "this.applyEvent.bind(this)"
 */
const registerUserHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof RegisterUser>,
  UserEvent,
  UserError
>({
  name: "RegisterUser",
  commandType: "RegisterUser",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword here - just pure function parameters
      
      // Check if user already exists
      if (aggregate.state !== null) {
        return yield* Effect.fail(new UserAlreadyExistsError(command.payload.email))
      }
      
      // Create registration event
      const event: Schema.Schema.Type<typeof UserRegistered> = {
        type: "UserRegistered",
        data: {
          email: command.payload.email,
          username: command.payload.username,
          passwordHash: command.payload.passwordHash,
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
 * ✅ Activate user handler - functional approach
 * REPLACES: The class method with "this" binding issues
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
      // ✅ NO "this" keyword - pure function approach
      
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      if (aggregate.state.isActive) {
        return yield* Effect.fail(new UserAlreadyActiveError(aggregate.id))
      }
      
      const event: Schema.Schema.Type<typeof UserActivated> = {
        type: "UserActivated",
        data: {
          activatedBy: command.payload.activatedBy,
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
 * ✅ Delete user handler - functional approach
 * REPLACES: The problematic class method with "this.applyEvent.bind(this)"
 */
const deleteUserHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof DeleteUser>,
  UserEvent,
  UserError
>({
  name: "DeleteUser",
  commandType: "DeleteUser",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword issues here
      
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      // Calculate purge date (30 days from now)
      const purgeDate = new Date()
      purgeDate.setDate(purgeDate.getDate() + 30)
      
      const event: Schema.Schema.Type<typeof UserDeleted> = {
        type: "UserDeleted",
        data: {
          deletedBy: command.payload.deletedBy,
          reason: command.payload.reason,
          scheduledPurgeDate: purgeDate.getTime(),
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
 * ✅ Record login handler - functional approach
 * REPLACES: Class method with "this" context issues
 */
const recordLoginHandler = createCommandHandler<
  UserState | null,
  Schema.Schema.Type<typeof RecordLogin>,
  UserEvent,
  UserError
>({
  name: "RecordLogin",
  commandType: "RecordLogin",
  
  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword - works perfectly with Effect.gen
      
      if (aggregate.state === null) {
        return yield* Effect.fail(new UserNotFoundError(aggregate.id))
      }
      
      const event: Schema.Schema.Type<typeof LoginRecorded> = {
        type: "LoginRecorded",
        data: {
          ipAddress: command.payload.ipAddress,
          userAgent: command.payload.userAgent,
          twoFactorUsed: command.payload.twoFactorUsed ?? false,
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
 * ✅ Create user repository - functional approach
 */
const createUserRepository = () =>
  createRepository("User", applyUserEvent, null)

// ============================================================================
// Export Everything for Migration
// ============================================================================

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
  UserDeleted,
  UserSuspended,
  EmailVerified,
  PasswordChanged,
  ProfileUpdated,
  LoginRecorded,
  
  // Command schemas
  RegisterUser,
  ActivateUser,
  DeleteUser,
  SuspendUser,
  VerifyEmail,
  ChangePassword,
  UpdateProfile,
  RecordLogin,
  
  // Pure functions - NO "this" keyword issues
  applyUserEvent,
  registerUserHandler,
  activateUserHandler,
  deleteUserHandler,
  recordLoginHandler,
  createUserRepository,
}