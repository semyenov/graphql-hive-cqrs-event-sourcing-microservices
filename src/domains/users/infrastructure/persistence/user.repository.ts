/**
 * Infrastructure Layer: User Repository
 * 
 * Repository implementation for User aggregates.
 * Handles persistence and retrieval of user aggregates.
 */

import { AggregateRepository } from '@cqrs/framework/infrastructure/repository/aggregate';
import type { IEventStore, IEventBus } from '@cqrs/framework/core/event';
import type { ISnapshotStore } from '@cqrs/framework/core/repository';
import type { AggregateId } from '@cqrs/framework/core/branded/types';
import type { UserEvent } from '../../domain/user.events';
import type { UserState } from '../../domain/user.types';
import { UserAggregate } from '../../domain/user.aggregate';

/**
 * User repository implementation
 */
export class UserRepository extends AggregateRepository<
  UserState,
  UserEvent,
  AggregateId,
  UserAggregate
> {
  constructor(
    eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>,
    eventBus?: IEventBus<UserEvent>,
    snapshotStore?: ISnapshotStore<UserState, AggregateId>,
    cacheEnabled = true
  ) {
    super(eventStore, eventBus, snapshotStore, cacheEnabled);
  }

  /**
   * Create new user aggregate instance
   */
  override createAggregate(id: AggregateId): UserAggregate {
    return new UserAggregate(id);
  }

  /**
   * Get user aggregate or throw if not found
   */
  override async getOrThrow(id: AggregateId, message?: string): Promise<UserAggregate> {
    const aggregate = await this.get(id);
    if (!aggregate) {
      throw new Error(message || `User not found: ${id}`);
    }
    return aggregate;
  }

  /**
   * Find user by email (scans all aggregates - not efficient for large datasets)
   */
  async findByEmail(email: string): Promise<UserAggregate | null> {
    // This is not ideal for production - you'd want a proper index
    // But for demonstration purposes, it shows how to extend repository
    const allEvents = await this.eventStore.getEvents('' as AggregateId);
    
    for (const event of allEvents) {
      if (event.type === 'USER_CREATED' && event.data.email === email) {
        return this.get(event.aggregateId);
      }
    }
    
    return null;
  }
}

/**
 * Factory function to create user repository
 */
export function createUserRepository(
  eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>,
  eventBus?: IEventBus<UserEvent>,
  snapshotStore?: ISnapshotStore<UserState, AggregateId>
): UserRepository {
  return new UserRepository(eventStore, eventBus, snapshotStore);
} 