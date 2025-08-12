/**
 * ✅ FIXED Functional Projection Pattern
 * 
 * Replaces the class-based Projection that uses "const self = this" 
 * with pure functional patterns that work perfectly with Effect.gen
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"
import type { DomainEvent } from "../schema/core/messages"
import { EventStore } from "../effects/services"

// ============================================================================
// Projection Types - Pure Interfaces (NO classes)
// ============================================================================

/**
 * Projection configuration - pure data structure
 */
export interface ProjectionConfig<State> {
  readonly name: string
  readonly initialState: State
  readonly batchSize?: number
  readonly saveCheckpointEvery?: number
}

/**
 * Projection state - pure data structure
 */
export interface ProjectionState<State> {
  readonly state: State
  readonly position: bigint
  readonly lastUpdated: Date
  readonly eventCount: number
}

/**
 * Event processor function type - pure function
 */
export type EventProcessor<State, Event extends DomainEvent> = (
  state: State,
  event: Event
) => Effect.Effect<State, ProjectionError>

/**
 * Projection interface - functional approach
 */
export interface Projection<State, Event extends DomainEvent> {
  readonly process: (
    fromPosition?: bigint
  ) => Effect.Effect<void, ProjectionError, EventStore | CheckpointStore>
  
  readonly processStream: (
    events: Stream.Stream<Event, any>
  ) => Effect.Effect<void, ProjectionError>
  
  readonly getState: () => Effect.Effect<ProjectionState<State>, never>
  
  readonly checkpoint: () => Effect.Effect<void, CheckpointError, CheckpointStore>
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
// Checkpoint Store Interface
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
// Pure Functional Projection Creation - ✅ NO "this" keyword issues
// ============================================================================

/**
 * ✅ Create projection with pure functions - NO classes, NO "this"
 * REPLACES: The class-based Projection with "const self = this" issues
 */
export const createProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  processor: EventProcessor<State, Event>
): Effect.Effect<Projection<State, Event>, never> =>
  Effect.gen(function* () {
    // Create state reference
    const stateRef = yield* Ref.make<ProjectionState<State>>({
      state: config.initialState,
      position: 0n,
      lastUpdated: new Date(),
      eventCount: 0,
    })
    
    // ✅ Pure function to process single event - NO "this" keyword
    const processEvent = (event: Event): Effect.Effect<void, ProjectionError> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        
        // Process the event
        const newState = yield* processor(currentState.state, event).pipe(
          Effect.mapError((error) => 
            new ProjectionError("ProcessingFailed", error.message || String(error), error)
          )
        )
        
        // Update state
        yield* Ref.update(stateRef, (current) => ({
          state: newState,
          position: current.position + 1n,
          lastUpdated: new Date(),
          eventCount: current.eventCount + 1,
        }))
      })
    
    // ✅ Pure function to process stream - NO "this" keyword issues
    const processStream = (
      events: Stream.Stream<Event, any>
    ): Effect.Effect<void, ProjectionError> =>
      pipe(
        events,
        // ✅ NO "this" keyword - direct function reference works perfectly
        Stream.mapEffect(processEvent),
        Stream.grouped(config.batchSize ?? 100),
        Stream.mapEffect(() => Effect.succeed(undefined)),
        Stream.runDrain
      )
    
    // ✅ Pure function to save checkpoint - NO "this" keyword
    const checkpoint = (): Effect.Effect<void, CheckpointError, CheckpointStore> =>
      Effect.gen(function* () {
        const checkpointStore = yield* CheckpointStore
        const currentState = yield* Ref.get(stateRef)
        
        yield* checkpointStore.save(config.name, currentState.position)
      })
    
    // ✅ Pure function to process from position - NO "this" issues
    const process = (
      fromPosition?: bigint
    ): Effect.Effect<void, ProjectionError, EventStore | CheckpointStore> =>
      Effect.gen(function* () {
        // ✅ NO "this" keyword - all parameters are explicit
        const eventStore = yield* EventStore
        const checkpointStore = yield* CheckpointStore
        
        // Load last checkpoint if not specified
        const startPosition = fromPosition ?? (yield* pipe(
          checkpointStore.load(config.name),
          Effect.map(Option.getOrElse(() => 0n)),
          Effect.orElse(() => Effect.succeed(0n))
        ))
        
        // Reset state
        yield* Ref.set(stateRef, {
          state: config.initialState,
          position: startPosition,
          lastUpdated: new Date(),
          eventCount: 0,
        })
        
        // Process all events from position
        const events = eventStore.readAll<Event>({
          fromPosition: startPosition,
        })
        
        // ✅ NO "this" keyword - direct function call
        yield* processStream(events)
        
        // Save checkpoint if configured
        if (config.saveCheckpointEvery && config.saveCheckpointEvery > 0) {
          const currentState = yield* Ref.get(stateRef)
          if (currentState.eventCount % config.saveCheckpointEvery === 0) {
            yield* checkpoint()
          }
        }
      })
    
    // Return functional interface - NO classes
    return {
      process,
      processStream,
      getState: () => Ref.get(stateRef),
      checkpoint,
    }
  })

// ============================================================================
// Projection Builders - Functional Helpers
// ============================================================================

/**
 * ✅ Create simple state-reducing projection
 */
export const createReducerProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  reducer: (state: State, event: Event) => State
): Effect.Effect<Projection<State, Event>, never> =>
  createProjection(config, (state, event) => Effect.succeed(reducer(state, event)))

/**
 * ✅ Create projection with Effect-based processor
 */
export const createEffectProjection = <State, Event extends DomainEvent, R>(
  config: ProjectionConfig<State>,
  processor: (state: State, event: Event) => Effect.Effect<State, ProjectionError, R>
): Effect.Effect<Projection<State, Event>, never, R> =>
  createProjection(config, processor)

// ============================================================================
// In-Memory Checkpoint Store for Testing
// ============================================================================

export const InMemoryCheckpointStore = Layer.effect(
  CheckpointStore,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, bigint>())
    
    return {
      save: (projectionName, position) =>
        Ref.update(store, (map) => {
          const newMap = new Map(map)
          newMap.set(projectionName, position)
          return newMap
        }),
      
      load: (projectionName) =>
        Effect.gen(function* () {
          const currentStore = yield* Ref.get(store)
          const position = currentStore.get(projectionName)
          return position !== undefined ? Option.some(position) : Option.none()
        }),
      
      delete: (projectionName) =>
        Ref.update(store, (map) => {
          const newMap = new Map(map)
          newMap.delete(projectionName)
          return newMap
        }),
    }
  })
)

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * ✅ Convert class-based projection to functional projection
 * Use this to gradually migrate existing projections
 */
export const fromClassProjection = <State, Event extends DomainEvent>(
  config: ProjectionConfig<State>,
  eventHandler: (state: State, event: Event) => Effect.Effect<State, any>
): Effect.Effect<Projection<State, Event>, never> =>
  createProjection(config, (state, event) =>
    eventHandler(state, event).pipe(
      Effect.mapError((error) => 
        new ProjectionError("ProcessingFailed", error.message || String(error), error)
      )
    )
  )

// ============================================================================
// Example Usage - Shows the benefits
// ============================================================================

/**
 * ✅ Example: User count projection using functional approach
 * NO "this" keyword issues, pure functions throughout
 */
export const createUserCountProjection = () => {
  interface UserCountState {
    totalUsers: number
    activeUsers: number
    deletedUsers: number
  }
  
  const config: ProjectionConfig<UserCountState> = {
    name: "user-count",
    initialState: {
      totalUsers: 0,
      activeUsers: 0,
      deletedUsers: 0,
    },
    batchSize: 100,
    saveCheckpointEvery: 1000,
  }
  
  // ✅ Pure reducer function - NO classes, NO "this"
  const reducer = (state: UserCountState, event: any): UserCountState => {
    switch (event.type) {
      case "UserRegistered":
        return {
          ...state,
          totalUsers: state.totalUsers + 1,
        }
      
      case "UserActivated":
        return {
          ...state,
          activeUsers: state.activeUsers + 1,
        }
      
      case "UserDeleted":
        return {
          ...state,
          activeUsers: state.activeUsers - 1,
          deletedUsers: state.deletedUsers + 1,
        }
      
      default:
        return state
    }
  }
  
  return createReducerProjection(config, reducer)
}

// All exports are already handled above in individual declarations