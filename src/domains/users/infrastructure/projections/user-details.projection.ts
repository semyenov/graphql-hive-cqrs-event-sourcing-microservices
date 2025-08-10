/**
 * Infrastructure Layer: User Details Projection
 * 
 * Builds a detailed view of individual user data optimized for queries.
 * This projection is used for single user lookups and detailed views.
 */

import { createProjectionBuilder } from '../../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';
import type { UserState } from '../../domain/user.types';
import { UserEventTypes } from '../../domain/user.events';
import { matchEvent } from '../../../../framework/core/event';

/**
 * Build user details projection from events
 */
function buildUserDetailsProjection(aggregateId: string, events: UserEvent[]): UserState | null {
  if (events.length === 0) return null;

  let state: UserState | null = null;

  for (const event of events) {
    matchEvent<UserEvent, unknown>(event, {
      [UserEventTypes.UserCreated]: (e) => {
        state = {
          id: aggregateId,
          name: e.data.name,
          email: e.data.email,
          emailVerified: false,
          deleted: false,
          createdAt: e.data.createdAt,
          updatedAt: e.data.createdAt,
        };
      },

      [UserEventTypes.UserUpdated]: (e) => {
        if (!state) return;
        state = {
          ...state,
          ...(e.data.name && { name: e.data.name }),
          ...(e.data.email && { 
            email: e.data.email, 
            emailVerified: false // Reset verification when email changes
          }),
          updatedAt: e.data.updatedAt,
        };
      },

      [UserEventTypes.UserDeleted]: (e) => {
        if (!state) return;
        state = {
          ...state,
          deleted: true,
          updatedAt: e.data.deletedAt,
        };
      },

      [UserEventTypes.UserEmailVerified]: (e) => {
        if (!state) return;
        state = {
          ...state,
          emailVerified: true,
          updatedAt: e.data.verifiedAt,
        };
      },

      [UserEventTypes.UserPasswordChanged]: (e) => {
        if (!state) return;
        state = {
          ...state,
          updatedAt: e.data.changedAt,
        };
      },

      [UserEventTypes.UserProfileUpdated]: (e) => {
        if (!state) return;
        state = {
          ...state,
          profile: {
            ...state.profile,
            bio: e.data.bio,
            avatar: e.data.avatar,
            location: e.data.location,
          },
          updatedAt: e.data.updatedAt,
        };
      },
    });
  }

  return state;
}

/**
 * Create user details projection builder
 */
export function createUserDetailsProjection() {
  return createProjectionBuilder<UserEvent, UserState>(
    'UserDetailsProjection',
    buildUserDetailsProjection
  );
} 