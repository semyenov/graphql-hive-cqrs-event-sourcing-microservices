/**
 * Shared: Type Guards and Helpers
 * 
 * Type-safe utilities for event handling and type narrowing.
 * These are used across the user domain for safe type operations.
 */

import type { UserEvent } from '../domain/user.events';
import { UserEventTypes } from '../domain/user.events';

/**
 * Type guard for UserCreated event
 */
export function isUserCreatedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }> {
  return event.type === UserEventTypes.UserCreated;
}

/**
 * Type guard for UserUpdated event
 */
export function isUserUpdatedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserUpdated }> {
  return event.type === UserEventTypes.UserUpdated;
}

/**
 * Type guard for UserDeleted event
 */
export function isUserDeletedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserDeleted }> {
  return event.type === UserEventTypes.UserDeleted;
}

/**
 * Type guard for UserEmailVerified event
 */
export function isUserEmailVerifiedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }> {
  return event.type === UserEventTypes.UserEmailVerified;
}

/**
 * Type guard for UserPasswordChanged event
 */
export function isUserPasswordChangedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }> {
  return event.type === UserEventTypes.UserPasswordChanged;
}

/**
 * Type guard for UserProfileUpdated event
 */
export function isUserProfileUpdatedEvent(
  event: UserEvent
): event is Extract<UserEvent, { type: typeof UserEventTypes.UserProfileUpdated }> {
  return event.type === UserEventTypes.UserProfileUpdated;
}

/**
 * Pattern-based event matching with type safety
 */
export function matchUserEvent<T>(
  event: UserEvent,
  patterns: {
    [UserEventTypes.UserCreated]: (event: UserEvent) => T;
    [UserEventTypes.UserUpdated]: (event: UserEvent) => T;
    [UserEventTypes.UserDeleted]: (event: UserEvent) => T;
    [UserEventTypes.UserEmailVerified]: (event: UserEvent) => T;
    [UserEventTypes.UserPasswordChanged]: (event: UserEvent) => T;
    [UserEventTypes.UserProfileUpdated]: (event: UserEvent) => T;
  }
): T {
  const handler = patterns[event.type as keyof typeof patterns];
  if (!handler) {
    throw new Error(`No handler for event type: ${event.type}`);
  }
  return handler(event);
} 