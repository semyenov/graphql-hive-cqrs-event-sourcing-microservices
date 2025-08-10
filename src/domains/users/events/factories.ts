/**
 * User Domain: Event Factories
 * 
 * Factory functions for creating user domain events.
 */

import type * as Events from './types';
import { UserEventTypes } from './types';
import { defineEventFactory } from '../../../framework/core/event';

/**
 * User event factories
 */
export const UserEventFactories = {
  /**
   * Create user created event
   */
  createUserCreated: defineEventFactory<Events.UserCreatedEvent, typeof UserEventTypes.UserCreated>(UserEventTypes.UserCreated),

  /**
   * Create user updated event
   */
  createUserUpdated: defineEventFactory<Events.UserUpdatedEvent, typeof UserEventTypes.UserUpdated>(UserEventTypes.UserUpdated),

  /**
   * Create user deleted event
   */
  createUserDeleted: defineEventFactory<Events.UserDeletedEvent, typeof UserEventTypes.UserDeleted>(UserEventTypes.UserDeleted),

  /**
   * Create email verified event
   */
  createEmailVerified: defineEventFactory<Events.UserEmailVerifiedEvent, typeof UserEventTypes.UserEmailVerified>(UserEventTypes.UserEmailVerified),

  /**
   * Create password changed event
   */
  createPasswordChanged: defineEventFactory<Events.UserPasswordChangedEvent, typeof UserEventTypes.UserPasswordChanged>(UserEventTypes.UserPasswordChanged),

  /**
   * Create profile updated event
   */
  createProfileUpdated: defineEventFactory<Events.UserProfileUpdatedEvent, typeof UserEventTypes.UserProfileUpdated>(UserEventTypes.UserProfileUpdated),
} as const;