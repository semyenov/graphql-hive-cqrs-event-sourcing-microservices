/**
 * Effect-Native Services
 *
 * Services implemented as Effect Layers for dependency injection
 * All operations return Effects for composability and error handling
 */

import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Option from "effect/Option";
import * as HashMap from "effect/HashMap";
import * as Ref from "effect/Ref";
import * as Queue from "effect/Queue";
import { pipe } from "effect/Function";
import type {
  AggregateId,
  StreamName,
  Version,
} from "../schema/core/primitives";

// ============================================================================
// Event Store Service
// ============================================================================

/**
 * Event Store Interface
 */
export interface EventStore {
  readonly append: <Event>(
    streamName: StreamName,
    events: ReadonlyArray<Event>,
    expectedVersion: Version,
  ) => Effect.Effect<void, EventStoreError>;

  readonly read: <Event>(
    streamName: StreamName,
    fromVersion?: Version,
  ) => Stream.Stream<Event, EventStoreError>;

  readonly readAll: <Event>(
    fromPosition?: bigint,
  ) => Stream.Stream<Event, EventStoreError>;

  readonly getVersion: (
    streamName: StreamName,
  ) => Effect.Effect<Option.Option<Version>, EventStoreError>;

  readonly subscribe: <Event>(
    filter?: EventFilter,
  ) => Stream.Stream<Event, EventStoreError>;
}

export interface EventFilter {
  readonly streamName?: StreamName;
  readonly eventTypes?: ReadonlyArray<string>;
  readonly fromPosition?: bigint;
}

export class EventStoreError {
  readonly _tag = "EventStoreError";
  constructor(
    readonly reason:
      | "StreamNotFound"
      | "ConcurrencyConflict"
      | "ConnectionError",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

export const EventStore = Context.GenericTag<EventStore>("EventStore");

/**
 * In-Memory Event Store Implementation
 */
export const InMemoryEventStore = Layer.effect(
  EventStore,
  Effect.gen(function* () {
    const streams = yield* Ref.make(
      HashMap.empty<StreamName, ReadonlyArray<any>>(),
    );
    const globalStream = yield* Ref.make<ReadonlyArray<any>>([]);
    const subscribers = yield* Ref.make<ReadonlyArray<Queue.Queue<any>>>([]);

    return {
      append: (streamName, events, expectedVersion) =>
        Effect.gen(function* () {
          const currentStreams = yield* Ref.get(streams);
          const currentEvents = HashMap.get(currentStreams, streamName);
          const currentVersion = Option.match(currentEvents, {
            onNone: () => -1,
            onSome: (events) => events.length - 1,
          });

          if (currentVersion !== (expectedVersion as number)) {
            return yield* Effect.fail(
              new EventStoreError(
                "ConcurrencyConflict",
                `Expected version ${expectedVersion}, but stream is at ${currentVersion}`,
              ),
            );
          }

          const newEvents = Option.match(currentEvents, {
            onNone: () => events,
            onSome: (existing) => [...existing, ...events],
          });

          yield* Ref.update(streams, HashMap.set(streamName, newEvents));
          yield* Ref.update(globalStream, (global) => [...global, ...events]);

          // Notify subscribers
          const subs = yield* Ref.get(subscribers);
          yield* Effect.all(
            subs.map((queue) =>
              Effect.all(events.map((event) => Queue.offer(queue, event)))
            ),
            { discard: true },
          );
        }),

      read: (streamName, fromVersion = 0 as Version) =>
        Stream.fromEffect(
          Effect.gen(function* () {
            const currentStreams = yield* Ref.get(streams);
            const events = HashMap.get(currentStreams, streamName);

            return Option.match(events, {
              onNone: () => [],
              onSome: (events) => events.slice(fromVersion as number),
            });
          }),
        ).pipe(Stream.flatMap((events) => Stream.fromIterable(events))),

      readAll: (fromPosition = 0n) =>
        Stream.fromEffect(Ref.get(globalStream)).pipe(
          Stream.flatMap((events) =>
            Stream.fromIterable(events.slice(Number(fromPosition)))
          ),
        ),

      getVersion: (streamName) =>
        Effect.gen(function* () {
          const currentStreams = yield* Ref.get(streams);
          const events = HashMap.get(currentStreams, streamName);

          return Option.map(events, (events) => (events.length - 1) as Version);
        }),

      subscribe: (filter) =>
        Stream.fromEffect(
          Effect.gen(function* () {
            const queue = yield* Queue.unbounded<any>();
            yield* Ref.update(subscribers, (subs) => [...subs, queue]);
            return queue;
          }),
        ).pipe(
          Stream.flatMap((queue) => Stream.fromQueue(queue)),
          Stream.filter((event) =>
            !filter ||
            (!filter.streamName || true) && // Would need event metadata
              (!filter.eventTypes || filter.eventTypes.includes(event.type))
          ),
        ),
    };
  }),
);

// ============================================================================
// Command Bus Service
// ============================================================================

/**
 * Command Bus Interface
 */
export interface CommandBus {
  readonly send: <Command, Result>(
    command: Command,
  ) => Effect.Effect<Result, CommandError>;

  readonly register: <Command, Result>(
    commandType: string,
    handler: CommandHandler<Command, Result>,
  ) => Effect.Effect<void>;
}

export type CommandHandler<Command, Result> = (
  command: Command,
) => Effect.Effect<Result, CommandError>;

export class CommandError {
  readonly _tag = "CommandError";
  constructor(
    readonly reason: "HandlerNotFound" | "ValidationFailed" | "ExecutionFailed",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

export const CommandBus = Context.GenericTag<CommandBus>("CommandBus");

/**
 * In-Memory Command Bus Implementation
 */
export const InMemoryCommandBus = Layer.effect(
  CommandBus,
  Effect.gen(function* () {
    const handlers = yield* Ref.make(
      new Map<string, CommandHandler<any, any>>(),
    );

    return {
      send: (command: any) =>
        Effect.gen(function* () {
          const currentHandlers = yield* Ref.get(handlers);
          const handler = currentHandlers.get(command.type);

          if (!handler) {
            return yield* Effect.fail(
              new CommandError(
                "HandlerNotFound",
                `No handler registered for command type: ${command.type}`,
              ),
            );
          }

          return yield* handler(command);
        }),

      register: (commandType, handler) =>
        Ref.update(handlers, (map) => {
          const newMap = new Map(map);
          newMap.set(commandType, handler);
          return newMap;
        }),
    };
  }),
);

// ============================================================================
// Query Bus Service
// ============================================================================

/**
 * Query Bus Interface
 */
export interface QueryBus {
  readonly execute: <Query, Result>(
    query: Query,
  ) => Effect.Effect<Result, QueryError>;

  readonly register: <Query, Result>(
    queryType: string,
    handler: QueryHandler<Query, Result>,
  ) => Effect.Effect<void>;
}

export type QueryHandler<Query, Result> = (
  query: Query,
) => Effect.Effect<Result, QueryError>;

export class QueryError {
  readonly _tag = "QueryError";
  constructor(
    readonly reason: "HandlerNotFound" | "ExecutionFailed",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

export const QueryBus = Context.GenericTag<QueryBus>("QueryBus");

/**
 * In-Memory Query Bus Implementation
 */
export const InMemoryQueryBus = Layer.effect(
  QueryBus,
  Effect.gen(function* () {
    const handlers = yield* Ref.make(new Map<string, QueryHandler<any, any>>());

    return {
      execute: (query: any) =>
        Effect.gen(function* () {
          const currentHandlers = yield* Ref.get(handlers);
          const handler = currentHandlers.get(query.type);

          if (!handler) {
            return yield* Effect.fail(
              new QueryError(
                "HandlerNotFound",
                `No handler registered for query type: ${query.type}`,
              ),
            );
          }

          return yield* handler(query);
        }),

      register: (queryType, handler) =>
        Ref.update(handlers, (map) => {
          const newMap = new Map(map);
          newMap.set(queryType, handler);
          return newMap;
        }),
    };
  }),
);

// ============================================================================
// Projection Store Service
// ============================================================================

/**
 * Projection Store Interface
 */
export interface ProjectionStore {
  readonly save: <State>(
    projectionName: string,
    state: State,
  ) => Effect.Effect<void, ProjectionError>;

  readonly load: <State>(
    projectionName: string,
  ) => Effect.Effect<Option.Option<State>, ProjectionError>;

  readonly saveCheckpoint: (
    projectionName: string,
    position: bigint,
  ) => Effect.Effect<void, ProjectionError>;

  readonly loadCheckpoint: (
    projectionName: string,
  ) => Effect.Effect<Option.Option<bigint>, ProjectionError>;
}

export class ProjectionError {
  readonly _tag = "ProjectionError";
  constructor(
    readonly reason: "SaveFailed" | "LoadFailed",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

export const ProjectionStore = Context.GenericTag<ProjectionStore>(
  "ProjectionStore",
);

/**
 * In-Memory Projection Store Implementation
 */
export const InMemoryProjectionStore = Layer.effect(
  ProjectionStore,
  Effect.gen(function* () {
    const states = yield* Ref.make(new Map<string, any>());
    const checkpoints = yield* Ref.make(new Map<string, bigint>());

    return {
      save: (projectionName, state) =>
        Ref.update(states, (map) => {
          const newMap = new Map(map);
          newMap.set(projectionName, state);
          return newMap;
        }),

      load: (projectionName) =>
        Effect.gen(function* () {
          const currentStates = yield* Ref.get(states);
          return Option.fromNullable(currentStates.get(projectionName));
        }),

      saveCheckpoint: (projectionName, position) =>
        Ref.update(checkpoints, (map) => {
          const newMap = new Map(map);
          newMap.set(projectionName, position);
          return newMap;
        }),

      loadCheckpoint: (projectionName) =>
        Effect.gen(function* () {
          const currentCheckpoints = yield* Ref.get(checkpoints);
          return Option.fromNullable(currentCheckpoints.get(projectionName));
        }),
    };
  }),
);

// ============================================================================
// Repository Service
// ============================================================================

/**
 * Repository Interface
 */
export interface Repository<Aggregate> {
  readonly load: (
    id: AggregateId,
  ) => Effect.Effect<Option.Option<Aggregate>, RepositoryError>;

  readonly save: (
    aggregate: Aggregate,
  ) => Effect.Effect<void, RepositoryError>;

  readonly exists: (
    id: AggregateId,
  ) => Effect.Effect<boolean, RepositoryError>;
}

export class RepositoryError {
  readonly _tag = "RepositoryError";
  constructor(
    readonly reason: "LoadFailed" | "SaveFailed" | "ConcurrencyConflict",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

/**
 * Create a repository for an aggregate type
 */
export const createLegacyRepository = <State, Event>(
  aggregateName: string,
  loadFromEvents: (events: ReadonlyArray<Event>) => State,
  getUncommittedEvents: (aggregate: State) => ReadonlyArray<Event>,
  getVersion: (aggregate: State) => Version,
  getId: (aggregate: State) => AggregateId,
) =>
  Layer.effect(
    Context.GenericTag<Repository<State>>(`Repository<${aggregateName}>`),
    Effect.gen(function* () {
      const eventStore = yield* EventStore;

      return {
        load: (id) =>
          Effect.gen(function* () {
            const streamName = `${aggregateName}-${id}` as StreamName;
            const events = yield* pipe(
              eventStore.read<Event>(streamName),
              Stream.runCollect,
              Effect.map((chunk) => Array.from(chunk)),
            ).pipe(
              Effect.mapError((error) =>
                new RepositoryError("LoadFailed", error.message, error.details)
              ),
            );

            if (events.length === 0) {
              return Option.none();
            }

            return Option.some(loadFromEvents(events));
          }),

        save: (aggregate) =>
          Effect.gen(function* () {
            const id = getId(aggregate);
            const streamName = `${aggregateName}-${id}` as StreamName;
            const events = getUncommittedEvents(aggregate);
            const version = getVersion(aggregate);

            if (events.length > 0) {
              yield* eventStore.append(streamName, events, version).pipe(
                Effect.mapError((error) =>
                  new RepositoryError(
                    "SaveFailed",
                    error.message,
                    error.details,
                  )
                ),
              );
            }
          }),

        exists: (id) =>
          Effect.gen(function* () {
            const streamName = `${aggregateName}-${id}` as StreamName;
            const version = yield* eventStore.getVersion(streamName).pipe(
              Effect.mapError((error) =>
                new RepositoryError("LoadFailed", error.message, error.details)
              ),
            );
            return Option.isSome(version);
          }),
      };
    }),
  );

// ============================================================================
// Saga Manager Service
// ============================================================================

/**
 * Saga Manager Interface
 */
export interface SagaManager {
  readonly start: <SagaState>(
    sagaId: string,
    sagaType: string,
    initialState: SagaState,
  ) => Effect.Effect<void, SagaError>;

  readonly handle: <Event>(
    event: Event,
  ) => Effect.Effect<void, SagaError>;

  readonly getState: <SagaState>(
    sagaId: string,
  ) => Effect.Effect<Option.Option<SagaState>, SagaError>;
}

export class SagaError {
  readonly _tag = "SagaError";
  constructor(
    readonly reason: "StartFailed" | "HandleFailed" | "NotFound",
    readonly message: string,
    readonly details?: unknown,
  ) {}
}

export const SagaManager = Context.GenericTag<SagaManager>("SagaManager");

// ============================================================================
// Complete Service Layer
// ============================================================================

/**
 * Core services layer - combines all essential services
 */
export const CoreServicesLive = Layer.mergeAll(
  InMemoryEventStore,
  InMemoryCommandBus,
  InMemoryQueryBus,
  InMemoryProjectionStore,
);

/**
 * Test services layer - for testing
 */
export const TestServicesLive = CoreServicesLive;
