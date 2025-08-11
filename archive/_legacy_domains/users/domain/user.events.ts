/**
 * User Domain: Domain Events
 * 
 * Pure domain events representing things that have happened in the user domain.
 * These events capture the business-meaningful changes to user state.
 */

import type { IEvent } from '@cqrs/framework/core/event';
import type { AggregateId } from '@cqrs/framework/core/branded/types';
import type { Email, PersonName } from './user.types';

/**
 * User event types - string literals for better type safety
 */
export const UserEventTypes = {
  UserCreated: 'USER_CREATED',
  UserUpdated: 'USER_UPDATED', 
  UserDeleted: 'USER_DELETED',
  UserEmailVerified: 'USER_EMAIL_VERIFIED',
  UserPasswordChanged: 'USER_PASSWORD_CHANGED',
  UserProfileUpdated: 'USER_PROFILE_UPDATED',
} as const;


export type UserEventTypeKey = keyof typeof UserEventTypes;
export type UserEventType = typeof UserEventTypes[UserEventTypeKey];

/**
 * User created event - someone became a user
 */
export interface UserCreatedEvent extends IEvent<
  typeof UserEventTypes.UserCreated,
  {
    readonly name: PersonName;
    readonly email: Email;
    readonly createdAt: string;
  },
  AggregateId
> {}

/**
 * User updated event - basic user information changed
 */
export interface UserUpdatedEvent extends IEvent<
  typeof UserEventTypes.UserUpdated,
  {
    readonly name?: PersonName;
    readonly email?: Email;
    readonly updatedAt: string;
  },
  AggregateId
> {}

/**
 * User deleted event - user was removed from the system
 */
export interface UserDeletedEvent extends IEvent<
  typeof UserEventTypes.UserDeleted,
  {
    readonly deletedAt: string;
    readonly reason?: string;
  },
  AggregateId
> {}

/**
 * User email verified event - user confirmed their email address
 */
export interface UserEmailVerifiedEvent extends IEvent<
  typeof UserEventTypes.UserEmailVerified,
  {
    readonly verifiedAt: string;
  },
  AggregateId
> {}

/**
 * User password changed event - user's password was updated
 */
export interface UserPasswordChangedEvent extends IEvent<
  typeof UserEventTypes.UserPasswordChanged,
  {
    readonly changedAt: string;
  },
  AggregateId
> {}

/**
 * User profile updated event - user's profile information changed
 */
export interface UserProfileUpdatedEvent extends IEvent<
  typeof UserEventTypes.UserProfileUpdated,
  {
    readonly bio?: string;
    readonly avatar?: string;
    readonly location?: string;
    readonly updatedAt: string;
  },
  AggregateId
> {}

/**
 * Union type of all user events
 */
export type UserEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserEmailVerifiedEvent
  | UserPasswordChangedEvent
  | UserProfileUpdatedEvent;

/**
 * User event data union type for type guards
 */
export type UserEventData =
  | UserCreatedEvent['data']
  | UserUpdatedEvent['data']
  | UserDeletedEvent['data']
  | UserEmailVerifiedEvent['data']
  | UserPasswordChangedEvent['data']
  | UserProfileUpdatedEvent['data']; 