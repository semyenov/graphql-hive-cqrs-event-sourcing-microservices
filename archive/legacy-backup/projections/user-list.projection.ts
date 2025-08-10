/**
 * User Domain: User List Projection
 * 
 * Optimized projection for listing users with minimal data.
 */

import { createProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';
import { matchUserEvent } from '../helpers/type-guards';

/**
 * User list item with minimal data
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
 * Create user list projection builder
 */
export function createUserListProjection() {
  return createProjectionBuilder<UserEvent, UserListItem>(
    'UserListProjection',
    function buildUserListProjection(
      aggregateId: string,
      events: UserEvent[]
    ): UserListItem | null {
      if (events.length === 0) {
        return null;
      }
    
      let item: UserListItem | null = null;
    
      for (const event of events) {
        item = matchUserEvent<UserListItem | null>(event, {
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
    },
  );
}