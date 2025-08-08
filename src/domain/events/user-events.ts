/**
 * User domain events
 */

import type { IEvent } from '../../core/types';
import type { AggregateId, Timestamp } from '../../core/branded';
import { EventTypes } from './types';

// ============================================================================
// User Event Data Types
// ============================================================================

/**
 * Data for user creation
 */
export interface IUserCreatedData {
  name: string;
  email: string;
}

/**
 * Data for user update
 */
export interface IUserUpdatedData {
  name?: string;
  email?: string;
}

/**
 * Data for user deletion (empty for now, can be extended)
 */
export interface IUserDeletedData {
  reason?: string;
  deletedBy?: string;
}

// ============================================================================
// User Event Types
// ============================================================================

/**
 * User created event
 */
export type UserCreatedEvent = IEvent<
  typeof EventTypes.UserCreated,
  IUserCreatedData,
  AggregateId
>;

/**
 * User updated event
 */
export type UserUpdatedEvent = IEvent<
  typeof EventTypes.UserUpdated,
  IUserUpdatedData,
  AggregateId
>;

/**
 * User deleted event
 */
export type UserDeletedEvent = IEvent<
  typeof EventTypes.UserDeleted,
  IUserDeletedData,
  AggregateId
>;

/**
 * Union of all user events
 */
export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

// ============================================================================
// User State Type
// ============================================================================

/**
 * User aggregate state
 */
export interface IUserState {
  id: AggregateId;
  name: string;
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deleted: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for UserCreatedEvent
 */
export const isUserCreatedEvent = (event: IEvent): event is UserCreatedEvent => {
  return event.type === EventTypes.UserCreated;
};

/**
 * Type guard for UserUpdatedEvent
 */
export const isUserUpdatedEvent = (event: IEvent): event is UserUpdatedEvent => {
  return event.type === EventTypes.UserUpdated;
};

/**
 * Type guard for UserDeletedEvent
 */
export const isUserDeletedEvent = (event: IEvent): event is UserDeletedEvent => {
  return event.type === EventTypes.UserDeleted;
};

/**
 * Type guard for any user event
 */
export const isUserEvent = (event: IEvent): event is UserEvent => {
  return (
    isUserCreatedEvent(event) ||
    isUserUpdatedEvent(event) ||
    isUserDeletedEvent(event)
  );
};