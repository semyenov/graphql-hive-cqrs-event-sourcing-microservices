/**
 * User Domain: Event Factories
 * 
 * Factory functions for creating user domain events.
 */

import type * as Events from './types';
import { UserEventTypes } from './types';
import type { AggregateId, EventVersion } from '../../../framework/core/branded/types';
import { BrandedTypes } from '../../../framework/core/branded';
import { UserBrandedTypes } from '../helpers/factories';
import { defineEventFactory } from '../../../framework/core/event';

/**
 * User event factories
 */
const rawUserCreated = defineEventFactory<Events.UserCreatedEvent, typeof UserEventTypes.UserCreated>(UserEventTypes.UserCreated);
const rawUserUpdated = defineEventFactory<Events.UserUpdatedEvent, typeof UserEventTypes.UserUpdated>(UserEventTypes.UserUpdated);
const rawUserDeleted = defineEventFactory<Events.UserDeletedEvent, typeof UserEventTypes.UserDeleted>(UserEventTypes.UserDeleted);
const rawEmailVerified = defineEventFactory<Events.UserEmailVerifiedEvent, typeof UserEventTypes.UserEmailVerified>(UserEventTypes.UserEmailVerified);
const rawPasswordChanged = defineEventFactory<Events.UserPasswordChangedEvent, typeof UserEventTypes.UserPasswordChanged>(UserEventTypes.UserPasswordChanged);
const rawProfileUpdated = defineEventFactory<Events.UserProfileUpdatedEvent, typeof UserEventTypes.UserProfileUpdated>(UserEventTypes.UserProfileUpdated);

export const UserEventFactories = {
  /**
   * Create user created event
   * Overloads: (id, data) => version 1; (id, version, data)
   */
  createUserCreated(
    aggregateId: AggregateId,
    versionOrData: EventVersion | { name: string; email: string },
    maybeData?: { name: string; email: string }
  ): Events.UserCreatedEvent {
    const version = (typeof versionOrData === 'number' ? versionOrData : BrandedTypes.eventVersion(1)) as EventVersion;
    const data = (typeof versionOrData === 'number' ? maybeData! : versionOrData);
    return rawUserCreated(aggregateId, version, {
      name: UserBrandedTypes.personName(data.name),
      email: UserBrandedTypes.email(data.email),
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Create user updated event
   */
  createUserUpdated(
    aggregateId: AggregateId,
    version: AggregateVersion,
    data: { name?: string; email?: string; updatedAt?: string }
  ): Events.UserUpdatedEvent {
    return rawUserUpdated(aggregateId, version, {
      ...(data.name ? { name: UserBrandedTypes.personName(data.name) } : {}),
      ...(data.email ? { email: UserBrandedTypes.email(data.email) } : {}),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    });
  },

  /**
   * Create user deleted event
   */
  createUserDeleted(
    aggregateId: AggregateId,
    version: AggregateVersion,
    data?: { reason?: string; deletedAt?: string }
  ): Events.UserDeletedEvent {
    return rawUserDeleted(aggregateId, version, {
      deletedAt: data?.deletedAt ?? new Date().toISOString(),
      ...(data?.reason ? { reason: data.reason } : {}),
    });
  },

  /**
   * Create email verified event
   * Overloads: (id, version) will auto-fill verifiedAt now
   */
  createEmailVerified(
    aggregateId: AggregateId,
    version: AggregateVersion,
    data?: { verifiedAt?: string }
  ): Events.UserEmailVerifiedEvent {
    return rawEmailVerified(aggregateId, version, {
      verifiedAt: data?.verifiedAt ?? new Date().toISOString(),
    });
  },

  /**
   * Create password changed event
   */
  createPasswordChanged(
    aggregateId: AggregateId,
    version: AggregateVersion,
    data?: { changedAt?: string; newPassword?: string }
  ): Events.UserPasswordChangedEvent {
    return rawPasswordChanged(aggregateId, version, {
      changedAt: data?.changedAt ?? new Date().toISOString(),
      ...(data?.newPassword ? { newPassword: data.newPassword } : {}),
    });
  },

  /**
   * Create profile updated event
   */
  createProfileUpdated(
    aggregateId: AggregateId,
    version: AggregateVersion,
    data: { bio?: string; avatar?: string; location?: string; updatedAt?: string }
  ): Events.UserProfileUpdatedEvent {
    return rawProfileUpdated(aggregateId, version, {
      ...data,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    });
  },
} as const;