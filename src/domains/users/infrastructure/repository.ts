/**
 * User Domain: Repository Implementation
 * 
 * Effect-based repository with caching, optimistic locking, and snapshots.
 * Implements the repository pattern for aggregate persistence.
 */

import * as Effect from 'effect/Effect';
import * as Cache from 'effect/Cache';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import * as Ref from 'effect/Ref';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';
import { 
  createRepository,
  withOptimisticLocking,
  createCachedRepository,
  type EffectRepository,
  type RepositoryContext,
  RepositoryContextTag,
  AggregateNotFoundError,
  VersionConflictError,
  PersistenceError,
  SnapshotError
} from '@cqrs/framework/effect';
import type { AggregateVersion, EventHandler, IEventStore } from '@cqrs/framework';
import { UserAggregate } from '../core/aggregate';
import type { UserId, Email, Username, UserState } from '../core/types';
import { UserTypes } from '../core/types';
import type { UserDomainEvent } from '../core/events';
import * as Errors from '../core/errors';
import type { UserRepository } from '../application/command-handlers';
import type { ISnapshot } from '@cqrs/framework/effect/core/types';

/**
 * User repository context with additional services
 */
export interface UserRepositoryContext extends RepositoryContext<UserState, UserDomainEvent, UserId> {
  readonly eventStore: IEventStore<UserDomainEvent>;
  readonly snapshotStore: Map<string, ISnapshot<UserState>>;
  readonly indexStore: UserIndexStore;
}

/**
 * User event store interface
 */
export interface UserEventStore extends IEventStore<UserDomainEvent> {
  readonly getEvents: (aggregateId: UserId, fromVersion?: number) => Promise<ReadonlyArray<UserDomainEvent>>;
  readonly appendBatch: (events: ReadonlyArray<UserDomainEvent>, expectedVersion?: number) => Promise<void>;
  readonly getAllEvents: () => Promise<ReadonlyArray<UserDomainEvent>>;
  readonly subscribe: (handler: EventHandler<UserDomainEvent>) => void;
}

/**
 * User snapshot store interface
 */
export interface UserSnapshotStore {
  readonly save: (aggregateId: UserId, aggregate: UserAggregate, version: number) => Effect.Effect<void, SnapshotError, never>;
  readonly load: (aggregateId: UserId) => Effect.Effect<Option.Option<{ aggregate: UserAggregate; version: number }>, SnapshotError, never>;
}

/**
 * User index store for lookups
 */
export interface UserIndexStore {
  readonly indexByEmail: (email: Email, userId: UserId) => Effect.Effect<void, never, never>;
  readonly indexByUsername: (username: Username, userId: UserId) => Effect.Effect<void, never, never>;
  readonly findByEmail: (email: Email) => Effect.Effect<Option.Option<UserId>, never, never>;
  readonly findByUsername: (username: Username) => Effect.Effect<Option.Option<Username>, never, never>;
  readonly removeEmailIndex: (email: Email) => Effect.Effect<void, never, never>;
  readonly removeUsernameIndex: (username: Username) => Effect.Effect<void, never, never>;
}

export const UserRepositoryContextTag = Context.GenericTag<UserRepositoryContext>('UserRepositoryContext');
export const UserEventStoreTag = Context.GenericTag<UserEventStore>('UserEventStore');
export const UserSnapshotStoreTag = Context.GenericTag<UserSnapshotStore>('UserSnapshotStore');
export const UserIndexStoreTag = Context.GenericTag<UserIndexStore>('UserIndexStore');

/**
 * User repository implementation
 */
export class UserRepositoryImpl implements UserRepository { 
  private readonly cache: Cache.Cache<UserId, AggregateNotFoundError, UserAggregate>;
  private readonly lockMap: Map<string, Promise<void>>;
  
  private constructor(
    cache: Cache.Cache<UserId, AggregateNotFoundError, UserAggregate>,
    private readonly context: UserRepositoryContext
  ) {
    this.cache = cache;
    this.lockMap = new Map();
  }

  /**
   * Create a new repository instance
   */
  static  create(config?: {
    cacheSize?: number;
    cacheTTL?: Duration.Duration;
    snapshotFrequency?: number;
  }): Effect.Effect<UserRepositoryImpl, never, UserRepositoryContext> {
    return pipe(
      UserRepositoryContextTag,
      Effect.flatMap((context) =>
        pipe(
          Cache.make({
            capacity: config?.cacheSize || 1000,
            timeToLive: config?.cacheTTL || Duration.minutes(5),
            lookup: (userId: UserId) => loadAggregateFromStore(userId, context)
          }),
          Effect.map((cache) => new UserRepositoryImpl(cache, context))
        )
      )
    )
  }

  /**
   * Get aggregate by ID
   */
  get(id: string): Effect.Effect<UserAggregate | null, AggregateNotFoundError, never> {
    const userId = UserTypes.userId(id);  
    const context = this.context;

    return Effect.gen(function* (_) {
      // Try cache first
      const cached = yield* context.cache.get(userId);
      if (cached) return cached;
      
      // Load from store
      const aggregate = yield* pipe(
        loadAggregateFromStore(userId, context),
        Effect.catchAll(() => Effect.succeed(null))
      );
      
      // Cache if found
      if (aggregate) {
        yield* context.cache.set(userId, aggregate);
      }
      
      return aggregate;
    });
  }

  /**
   * Save aggregate with optimistic locking
   */
  save(aggregate: UserAggregate): Effect.Effect<UserAggregate, never, never> {
    const context = this.context;
    const cache = this.cache;
    const releaseLock = this.releaseLock.bind(this);
    const acquireLock = this.acquireLock.bind(this);
    const saveSnapshotIfNeeded = this.saveSnapshotIfNeeded.bind(this);
    const updateIndexes = this.updateIndexes.bind(this);
    const handleVersionConflict = this.handleVersionConflict.bind(this);

    return Effect.gen(function* (_) {
      const userId = aggregate.id;
      const events = aggregate.uncommittedEvents;
      
      if (events.length === 0) {
        return aggregate; // Nothing to save
      }
      
      // Acquire lock for this aggregate
      yield* _(acquireLock(userId));
      const eventStore = context.eventStore;
      
      try { 
        // Save events with version check
        yield* pipe(
          eventStore.saveEvents(
            userId,
            events,
            aggregate.version - events.length
          ),
          Effect.catchTag('VersionConflictError', (error) => {
            // Handle version conflict by reloading and retrying
            return handleVersionConflict(aggregate);
          })
        );
        
        // Mark events as committed
        aggregate.markEventsAsCommitted();
        
        // Update indexes if needed
        yield* _(updateIndexes(aggregate, events));
        
        // Save snapshot if needed
        yield* _(saveSnapshotIfNeeded(aggregate));
        
        // Update cache
        yield* _(Cache.set(cache, userId, aggregate));
        
      } finally {
        // Release lock
        yield* _(releaseLock(userId));
      }
    });
  }

  /**
   * Find by email
   */
  findByEmail(email: string): Effect.Effect<UserAggregate | null, never, never> {
    const emailBrand = UserTypes.email(email);
    const context = this.context;
    
    return Effect.gen(function* (_) {
      const get = this.get.bind(this);
      const userIdOption = yield* context.indexStore.findByEmail(emailBrand);
      
      if (Option.isNone(userIdOption)) {
        return null;
      }
      
      return yield* get(userIdOption.value);
    });
  }

  /**
   * Find by username
   */
  findByUsername(username: string): Effect.Effect<UserAggregate | null, never, never> {
    const usernameBrand = UserTypes.username(username);
    const context = this.context;
    
    return Effect.gen(function* (_) {
      const get = this.get.bind(this);
      const userIdOption = yield* context.indexStore.findByUsername(usernameBrand);
      
      if (Option.isNone(userIdOption)) {
        return null;
      }
      
      return yield* get(userIdOption.value);
    });
  }

  /**
   * Acquire lock for aggregate
   */
  private acquireLock(userId: UserId): Effect.Effect<void, never, never> {
    return Effect.async<void>((resume) => {
      const lockKey = userId;
      const existingLock = this.lockMap.get(lockKey);
      
      if (existingLock) {
        // Wait for existing lock
        existingLock.then(() => {
          // Create new lock
          const newLock = new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
          this.lockMap.set(lockKey, newLock);
          resume(Effect.succeed(undefined));
        });
      } else {
        // Create new lock
        const newLock = new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        this.lockMap.set(lockKey, newLock);
        resume(Effect.succeed(undefined));
      }
    });
  }

  /**
   * Release lock for aggregate
   */
  private releaseLock(userId: UserId): void {
    const lockKey = userId;
    this.lockMap.delete(lockKey);
  }

  /**
   * Handle version conflict with retry
   */
  private handleVersionConflict(aggregate: UserAggregate): Effect.Effect<void, never, never> {
    const context = this.context;
    
    return Effect.gen(function* (_) {
      const loadAggregateFromStore = this.loadAggregateFromStore.bind(this);
      // Reload aggregate
      const reloaded = yield* loadAggregateFromStore(aggregate.id, context);
      
      // Replay uncommitted events
      const uncommittedEvents = aggregate.uncommittedEvents;
      for (const event of uncommittedEvents) {
        // Apply event to reloaded aggregate
        // This would require exposing an apply method on the aggregate
        // For now, we'll just fail
        yield* Effect.fail(new VersionConflictError({
          aggregateId: aggregate.id,
          expectedVersion: aggregate.version,
          actualVersion: reloaded.version
        }));
      }
    });
  }

  /**
   * Update indexes based on events
   */
  private updateIndexes(aggregate: UserAggregate, events: readonly UserDomainEvent[]): Effect.Effect<void, never, never> {
    const context = this.context;
    const indexStore = context.indexStore;
    return Effect.gen(function* (_) {
      if (!aggregate.state) return;
      
      // Index by email and username
      yield* _(indexStore.indexByEmail(aggregate.state.email, aggregate.id));
      yield* _(indexStore.indexByUsername(aggregate.state.username, aggregate.id));
    });
  }

  /**
   * Save snapshot if needed
   */
  private saveSnapshotIfNeeded(aggregate: UserAggregate): Effect.Effect<void, never, never> {
    const context = this.context;
    const snapshotStore = context.snapshotStore;

    
    return Effect.gen(function* (_) {
      // Save snapshot every 10 events
      if (aggregate.version % 10 === 0) {
        yield* _(snapshotStore.save(aggregate.id, aggregate, aggregate.version));
      }
    });
  }
}

/**
 * Load aggregate from store
 */
function loadAggregateFromStore(
  userId: UserId,
  context: UserRepositoryContext
): Effect.Effect<UserAggregate, AggregateNotFoundError, never> {
  return Effect.async<UserAggregate, AggregateNotFoundError, never>(function* (_) {
    // Try to load from snapshot first
    const snapshotOption = yield* _(context.snapshotStore.load(userId));
    
    let aggregate: UserAggregate;
    let fromVersion = 0 as AggregateVersion;
    
    if (Option.isSome(snapshotOption)) {
      // Start from snapshot
      aggregate = snapshotOption.value.aggregate;
      fromVersion = snapshotOption.value.version + 1;
    } else {
      // Create new aggregate
      aggregate = UserAggregate.create(userId);
    }
    
    
    // Replay events    
    return pipe(
      Effect.tryPromise( UserAggregate.fromHistory(userId, events)),
      Effect.catchAll((error) => {
        return Effect.fail(new PersistenceError({ 
          aggregateId: userId,
          error
        }));
      })
    );
  });
}

/**
 * Create in-memory implementations for testing
 */
export namespace InMemoryStores {
  export class InMemoryEventStore implements UserEventStore {
    private events: Map<string, UserDomainEvent[]> = new Map();
    private globalVersion = 0;
    
    getEvents(aggregateId: UserId, fromVersion = 0): Effect.Effect<readonly UserDomainEvent[], PersistenceError, never> {
      return Effect.succeed(
        this.events.get(aggregateId)?.filter(e => e.version > fromVersion) || []
      );
    }
    
    saveEvents(aggregateId: UserId, eventsToSave: readonly UserDomainEvent[], expectedVersion: number): Effect.Effect<void, VersionConflictError | PersistenceError, never> {
      const existing = this.events.get(aggregateId) || [];
      const currentVersion = existing.length as AggregateVersion;
      const events = this.events;
      let globalVersion = this.globalVersion;

      return Effect.gen(function* (_) {
        if (currentVersion !== expectedVersion) {
            yield*_(Effect.fail(new VersionConflictError({
            aggregateId,
            expectedVersion,
            actualVersion: currentVersion
          })));  
        }
        
        events.set(aggregateId, [...existing, ...eventsToSave]);
        globalVersion += eventsToSave.length;
      });
    }
    
    getAllEvents(fromVersion = 0): Effect.Effect<readonly UserDomainEvent[], PersistenceError, never> {
      const allEvents: UserDomainEvent[] = [];
      for (const events of this.events.values()) {
        allEvents.push(...events.filter(e => e.version > fromVersion));
      }
      return Effect.succeed(allEvents);
    }
  }
  
  export class InMemorySnapshotStore implements UserSnapshotStore {
    private snapshots: Map<string, { aggregate: UserAggregate; version: number }> = new Map();
    
    save(aggregateId: UserId, aggregate: UserAggregate, version: number): Effect.Effect<void, SnapshotError, never> {
      return Effect.succeed(
        this.snapshots.set(aggregateId, { aggregate, version })
      );
    }
    
    load(aggregateId: UserId): Effect.Effect<Option.Option<{ aggregate: UserAggregate; version: number }>, SnapshotError, never> {
      return Effect.succeed(
        Option.fromNullable(this.snapshots.get(aggregateId))
      );
    }
  }
  
  export class InMemoryIndexStore implements UserIndexStore {
    private emailIndex: Map<string, UserId> = new Map();
    private usernameIndex: Map<string, UserId> = new Map();
    
    indexByEmail(email: Email, userId: UserId): Effect.Effect<void, never, never> {
      return Effect.succeed(this.emailIndex.set(email, userId));
    }
    
    indexByUsername(username: Username, userId: UserId): Effect.Effect<void, never, never> {
      return Effect.succeed(this.usernameIndex.set(username, userId));
    }
    
    findByEmail(email: Email): Effect.Effect<Option.Option<UserId>, never, never> {
      return Effect.succeed(Option.fromNullable(this.emailIndex.get(email)));
    }
    
    findByUsername(username: Username): Effect.Effect<Option.Option<UserId>, never, never> {
      return Effect.succeed(Option.fromNullable(this.usernameIndex.get(username)));
    }
    
    removeEmailIndex(email: Email): Effect.Effect<void, never, never> {
      return Effect.succeed(this.emailIndex.delete(email));
    }
    
    removeUsernameIndex(username: Username): Effect.Effect<void, never, never> {
      return Effect.succeed(this.usernameIndex.delete(username));
    }
  }
}