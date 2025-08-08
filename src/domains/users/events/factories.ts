/**
 * User Domain: Event Factories
 * 
 * Factory functions for creating user domain events using framework helpers.
 */

import type * as Events from './types';
import { UserEventTypes } from './types';
import type { AggregateId } from '../../../framework/core/branded/types';
import type { IEventMetadata } from '../../../framework/core/event';
import { BrandedTypes } from '../../../framework/core/branded/factories';
import { createEvent, createEventMetadata } from '../../../framework/core/helpers';

/**
 * User event factories using framework helpers
 */
export const UserEventFactories = {
  /**
   * Create user created event with metadata
   */
  createUserCreated: (
    aggregateId: AggregateId,
    data: {
      name: string;
      email: string;
    },
    metadata?: Partial<IEventMetadata>
  ): Events.UserCreatedEvent => createEvent<Events.UserCreatedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserCreated,
      version: BrandedTypes.eventVersion(1),
      timestamp: BrandedTypes.timestamp(),
      data: {
        name: BrandedTypes.personName(data.name),
        email: BrandedTypes.email(data.email),
        createdAt: new Date().toISOString(),
      },
    },
    metadata
  ),

  /**
   * Create user updated event with metadata
   */
  createUserUpdated: (
    aggregateId: AggregateId,
    version: number,
    data: {
      name?: string;
      email?: string;
    },
    metadata?: Partial<IEventMetadata>
  ): Events.UserUpdatedEvent => createEvent<Events.UserUpdatedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserUpdated,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(),
      data: {
        ...(data.name && { name: BrandedTypes.personName(data.name) }),
        ...(data.email && { email: BrandedTypes.email(data.email) }),
        updatedAt: new Date().toISOString(),
      },
    },
    metadata
  ),

  /**
   * Create user deleted event with metadata
   */
  createUserDeleted: (
    aggregateId: AggregateId,
    version: number,
    reason?: string,
    metadata?: Partial<IEventMetadata>
  ): Events.UserDeletedEvent => createEvent<Events.UserDeletedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserDeleted,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(),
      data: {
        deletedAt: new Date().toISOString(),
        ...(reason && { reason }),
      },
    },
    metadata
  ),

  /**
   * Create email verified event with metadata
   */
  createEmailVerified: (
    aggregateId: AggregateId,
    version: number,
    metadata?: Partial<IEventMetadata>
  ): Events.UserEmailVerifiedEvent => createEvent<Events.UserEmailVerifiedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserEmailVerified,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(),
      data: {
        verifiedAt: new Date().toISOString(),
      },
    },
    metadata
  ),

  /**
   * Create password changed event with metadata
   */
  createPasswordChanged: (
    aggregateId: AggregateId,
    version: number,
    metadata?: Partial<IEventMetadata>
  ): Events.UserPasswordChangedEvent => createEvent<Events.UserPasswordChangedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserPasswordChanged,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(),
      data: {
        changedAt: new Date().toISOString(),
      },
    },
    metadata
  ),

  /**
   * Create profile updated event with metadata
   */
  createProfileUpdated: (
    aggregateId: AggregateId,
    version: number,
    data: {
      bio?: string;
      avatar?: string;
      location?: string;
    },
    metadata?: Partial<IEventMetadata>
  ): Events.UserProfileUpdatedEvent => createEvent<Events.UserProfileUpdatedEvent>(
    {
      aggregateId,
      type: UserEventTypes.UserProfileUpdated,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(),
      data: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    },
    metadata
  ),

  /**
   * Helper to create event metadata with user context
   */
  createMetadata: (userId?: string, correlationId?: string): IEventMetadata => {
    return createEventMetadata({
      userId: userId ? BrandedTypes.userId(userId) : undefined,
      correlationId: correlationId ? BrandedTypes.correlationId(correlationId) : undefined,
      source: 'user-domain',
      schemaVersion: 1,
    });
  },
} as const;