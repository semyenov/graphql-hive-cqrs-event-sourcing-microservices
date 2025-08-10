/**
 * User Domain: User Statistics Projection
 * 
 * Aggregated statistics projection for analytics.
 */

import { createProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';
import { matchUserEvent } from '../helpers/type-guards';

/**
 * User statistics data
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
 * Create user statistics projection builder
 */
export function createUserStatsProjection() {
  return createProjectionBuilder<UserEvent, UserStats>(
    'UserStatsProjection',
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

      let stats: UserStats = {
        totalUsers: 0,
        activeUsers: 0,
        deletedUsers: 0,
        verifiedEmails: 0,
        createdToday: 0,
        lastActivity: new Date().toISOString(),
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      // Track user states to calculate accurate stats
      const userStates = new Map<string, {
        created: boolean;
        deleted: boolean;
        emailVerified: boolean;
        createdAt: string;
      }>();

      for (const event of events) {
        const userId = event.aggregateId;
        
        if (!userStates.has(userId)) {
          userStates.set(userId, {
            created: false,
            deleted: false,
            emailVerified: false,
            createdAt: '',
          });
        }

        const userState = userStates.get(userId)!;
        stats.lastActivity = event.timestamp.toString();

        matchUserEvent<void>(event, {
          [UserEventTypes.UserCreated]: (e) => {
            userState.created = true;
            userState.createdAt = e.data.createdAt;
            
            // Check if created today
            const createdDate = new Date(e.data.createdAt);
            createdDate.setHours(0, 0, 0, 0);
            if (createdDate.getTime() === todayTime) {
              stats.createdToday++;
            }
          },
          [UserEventTypes.UserDeleted]: () => {
            userState.deleted = true;
          },
          [UserEventTypes.UserEmailVerified]: () => {
            userState.emailVerified = true;
          },
          [UserEventTypes.UserUpdated]: () => {
            // No state change for stats
          },
          [UserEventTypes.UserPasswordChanged]: () => {
            // No state change for stats
          },
          [UserEventTypes.UserProfileUpdated]: () => {
            // No state change for stats
          },
        });
      }

      // Calculate final stats from user states
      for (const userState of userStates.values()) {
        if (userState.created) {
          stats.totalUsers++;
          
          if (!userState.deleted) {
            stats.activeUsers++;
          } else {
            stats.deletedUsers++;
          }
          
          if (userState.emailVerified) {
            stats.verifiedEmails++;
          }
        }
      }

      return stats;
    },
  );
}