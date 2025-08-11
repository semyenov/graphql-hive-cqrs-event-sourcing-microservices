/**
 * Event Store - Infrastructure for event persistence
 * 
 * Using Effect streams for event processing and SQLite for storage
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Data from "effect/Data"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import {
  AggregateId,
  EventId,
  Version,
  StreamName,
  Timestamp,
} from "../schema/core/primitives"
import type { DomainEvent, EventMetadata } from "../schema/core/messages"
import type { AggregateSnapshot } from "../functions/aggregate"

// ============================================================================
// Event Store Errors
// ============================================================================

export class EventStoreError extends Data.TaggedError("EventStoreError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class OptimisticConcurrencyError extends Data.TaggedError("OptimisticConcurrencyError")<{
  readonly streamName: StreamName
  readonly expectedVersion: Version
  readonly actualVersion: Version
}> {}

export class StreamNotFoundError extends Data.TaggedError("StreamNotFoundError")<{
  readonly streamName: StreamName
}> {}

export type EventStoreErrorType =
  | EventStoreError
  | OptimisticConcurrencyError
  | StreamNotFoundError

// ============================================================================
// Event Store Types
// ============================================================================

/**
 * Persisted event with metadata
 */
export interface PersistedEvent<E extends DomainEvent = DomainEvent> {
  readonly eventId: EventId
  readonly streamName: StreamName
  readonly eventType: string
  readonly eventData: E
  readonly eventMetadata: EventMetadata
  readonly streamVersion: Version
  readonly globalPosition: bigint
  readonly timestamp: Timestamp
}

/**
 * Event filter for queries
 */
export interface EventFilter {
  readonly streamName?: StreamName
  readonly eventTypes?: ReadonlyArray<string>
  readonly fromVersion?: Version
  readonly toVersion?: Version
  readonly fromPosition?: bigint
  readonly toPosition?: bigint
  readonly fromTimestamp?: Timestamp
  readonly toTimestamp?: Timestamp
}

/**
 * Snapshot data
 */
export interface SnapshotData<S = unknown> {
  readonly streamName: StreamName
  readonly snapshotVersion: Version
  readonly snapshotData: S
  readonly snapshotMetadata: Record<string, unknown>
  readonly timestamp: Timestamp
}

// ============================================================================
// Event Store Interface
// ============================================================================

/**
 * Event store service interface
 */
export interface EventStore {
  /**
   * Append events to a stream
   */
  readonly appendToStream: <E extends DomainEvent>(
    streamName: StreamName,
    events: ReadonlyArray<E>,
    expectedVersion: Version
  ) => Effect.Effect<void, EventStoreErrorType>
  
  /**
   * Read events from a stream
   */
  readonly readStream: <E extends DomainEvent>(
    streamName: StreamName,
    fromVersion?: Version
  ) => Stream.Stream<PersistedEvent<E>, EventStoreErrorType>
  
  /**
   * Read all events
   */
  readonly readAll: <E extends DomainEvent>(
    filter?: EventFilter
  ) => Stream.Stream<PersistedEvent<E>, EventStoreErrorType>
  
  /**
   * Get stream version
   */
  readonly getStreamVersion: (
    streamName: StreamName
  ) => Effect.Effect<Version, StreamNotFoundError>
  
  /**
   * Check if stream exists
   */
  readonly streamExists: (
    streamName: StreamName
  ) => Effect.Effect<boolean, never>
  
  /**
   * Save snapshot
   */
  readonly saveSnapshot: <S>(
    streamName: StreamName,
    snapshot: AggregateSnapshot<S>
  ) => Effect.Effect<void, EventStoreError>
  
  /**
   * Get latest snapshot
   */
  readonly getSnapshot: <S>(
    streamName: StreamName
  ) => Effect.Effect<Option.Option<SnapshotData<S>>, EventStoreError>
  
  /**
   * Subscribe to events
   */
  readonly subscribe: <E extends DomainEvent>(
    filter?: EventFilter
  ) => Stream.Stream<PersistedEvent<E>, EventStoreErrorType>
}

export class EventStore extends Context.Tag("EventStore")<
  EventStore,
  EventStore
>() {}

// ============================================================================
// In-Memory Event Store Implementation
// ============================================================================

/**
 * In-memory event store for testing and development
 */
export class InMemoryEventStore implements EventStore {
  private events: Array<PersistedEvent> = []
  private snapshots: Map<string, SnapshotData> = new Map()
  private streamVersions: Map<string, Version> = new Map()
  private globalPosition: bigint = 0n
  
  appendToStream<E extends DomainEvent>(
    streamName: StreamName,
    events: ReadonlyArray<E>,
    expectedVersion: Version
  ): Effect.Effect<void, EventStoreErrorType> {
    return Effect.gen(function* () {
      // Check expected version
      const currentVersion = this.streamVersions.get(streamName) ?? Version.initial()
      
      if (currentVersion !== expectedVersion) {
        return yield* Effect.fail(
          new OptimisticConcurrencyError({
            streamName,
            expectedVersion,
            actualVersion: currentVersion,
          })
        )
      }
      
      // Append events
      let version = currentVersion
      for (const event of events) {
        version = Version.increment(version)
        this.globalPosition++
        
        const persistedEvent: PersistedEvent<E> = {
          eventId: event.metadata.eventId,
          streamName,
          eventType: event.type,
          eventData: event,
          eventMetadata: event.metadata,
          streamVersion: version,
          globalPosition: this.globalPosition,
          timestamp: Timestamp.now(),
        }
        
        this.events.push(persistedEvent as PersistedEvent)
      }
      
      this.streamVersions.set(streamName, version)
    }.bind(this))
  }
  
  readStream<E extends DomainEvent>(
    streamName: StreamName,
    fromVersion: Version = Version.initial()
  ): Stream.Stream<PersistedEvent<E>, EventStoreErrorType> {
    return Stream.fromIterable(
      this.events.filter(
        (e) =>
          e.streamName === streamName &&
          e.streamVersion > fromVersion
      ) as PersistedEvent<E>[]
    )
  }
  
  readAll<E extends DomainEvent>(
    filter?: EventFilter
  ): Stream.Stream<PersistedEvent<E>, EventStoreErrorType> {
    let filtered = this.events as PersistedEvent<E>[]
    
    if (filter) {
      filtered = filtered.filter((e) => {
        if (filter.streamName && e.streamName !== filter.streamName) return false
        if (filter.eventTypes && !filter.eventTypes.includes(e.eventType)) return false
        if (filter.fromVersion && e.streamVersion < filter.fromVersion) return false
        if (filter.toVersion && e.streamVersion > filter.toVersion) return false
        if (filter.fromPosition && e.globalPosition < filter.fromPosition) return false
        if (filter.toPosition && e.globalPosition > filter.toPosition) return false
        if (filter.fromTimestamp && e.timestamp < filter.fromTimestamp) return false
        if (filter.toTimestamp && e.timestamp > filter.toTimestamp) return false
        return true
      })
    }
    
    return Stream.fromIterable(filtered)
  }
  
  getStreamVersion(
    streamName: StreamName
  ): Effect.Effect<Version, StreamNotFoundError> {
    const version = this.streamVersions.get(streamName)
    
    if (version === undefined) {
      return Effect.fail(
        new StreamNotFoundError({ streamName })
      )
    }
    
    return Effect.succeed(version)
  }
  
  streamExists(streamName: StreamName): Effect.Effect<boolean, never> {
    return Effect.succeed(this.streamVersions.has(streamName))
  }
  
  saveSnapshot<S>(
    streamName: StreamName,
    snapshot: AggregateSnapshot<any>
  ): Effect.Effect<void, EventStoreError> {
    return Effect.sync(() => {
      const snapshotData: SnapshotData<S> = {
        streamName,
        snapshotVersion: snapshot.version,
        snapshotData: snapshot.state as S,
        snapshotMetadata: {},
        timestamp: snapshot.timestamp,
      }
      
      this.snapshots.set(streamName, snapshotData as SnapshotData)
    })
  }
  
  getSnapshot<S>(
    streamName: StreamName
  ): Effect.Effect<Option.Option<SnapshotData<S>>, EventStoreError> {
    return Effect.sync(() => {
      const snapshot = this.snapshots.get(streamName)
      return snapshot
        ? Option.some(snapshot as SnapshotData<S>)
        : Option.none()
    })
  }
  
  subscribe<E extends DomainEvent>(
    filter?: EventFilter
  ): Stream.Stream<PersistedEvent<E>, EventStoreErrorType> {
    // In a real implementation, this would be a live stream
    // For now, return existing events
    return this.readAll(filter)
  }
}

// ============================================================================
// Event Store Service Layer
// ============================================================================

/**
 * Create in-memory event store layer
 */
export const InMemoryEventStoreLive = Layer.succeed(
  EventStore,
  new InMemoryEventStore()
)

// ============================================================================
// Event Stream Processing
// ============================================================================

/**
 * Process events from a stream
 */
export const processEventStream = <E extends DomainEvent, R, A>(
  streamName: StreamName,
  handler: (event: PersistedEvent<E>) => Effect.Effect<A, never, R>,
  options?: {
    fromVersion?: Version
    batchSize?: number
    concurrency?: number
  }
): Effect.Effect<void, EventStoreErrorType, EventStore | R> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    
    yield* pipe(
      eventStore.readStream<E>(streamName, options?.fromVersion),
      Stream.mapEffect(handler, { concurrency: options?.concurrency ?? 1 }),
      Stream.grouped(options?.batchSize ?? 100),
      Stream.runDrain
    )
  })

/**
 * Catchup subscription - read historical events then subscribe to new ones
 */
export const catchupSubscription = <E extends DomainEvent, R, A>(
  filter: EventFilter,
  handler: (event: PersistedEvent<E>) => Effect.Effect<A, never, R>,
  checkpoint?: bigint
): Effect.Effect<never, EventStoreErrorType, EventStore | R> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    
    // Read historical events
    yield* pipe(
      eventStore.readAll<E>({
        ...filter,
        fromPosition: checkpoint,
      }),
      Stream.mapEffect(handler),
      Stream.runDrain
    )
    
    // Subscribe to new events
    yield* pipe(
      eventStore.subscribe<E>(filter),
      Stream.filter((e) => !checkpoint || e.globalPosition > checkpoint),
      Stream.mapEffect(handler),
      Stream.runDrain
    )
  })

/**
 * Event replayer for rebuilding projections
 */
export const replayEvents = <E extends DomainEvent, S>(
  streamName: StreamName,
  initialState: S,
  reducer: (state: S, event: E) => S,
  fromVersion?: Version
): Effect.Effect<S, EventStoreErrorType, EventStore> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    
    return yield* pipe(
      eventStore.readStream<E>(streamName, fromVersion),
      Stream.map((e) => e.eventData),
      Stream.reduce(initialState, reducer)
    )
  })

// ============================================================================
// Event Store Utilities
// ============================================================================

/**
 * Create event stream name from aggregate type and ID
 */
export const createStreamName = (
  aggregateType: string,
  aggregateId: AggregateId
): StreamName =>
  StreamName.create(aggregateType, aggregateId)

/**
 * Parse stream name to get aggregate type and ID
 */
export const parseStreamName = (
  streamName: StreamName
): { aggregateType: string; aggregateId: AggregateId } => ({
  aggregateType: StreamName.getAggregateType(streamName),
  aggregateId: StreamName.getAggregateId(streamName),
})

/**
 * Batch append events for better performance
 */
export const batchAppend = <E extends DomainEvent>(
  events: ReadonlyArray<{ streamName: StreamName; event: E; expectedVersion: Version }>
): Effect.Effect<void, EventStoreErrorType, EventStore> =>
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    
    // Group events by stream
    const grouped = pipe(
      events,
      ReadonlyArray.groupBy((e) => e.streamName)
    )
    
    // Append to each stream
    for (const [streamName, streamEvents] of grouped) {
      const firstEvent = streamEvents[0]
      if (!firstEvent) continue
      
      yield* eventStore.appendToStream(
        streamName as StreamName,
        streamEvents.map((e) => e.event),
        firstEvent.expectedVersion
      )
    }
  })