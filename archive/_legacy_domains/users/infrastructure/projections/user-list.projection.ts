/**
 * Infrastructure Layer: User List Projection
 * 
 * Optimized projection for listing users with minimal data.
 * Used for efficient user list queries and search operations.
 */

import { createProjectionBuilder } from '@cqrs/framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';
import { UserEventTypes } from '../../domain/user.events';
import { matchEvent } from '@cqrs/framework/core/event';

/**
 * User list item with minimal data for efficient listings
 */
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  deleted: boolean;
  createdAt: string;
}

/**
 * Build user list projection from events
 */
function buildUserListProjection(
  aggregateId: string,
  events: UserEvent[]
): UserListItem | null {
  if (events.length === 0) {
    return null;
  }

  let item: UserListItem | null = null;

  for (const event of events) {
    matchEvent<UserEvent, unknown>(event, {
      [UserEventTypes.UserCreated]: (e) => {
        item = {
          id: aggregateId,
          name: e.data.name,
          email: e.data.email,
          emailVerified: false,
          deleted: false,
          createdAt: e.data.createdAt,
        };
      },

      [UserEventTypes.UserUpdated]: (e) => {
        if (!item) return;
        item = {
          ...item,
          ...(e.data.name && { name: e.data.name }),
          ...(e.data.email && { 
            email: e.data.email, 
            emailVerified: false // Reset verification
          }),
        };
      },

      [UserEventTypes.UserDeleted]: () => {
        if (!item) return;
        item = {
          ...item,
          deleted: true,
        };
      },

      [UserEventTypes.UserEmailVerified]: () => {
        if (!item) return;
        item = {
          ...item,
          emailVerified: true,
        };
      },

      [UserEventTypes.UserPasswordChanged]: () => {
        // No changes needed for list view
      },

      [UserEventTypes.UserProfileUpdated]: () => {
        // No changes needed for list view
      },
    });
  }

  return item;
}

/**
 * Create user list projection builder
 */
export function createUserListProjection() {
  return createProjectionBuilder<UserEvent, UserListItem>(
    'UserListProjection',
    buildUserListProjection
  );
} 