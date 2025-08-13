/**
 * Pure Functional Event Sourcing
 * 
 * Pure functions for event sourcing operations
 * No classes, no inheritance, just functions and data
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import { match, P } from "ts-pattern"
import type { Version } from "../schema/core/primitives"
import { createAggregate } from "../domain/aggregate"

// ============================================================================
// Core Types
// ============================================================================

/**
 * Event Sourced Aggregate - Pure data structure
 * 
 * Represents the current state of an aggregate with its version and uncommitted events.
 * This is a pure data structure with no methods, following functional programming principles.
 * 
 * @template State - The aggregate state type
 * @template Event - The event type union
 */
export interface EventSourcedAggregate<State, Event> {
  readonly state: State
  readonly version: Version
  readonly uncommittedEvents: ReadonlyArray<Event>
  readonly isDeleted: boolean
}

/**
 * Command Decision - Result of command execution
 * 
 * Represents the outcome of processing a command:
 * - success: Command accepted, events produced
 * - failure: Command rejected with error
 * - noOp: Command ignored (idempotent operation)
 * 
 * @template Event - The event type union
 * @template Error - The error type
 */
export type CommandDecision<Event, Error> =
  | { type: "success"; events: ReadonlyArray<Event> }
  | { type: "failure"; error: Error }
  | { type: "noOp"; reason: string }

/**
 * Event Application Function
 * 
 * Pure function that applies an event to the current state.
 * Returns null if the event results in aggregate deletion.
 * 
 * @template State - The aggregate state type
 * @template Event - The event type union
 */
export type EventApplicator<State, Event> = (
  state: State | null,
  event: Event
) => State | null

/**
 * Command Handler Function
 * 
 * Pure function that processes a command and returns a decision.
 * This is where business logic and validation live.
 * 
 * @template State - The aggregate state type
 * @template Command - The command type union
 * @template Event - The event type union
 * @template Error - The error type
 */
export type CommandHandler<State, Command, Event, Error> = (
  state: State | null,
  command: Command
) => Effect.Effect<CommandDecision<Event, Error>, never, never>

// ============================================================================
// Pure Event Sourcing Functions
// ============================================================================

/**
 * Create an empty aggregate
 * 
 * @template State - The aggregate state type
 * @template Event - The event type union
 * @param initialState - Initial state of the aggregate
 * @returns New aggregate with version 0 and no uncommitted events
 * 
 * @example
 * ```typescript
 * const user = createAggregate<UserState, UserEvent>({
 *   id: createAggregateId(),
 *   email: "user@example.com",
 *   status: "pending"
 * })
 * ```
 */
export const createLegacyAggregate = <State, Event>(
  initialState: State
): EventSourcedAggregate<State, Event> => ({
  state: initialState,
  version: 0 as Version,
  uncommittedEvents: [],
  isDeleted: false
})

/**
 * Apply a single event to state
 * 
 * @template State - The aggregate state type
 * @template Event - The event type union
 * @param applicator - Function to apply event to state
 * @returns Curried function that applies event to aggregate
 * 
 * @example
 * ```typescript
 * const apply = applyEvent(userEventApplicator)
 * const updated = apply(aggregate, userCreatedEvent)
 * ```
 */
export const applyEvent = <State, Event>(
  applicator: EventApplicator<State, Event>
) => (
  aggregate: EventSourcedAggregate<State, Event>,
  event: Event
): EventSourcedAggregate<State, Event> => {
    const newState = applicator(aggregate.state, event)

    return {
      state: newState ?? aggregate.state,
      version: ((aggregate.version as number) + 1) as Version,
      uncommittedEvents: [...aggregate.uncommittedEvents, event],
      isDeleted: newState === null
    }
  }

/**
 * Apply multiple events to state
 * 
 * @template State - The aggregate state type
 * @template Event - The event type union
 * @param applicator - Function to apply each event
 * @returns Curried function that applies events to aggregate
 * 
 * @example
 * ```typescript
 * const apply = applyEvents(userEventApplicator)
 * const updated = apply(aggregate, [event1, event2, event3])
 * ```
 */
export const applyEvents = <State, Event>(
  applicator: EventApplicator<State, Event>
) => (
  aggregate: EventSourcedAggregate<State, Event>,
  events: ReadonlyArray<Event>
): EventSourcedAggregate<State, Event> =>
    pipe(
      events,
      ReadonlyArray.reduce(aggregate, (agg, event) =>
        applyEvent(applicator)(agg, event)
      )
    )

/**
 * Load aggregate from event history
 * 
 * Rebuilds aggregate state by replaying all events from the beginning.
 * This is the foundation of event sourcing - state is derived from events.
 * 
 * @template State - The aggregate state type  
 * @template Event - The event type union
 * @param applicator - Function to apply each event
 * @param initialState - Optional initial state
 * @returns Function that loads aggregate from events
 * 
 * @example
 * ```typescript
 * const load = loadFromEvents(userEventApplicator)
 * const aggregate = load(events)
 * // Aggregate state is now at the latest version
 * ```
 */
export const loadLegacyFromEvents = <State, Event>(
  applicator: EventApplicator<State, Event>,
  initialState: State | null = null
) => (
  events: ReadonlyArray<Event>
): EventSourcedAggregate<State, Event> => {
    const initial = createAggregate(initialState as State)

    return pipe(
      events,
      ReadonlyArray.reduce(initial, (agg, event) => {
        const newState = applicator(agg.state, event)
        return {
          ...agg,
          state: newState ?? agg.state,
          version: ((agg.version as number) + 1) as Version,
          isDeleted: newState === null
        }
      })
    )
  }

/**
 * Execute a command against an aggregate
 * 
 * Processes a command, produces events, and returns updated aggregate.
 * This combines command handling with event application in a single operation.
 * 
 * @template State - The aggregate state type
 * @template Command - The command type union
 * @template Event - The event type union
 * @template Error - The error type
 * @param handler - Command handler function
 * @param applicator - Event applicator function
 * @returns Curried function that executes command on aggregate
 * 
 * @example
 * ```typescript
 * const execute = executeCommand(userCommandHandler, userEventApplicator)
 * const result = await pipe(
 *   execute(userAggregate, createUserCommand),
 *   Effect.runPromise
 * )
 * ```
 */
export const executeCommand = <State, Command, Event, Error>(
  handler: CommandHandler<State, Command, Event, Error>,
  applicator: EventApplicator<State, Event>
) => (
  aggregate: EventSourcedAggregate<State, Event>,
  command: Command
): Effect.Effect<EventSourcedAggregate<State, Event>, Error, never> =>
    pipe(
      handler(aggregate.state, command),
      Effect.flatMap(decision =>
        match(decision)
          .with({ type: "success" }, ({ events }) =>
            Effect.succeed(applyEvents(applicator)(aggregate, events))
          )
          .with({ type: "failure" }, ({ error }) =>
            Effect.fail(error)
          )
          .with({ type: "noOp" }, () =>
            Effect.succeed(aggregate)
          )
          .exhaustive()
      )
    )

/**
 * Get uncommitted events from aggregate
 */
export const getUncommittedEvents = <State, Event>(
  aggregate: EventSourcedAggregate<State, Event>
): ReadonlyArray<Event> => aggregate.uncommittedEvents

/**
 * Mark events as committed
 */
export const markLegacyEventsAsCommitted = <State, Event>(
  aggregate: EventSourcedAggregate<State, Event>
): EventSourcedAggregate<State, Event> => ({
  ...aggregate,
  uncommittedEvents: []
})

// ============================================================================
// Pattern-Based Event Application
// ============================================================================

/**
 * Create a pattern-based event applicator
 */
export const createEventApplicator = <State, Event extends { type: string }>(
  patterns: {
    [K in Event["type"]]: (
      state: State | null,
      event: Extract<Event, { type: K }>
    ) => State | null
  }
): EventApplicator<State, Event> => (state, event) =>
    match(event)
      .when(
        (e): e is Event => e.type in patterns,
        (e) => patterns[e.type as Event["type"]](state, e as any)
      )
      .otherwise(() => state)

/**
 * Create a pattern-based command handler
 */
export const createLegacyCommandHandler = <
  State,
  Command extends { type: string },
  Event,
  Error
>(
  patterns: {
    [K in Command["type"]]: (
      state: State | null,
      command: Extract<Command, { type: K }>
    ) => Effect.Effect<CommandDecision<Event, Error>, never, never>
  }
): CommandHandler<State, Command, Event, Error> => (state, command) =>
    match(command)
      .when(
        (c): c is Command => c.type in patterns,
        (c) => patterns[c.type as Command["type"]](state, c as any)
      )
      .otherwise(() =>
        Effect.succeed({
          type: "noOp" as const,
          reason: `Unknown command type: ${command.type}`
        })
      )

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate command with schema
 */
export const validateCommand = <Command>(
  schema: Schema.Schema<Command, unknown>
) => (
  command: unknown
): Effect.Effect<Command, Schema.ParseError> =>
    Schema.decodeUnknown(schema)(command)

/**
 * Ensure aggregate exists (not deleted)
 */
export const ensureExists = <State, Event, Error>(
  aggregate: EventSourcedAggregate<State, Event>,
  error: Error
): Effect.Effect<EventSourcedAggregate<State, Event>, Error> =>
  aggregate.isDeleted
    ? Effect.fail(error)
    : Effect.succeed(aggregate)

/**
 * Ensure aggregate doesn't exist (for creation)
 */
export const ensureNotExists = <State, Event, Error>(
  aggregate: EventSourcedAggregate<State, Event> | null,
  error: Error
): Effect.Effect<void, Error> =>
  aggregate && !aggregate.isDeleted
    ? Effect.fail(error)
    : Effect.succeed(undefined)

// ============================================================================
// Snapshot Support
// ============================================================================

/**
 * Create snapshot of aggregate
 */
export const createSnapshot = <State, Event>(
  aggregate: EventSourcedAggregate<State, Event>
): { state: State; version: Version } => ({
  state: aggregate.state,
  version: aggregate.version
})

/**
 * Load from snapshot and events
 */
export const loadFromSnapshot = <State, Event>(
  snapshot: { state: State; version: Version },
  events: ReadonlyArray<Event>,
  applicator: EventApplicator<State, Event>
): EventSourcedAggregate<State, Event> => {
  const initial: EventSourcedAggregate<State, Event> = {
    state: snapshot.state,
    version: snapshot.version,
    uncommittedEvents: [],
    isDeleted: false
  }

  return applyEvents(applicator)(initial, events)
}

// ============================================================================
// Projection Support
// ============================================================================

/**
 * Projection - Pure reducer for read models
 */
export interface Projection<State, Event> {
  readonly name: string
  readonly initialState: State
  readonly reducer: (state: State, event: Event) => State
}

/**
 * Create a projection
 */
export const createProjection = <State, Event extends { type: string }>(
  name: string,
  initialState: State,
  patterns: {
    [K in Event["type"]]?: (
      state: State,
      event: Extract<Event, { type: K }>
    ) => State
  }
): Projection<State, Event> => ({
  name,
  initialState,
  reducer: (state, event) =>
    match(event)
      .when(
        (e): e is Event => e.type in patterns && patterns[e.type] !== undefined,
        (e) => patterns[e.type as Event["type"]]!(state, e as any)
      )
      .otherwise(() => state)
})

/**
 * Run projection over events
 */
export const runProjection = <State, Event>(
  projection: Projection<State, Event>,
  events: ReadonlyArray<Event>
): State =>
  pipe(
    events,
    ReadonlyArray.reduce(projection.initialState, projection.reducer)
  )

/**
 * Create multiple projections from the same events
 */
export const createProjectionSet = <Event>(
  projections: ReadonlyArray<Projection<any, Event>>
) => (events: ReadonlyArray<Event>): Map<string, any> =>
    new Map(
      projections.map(projection => [
        projection.name,
        runProjection(projection, events)
      ])
    )

// ============================================================================
// Saga/Process Manager Support
// ============================================================================

/**
 * Saga Step - A step in a process manager
 */
export interface SagaStep<Event, Command> {
  readonly on: Event["type"]
  readonly execute: (event: Event) => Effect.Effect<ReadonlyArray<Command>, never, never>
}

/**
 * Create a saga/process manager
 */
export const createSaga = <Event extends { type: string }, Command>(
  name: string,
  steps: ReadonlyArray<SagaStep<Event, Command>>
) => (event: Event): Effect.Effect<ReadonlyArray<Command>, never, never> =>
    pipe(
      steps,
      ReadonlyArray.findFirst(step => step.on === event.type),
      Option.match({
        onNone: () => Effect.succeed([]),
        onSome: (step) => step.execute(event)
      })
    )