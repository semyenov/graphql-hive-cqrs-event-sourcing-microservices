/**
 * Projection Processing - Pipe Pattern Implementation
 * 
 * Pure functional projection building without classes or Effect.gen
 * Superior composition through pipe patterns
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as HashMap from "effect/HashMap"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import type { DomainEvent } from "../schema/core/messages"
import { EventStore } from "../effects/services"

// ============================================================================
// Projection Types
// ============================================================================

export interface ProjectionState<State> {
  readonly state: State
  readonly position: bigint
  readonly lastUpdated: Date
  readonly eventCount: number
}

export interface ProjectionConfig<State> {
  readonly name: string
  readonly initialState: State
  readonly batchSize?: number
  readonly saveCheckpointEvery?: number
}

// ============================================================================
// Errors
// ============================================================================

export class ProjectionError {
  readonly _tag = "ProjectionError"
  constructor(
    readonly reason: "ProcessingFailed" | "StateError" | "CheckpointFailed",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

export class CheckpointError {
  readonly _tag = "CheckpointError"
  constructor(
    readonly reason: "SaveFailed" | "LoadFailed",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

// ============================================================================
// Checkpoint Store
// ============================================================================

export interface CheckpointStore {
  readonly save: (
    projectionName: string,
    position: bigint
  ) => Effect.Effect<void, CheckpointError>
  
  readonly load: (
    projectionName: string
  ) => Effect.Effect<Option.Option<bigint>, CheckpointError>
  
  readonly delete: (
    projectionName: string
  ) => Effect.Effect<void, CheckpointError>
}

export const CheckpointStore = Context.GenericTag<CheckpointStore>("CheckpointStore")

// ============================================================================
// Projection Builder - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Process single event - PIPE PATTERN
 * Pure function composition without "this" context
 */
export const processEvent = <State, Event extends DomainEvent>(
  stateRef: Ref.Ref<ProjectionState<State>>,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError>
) => (event: Event): Effect.Effect<void, ProjectionError> =>
  pipe(
    Ref.get(stateRef),
    Effect.flatMap((currentState) =>
      pipe(
        processor(currentState.state, event),
        Effect.mapError((error) =>
          new ProjectionError("ProcessingFailed", error.message || String(error), error)
        ),
        Effect.flatMap((newState) =>
          Ref.update(stateRef, (current) => ({
            state: newState,
            position: current.position + 1n,
            lastUpdated: new Date(),
            eventCount: current.eventCount + 1,
          }))
        )
      )
    )
  )

/**
 * 🎯 Process event stream - PIPE PATTERN
 * Stream processing with functional composition
 */
export const processEventStream = <State, Event extends DomainEvent>(
  stateRef: Ref.Ref<ProjectionState<State>>,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError>,
  batchSize: number = 100
) => (events: Stream.Stream<Event, any>): Effect.Effect<void, ProjectionError> =>
  pipe(
    events,
    Stream.mapEffect(processEvent(stateRef, processor)),
    Stream.grouped(batchSize),
    Stream.mapEffect(() => Effect.void),
    Stream.runDrain
  )

/**
 * 🎯 Save checkpoint - PIPE PATTERN
 * Checkpoint persistence with clean composition
 */
export const saveCheckpoint = (
  projectionName: string,
  stateRef: Ref.Ref<ProjectionState<any>>
): Effect.Effect<void, CheckpointError, CheckpointStore> =>
  pipe(
    Effect.all({
      checkpointStore: CheckpointStore,
      currentState: Ref.get(stateRef),
    }),
    Effect.flatMap(({ checkpointStore, currentState }) =>
      checkpointStore.save(projectionName, currentState.position)
    )
  )

/**
 * 🎯 Load checkpoint - PIPE PATTERN
 * Checkpoint recovery with functional flow
 */
export const loadCheckpoint = (
  projectionName: string
): Effect.Effect<bigint, never, CheckpointStore> =>
  pipe(
    CheckpointStore,
    Effect.flatMap((store) => store.load(projectionName)),
    Effect.map(Option.getOrElse(() => 0n))
  )

/**
 * 🎯 Build projection from events - PIPE PATTERN
 * Complete projection building pipeline
 */
export const buildProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError>
): Effect.Effect<
  {
    readonly process: (fromPosition?: bigint) => Effect.Effect<void, ProjectionError, EventStore | CheckpointStore>
    readonly getState: () => Effect.Effect<ProjectionState<State>, never>
    readonly checkpoint: () => Effect.Effect<void, CheckpointError, CheckpointStore>
  },
  never
> =>
  pipe(
    Ref.make<ProjectionState<State>>({
      state: config.initialState,
      position: 0n,
      lastUpdated: new Date(),
      eventCount: 0,
    }),
    Effect.map((stateRef) => ({
      process: (fromPosition?: bigint) =>
        pipe(
          // Load starting position
          fromPosition !== undefined
            ? Effect.succeed(fromPosition)
            : loadCheckpoint(config.name),
          // Reset state to initial
          Effect.tap((startPosition) =>
            Ref.set(stateRef, {
              state: config.initialState,
              position: startPosition,
              lastUpdated: new Date(),
              eventCount: 0,
            })
          ),
          // Get event stream
          Effect.flatMap((startPosition) =>
            pipe(
              EventStore,
              Effect.flatMap((eventStore) =>
                pipe(
                  eventStore.readAll<Event>({ fromPosition: startPosition }),
                  processEventStream(stateRef, processor, config.batchSize)
                )
              )
            )
          ),
          // Save checkpoint if configured
          Effect.tap(() =>
            config.saveCheckpointEvery
              ? pipe(
                  Ref.get(stateRef),
                  Effect.flatMap((state) =>
                    state.eventCount % config.saveCheckpointEvery === 0
                      ? saveCheckpoint(config.name, stateRef)
                      : Effect.void
                  )
                )
              : Effect.void
          )
        ),
      
      getState: () => Ref.get(stateRef),
      
      checkpoint: () => saveCheckpoint(config.name, stateRef),
    }))
  )

// ============================================================================
// Projection Patterns - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create reducer projection - PIPE PATTERN
 * Simple state reduction with pure functions
 */
export const createReducerProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  reducer: (state: State, event: Event) => State
) =>
  buildProjection(
    config,
    (state, event) => Effect.succeed(reducer(state, event))
  )

/**
 * 🎯 Create async projection - PIPE PATTERN
 * Effectful projection with external dependencies
 */
export const createAsyncProjection = <State, Event extends DomainEvent, R>(
  config: ProjectionConfig<State>,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError, R>
) =>
  buildProjection(config, processor)

/**
 * 🎯 Create filtered projection - PIPE PATTERN
 * Projection with event filtering
 */
export const createFilteredProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  filter: (event: Event) => boolean,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError>
) =>
  buildProjection(
    config,
    (state, event) =>
      filter(event)
        ? processor(state, event)
        : Effect.succeed(state)
  )

/**
 * 🎯 Create windowed projection - PIPE PATTERN
 * Time-windowed projection processing
 */
export const createWindowedProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  windowSize: Duration.Duration,
  processor: (state: State, events: ReadonlyArray<Event>) => Effect.Effect<State, ProjectionError>
): Effect.Effect<
  {
    readonly processWindow: (events: ReadonlyArray<Event>) => Effect.Effect<void, ProjectionError>
    readonly getState: () => Effect.Effect<ProjectionState<State>, never>
  },
  never
> =>
  pipe(
    Ref.make<ProjectionState<State>>({
      state: config.initialState,
      position: 0n,
      lastUpdated: new Date(),
      eventCount: 0,
    }),
    Effect.map((stateRef) => ({
      processWindow: (events: ReadonlyArray<Event>) =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((currentState) =>
            processor(currentState.state, events)
          ),
          Effect.flatMap((newState) =>
            Ref.update(stateRef, (current) => ({
              state: newState,
              position: current.position + BigInt(events.length),
              lastUpdated: new Date(),
              eventCount: current.eventCount + events.length,
            }))
          )
        ),
      
      getState: () => Ref.get(stateRef),
    }))
  )

// ============================================================================
// Projection Composition - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Compose multiple projections - PIPE PATTERN
 * Run multiple projections in parallel
 */
export const composeProjections = <Event extends DomainEvent>(
  projections: ReadonlyArray<{
    readonly name: string
    readonly process: (event: Event) => Effect.Effect<void, ProjectionError>
  }>
) => (event: Event): Effect.Effect<void, ProjectionError> =>
  pipe(
    projections.map((projection) =>
      pipe(
        projection.process(event),
        Effect.mapError((error) =>
          new ProjectionError(
            "ProcessingFailed",
            `Projection ${projection.name} failed: ${error.message}`,
            error
          )
        )
      )
    ),
    Effect.all,
    Effect.asVoid
  )

/**
 * 🎯 Chain projections - PIPE PATTERN
 * Sequential projection processing
 */
export const chainProjections = <State1, State2, Event extends DomainEvent>(
  first: (event: Event) => Effect.Effect<State1, ProjectionError>,
  second: (state: State1, event: Event) => Effect.Effect<State2, ProjectionError>
) => (event: Event): Effect.Effect<State2, ProjectionError> =>
  pipe(
    first(event),
    Effect.flatMap((state1) => second(state1, event))
  )

// ============================================================================
// In-Memory Checkpoint Store - PIPE PATTERN
// ============================================================================

export const InMemoryCheckpointStore = Layer.effect(
  CheckpointStore,
  pipe(
    Ref.make(HashMap.empty<string, bigint>()),
    Effect.map((store) => ({
      save: (projectionName, position) =>
        Ref.update(store, HashMap.set(projectionName, position)),
      
      load: (projectionName) =>
        pipe(
          Ref.get(store),
          Effect.map((map) => HashMap.get(map, projectionName))
        ),
      
      delete: (projectionName) =>
        Ref.update(store, HashMap.remove(projectionName)),
    }))
  )
)

// ============================================================================
// Example: Analytics Projection - PIPE PATTERN
// ============================================================================

interface AnalyticsState {
  readonly eventCounts: Map<string, number>
  readonly totalEvents: number
  readonly lastEventTime: number
}

/**
 * 🎯 Analytics projection using PIPE PATTERN
 * Real-world example of projection building
 */
export const createAnalyticsProjection = () =>
  createReducerProjection<AnalyticsState, DomainEvent>(
    {
      name: "analytics",
      initialState: {
        eventCounts: new Map(),
        totalEvents: 0,
        lastEventTime: 0,
      },
      batchSize: 500,
      saveCheckpointEvery: 1000,
    },
    (state, event) => ({
      eventCounts: new Map(state.eventCounts).set(
        event.type,
        (state.eventCounts.get(event.type) || 0) + 1
      ),
      totalEvents: state.totalEvents + 1,
      lastEventTime: event.metadata.timestamp,
    })
  )

// All exports are already declared inline above