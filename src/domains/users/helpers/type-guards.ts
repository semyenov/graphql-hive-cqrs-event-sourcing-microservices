/**
 * User Domain: Type Guards and Helpers
 * 
 * Type-safe utilities for event handling and type narrowing.
 */

import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';

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