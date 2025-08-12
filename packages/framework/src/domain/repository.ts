/**
 * Functional Repository Pattern
 * 
 * Pure functions for aggregate persistence without classes or 'this' context
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as HashMap from "effect/HashMap"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import type { Aggregate, EventApplicator } from "./aggregate"
import { loadFromEvents, markEventsAsCommitted, fromSnapshot } from "./aggregate"
import type { DomainEvent } from "../schema/core/messages"
import type { AggregateId, Version, StreamName } from "../schema/core/primitives"
import { EventStore, type EventStoreError } from "../effects/services"

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Repository interface - functional approach
 */
export interface Repository<State, Event extends DomainEvent> {
  readonly load: (
    id: AggregateId
  ) => Effect.Effect<Aggregate<State | null, Event>, RepositoryError, EventStore>
  
  readonly save: (
    aggregate: Aggregate<State, Event>
  ) => Effect.Effect<void, RepositoryError | EventStoreError, EventStore>
  
  readonly exists: (
    id: AggregateId
  ) => Effect.Effect<boolean, RepositoryError, EventStore>
  
  readonly loadFromSnapshot: (
    id: AggregateId,
    snapshotVersion?: Version
  ) => Effect.Effect<Aggregate<State | null, Event>, RepositoryError, EventStore | SnapshotStore>
}

/**
 * Repository errors
 */
export class RepositoryError {
  readonly _tag = "RepositoryError"
  constructor(
    readonly reason: "LoadFailed" | "SaveFailed" | "ConcurrencyConflict" | "InvalidState",
    readonly message: string,
    readonly aggregateId?: AggregateId,
    readonly details?: unknown
  ) {}
}

// ============================================================================
// Snapshot Store
// ============================================================================

/**
 * Snapshot store interface
 */
export interface SnapshotStore {
  readonly save: <State>(
    aggregateId: AggregateId,
    version: Version,
    state: State
  ) => Effect.Effect<void, SnapshotError>
  
  readonly load: <State>(
    aggregateId: AggregateId,
    version?: Version
  ) => Effect.Effect<Option.Option<{
    readonly version: Version
    readonly state: State
    readonly timestamp: number
  }>, SnapshotError>
  
  readonly delete: (
    aggregateId: AggregateId
  ) => Effect.Effect<void, SnapshotError>
}

export class SnapshotError {
  readonly _tag = "SnapshotError"
  constructor(
    readonly reason: "SaveFailed" | "LoadFailed" | "DeleteFailed",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

export const SnapshotStore = Context.GenericTag<SnapshotStore>("SnapshotStore")

// ============================================================================
// Repository Creation
// ============================================================================

/**
 * Create a repository with an event applicator
 */
export const createRepository = <State, Event extends DomainEvent>(
  streamPrefix: string,
  applicator: EventApplicator<State, Event>,
  initialState: State | null = null
): Repository<State, Event> => {
  const getStreamName = (id: AggregateId): StreamName =>
    `${streamPrefix}-${id}` as StreamName

  return {
    load: (id) =>
      pipe(
        EventStore,
        Effect.flatMap((eventStore) => {
          const streamName = getStreamName(id)
          return pipe(
            eventStore.read<Event>(streamName),
            Stream.runCollect,
            Effect.map((chunk) => Array.from(chunk)),
            Effect.orElseSucceed(() => [] as Event[]),
            Effect.map((events) => loadFromEvents(id, events, applicator, initialState))
          )
        })
      ),

    save: (aggregate) =>
      aggregate.uncommittedEvents.length === 0
        ? Effect.void
        : pipe(
            EventStore,
            Effect.flatMap((eventStore) => {
              const streamName = getStreamName(aggregate.id)
              // Calculate the expected version before these uncommitted events
              const expectedVersion = (aggregate.version - aggregate.uncommittedEvents.length) as Version
              
              return eventStore.append(
                streamName,
                aggregate.uncommittedEvents,
                expectedVersion
              )
            })
          ),

    exists: (id) =>
      pipe(
        EventStore,
        Effect.flatMap((eventStore) => {
          const streamName = getStreamName(id)
          return eventStore.getVersion(streamName)
        }),
        Effect.map(Option.isSome)
      ),

    loadFromSnapshot: (id, snapshotVersion) =>
      pipe(
        Effect.all({
          eventStore: EventStore,
          snapshotStore: SnapshotStore,
        }),
        Effect.flatMap(({ eventStore, snapshotStore }) => {
          const streamName = getStreamName(id)
          return pipe(
            snapshotStore.load<State>(id, snapshotVersion),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  // No snapshot, load from beginning
                  pipe(
                    eventStore.read<Event>(streamName),
                    Stream.runCollect,
                    Effect.map((chunk) => Array.from(chunk)),
                    Effect.map((events) => loadFromEvents(id, events, applicator, initialState))
                  ),
                onSome: ({ version, state }) =>
                  // Load events after snapshot
                  pipe(
                    eventStore.read<Event>(streamName, version),
                    Stream.runCollect,
                    Effect.map((chunk) => Array.from(chunk)),
                    Effect.map((events) => {
                      const base = fromSnapshot<State, Event>({ id, version, state })
                      return events.reduce(
                        (agg, event) => ({
                          ...agg,
                          state: applicator(agg.state, event),
                          version: (agg.version + 1) as Version,
                        }),
                        base
                      )
                    })
                  ),
              })
            )
          )
        })
      ),
  }
}

// ============================================================================
// Cached Repository
// ============================================================================

/**
 * Create a cached repository wrapper
 */
export const withCache = <State, Event extends DomainEvent>(
  repository: Repository<State, Event>,
  ttl: Duration.Duration = Duration.minutes(5)
): Effect.Effect<Repository<State, Event>, never, never> =>
  pipe(
    Ref.make(
      HashMap.empty<AggregateId, {
        readonly aggregate: Aggregate<State | null, Event>
        readonly timestamp: number
      }>()
    ),
    Effect.map((cache) => {
      const isExpired = (timestamp: number): boolean =>
        Date.now() - timestamp > Duration.toMillis(ttl)

      return {
        load: (id) =>
          pipe(
            Ref.get(cache),
            Effect.map((cached) => HashMap.get(cached, id)),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  pipe(
                    repository.load(id),
                    Effect.tap((aggregate) =>
                      Ref.update(cache, HashMap.set(id, {
                        aggregate,
                        timestamp: Date.now(),
                      }))
                    )
                  ),
                onSome: ({ aggregate, timestamp }) =>
                  isExpired(timestamp)
                    ? pipe(
                        repository.load(id),
                        Effect.tap((newAggregate) =>
                          Ref.update(cache, HashMap.set(id, {
                            aggregate: newAggregate,
                            timestamp: Date.now(),
                          }))
                        )
                      )
                    : Effect.succeed(aggregate),
              })
            )
          ),

      save: (aggregate) =>
        pipe(
          repository.save(aggregate),
          Effect.tap(() =>
            Ref.update(cache, HashMap.set(aggregate.id, {
              aggregate: markEventsAsCommitted(aggregate),
              timestamp: Date.now(),
            }))
          )
        ),

      exists: repository.exists,
      loadFromSnapshot: repository.loadFromSnapshot,
    }
    })
  )

// ============================================================================
// Repository with Optimistic Locking
// ============================================================================

/**
 * Add optimistic locking to repository
 */
export const withOptimisticLocking = <State, Event extends DomainEvent>(
  repository: Repository<State, Event>
): Repository<State, Event> => ({
  ...repository,
  save: (aggregate) =>
    pipe(
      repository.save(aggregate),
      Effect.catchTag("EventStoreError", (error) =>
        error.reason === "ConcurrencyConflict"
          ? Effect.fail(
              new RepositoryError(
                "ConcurrencyConflict",
                `Aggregate ${aggregate.id} was modified by another process`,
                aggregate.id,
                error
              )
            )
          : Effect.fail(
              new RepositoryError(
                "SaveFailed",
                error.message,
                aggregate.id,
                error
              )
            )
      )
    ),
})

// ============================================================================
// In-Memory Implementations
// ============================================================================

/**
 * In-memory snapshot store for testing
 */
export const InMemorySnapshotStore = Layer.effect(
  SnapshotStore,
  pipe(
    Ref.make(
      HashMap.empty<string, {
        readonly version: Version
        readonly state: unknown
        readonly timestamp: number
      }>()
    ),
    Effect.map((snapshots) => ({
      save: (aggregateId, version, state) =>
        Ref.update(snapshots, HashMap.set(
          `${aggregateId}-${version}`,
          { version, state, timestamp: Date.now() }
        )),

      load: (aggregateId, version) =>
        pipe(
          Ref.get(snapshots),
          Effect.map((store) => {
            if (version !== undefined) {
              return HashMap.get(store, `${aggregateId}-${version}`)
            }
            
            // Find latest snapshot for aggregate
            const prefix = `${aggregateId}-`
            const matches = Array.from(HashMap.keys(store))
              .filter((key) => key.startsWith(prefix))
              .map((key) => ({
                key,
                version: parseInt(key.substring(prefix.length)) as Version,
              }))
              .sort((a, b) => b.version - a.version)
            
            return matches.length > 0
              ? HashMap.get(store, matches[0].key)
              : Option.none()
          })
        ),

      delete: (aggregateId) =>
        pipe(
          Ref.update(snapshots, (store) => {
            const prefix = `${aggregateId}-`
            return Array.from(HashMap.keys(store))
              .filter((key) => key.startsWith(prefix))
              .reduce(
                (acc, key) => HashMap.remove(acc, key),
                store
              )
          })
        ),
    }))
  )
)

// ============================================================================
// Repository Service
// ============================================================================

/**
 * Repository service for dependency injection
 */
export interface RepositoryService {
  readonly createRepository: <State, Event extends DomainEvent>(
    streamPrefix: string,
    applicator: EventApplicator<State, Event>,
    initialState?: State | null
  ) => Repository<State, Event>
}

export const RepositoryService = Context.GenericTag<RepositoryService>("RepositoryService")

/**
 * Default repository service implementation
 */
export const RepositoryServiceLive = Layer.succeed(
  RepositoryService,
  {
    createRepository,
  }
)