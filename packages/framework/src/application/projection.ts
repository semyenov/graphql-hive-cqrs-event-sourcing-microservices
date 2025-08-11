/**
 * Projection System - Build read models from event streams
 * 
 * Using Effect streams for efficient event processing and state management
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as Data from "effect/Data"
import * as Ref from "effect/Ref"
import * as HashMap from "effect/HashMap"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import type { DomainEvent } from "../schema/core/messages"
import type { PersistedEvent } from "../infrastructure/event-store"
import { EventStore } from "../infrastructure/event-store"

// ============================================================================
// Projection Errors
// ============================================================================

export class ProjectionError extends Data.TaggedError("ProjectionError")<{
  readonly projectionName: string
  readonly cause: unknown
}> {}

export class CheckpointError extends Data.TaggedError("CheckpointError")<{
  readonly projectionName: string
  readonly position: bigint
  readonly cause: unknown
}> {}

export type ProjectionErrorType = ProjectionError | CheckpointError

// ============================================================================
// Projection Types
// ============================================================================

/**
 * Projection state with position tracking
 */
export interface ProjectionState<S = unknown> {
  readonly state: S
  readonly position: bigint
  readonly lastUpdated: Date
  readonly eventCount: number
}

/**
 * Projection handler for specific event type
 */
export type ProjectionHandler<S, E extends DomainEvent> = (
  state: S,
  event: E
) => Effect.Effect<S, ProjectionError>

/**
 * Projection configuration
 */
export interface ProjectionConfig<S, E extends DomainEvent = DomainEvent> {
  readonly name: string
  readonly initialState: S
  readonly handlers: {
    [K in E["type"]]?: ProjectionHandler<S, Extract<E, { type: K }>>
  }
  readonly snapshotInterval?: number
  readonly batchSize?: number
}

/**
 * Checkpoint store for projection positions
 */
export interface CheckpointStore {
  readonly save: (
    projectionName: string,
    position: bigint
  ) => Effect.Effect<void, CheckpointError>
  
  readonly load: (
    projectionName: string
  ) => Effect.Effect<Option.Option<bigint>, CheckpointError>
}

export class CheckpointStore extends Context.Tag("CheckpointStore")<
  CheckpointStore,
  CheckpointStore
>() {}

/**
 * Read model store for projection results
 */
export interface ReadModelStore<S> {
  readonly save: (
    key: string,
    model: S
  ) => Effect.Effect<void, ProjectionError>
  
  readonly get: (
    key: string
  ) => Effect.Effect<Option.Option<S>, ProjectionError>
  
  readonly getAll: () => Effect.Effect<ReadonlyArray<S>, ProjectionError>
  
  readonly delete: (
    key: string
  ) => Effect.Effect<void, ProjectionError>
}

export const ReadModelStore = <S>() =>
  Context.GenericTag<ReadModelStore<S>>("ReadModelStore")

// ============================================================================
// Projection Implementation
// ============================================================================

/**
 * Projection processor
 */
export class Projection<S, E extends DomainEvent = DomainEvent> {
  private readonly state: Ref.Ref<ProjectionState<S>>
  
  constructor(
    private readonly config: ProjectionConfig<S, E>,
    initialPosition: bigint = 0n
  ) {
    this.state = Ref.unsafeMake<ProjectionState<S>>({
      state: config.initialState,
      position: initialPosition,
      lastUpdated: new Date(),
      eventCount: 0,
    })
  }
  
  /**
   * Process a single event
   */
  processEvent(event: PersistedEvent<E>): Effect.Effect<void, ProjectionError> {
    const config = this.config
    const stateRef = this.state
    
    return Effect.gen(function* () {
      const handler = config.handlers[event.eventType as E["type"]]
      
      if (!handler) {
        // Skip events without handlers
        return
      }
      
      const currentState: ProjectionState<S> = yield* Ref.get(stateRef)
      const newState: S = yield* handler(
        currentState.state,
        event.eventData as any
      )
      
      yield* Ref.update(stateRef, (s): ProjectionState<S> => ({
        state: newState,
        position: event.globalPosition,
        lastUpdated: new Date(),
        eventCount: s.eventCount + 1,
      }))
    })
  }
  
  /**
   * Get current projection state
   */
  getState(): Effect.Effect<ProjectionState<S>, never> {
    return Ref.get(this.state)
  }
  
  /**
   * Process event stream
   */
  processStream(
    events: Stream.Stream<PersistedEvent<E>, any>
  ): Effect.Effect<void, ProjectionError> {
    const self = this
    return pipe(
      events,
      Stream.mapEffect((event) => self.processEvent(event)),
      Stream.grouped(self.config.batchSize ?? 100),
      Stream.mapEffect(() => Effect.succeed(undefined)),
      Stream.runDrain
    )
  }
  
  /**
   * Save checkpoint
   */
  checkpoint(): Effect.Effect<void, CheckpointError, CheckpointStore> {
    const config = this.config
    const stateRef = this.state
    
    return Effect.gen(function* () {
      const checkpointStore = yield* CheckpointStore
      const state: ProjectionState<S> = yield* Ref.get(stateRef)
      
      yield* checkpointStore.save(config.name, state.position)
    })
  }
  
  /**
   * Rebuild projection from events
   */
  rebuild(
    fromPosition?: bigint
  ): Effect.Effect<void, ProjectionError | CheckpointError, EventStore | CheckpointStore> {
    const config = this.config
    const stateRef = this.state
    const self = this
    
    return Effect.gen(function* () {
      const eventStore = yield* EventStore
      const checkpointStore = yield* CheckpointStore
      
      // Load last checkpoint if not specified
      const startPosition = fromPosition ?? (yield* pipe(
        checkpointStore.load(config.name),
        Effect.map(Option.getOrElse(() => 0n))
      ))
      
      // Reset state
      yield* Ref.set(stateRef, {
        state: config.initialState,
        position: startPosition,
        lastUpdated: new Date(),
        eventCount: 0,
      })
      
      // Process all events from position
      const events = eventStore.readAll<E>({
        fromPosition: startPosition,
      })
      
      yield* self.processStream(events)
    })
  }
}

// ============================================================================
// Projection Builder
// ============================================================================

/**
 * Builder for creating projections
 */
export class ProjectionBuilder<S, E extends DomainEvent = DomainEvent> {
  private config: ProjectionConfig<S, E>
  private readonly handlers: ProjectionConfig<S, E>["handlers"] = {}
  
  constructor() {
    this.config = {} as ProjectionConfig<S, E>
  }
  
  withName(name: string): this {
    this.config = { ...this.config, name }
    return this
  }
  
  withInitialState(state: S): this {
    this.config = { ...this.config, initialState: state }
    return this
  }
  
  on<T extends E["type"]>(
    eventType: T,
    handler: ProjectionHandler<S, Extract<E, { type: T }>>
  ): this {
    this.handlers[eventType] = handler as any
    return this
  }
  
  withSnapshotInterval(interval: number): this {
    this.config = { ...this.config, snapshotInterval: interval }
    return this
  }
  
  withBatchSize(size: number): this {
    this.config = { ...this.config, batchSize: size }
    return this
  }
  
  build(): Projection<S, E> {
    if (!this.config.name) {
      throw new Error("Projection name is required")
    }
    if (this.config.initialState === undefined) {
      throw new Error("Initial state is required")
    }
    
    return new Projection({
      ...this.config,
      handlers: this.handlers,
    } as ProjectionConfig<S, E>)
  }
}

// ============================================================================
// Read Model Projections
// ============================================================================

/**
 * Read model projection with automatic persistence
 */
export class ReadModelProjection<S, E extends DomainEvent = DomainEvent> {
  private readonly projections: Ref.Ref<HashMap.HashMap<string, S>>
  
  constructor(
    readonly name: string,
    private readonly getKey: (event: E) => string,
    private readonly reducer: (state: S | undefined, event: E) => S
  ) {
    this.projections = Ref.unsafeMake(HashMap.empty<string, S>())
  }
  
  /**
   * Process event and update read model
   */
  processEvent(
    event: PersistedEvent<E>
  ): Effect.Effect<void, ProjectionError, ReadModelStore<S>> {
    const getKey = this.getKey
    const reducer = this.reducer
    const projectionsRef = this.projections
    
    return Effect.gen(function* () {
      const store = yield* ReadModelStore<S>()
      const key = getKey(event.eventData)
      
      // Get current state
      const currentModels: HashMap.HashMap<string, S> = yield* Ref.get(projectionsRef)
      const currentState = HashMap.get(currentModels, key)
      
      // Apply reducer
      const newState = reducer(
        Option.getOrUndefined(currentState),
        event.eventData
      )
      
      // Update in-memory state
      yield* Ref.update(
        projectionsRef,
        (map): HashMap.HashMap<string, S> => HashMap.set(map, key, newState)
      )
      
      // Persist to store
      yield* store.save(key, newState)
    })
  }
  
  /**
   * Get read model by key
   */
  get(key: string): Effect.Effect<Option.Option<S>, never> {
    return pipe(
      Ref.get(this.projections),
      Effect.map((map) => HashMap.get(map, key))
    )
  }
  
  /**
   * Get all read models
   */
  getAll(): Effect.Effect<ReadonlyArray<S>, never> {
    return pipe(
      Ref.get(this.projections),
      Effect.map(HashMap.values),
      Effect.map((iter) => Array.from(iter))
    )
  }
}

// ============================================================================
// In-Memory Implementations
// ============================================================================

/**
 * In-memory checkpoint store
 */
export class InMemoryCheckpointStore {
  private readonly checkpoints = new Map<string, bigint>()
  
  save(projectionName: string, position: bigint): Effect.Effect<void, CheckpointError> {
    return Effect.sync(() => {
      this.checkpoints.set(projectionName, position)
    })
  }
  
  load(projectionName: string): Effect.Effect<Option.Option<bigint>, CheckpointError> {
    return Effect.sync(() => {
      const position = this.checkpoints.get(projectionName)
      return position !== undefined ? Option.some(position) : Option.none()
    })
  }
}

/**
 * In-memory read model store
 */
export class InMemoryReadModelStore<S> implements ReadModelStore<S> {
  private readonly models = new Map<string, S>()
  
  save(key: string, model: S): Effect.Effect<void, ProjectionError> {
    return Effect.sync(() => {
      this.models.set(key, model)
    })
  }
  
  get(key: string): Effect.Effect<Option.Option<S>, ProjectionError> {
    return Effect.sync(() => {
      const model = this.models.get(key)
      return model !== undefined ? Option.some(model) : Option.none()
    })
  }
  
  getAll(): Effect.Effect<ReadonlyArray<S>, ProjectionError> {
    return Effect.sync(() => Array.from(this.models.values()))
  }
  
  delete(key: string): Effect.Effect<void, ProjectionError> {
    return Effect.sync(() => {
      this.models.delete(key)
    })
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create projection builder
 */
export const projection = <S, E extends DomainEvent = DomainEvent>() =>
  new ProjectionBuilder<S, E>()

/**
 * Create read model projection
 */
export const readModel = <S, E extends DomainEvent = DomainEvent>(
  name: string,
  getKey: (event: E) => string,
  reducer: (state: S | undefined, event: E) => S
) => new ReadModelProjection(name, getKey, reducer)

/**
 * Combine multiple projections
 */
export const combineProjections = <E extends DomainEvent = DomainEvent>(
  projections: ReadonlyArray<Projection<unknown, E>>
): Effect.Effect<void, ProjectionError | import("../infrastructure/event-store").EventStoreErrorType, EventStore> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    const events = eventStore.readAll<E>()
    
    yield* pipe(
      events,
      Stream.mapEffect((event) =>
        Effect.all(
          projections.map((p) => p.processEvent(event)),
          { concurrency: "unbounded" }
        )
      ),
      Stream.runDrain
    )
  })

/**
 * Monitor projection lag
 */
export const monitorProjectionLag = <S>(
  projection: Projection<S>,
  threshold: Duration.Duration
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const state = yield* projection.getState()
    const lag = Date.now() - state.lastUpdated.getTime()
    return lag > Duration.toMillis(threshold)
  })