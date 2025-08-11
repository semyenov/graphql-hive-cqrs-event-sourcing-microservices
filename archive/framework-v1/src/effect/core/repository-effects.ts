/**
 * Framework Effect: Repository Effects
 *
 * Repository pattern implementation with Effect-TS for
 * aggregate persistence, optimistic locking, and caching.
 *
 * @module
 */

import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Data from "effect/Data";
import * as Option from "effect/Option";
import * as Cache from "effect/Cache";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
import * as Ref from "effect/Ref";
import { pipe } from "effect/Function";
import type {
  IAggregateBehavior,
  IEvent,
  IEventStore,
  ISnapshot,
} from "./types";
import type {
  AggregateId,
  AggregateVersion,
  EventVersion,
} from "../../core/branded/types";

/**
 * Repository context - dependencies for aggregate persistence
 */
export interface RepositoryContext<
  TState,
  TEvent extends IEvent = IEvent,
  TId extends AggregateId = AggregateId,
> {
  readonly snapshotStore?: Map<string, ISnapshot<TState>>;
  readonly cache?: Cache.Cache<TId, never, any>;
  readonly eventStore: IEventStore<TEvent, TId>;
}

/**
 * Repository context tag for dependency injection
 */
export const RepositoryContextTag = <
  TState,
  TEvent extends IEvent = IEvent,
  TId extends AggregateId = AggregateId,
>() =>
  Context.GenericTag<RepositoryContext<TState, TEvent, TId>>(
    "RepositoryContext",
  );

/**
 * Repository errors using Data.TaggedError for type-safe error handling
 */
export class AggregateNotFoundError
  extends Data.TaggedError("AggregateNotFoundError")<{
    readonly aggregateId: AggregateId;
  }> {}

export class VersionConflictError
  extends Data.TaggedError("VersionConflictError")<{
    readonly aggregateId: AggregateId;
    readonly expectedVersion: AggregateVersion;
    readonly actualVersion: AggregateVersion;
  }> {}

export class PersistenceError extends Data.TaggedError("PersistenceError")<{
  readonly aggregateId: AggregateId;
  readonly operation: "load" | "save" | "delete";
  readonly cause: unknown;
}> {}

export class SnapshotError extends Data.TaggedError("SnapshotError")<{
  readonly aggregateId: AggregateId;
  readonly cause: unknown;
}> {}

export type RepositoryError =
  | AggregateNotFoundError
  | VersionConflictError
  | PersistenceError
  | SnapshotError;

/**
 * Effect-based repository interface
 */
export interface EffectRepository<
  TState,
  TEvent extends IEvent = IEvent,
  TId extends AggregateId = AggregateId,
  TAggregate = IAggregateBehavior<TState, TEvent, TId>,
> {
  /**
   * Load aggregate by ID
   */
  load(
    id: AggregateId,
  ): Effect.Effect<
    TAggregate,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;

  /**
   * Save aggregate
   */
  save(
    aggregate: TAggregate,
  ): Effect.Effect<
    TAggregate,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;

  /**
   * Delete aggregate
   */
  delete(
    id: AggregateId,
  ): Effect.Effect<
    void,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;

  /**
   * Check if aggregate exists
   */
  exists(
    id: AggregateId,
  ): Effect.Effect<
    boolean,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;
}

/**
 * Create an Effect-based repository with caching and snapshot support
 *
 * @example
 * ```typescript
 * const repository = createRepository({
 *   createAggregate: (id) => new UserAggregate(id),
 *   snapshotFrequency: 10,
 *   cacheCapacity: 100,
 *   cacheTTL: Duration.minutes(5)
 * });
 * ```
 */
export function createRepository<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent = IEvent,
>(
  config: {
    createAggregate: <TId extends AggregateId>(id: TId) => TAggregate;
    snapshotFrequency?: number;
    cacheCapacity?: number;
    cacheTTL?: Duration.DurationInput;
  },
): EffectRepository<TState, TEvent, TId, TAggregate> {
  const contextTag = RepositoryContextTag<TState, TEvent, TId>();

  return {
    load: (
      id: TId,
    ): Effect.Effect<
      TAggregate,
      RepositoryError,
      RepositoryContext<TState, TEvent, TId>
    > =>
      Effect.gen(function* (_) {
        const ctx = yield* _(contextTag);

        // Check cache first if available
        if (ctx.cache) {
          const cached = yield* _(ctx.cache.get(id));
          if (Option.isSome(cached)) {
            return cached.value as TAggregate;
          }
        }

        // Load from store
        const aggregate = yield* _(
          loadFromStore(ctx, id, config.createAggregate),
        );

        // Cache the loaded aggregate
        if (ctx.cache) {
          yield* _(ctx.cache.set(id, aggregate));
        }

        return aggregate as TAggregate;
      }),

    save: (
      aggregate: TAggregate,
    ): Effect.Effect<
      TAggregate,
      RepositoryError,
      RepositoryContext<TState, TEvent, TId>
    > =>
      Effect.gen(function* (_) {
        const ctx = yield* _(contextTag);

        // Save events
        yield* _(saveEvents(ctx, aggregate));

        // Update cache
        if (ctx.cache) {
          yield* _(ctx.cache.set(aggregate.id, aggregate));
        }

        // Create snapshot if needed
        if (
          config.snapshotFrequency &&
          aggregate.version % config.snapshotFrequency === 0
        ) {
          yield* _(createSnapshot(ctx, aggregate));
        }

        return aggregate as TAggregate;
      }),

    delete: (id: TId) =>
      Effect.gen(function* (_) {
        const ctx = yield* _(contextTag);

        // Mark as deleted (soft delete via event)
        yield* _(Effect.tryPromise({
          try: () =>
            ctx.eventStore.appendBatch([{
              aggregateId: id,
              type: "AggregateDeleted" as TEvent["type"],
              data: { deletedAt: new Date().toISOString() },
              version: 0 as EventVersion,
              timestamp: new Date().toISOString(),
            } as unknown as Extract<TEvent, { type: TEvent["type"] }>]),
          catch: (error) =>
            new PersistenceError({
              aggregateId: id,
              operation: "delete",
              cause: error,
            }),
        }));

        // Remove from cache
        if (ctx.cache) {
          yield* _(ctx.cache.invalidate(id));
        }
      }),

    exists: (id: TId) =>
      Effect.gen(function* (_) {
        const ctx = yield* _(contextTag);

        const result = yield* _(Effect.tryPromise({
          try: async () => {
            const events = await ctx.eventStore.getEvents(id);
            return events.length > 0;
          },
          catch: () => new AggregateNotFoundError({ aggregateId: id }),
        }));

        return result;
      }).pipe(
        Effect.mapError(() => new AggregateNotFoundError({ aggregateId: id })),
      ),
  };
}

// Helper functions
function loadFromStore<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  ctx: RepositoryContext<TState, TEvent, TId>,
  id: TId,
  createAggregate: (id: TId) => TAggregate,
): Effect.Effect<TAggregate, RepositoryError, never> {
  return Effect.gen(function* (_) {
    // Try to load snapshot
    const snapshot = yield* _(loadSnapshot(ctx, id));

    // Load events after snapshot
    const events = yield* _(Effect.tryPromise({
      try: () =>
        ctx.eventStore.getEvents(
          id,
          Option.match(snapshot, {
            onNone: () => 0 as AggregateVersion,
            onSome: (s) => s.version,
          }),
        ),
      catch: (error) =>
        new PersistenceError({
          aggregateId: id,
          operation: "load",
          cause: error,
        }),
    }));

    if (events.length === 0 && Option.isNone(snapshot)) {
      return yield* _(
        Effect.fail(new AggregateNotFoundError({ aggregateId: id })),
      );
    }

    const aggregate = createAggregate(id);

    // Apply snapshot if available
    if (Option.isSome(snapshot)) {
      (aggregate as any).loadFromSnapshot(snapshot.value);
    }

    // Apply events
    events.forEach((event) => (aggregate as any).applyEvent(event, false));

    return aggregate;
  });
}

function saveEvents<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  ctx: RepositoryContext<TState, TEvent, TId>,
  aggregate: TAggregate,
): Effect.Effect<void, RepositoryError, never> {
  const uncommittedEvents = aggregate.uncommittedEvents;

  if (!uncommittedEvents || uncommittedEvents.length === 0) {
    return Effect.succeed(undefined);
  }

  return Effect.tryPromise({
    try: () =>
      ctx.eventStore.appendBatch(
        uncommittedEvents as Extract<TEvent, { type: TEvent["type"] }>[],
      ),
    catch: (error) =>
      new PersistenceError({
        aggregateId: aggregate.id,
        operation: "save",
        cause: error,
      }),
  }).pipe(
    Effect.tap(() => Effect.sync(() => aggregate.markEventsAsCommitted())),
  );
}

function loadSnapshot<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  ctx: RepositoryContext<TState, TEvent, TId>,
  id: TId,
): Effect.Effect<Option.Option<ISnapshot>, never, never> {
  if (!ctx.snapshotStore) {
    return Effect.succeed(Option.none());
  }

  return Effect.sync(() => {
    const snapshot = ctx.snapshotStore!.get(id as string);
    return snapshot ? Option.some(snapshot) : Option.none();
  });
}

function createSnapshot<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  ctx: RepositoryContext<TState, TEvent, TId>,
  aggregate: TAggregate,
): Effect.Effect<void, never, never> {
  if (!ctx.snapshotStore) {
    return Effect.succeed(undefined);
  }

  return Effect.sync(() => {
    const snapshot = (aggregate as any).createSnapshot();
    ctx.snapshotStore!.set(aggregate.id as string, snapshot);
  });
}

/**
 * Repository with optimistic locking
 */
export function withOptimisticLocking<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  repository: EffectRepository<TState, TEvent, TId, TAggregate>,
): EffectRepository<TState, TEvent, TId, TAggregate> {
  const versions = new Map<string, AggregateVersion>();
  const contextTag = RepositoryContextTag<TState, TEvent, TId>();

  return {
    ...repository,

    save: (
      aggregate: TAggregate,
    ): Effect.Effect<
      TAggregate,
      RepositoryError,
      RepositoryContext<TState, TEvent, TId>
    > =>
      Effect.gen(function* (_) {
        const ctx = yield* _(contextTag);

        // Check version conflict
        const events = yield* _(Effect.tryPromise({
          try: () => ctx.eventStore.getEvents(aggregate.id),
          catch: (error) =>
            new PersistenceError({
              aggregateId: aggregate.id,
              operation: "save",
              cause: error,
            }),
        }));

        const currentVersion = events.length;
        const lastKnownVersion = versions.get(aggregate.id as string);

        if (lastKnownVersion && lastKnownVersion !== currentVersion) {
          return yield* _(Effect.fail(
            new VersionConflictError({
              aggregateId: aggregate.id,
              expectedVersion: lastKnownVersion,
              actualVersion: currentVersion as AggregateVersion,
            }),
          ));
        }

        const savedAggregate = yield* _(repository.save(aggregate));
        versions.set(
          aggregate.id as string,
          aggregate.version as AggregateVersion,
        );
        return savedAggregate;
      }),
  };
}

/**
 * Repository with automatic retry using exponential backoff
 */
export function withRetry<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  repository: EffectRepository<TState, TEvent, TId, TAggregate>,
  schedule: Schedule.Schedule<unknown, unknown, never> = Schedule.exponential(
    Duration.millis(100),
  ),
): EffectRepository<TState, TEvent, TId, TAggregate> {
  return {
    load: (id: TId) => pipe(repository.load(id), Effect.retry(schedule)),

    save: (
      aggregate: TAggregate,
    ): Effect.Effect<
      TAggregate,
      RepositoryError,
      RepositoryContext<TState, TEvent, TId>
    > => pipe(repository.save(aggregate), Effect.retry(schedule)),

    delete: (id: TId) => pipe(repository.delete(id), Effect.retry(schedule)),

    exists: repository.exists,
  };
}

/**
 * Create cached repository
 */
export function createCachedRepository<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  config: {
    createAggregate: (id: AggregateId) => TAggregate;
    capacity: number;
    timeToLive: Duration.DurationInput;
  },
): Effect.Effect<
  EffectRepository<TState, TEvent, TId, TAggregate>,
  never,
  RepositoryContext<TState, TEvent, TId>
> {
  return Effect.map(
    RepositoryContextTag<TState, TEvent, TId>(),
    (ctx) => {
      // Create repository with caching configuration
      return createRepository({
        ...config,
        cacheCapacity: config.capacity,
        cacheTTL: config.timeToLive,
      });
    },
  );
}

/**
 * Transaction support using Ref for simpler implementation
 * Note: STM cannot easily run Effects, so we use a simpler Ref-based approach
 */
export function withTransaction<
  TState,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  TId extends AggregateId,
  TEvent extends IEvent,
>(
  repository: EffectRepository<TState, TEvent, TId, TAggregate>,
): EffectRepository<TState, TEvent, TId, TAggregate> & {
  beginTransaction: () => Effect.Effect<
    void,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;
  commitTransaction: () => Effect.Effect<
    void,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;
  rollbackTransaction: () => Effect.Effect<
    void,
    RepositoryError,
    RepositoryContext<TState, TEvent, TId>
  >;
} {
  const transactionMap = Ref.unsafeMake<Map<string, TAggregate>>(new Map());
  const pendingOperations = Ref.unsafeMake<
    Array<
      () => Effect.Effect<
        void,
        RepositoryError,
        RepositoryContext<TState, TEvent, TId>
      >
    >
  >([]);

  return {
    ...repository,

    load: (id: TId) =>
      pipe(
        Ref.get(transactionMap),
        Effect.flatMap((map) => {
          const cached = map.get(id as string);
          if (cached) {
            return Effect.succeed(cached);
          }
          return repository.load(id);
        }),
      ),

    save: (
      aggregate: TAggregate,
    ): Effect.Effect<
      TAggregate,
      RepositoryError,
      RepositoryContext<TState, TEvent, TId>
    > =>
      pipe(
        Ref.update(transactionMap, (map) => {
          const newMap = new Map(map);
          newMap.set(aggregate.id as string, aggregate);
          return newMap;
        }),
        Effect.flatMap(() =>
          Ref.update(pendingOperations, (ops) => [
            ...ops,
            () => repository.save(aggregate),
          ])
        ),
        Effect.map(() => aggregate),
      ),

    delete: (id: TId) =>
      pipe(
        Ref.update(transactionMap, (map) => {
          const newMap = new Map(map);
          newMap.delete(id as string);
          return newMap;
        }),
        Effect.flatMap(() =>
          Ref.update(pendingOperations, (ops) => [
            ...ops,
            () => repository.delete(id),
          ])
        ),
      ),

    exists: repository.exists,

    beginTransaction: () =>
      pipe(
        Ref.set(transactionMap, new Map()),
        Effect.flatMap(() => Ref.set(pendingOperations, [])),
      ),

    commitTransaction: () =>
      pipe(
        Ref.get(pendingOperations),
        Effect.flatMap((ops) =>
          Effect.all(ops.map((op) => op()), { discard: true })
        ),
        Effect.flatMap(() =>
          pipe(
            Ref.set(transactionMap, new Map()),
            Effect.flatMap(() => Ref.set(pendingOperations, [])),
          )
        ),
      ),

    rollbackTransaction: () =>
      pipe(
        Ref.set(transactionMap, new Map()),
        Effect.flatMap(() => Ref.set(pendingOperations, [])),
      ),
  };
}

/**
 * Create repository service layer
 */
export function createRepositoryLayer<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
>(
  eventStore: IEventStore<TEvent, TId>,
  options?: {
    enableSnapshots?: boolean;
    enableCache?: boolean;
    cacheCapacity?: number;
    cacheTTL?: Duration.DurationInput;
  },
): Layer.Layer<RepositoryContext<TState, TEvent, TId>, never, never> {
  return Layer.succeed(
    RepositoryContextTag<TState, TEvent, TId>(),
    {
      eventStore,
      snapshotStore: options?.enableSnapshots ? new Map() : undefined,
      cache: undefined, // Cache should be created per repository instance
    },
  );
}

/**
 * Repository with logging
 */
export function withLogging<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
>(
  repository: EffectRepository<TState, TEvent, TId, TAggregate>,
  repositoryName: string,
): EffectRepository<TState, TEvent, TId, TAggregate> {
  return {
    load: (id: TId) =>
      pipe(
        Effect.log(`[${repositoryName}] Loading aggregate ${id}`),
        Effect.flatMap(() => repository.load(id)),
        Effect.tap(() =>
          Effect.log(`[${repositoryName}] Successfully loaded aggregate ${id}`)
        ),
        Effect.tapError((error) =>
          Effect.log(
            `[${repositoryName}] Failed to load aggregate ${id}: ${error}`,
          )
        ),
      ),

    save: (aggregate: TAggregate) =>
      pipe(
        Effect.log(`[${repositoryName}] Saving aggregate ${aggregate.id}`),
        Effect.flatMap(() => repository.save(aggregate)),
        Effect.tap(() =>
          Effect.log(
            `[${repositoryName}] Successfully saved aggregate ${aggregate.id}`,
          )
        ),
        Effect.tapError((error) =>
          Effect.log(
            `[${repositoryName}] Failed to save aggregate ${aggregate.id}: ${error}`,
          )
        ),
      ),

    delete: (id: TId) =>
      pipe(
        Effect.log(`[${repositoryName}] Deleting aggregate ${id}`),
        Effect.flatMap(() => repository.delete(id)),
        Effect.tap(() =>
          Effect.log(`[${repositoryName}] Successfully deleted aggregate ${id}`)
        ),
        Effect.tapError((error) =>
          Effect.log(
            `[${repositoryName}] Failed to delete aggregate ${id}: ${error}`,
          )
        ),
      ),

    exists: repository.exists,
  };
}

/**
 * Repository with metrics
 */
export function withMetrics<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
>(
  repository: EffectRepository<TState, TEvent, TId, TAggregate>,
  metricsPrefix: string = "repository",
): EffectRepository<TState, TEvent, TId, TAggregate> {
  const metrics = {
    loads: Ref.unsafeMake(0),
    saves: Ref.unsafeMake(0),
    deletes: Ref.unsafeMake(0),
    errors: Ref.unsafeMake(0),
  };

  return {
    load: (id: TId) =>
      pipe(
        Ref.update(metrics.loads, (n) => n + 1),
        Effect.flatMap(() => repository.load(id)),
        Effect.tapError(() => Ref.update(metrics.errors, (n) => n + 1)),
      ),

    save: (aggregate: TAggregate) =>
      pipe(
        Ref.update(metrics.saves, (n) => n + 1),
        Effect.flatMap(() => repository.save(aggregate)),
        Effect.tapError(() => Ref.update(metrics.errors, (n) => n + 1)),
      ),

    delete: (id: TId) =>
      pipe(
        Ref.update(metrics.deletes, (n) => n + 1),
        Effect.flatMap(() => repository.delete(id)),
        Effect.tapError(() => Ref.update(metrics.errors, (n) => n + 1)),
      ),

    exists: repository.exists,
  };
}
