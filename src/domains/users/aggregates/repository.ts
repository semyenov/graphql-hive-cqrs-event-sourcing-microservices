/**
 * User Domain: User Repository
 * 
 * Repository implementation for User aggregates.
 */

import { AggregateRepository } from '../../../framework/infrastructure/repository/aggregate';
import type { IEventStore, IEventBus } from '../../../framework/core/event';
import type { ISnapshotStore } from '../../../framework/core/repository';
import type { AggregateId } from '../../../framework/core/branded/types';
import type { UserEvent } from '../events/types';
import type { UserState } from './user';
import { UserAggregate } from './user';

/**
 * User repository
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
  createAggregate(id: AggregateId): UserAggregate {
    return new UserAggregate(id);
  }

  /**
   * Check if user is deleted
   */
  async isDeleted(userId: AggregateId): Promise<boolean> {
    const aggregate = await this.get(userId);
    return aggregate?.isDeleted() ?? false;
  }

  /**
   * Check if user email is verified
   */
  async isEmailVerified(userId: AggregateId): Promise<boolean> {
    const aggregate = await this.get(userId);
    return aggregate?.isEmailVerified() ?? false;
  }

  /**
   * Find user by email (requires projection integration)
   */
  async findByEmail(email: string): Promise<UserAggregate | null> {
    // This would typically query a projection or read model
    // For now, this is a placeholder that would need integration
    // with the projection layer
    console.warn('findByEmail requires projection integration');
    return null;
  }

  /**
   * Get all active users (requires projection integration)
   */
  async getActiveUsers(): Promise<UserAggregate[]> {
    // This would query a projection for active users
    console.warn('getActiveUsers requires projection integration');
    return [];
  }
}

/**
 * Factory for creating user repository
 */
export function createUserRepository(
  eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>,
  eventBus?: IEventBus<UserEvent>,
  snapshotStore?: ISnapshotStore<UserState, AggregateId>
): UserRepository {
  return new UserRepository(eventStore, eventBus, snapshotStore);
}