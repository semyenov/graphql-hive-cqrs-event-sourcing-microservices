/**
 * User Domain: Event Types
 * 
 * Domain-specific events for the User aggregate.
 */

import type { IEvent } from '../../../framework/core/event';
import type { AggregateId, EventVersion, Timestamp, Email, PersonName } from '../../../framework/core/branded/types';

/**
 * User event types enum
 */
export enum UserEventTypes {
  UserCreated = 'USER_CREATED',
  UserUpdated = 'USER_UPDATED',
  UserDeleted = 'USER_DELETED',
  UserEmailVerified = 'USER_EMAIL_VERIFIED',
  UserPasswordChanged = 'USER_PASSWORD_CHANGED',
  UserProfileUpdated = 'USER_PROFILE_UPDATED',
}

/**
 * User created event
 */
export interface UserCreatedEvent extends IEvent<
  UserEventTypes.UserCreated,
  {
    name: PersonName;
    email: Email;
    createdAt: string;
  },
  AggregateId
> {}

/**
 * User updated event
 */
export interface UserUpdatedEvent extends IEvent<
  UserEventTypes.UserUpdated,
  {
    name?: PersonName;
    email?: Email;
    updatedAt: string;
  },
  AggregateId
> {}

/**
 * User deleted event
 */
export interface UserDeletedEvent extends IEvent<
  UserEventTypes.UserDeleted,
  {
    deletedAt: string;
    reason?: string;
  },
  AggregateId
> {}

/**
 * User email verified event
 */
export interface UserEmailVerifiedEvent extends IEvent<
  UserEventTypes.UserEmailVerified,
  {
    verifiedAt: string;
  },
  AggregateId
> {}

/**
 * User password changed event
 */
export interface UserPasswordChangedEvent extends IEvent<
  UserEventTypes.UserPasswordChanged,
  {
    changedAt: string;
  },
  AggregateId
> {}

/**
 * User profile updated event
 */
export interface UserProfileUpdatedEvent extends IEvent<
  UserEventTypes.UserProfileUpdated,
  {
    bio?: string;
    avatar?: string;
    location?: string;
    updatedAt: string;
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
 * Type guard functions
 */
export const isUserCreatedEvent = (event: UserEvent): event is UserCreatedEvent =>
  event.type === UserEventTypes.UserCreated;

export const isUserUpdatedEvent = (event: UserEvent): event is UserUpdatedEvent =>
  event.type === UserEventTypes.UserUpdated;

export const isUserDeletedEvent = (event: UserEvent): event is UserDeletedEvent =>
  event.type === UserEventTypes.UserDeleted;

export const isUserEmailVerifiedEvent = (event: UserEvent): event is UserEmailVerifiedEvent =>
  event.type === UserEventTypes.UserEmailVerified;

export const isUserPasswordChangedEvent = (event: UserEvent): event is UserPasswordChangedEvent =>
  event.type === UserEventTypes.UserPasswordChanged;

export const isUserProfileUpdatedEvent = (event: UserEvent): event is UserProfileUpdatedEvent =>
  event.type === UserEventTypes.UserProfileUpdated;