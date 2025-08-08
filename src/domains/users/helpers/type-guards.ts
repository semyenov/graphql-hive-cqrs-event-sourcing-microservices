/**
 * User Domain: Type Guards and Helpers
 * 
 * Type-safe utilities for event handling and type narrowing.
 */

import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';

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
 * Type-safe event matcher that properly narrows types
 */
export function matchUserEvent<TResult>(
  event: UserEvent,
  patterns: {
    [UserEventTypes.UserCreated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }>) => TResult;
    [UserEventTypes.UserUpdated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserUpdated }>) => TResult;
    [UserEventTypes.UserDeleted]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserDeleted }>) => TResult;
    [UserEventTypes.UserEmailVerified]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }>) => TResult;
    [UserEventTypes.UserPasswordChanged]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }>) => TResult;
    [UserEventTypes.UserProfileUpdated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserProfileUpdated }>) => TResult;
  }
): TResult {
  switch (event.type) {
    case UserEventTypes.UserCreated:
      return patterns[UserEventTypes.UserCreated](event);
    case UserEventTypes.UserUpdated:
      return patterns[UserEventTypes.UserUpdated](event);
    case UserEventTypes.UserDeleted:
      return patterns[UserEventTypes.UserDeleted](event);
    case UserEventTypes.UserEmailVerified:
      return patterns[UserEventTypes.UserEmailVerified](event);
    case UserEventTypes.UserPasswordChanged:
      return patterns[UserEventTypes.UserPasswordChanged](event);
    case UserEventTypes.UserProfileUpdated:
      return patterns[UserEventTypes.UserProfileUpdated](event);
    default:
      // This should never happen if UserEvent is exhaustive
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled event type: ${(exhaustiveCheck as UserEvent).type}`);
  }
}

/**
 * Partial event matcher with optional handlers
 */
export function matchUserEventPartial<TResult>(
  event: UserEvent,
  patterns: Partial<{
    [UserEventTypes.UserCreated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }>) => TResult;
    [UserEventTypes.UserUpdated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserUpdated }>) => TResult;
    [UserEventTypes.UserDeleted]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserDeleted }>) => TResult;
    [UserEventTypes.UserEmailVerified]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }>) => TResult;
    [UserEventTypes.UserPasswordChanged]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }>) => TResult;
    [UserEventTypes.UserProfileUpdated]: (e: Extract<UserEvent, { type: typeof UserEventTypes.UserProfileUpdated }>) => TResult;
  }>,
  defaultHandler: (e: UserEvent) => TResult
): TResult {
  switch (event.type) {
    case UserEventTypes.UserCreated:
      return patterns[UserEventTypes.UserCreated]?.(event) ?? defaultHandler(event);
    case UserEventTypes.UserUpdated:
      return patterns[UserEventTypes.UserUpdated]?.(event) ?? defaultHandler(event);
    case UserEventTypes.UserDeleted:
      return patterns[UserEventTypes.UserDeleted]?.(event) ?? defaultHandler(event);
    case UserEventTypes.UserEmailVerified:
      return patterns[UserEventTypes.UserEmailVerified]?.(event) ?? defaultHandler(event);
    case UserEventTypes.UserPasswordChanged:
      return patterns[UserEventTypes.UserPasswordChanged]?.(event) ?? defaultHandler(event);
    case UserEventTypes.UserProfileUpdated:
      return patterns[UserEventTypes.UserProfileUpdated]?.(event) ?? defaultHandler(event);
    default:
      const exhaustiveCheck: never = event;
      return defaultHandler(exhaustiveCheck as UserEvent);
  }
}