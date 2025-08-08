/**
 * User Domain: User List Projection
 * 
 * Optimized projection for listing users with minimal data using IndexedProjectionBuilder.
 */

import { IndexedProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import { matchEvent } from '../../../framework/core/event-utils';
import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';

/**
 * User list item with minimal data
 */
export interface UserListItem extends Record<string, unknown> {
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
    item = matchEvent(event, {
      [UserEventTypes.UserCreated]: (e) => ({
        id: aggregateId,
        name: e.data.name as string,
        email: e.data.email as string,
        emailVerified: false,
        deleted: false,
        createdAt: e.data.createdAt,
      }),

      [UserEventTypes.UserUpdated]: (e) => {
        if (!item) return null;
        return {
          ...item,
          ...(e.data.name && { name: e.data.name as string }),
          ...(e.data.email && { 
            email: e.data.email as string,
            emailVerified: false 
          }),
        };
      },

      [UserEventTypes.UserDeleted]: () => {
        if (!item) return null;
        return {
          ...item,
          deleted: true,
        };
      },

      [UserEventTypes.UserEmailVerified]: () => {
        if (!item) return null;
        return {
          ...item,
          emailVerified: true,
        };
      },

      [UserEventTypes.UserPasswordChanged]: () => item,
      
      [UserEventTypes.UserProfileUpdated]: () => item,
    });
  }

  return item;
}

/**
 * Create user list projection builder with indexing support
 */
export function createUserListProjection() {
  const projection = new IndexedProjectionBuilder<UserEvent, UserListItem>(
    buildUserListProjection,
    'UserListProjection'
  );
  
  // Create indexes for fast lookups
  projection.createIndex('email');
  projection.createIndex('emailVerified');
  projection.createIndex('deleted');
  
  return projection;
}

