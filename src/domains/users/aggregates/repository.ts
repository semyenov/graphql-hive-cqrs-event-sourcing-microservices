/**
 * User Domain: User Repository
 * 
 * Repository implementation for User aggregates.
 */

import { AggregateRepository } from '../../../framework/infrastructure/repository/aggregate';
import type { IEventStore, IEventBus } from '../../../framework/core/event';
import type { ISnapshot } from '../../../framework/core/aggregate';
import type { AggregateId } from '../../../framework/core/branded/types';
import type { UserEvent } from '../events/types';
import type { UserState } from './user';
import { UserAggregate } from './user';

/**
 * User repository
 */
export class UserRepository extends AggregateRepository<
  UserAggregate,
  UserEvent
> {
  private snapshots = new Map<string, ISnapshot<UserState, AggregateId>>();
  private readonly snapshotFrequency = 10; // Create snapshot every 10 events

  constructor(
    eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>,
    cacheEnabled = true,
    eventBus?: IEventBus<UserEvent>
  ) {
    super(eventStore, cacheEnabled, eventBus);
  }

  /**
   * Create new user aggregate instance
   */
  createAggregate(id: AggregateId): UserAggregate {
    return new UserAggregate(id);
  }

  /**
   * Save aggregate with snapshot support
   */
  override async save(aggregate: UserAggregate): Promise<void> {
    await super.save(aggregate);
    
    // Create snapshot if needed
    if (aggregate.version % this.snapshotFrequency === 0) {
      const snapshot = aggregate.createSnapshot();
      this.snapshots.set(aggregate.id as string, snapshot);
    }
  }

  /**
   * Get aggregate with snapshot support
   */
  override async get(id: AggregateId): Promise<UserAggregate | null> {
    // Check for snapshot first
    const snapshot = this.snapshots.get(id as string);
    
    if (snapshot) {
      const aggregate = this.createAggregate(id);
      aggregate.loadFromSnapshot(snapshot);
      
      // Load events after snapshot
      const events = await this.eventStore.getEvents(id, snapshot.version);
      if (events.length > 0) {
        aggregate.loadFromHistory(events);
      }
      
      // Update cache
      if (this.cacheEnabled) {
        this.evictFromCache(id);
      }
      
      return aggregate;
    }
    
    // Fallback to normal loading
    return super.get(id);
  }

  /**
   * Clear snapshots older than a specific date
   */
  clearOldSnapshots(olderThan: Date): void {
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.timestamp < olderThan) {
        this.snapshots.delete(id);
      }
    }
  }

  /**
   * Get snapshot for aggregate
   */
  getSnapshot(id: AggregateId): ISnapshot<UserState, AggregateId> | null {
    return this.snapshots.get(id as string) || null;
  }

}

/**
 * Factory for creating user repository
 */
export function createUserRepository(
  eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>,
  eventBus?: IEventBus<UserEvent>
): UserRepository {
  return new UserRepository(eventStore, true, eventBus);
}