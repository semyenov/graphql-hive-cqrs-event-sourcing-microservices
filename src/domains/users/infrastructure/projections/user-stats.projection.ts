/**
 * Infrastructure Layer: User Statistics Projection
 * 
 * Aggregated statistics projection for analytics and dashboard metrics.
 * Provides real-time insights into user activity and growth.
 */

import { createProjectionBuilder } from '@cqrs/framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';
import { UserEventTypes } from '../../domain/user.events';
import { matchEvent } from '@cqrs/framework/core/event';

/**
 * User statistics data for analytics
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  verifiedEmails: number;
  createdToday: number;
  lastActivity: string;
}

/**
 * Build user statistics projection from events
 */
function buildUserStatsProjection(
  aggregateId: string,
  events: UserEvent[]
): UserStats | null {
  if (aggregateId !== 'stats') {
    // Only build stats for the special 'stats' aggregate
    return null;
  }

  if (events.length === 0) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      deletedUsers: 0,
      verifiedEmails: 0,
      createdToday: 0,
      lastActivity: new Date().toISOString(),
    };
  }

  // Track user states to compute accurate stats
  const userStates = new Map<string, {
    created: boolean;
    deleted: boolean;
    emailVerified: boolean;
    createdAt: string;
  }>();

  let lastActivity = new Date(0).toISOString();
  const today = new Date().toISOString().split('T')[0];

  // Process all events to build user states
  for (const event of events) {
    const userId = event.aggregateId as string;
    const eventTime = String(event.timestamp);
    lastActivity = eventTime > lastActivity ? eventTime : lastActivity;

    matchEvent<UserEvent, unknown>(event, {
      [UserEventTypes.UserCreated]: (e) => {
        userStates.set(userId, {
          created: true,
          deleted: false,
          emailVerified: false,
          createdAt: e.data.createdAt || new Date().toISOString(),
        });
      },

      [UserEventTypes.UserUpdated]: (e) => {
        const user = userStates.get(userId);
        if (user && e.data.email) {
          // Reset email verification when email changes
          user.emailVerified = false;
        }
      },

      [UserEventTypes.UserDeleted]: () => {
        const user = userStates.get(userId);
        if (user) {
          user.deleted = true;
        }
      },

      [UserEventTypes.UserEmailVerified]: () => {
        const user = userStates.get(userId);
        if (user) {
          user.emailVerified = true;
        }
      },

      [UserEventTypes.UserPasswordChanged]: () => {
        // No changes needed for stats
      },

      [UserEventTypes.UserProfileUpdated]: () => {
        // No changes needed for stats
      },
    });
  }

  // Calculate statistics from user states
  const users = Array.from(userStates.values());
  const activeUsers = users.filter(u => u.created && !u.deleted);
  const deletedUsers = users.filter(u => u.created && u.deleted);
  const verifiedEmails = users.filter(u => u.created && u.emailVerified);
  const createdToday = users.filter(u => 
    u.created && u.createdAt && u.createdAt.startsWith(today!)
  );

  const stats: UserStats = {
    totalUsers: users.filter(u => u.created).length,
    activeUsers: activeUsers.length,
    deletedUsers: deletedUsers.length,
    verifiedEmails: verifiedEmails.length,
    createdToday: createdToday.length,
    lastActivity,
  };

  return stats;
}

/**
 * Create user statistics projection builder
 */
export function createUserStatsProjection() {
  return createProjectionBuilder<UserEvent, UserStats>(
    'UserStatsProjection',
    buildUserStatsProjection
  );
} 