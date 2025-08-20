/**
 * Pure Functional Aggregate Operations
 * 
 * No classes, just pure functions and data structures
 * Following the patterns from event-sourcing.ts
 */

import * as Effect from "effect/Effect"
import * as Data from "effect/Data"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type {
  AggregateId,
  Version,
  Timestamp,
  Username,
  NonEmptyString,
  EventId,
  Email,
  CorrelationId,
  CausationId,
} from "../schema/core/primitives"
import type { UserEvent, UserState } from "../domain/handlers/user-handlers-pipe"

// ============================================================================
// Aggregate Errors (using Data.TaggedError for discriminated unions)
// ============================================================================

export class AggregateNotFound extends Data.TaggedError("AggregateNotFound")<{
  readonly aggregateId: AggregateId
  readonly aggregateType: string
}> {}

export class ConcurrencyConflict extends Data.TaggedError("ConcurrencyConflict")<{
  readonly aggregateId: AggregateId
  readonly expectedVersion: Version
  readonly actualVersion: Version
}> {}

export class InvalidState extends Data.TaggedError("InvalidState")<{
  readonly aggregateId: AggregateId
  readonly reason: string
}> {}

export class BusinessRuleViolation extends Data.TaggedError("BusinessRuleViolation")<{
  readonly aggregateId: AggregateId
  readonly rule: string
  readonly context?: unknown
}> {}

export type AggregateError =
  | AggregateNotFound
  | ConcurrencyConflict
  | InvalidState
  | BusinessRuleViolation

// ============================================================================
// Core Types (Pure Data Structures)
// ============================================================================

/**
 * Aggregate metadata
 */
export interface AggregateMetadata {
  readonly aggregateId: AggregateId
  readonly version: Version
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
  readonly deletedAt: Option.Option<Timestamp>
}

/**
 * Aggregate snapshot for performance optimization
 */
export interface AggregateSnapshot<State> {
  readonly aggregateId: AggregateId
  readonly version: Version
  readonly state: State
  readonly timestamp: Timestamp
}

/**
 * Decision result from command handling
 */
export type Decision<Event, Error = AggregateError> =
  | { readonly _tag: "Success"; readonly events: ReadonlyArray<Event> }
  | { readonly _tag: "Failure"; readonly error: Error }
  | { readonly _tag: "NoOp"; readonly reason: string }

// ============================================================================
// Pure Functions for Aggregate Operations
// ============================================================================

/**
 * Create initial aggregate metadata
 * 
 * @param aggregateId - Unique identifier for the aggregate
 * @returns Initial metadata with version 0 and current timestamps
 * 
 * @example
 * ```typescript
 * const metadata = createMetadata(createAggregateId())
 * // { aggregateId: "...", version: 0, createdAt: ..., updatedAt: ..., deletedAt: None() }
 * ```
 */
export const createMetadata = (aggregateId: AggregateId): AggregateMetadata => ({
  aggregateId,
  version: 0 as Version,
  createdAt: Date.now() as Timestamp,
  updatedAt: Date.now() as Timestamp,
  deletedAt: Option.none(),
})

/**
 * Update metadata after applying an event
 * 
 * @param metadata - Current aggregate metadata
 * @param isDelete - Whether this event marks the aggregate as deleted
 * @returns Updated metadata with incremented version and updated timestamp
 * 
 * @example
 * ```typescript
 * const updated = updateMetadata(metadata)
 * // Version incremented, updatedAt updated
 * 
 * const deleted = updateMetadata(metadata, true)
 * // Also sets deletedAt timestamp
 * ```
 */
export const updateMetadata = (
  metadata: AggregateMetadata,
  isDelete: boolean = false
): AggregateMetadata => ({
  ...metadata,
  version: (metadata.version + 1) as Version,
  updatedAt: Date.now() as Timestamp,
  deletedAt: isDelete 
    ? Option.some(Date.now() as Timestamp)
    : metadata.deletedAt,
})

/**
 * Check if aggregate is deleted
 */
export const isDeleted = (metadata: AggregateMetadata): boolean =>
  Option.isSome(metadata.deletedAt)

/**
 * Validate version for optimistic concurrency control
 */
export const validateVersion = (
  expected: Version,
  actual: Version,
  aggregateId: AggregateId
): Effect.Effect<void, ConcurrencyConflict> =>
  expected === actual
    ? Effect.succeed(undefined)
    : Effect.fail(new ConcurrencyConflict({
        aggregateId,
        expectedVersion: expected,
        actualVersion: actual,
      }))

/**
 * Validate business rule
 * 
 * @param condition - Boolean condition that must be true
 * @param aggregateId - ID of the aggregate for error context
 * @param rule - Description of the business rule
 * @param context - Optional additional context for debugging
 * @returns Effect that succeeds if condition is true, fails with BusinessRuleViolation otherwise
 * 
 * @example
 * ```typescript
 * const validation = validateRule(
 *   order.total > 0,
 *   order.id,
 *   "Order total must be positive",
 *   { total: order.total }
 * )
 * ```
 */
export const validateRule = (
  condition: boolean,
  aggregateId: AggregateId,
  rule: string,
  context?: unknown
): Effect.Effect<void, BusinessRuleViolation> =>
  condition
    ? Effect.succeed(undefined)
    : Effect.fail(new BusinessRuleViolation({
        aggregateId,
        rule,
        context,
      }))

/**
 * Ensure aggregate exists
 */
export const ensureExists = <State>(
  state: Option.Option<State>,
  aggregateId: AggregateId,
  aggregateType: string
): Effect.Effect<State, AggregateNotFound> =>
  Option.match(state, {
    onNone: () => Effect.fail(new AggregateNotFound({
      aggregateId,
      aggregateType,
    })),
    onSome: Effect.succeed,
  })

/**
 * Ensure aggregate is not deleted
 */
export const ensureNotDeleted = (
  metadata: AggregateMetadata
): Effect.Effect<void, InvalidState> =>
  isDeleted(metadata)
    ? Effect.fail(new InvalidState({
        aggregateId: metadata.aggregateId,
        reason: "Aggregate is deleted",
      }))
    : Effect.succeed(undefined)

// ============================================================================
// Decision Constructors
// ============================================================================

export const Decision = {
  success: <Event>(events: ReadonlyArray<Event>): Decision<Event> => ({
    _tag: "Success",
    events,
  }),
  
  failure: <Event, Error = AggregateError>(error: Error): Decision<Event, Error> => ({
    _tag: "Failure",
    error,
  }),
  
  noOp: <Event>(reason: string): Decision<Event> => ({
    _tag: "NoOp",
    reason,
  }),
  
  /**
   * Pattern match on decision
   */
  match: <Event, Error, R>(
    decision: Decision<Event, Error>,
    patterns: {
      Success: (events: ReadonlyArray<Event>) => R
      Failure: (error: Error) => R
      NoOp: (reason: string) => R
    }
  ): R =>
    match(decision)
      .with({ _tag: "Success" }, d => patterns.Success(d.events))
      .with({ _tag: "Failure" }, d => patterns.Failure(d.error))
      .with({ _tag: "NoOp" }, d => patterns.NoOp(d.reason))
      .exhaustive(),
}

// ============================================================================
// Aggregate Lifecycle Functions
// ============================================================================

/**
 * Rebuild aggregate state from events
 */
export const rebuildFromEvents = <State, Event>(
  applyEvent: (state: State | null, event: Event) => State | null,
  initialState: State | null,
  events: ReadonlyArray<Event>
): State | null =>
  pipe(
    events,
    ReadonlyArray.reduce(initialState, applyEvent)
  )

/**
 * Create snapshot of current state
 */
export const createSnapshot = <State>(
  aggregateId: AggregateId,
  version: Version,
  state: State
): AggregateSnapshot<State> => ({
  aggregateId,
  version,
  state,
  timestamp: Date.now() as Timestamp,
})

/**
 * Load from snapshot and apply subsequent events
 */
export const loadFromSnapshot = <State, Event>(
  applyEvent: (state: State | null, event: Event) => State | null,
  snapshot: AggregateSnapshot<State>,
  events: ReadonlyArray<Event>
): State | null =>
  rebuildFromEvents(applyEvent, snapshot.state, events)

// ============================================================================
// Command Processing Pipeline
// ============================================================================

/**
 * Process command with validation and decision
 * 
 * Creates a command processor that validates and decides on events to produce.
 * This is the core pattern for command handling in event-sourced aggregates.
 * 
 * @template State - The aggregate state type
 * @template Command - The command type union
 * @template Event - The event type union
 * @param validate - Function to validate the command against current state
 * @param decide - Function to decide which events to produce
 * @returns Command processor function
 * 
 * @example
 * ```typescript
 * const handleCommand = processCommand<UserState, UserCommand, UserEvent>(
 *   // Validation
 *   (state, command) => 
 *     match(command)
 *       .with({ type: "CreateUser" }, () =>
 *         state ? Effect.fail(new AlreadyExists()) : Effect.succeed(undefined)
 *       )
 *       .exhaustive(),
 *   
 *   // Decision
 *   (state, command) =>
 *     Effect.succeed(
 *       match(command)
 *         .with({ type: "CreateUser" }, cmd =>
 *           Decision.success([createUserCreatedEvent(cmd)])
 *         )
 *         .exhaustive()
 *     )
 * )
 * ```
 */
export const processCommand = <State, Command, Event>(
  validate: (state: State | null, command: Command) => Effect.Effect<void, AggregateError>,
  decide: (state: State | null, command: Command) => Effect.Effect<Decision<Event>, never, never>
) => (
  state: State | null,
  command: Command
): Effect.Effect<Decision<Event>, AggregateError> =>
  Effect.gen(function* () {
    // Validate command
    yield* validate(state, command)
    
    // Make decision
    const decision = yield* decide(state, command)
    
    // Return decision or fail if it's a failure
    if (decision._tag === "Failure") {
      return yield* Effect.fail(decision.error)
    }
    
    return decision
  })

/**
 * Execute command and apply events
 */
export const executeCommandWithEvents = <State, Command, Event>(
  processCmd: (state: State | null, command: Command) => Effect.Effect<Decision<Event>, AggregateError>,
  applyEvent: (state: State | null, event: Event) => State | null
) => (
  state: State | null,
  command: Command
): Effect.Effect<{
  readonly newState: State | null
  readonly events: ReadonlyArray<Event>
  readonly decision: Decision<Event>
}, AggregateError> =>
  Effect.gen(function* () {
    const decision = yield* processCmd(state, command)
    
    const events = Decision.match(decision, {
      Success: events => events,
      Failure: () => [],
      NoOp: () => [],
    })
    
    const newState = rebuildFromEvents(applyEvent, state, events)
    
    return {
      newState,
      events,
      decision,
    }
  })

// ============================================================================
// Projection Helpers
// ============================================================================

/**
 * Create a projection from events
 * 
 * Projections are read models built from event streams. They provide
 * optimized views of the data for querying.
 * 
 * @template State - The projection state type
 * @template Event - The event type union
 * @param name - Name of the projection for identification
 * @param initialState - Initial state of the projection
 * @param handlers - Event handlers that update the state
 * @returns Projection object with apply and rebuild methods
 * 
 * @example
 * ```typescript
 * const UserListProjection = createSimpleProjection(
 *   "UserList",
 *   [] as User[],
 *   {
 *     UserCreated: (state, event) => 
 *       [...state, { id: event.aggregateId, name: event.data.name }],
 *     UserDeleted: (state, event) =>
 *       state.filter(u => u.id !== event.aggregateId)
 *   }
 * )
 * 
 * const userList = UserListProjection.rebuild(events)
 * ```
 */
export const createSimpleProjection = <State, Event extends { type: string; aggregateId: string; data: Record<string, unknown> }>(
  name: string,
  initialState: State,
  handlers: {
    [K in Event["type"]]: (
      state: State,
      event: Extract<Event, { type: Event["type"] }>
    ) => State
  }
) => ({
  name,
  initialState,
  apply: (state: State, event: Event): State => {
    const handler = handlers[event.type as keyof typeof handlers]
    return handler ? handler(state, event as Extract<Event, { type: Event["type"] }>) : state
  },
  rebuild: (events: ReadonlyArray<Event>): State => {
    return pipe(
      events,
      ReadonlyArray.reduce(initialState, (state, event) => {
        const handler = handlers[event.type as keyof typeof handlers]
        return handler ? handler(state, event as Extract<Event, { type: Event["type"] }>) : state
        })
      )
    }
})


const events: ReadonlyArray<UserEvent>  = [
  { type: "UserRegistered", aggregateId: "1" as AggregateId, data: { username: "test" as Username, email: "test@test.com" as Email, passwordHash: "password" as NonEmptyString }, metadata: { aggregateId: "1" as AggregateId, eventId: "1" as EventId, version: 0 as Version, timestamp: Date.now() as Timestamp, correlationId: "1" as CorrelationId, causationId: "1" as CausationId, actor: { id: "1" as ActorId, name: "system" as NonEmptyString } } },
  { type: "UserActivated", aggregateId: "1" as AggregateId, data: { activatedBy: "system" as NonEmptyString }, metadata: { aggregateId: "1" as AggregateId, eventId: "1" as EventId, version: 0 as Version, timestamp: Date.now() as Timestamp, correlationId: "1" as CorrelationId, causationId: "1" as CausationId, actor: { id: "1" as ActorId, name: "system" as NonEmptyString } } },
]

const projection = createSimpleProjection("UserList", [] as ReadonlyArray<UserState>, {
  UserRegistered: (state, event) => {
    return [event.data as UserState, ...state]
  },
  UserActivated: (state, event) => {
    return state.filter(u => u.username !== (event.data as UserState).username)
  }
})  

console.log(projection.apply(projection.initialState, events[0]))
console.log(projection.apply(projection.initialState, events[1]))
const newState = projection.rebuild(events)

console.log(newState)

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example: Creating a pure functional aggregate
 * 
 * @example
 * ```typescript
 * // Define your state
 * interface UserState {
 *   id: AggregateId
 *   email: string
 *   name: string
 * }
 * 
 * // Define event applicator
 * const applyUserEvent = (state: UserState | null, event: UserEvent): UserState | null =>
 *   match(event)
 *     .with({ type: "UserCreated" }, e => ({
 *       id: e.aggregateId,
 *       email: e.data.email,
 *       name: e.data.name,
 *     }))
 *     .with({ type: "UserDeleted" }, () => null)
 *     .exhaustive()
 * 
 * // Define command handler
 * const handleUserCommand = processCommand<UserState, UserCommand, UserEvent>(
 *   // Validation
 *   (state, command) => 
 *     match(command)
 *       .with({ type: "CreateUser" }, () =>
 *         state !== null 
 *           ? Effect.fail(new InvalidState({ aggregateId: command.aggregateId, reason: "User already exists" }))
 *           : Effect.succeed(undefined)
 *       )
 *       .exhaustive(),
 *   
 *   // Decision
 *   (state, command) =>
 *     Effect.succeed(
 *       match(command)
 *         .with({ type: "CreateUser" }, cmd =>
 *           Decision.success([{
 *             type: "UserCreated",
 *             aggregateId: cmd.aggregateId,
 *             data: { email: cmd.email, name: cmd.name }
 *           }])
 *         )
 *         .exhaustive()
 *     )
 * )
 * ```
 */