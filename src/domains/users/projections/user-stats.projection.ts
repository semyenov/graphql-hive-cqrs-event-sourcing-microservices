/**
 * User Domain: User Statistics Projection
 * 
 * Aggregated statistics projection for analytics.
 */

import { createProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../events/types';
import { UserEventTypes } from '../events/types';

/**
 * User statistics data
 */
export interface UserStats {
  aggregateId: string; // Using 'stats' as the single key
  totalCreated: number;
  totalDeleted: number;
  totalVerified: number;
  lastActivity: string;
  dailyStats: Map<string, {
    created: number;
    deleted: number;
    verified: number;
  }>;
}

/**
 * Build user statistics from all events
 */
function buildUserStatsProjection(
  aggregateId: string, // Will be 'stats' for the single stats object
  events: UserEvent[]
): UserStats | null {
  if (aggregateId !== 'stats') {
    // Only build stats for the special 'stats' aggregate
    return null;
  }

  const stats: UserStats = {
    aggregateId: 'stats',
    totalCreated: 0,
    totalDeleted: 0,
    totalVerified: 0,
    lastActivity: new Date().toISOString(),
    dailyStats: new Map(),
  };

  for (const event of events) {
    const date = new Date(event.timestamp.toString()).toISOString().split('T')[0];
    if (!date) {
      continue;
    }
    
    if (!stats.dailyStats.has(date)) {
      stats.dailyStats.set(date, {
        created: 0,
        deleted: 0,
        verified: 0,
      });
    }
    
    const dailyStat = stats.dailyStats.get(date)!;

    switch (event.type) {
      case UserEventTypes.UserCreated:
        stats.totalCreated++;
        dailyStat.created++;
        stats.lastActivity = event.timestamp.toString();
        break;
        
      case UserEventTypes.UserDeleted:
        stats.totalDeleted++;
        dailyStat.deleted++;
        stats.lastActivity = event.timestamp.toString();
        break;
        
      case UserEventTypes.UserEmailVerified:
        stats.totalVerified++;
        dailyStat.verified++;
        stats.lastActivity = event.timestamp.toString();
        break;
        
      default:
        // Update last activity for any event
        stats.lastActivity = event.timestamp.toString();
    }
  }

  return stats;
}

/**
 * Create user statistics projection builder
 * 
 * Note: This is a special projection that aggregates ALL user events
 * into a single statistics object. It should be rebuilt from all events.
 */
export function createUserStatsProjection() {
  return createProjectionBuilder<UserEvent, UserStats>(
    buildUserStatsProjection,
    'UserStatsProjection'
  );
}

/**
 * Helper to rebuild stats from all user events
 */
export async function rebuildUserStats(
  projection: ReturnType<typeof createUserStatsProjection>,
  allUserEvents: UserEvent[]
): Promise<UserStats | null> {
  // Group all events under a single 'stats' key
  await projection.rebuild([
    ...allUserEvents.map(event => ({
      ...event,
      aggregateId: 'stats' as any, // Override aggregateId for stats aggregation
    }))
  ]);
  
  return projection.get('stats');
}