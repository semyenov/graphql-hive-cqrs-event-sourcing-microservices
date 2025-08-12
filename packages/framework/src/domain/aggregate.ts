/**
 * Functional Aggregate Pattern for Event Sourcing
 * 
 * Pure functions for aggregate operations without classes or 'this' context
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type {
  AggregateId,
  Version,
  Timestamp,
} from "../schema/core/primitives"
import type { DomainEvent } from "../schema/core/messages"

// ============================================================================
// Core Types
// ============================================================================

/**
 * Base aggregate interface - pure data structure
 */
export interface Aggregate<State = unknown, Event extends DomainEvent = DomainEvent> {
  readonly id: AggregateId
  readonly version: Version
  readonly state: State
  readonly uncommittedEvents: ReadonlyArray<Event>
  readonly metadata?: Record<string, unknown>
}

/**
 * Event applicator function type
 */
export type EventApplicator<State, Event extends DomainEvent> = (
  state: State | null,
  event: Event
) => State | null

/**
 * Command decision - the result of handling a command
 */
export type CommandDecision<Event extends DomainEvent = DomainEvent, Error = never> =
  | { readonly type: "success"; readonly events: ReadonlyArray<Event> }
  | { readonly type: "failure"; readonly error: Error }
  | { readonly type: "none" }

/**
 * Command handler function type
 */
export type CommandHandler<
  State,
  Command,
  Event extends DomainEvent,
  Error = never,
  Requirements = never
> = (
  aggregate: Aggregate<State, Event>,
  command: Command
) => Effect.Effect<CommandDecision<Event, Error>, never, Requirements>

// ============================================================================
// Aggregate Creation
// ============================================================================

/**
 * Create an empty aggregate
 */
export const createAggregate = <State, Event extends DomainEvent>(
  id: AggregateId,
  initialState: State | null = null
): Aggregate<State | null, Event> => ({
  id,
  version: -1 as Version, // Start at -1 for empty aggregate (no events yet)
  state: initialState,
  uncommittedEvents: [],
})

/**
 * Create aggregate with initial event
 */
export const createWithEvent = <State, Event extends DomainEvent>(
  id: AggregateId,
  event: Event,
  applicator: EventApplicator<State, Event>
): Aggregate<State | null, Event> => {
  const state = applicator(null, event)
  return {
    id,
    version: 1 as Version,
    state,
    uncommittedEvents: [event],
  }
}

// ============================================================================
// Event Application
// ============================================================================

/**
 * Apply a single event to an aggregate
 */
export const applyEvent = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>,
  event: Event,
  applicator: EventApplicator<State, Event>
): Aggregate<State, Event> => {
  const newState = applicator(aggregate.state, event)
  return {
    ...aggregate,
    state: newState as State,
    version: (aggregate.version + 1) as Version,
    uncommittedEvents: [...aggregate.uncommittedEvents, event],
  }
}

/**
 * Apply multiple events to an aggregate
 */
export const applyEvents = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>,
  events: ReadonlyArray<Event>,
  applicator: EventApplicator<State, Event>
): Aggregate<State, Event> =>
  events.reduce(
    (agg, event) => applyEvent(agg, event, applicator),
    aggregate
  )

/**
 * Load aggregate from event history
 */
export const loadFromEvents = <State, Event extends DomainEvent>(
  id: AggregateId,
  events: ReadonlyArray<Event>,
  applicator: EventApplicator<State, Event>,
  initialState: State | null = null
): Aggregate<State | null, Event> => {
  const aggregate = createAggregate<State, Event>(id, initialState)
  return events.reduce(
    (agg, event) => ({
      ...agg,
      state: applicator(agg.state, event),
      version: (agg.version + 1) as Version,
    }),
    aggregate
  )
}

// ============================================================================
// Command Handling
// ============================================================================

/**
 * Handle command and produce events
 */
export const handleCommand = <State, Command, Event extends DomainEvent, Error, Requirements>(
  aggregate: Aggregate<State, Event>,
  command: Command,
  handler: CommandHandler<State, Command, Event, Error, Requirements>
): Effect.Effect<Aggregate<State, Event>, Error, Requirements> =>
  pipe(
    handler(aggregate, command),
    Effect.flatMap((decision) =>
      match(decision)
        .with({ type: "success" }, ({ events }) =>
          Effect.succeed(
            applyEvents(aggregate, events, (state, event) => 
              // This needs to be provided by the caller
              state as State
            )
          )
        )
        .with({ type: "failure" }, ({ error }) =>
          Effect.fail(error)
        )
        .with({ type: "none" }, () =>
          Effect.succeed(aggregate)
        )
        .exhaustive()
    )
  )

/**
 * Handle command with custom event applicator
 */
export const handleCommandWithApplicator = <State, Command, Event extends DomainEvent, Error, Requirements>(
  aggregate: Aggregate<State, Event>,
  command: Command,
  handler: CommandHandler<State, Command, Event, Error, Requirements>,
  applicator: EventApplicator<State, Event>
): Effect.Effect<Aggregate<State, Event>, Error, Requirements> =>
  pipe(
    handler(aggregate, command),
    Effect.flatMap((decision) =>
      match(decision)
        .with({ type: "success" }, ({ events }) =>
          Effect.succeed(applyEvents(aggregate, events, applicator))
        )
        .with({ type: "failure" }, ({ error }) =>
          Effect.fail(error)
        )
        .with({ type: "none" }, () =>
          Effect.succeed(aggregate)
        )
        .exhaustive()
    )
  )

// ============================================================================
// Aggregate Operations
// ============================================================================

/**
 * Mark all events as committed
 */
export const markEventsAsCommitted = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>
): Aggregate<State, Event> => ({
  ...aggregate,
  uncommittedEvents: [],
})

/**
 * Get uncommitted events
 */
export const getUncommittedEvents = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>
): ReadonlyArray<Event> =>
  aggregate.uncommittedEvents

/**
 * Check if aggregate has uncommitted events
 */
export const hasUncommittedEvents = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>
): boolean =>
  aggregate.uncommittedEvents.length > 0

/**
 * Get aggregate snapshot
 */
export const toSnapshot = <State, Event extends DomainEvent>(
  aggregate: Aggregate<State, Event>
): {
  readonly id: AggregateId
  readonly version: Version
  readonly state: State
} => ({
  id: aggregate.id,
  version: aggregate.version,
  state: aggregate.state,
})

/**
 * Load from snapshot
 */
export const fromSnapshot = <State, Event extends DomainEvent>(
  snapshot: {
    readonly id: AggregateId
    readonly version: Version
    readonly state: State
  }
): Aggregate<State, Event> => ({
  id: snapshot.id,
  version: snapshot.version,
  state: snapshot.state,
  uncommittedEvents: [],
})

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate aggregate state
 */
export const validateState = <State, Event extends DomainEvent, Error>(
  aggregate: Aggregate<State, Event>,
  validator: (state: State) => Option.Option<Error>
): Effect.Effect<void, Error> =>
  pipe(
    validator(aggregate.state),
    Option.match({
      onNone: () => Effect.void,
      onSome: (error) => Effect.fail(error),
    })
  )

/**
 * Ensure aggregate exists (state is not null)
 */
export const ensureExists = <State, Event extends DomainEvent, Error>(
  aggregate: Aggregate<State | null, Event>,
  error: Error
): Effect.Effect<Aggregate<State, Event>, Error> =>
  aggregate.state === null
    ? Effect.fail(error)
    : Effect.succeed(aggregate as Aggregate<State, Event>)

/**
 * Ensure aggregate doesn't exist (state is null)
 */
export const ensureNotExists = <State, Event extends DomainEvent, Error>(
  aggregate: Aggregate<State | null, Event>,
  error: Error
): Effect.Effect<void, Error> =>
  aggregate.state !== null
    ? Effect.fail(error)
    : Effect.void