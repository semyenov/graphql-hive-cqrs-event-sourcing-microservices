/**
 * User Domain: User Projection
 * 
 * Builds user read models from events using SnapshotProjectionBuilder.
 */

import { SnapshotProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import { matchEvent } from '../../../framework/core/event-utils';
import type { UserState } from '../aggregates/user';
import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';

/**
 * Build user projection from events
 */
function buildUserProjection(
  aggregateId: string,
  events: UserEvent[]
): UserState | null {
  if (events.length === 0) {
    return null;
  }

  let state: UserState | null = null;

  for (const event of events) {
    state = matchEvent(event, {
      [UserEventTypes.UserCreated]: (e) => ({
        id: aggregateId,
        name: e.data.name,
        email: e.data.email,
        emailVerified: false,
        deleted: false,
        createdAt: e.data.createdAt,
        updatedAt: e.data.createdAt,
      }),

      [UserEventTypes.UserUpdated]: (e) => {
        if (!state) return null;
        return {
          ...state,
          ...(e.data.name && { name: e.data.name }),
          ...(e.data.email && { 
            email: e.data.email, 
            emailVerified: false 
          }),
          updatedAt: e.data.updatedAt,
        };
      },

      [UserEventTypes.UserDeleted]: (e) => {
        if (!state) return null;
        return {
          ...state,
          deleted: true,
          updatedAt: e.data.deletedAt,
        };
      },

      [UserEventTypes.UserEmailVerified]: (e) => {
        if (!state) return null;
        return {
          ...state,
          emailVerified: true,
          updatedAt: e.data.verifiedAt,
        };
      },

      [UserEventTypes.UserPasswordChanged]: (e) => {
        if (!state) return null;
        return {
          ...state,
          updatedAt: e.data.changedAt,
        };
      },

      [UserEventTypes.UserProfileUpdated]: (e) => {
        if (!state) return null;
        return {
          ...state,
          profile: {
            ...state.profile,
            ...e.data,
          },
          updatedAt: e.data.updatedAt,
        };
      },
    });
  }

  return state;
}

/**
 * Create user projection builder with snapshot support
 */
export function createUserProjection() {
  return new SnapshotProjectionBuilder<UserEvent, UserState>(
    buildUserProjection,
    'UserProjection'
  );
}

