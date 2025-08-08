/**
 * User Domain: User Stats Projection
 * 
 * Global statistics projection using EventDrivenProjectionBuilder.
 */

import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';
import { EventDrivenProjectionBuilder } from '../../../framework/infrastructure/projections/builder';

/**
 * User statistics data
 */
export interface UserStats {
  totalCreated: number;
  totalDeleted: number;
  totalVerified: number;
  totalActive: number;
  lastActivity: string;
  dailyStats: Map<string, {
    created: number;
    deleted: number;
    verified: number;
    updated: number;
  }>;
}

/**
 * Initial state for user statistics
 */
function createInitialStats(): UserStats {
  return {
    totalCreated: 0,
    totalDeleted: 0,
    totalVerified: 0,
    totalActive: 0,
    lastActivity: new Date().toISOString(),
    dailyStats: new Map(),
  };
}

/**
 * Reducer for user stats projection
 */
function userStatsReducer(state: UserStats, event: UserEvent): UserStats {
  const dateKey = event.timestamp.toISOString().split('T')[0]!;
  
  // Ensure daily stats entry exists
  if (!state.dailyStats.has(dateKey)) {
    state.dailyStats.set(dateKey, { 
      created: 0, 
      deleted: 0, 
      verified: 0,
      updated: 0 
    });
  }
  
  const dailyStats = state.dailyStats.get(dateKey)!;
  const newState = { ...state };
  
  switch (event.type) {
    case UserEventTypes.UserCreated:
      newState.totalCreated++;
      newState.totalActive++;
      dailyStats.created++;
      newState.lastActivity = event.timestamp.toISOString();
      break;
      
    case UserEventTypes.UserDeleted:
      newState.totalDeleted++;
      newState.totalActive = Math.max(0, newState.totalActive - 1);
      dailyStats.deleted++;
      newState.lastActivity = event.timestamp.toISOString();
      break;
      
    case UserEventTypes.UserEmailVerified:
      newState.totalVerified++;
      dailyStats.verified++;
      newState.lastActivity = event.timestamp.toISOString();
      break;
      
    case UserEventTypes.UserUpdated:
    case UserEventTypes.UserPasswordChanged:
    case UserEventTypes.UserProfileUpdated:
      dailyStats.updated++;
      newState.lastActivity = event.timestamp.toISOString();
      break;
  }
  
  return newState;
}

/**
 * Create user stats projection using EventDrivenProjectionBuilder
 */
export function createUserStatsProjection() {
  const projection = new EventDrivenProjectionBuilder<UserEvent, UserStats>(
    createInitialStats,
    userStatsReducer,
    'UserStatsProjection'
  );
  
  // Register specific event handlers for optimized processing
  projection
    .on(UserEventTypes.UserCreated, (stats, event) => {
      const dateKey = event.timestamp.toISOString().split('T')[0]!;
      if (!stats.dailyStats.has(dateKey)) {
        stats.dailyStats.set(dateKey, { created: 0, deleted: 0, verified: 0, updated: 0 });
      }
      const daily = stats.dailyStats.get(dateKey)!;
      
      return {
        ...stats,
        totalCreated: stats.totalCreated + 1,
        totalActive: stats.totalActive + 1,
        lastActivity: event.timestamp.toISOString(),
        dailyStats: new Map(stats.dailyStats).set(dateKey, {
          ...daily,
          created: daily.created + 1,
        }),
      };
    })
    .on(UserEventTypes.UserDeleted, (stats, event) => {
      const dateKey = event.timestamp.toISOString().split('T')[0]!;
      if (!stats.dailyStats.has(dateKey)) {
        stats.dailyStats.set(dateKey, { created: 0, deleted: 0, verified: 0, updated: 0 });
      }
      const daily = stats.dailyStats.get(dateKey)!;
      
      return {
        ...stats,
        totalDeleted: stats.totalDeleted + 1,
        totalActive: Math.max(0, stats.totalActive - 1),
        lastActivity: event.timestamp.toISOString(),
        dailyStats: new Map(stats.dailyStats).set(dateKey, {
          ...daily,
          deleted: daily.deleted + 1,
        }),
      };
    })
    .on(UserEventTypes.UserEmailVerified, (stats, event) => {
      const dateKey = event.timestamp.toISOString().split('T')[0]!;
      if (!stats.dailyStats.has(dateKey)) {
        stats.dailyStats.set(dateKey, { created: 0, deleted: 0, verified: 0, updated: 0 });
      }
      const daily = stats.dailyStats.get(dateKey)!;
      
      return {
        ...stats,
        totalVerified: stats.totalVerified + 1,
        lastActivity: event.timestamp.toISOString(),
        dailyStats: new Map(stats.dailyStats).set(dateKey, {
          ...daily,
          verified: daily.verified + 1,
        }),
      };
    });
  
  return projection;
}

