/**
 * User Domain: User Repository
 * 
 * Repository implementation for User aggregates.
 */

import { AggregateRepository } from '../../../framework/infrastructure/repository/aggregate';
import type { IEventStore } from '../../../framework/core/event';
import type { AggregateId } from '../../../shared/branded/types';
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
    cacheEnabled = true
  ) {
    super(eventStore, cacheEnabled);
  }

  /**
   * Create new user aggregate instance
   */
  createAggregate(id: AggregateId): UserAggregate {
    return new UserAggregate(id);
  }

  /**
   * Find user by email (read from projections in production)
   */
  async findByEmail(email: string): Promise<UserAggregate | null> {
    // In production, this would query a projection/read model
    // For now, this is a placeholder
    throw new Error('findByEmail requires projection implementation');
  }

  /**
   * Get all active users (read from projections in production)
   */
  async getActiveUsers(): Promise<UserAggregate[]> {
    // In production, this would query a projection/read model
    // For now, this is a placeholder
    throw new Error('getActiveUsers requires projection implementation');
  }
}

/**
 * Factory for creating user repository
 */
export function createUserRepository(
  eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>
): UserRepository {
  return new UserRepository(eventStore);
}