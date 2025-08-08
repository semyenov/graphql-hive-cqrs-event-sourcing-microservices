/**
 * User Domain: Event Factories
 * 
 * Factory functions for creating user domain events.
 */

import type * as Events from './types';
import { UserEventTypes } from './types';
import type { AggregateId, EventVersion } from '../../../framework/core/branded/types';
import { BrandedTypes } from '../../../framework/core/branded/factories';

/**
 * User event factories
 */
export const UserEventFactories = {
  /**
   * Create user created event
   */
  createUserCreated: (
    aggregateId: AggregateId,
    data: {
      name: string;
      email: string;
    }
  ): Events.UserCreatedEvent => ({
    aggregateId,
    type: UserEventTypes.UserCreated,
    version: BrandedTypes.eventVersion(1),
    timestamp: BrandedTypes.timestamp(),
    data: {
      name: BrandedTypes.personName(data.name),
      email: BrandedTypes.email(data.email),
      createdAt: new Date().toISOString(),
    },
  }),

  /**
   * Create user updated event
   */
  createUserUpdated: (
    aggregateId: AggregateId,
    version: number,
    data: {
      name?: string;
      email?: string;
    }
  ): Events.UserUpdatedEvent => ({
    aggregateId,
    type: UserEventTypes.UserUpdated,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {
      ...(data.name && { name: BrandedTypes.personName(data.name) }),
      ...(data.email && { email: BrandedTypes.email(data.email) }),
      updatedAt: new Date().toISOString(),
    },
  }),

  /**
   * Create user deleted event
   */
  createUserDeleted: (
    aggregateId: AggregateId,
    version: number,
    reason?: string
  ): Events.UserDeletedEvent => ({
    aggregateId,
    type: UserEventTypes.UserDeleted,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {
      deletedAt: new Date().toISOString(),
      ...(reason && { reason }),
    },
  }),

  /**
   * Create email verified event
   */
  createEmailVerified: (
    aggregateId: AggregateId,
    version: number
  ): Events.UserEmailVerifiedEvent => ({
    aggregateId,
    type: UserEventTypes.UserEmailVerified,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {
      verifiedAt: new Date().toISOString(),
    },
  }),

  /**
   * Create password changed event
   */
  createPasswordChanged: (
    aggregateId: AggregateId,
    version: number
  ): Events.UserPasswordChangedEvent => ({
    aggregateId,
    type: UserEventTypes.UserPasswordChanged,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {
      changedAt: new Date().toISOString(),
    },
  }),

  /**
   * Create profile updated event
   */
  createProfileUpdated: (
    aggregateId: AggregateId,
    version: number,
    data: {
      bio?: string;
      avatar?: string;
      location?: string;
    }
  ): Events.UserProfileUpdatedEvent => ({
    aggregateId,
    type: UserEventTypes.UserProfileUpdated,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {
      ...data,
      updatedAt: new Date().toISOString(),
    },
  }),
} as const;