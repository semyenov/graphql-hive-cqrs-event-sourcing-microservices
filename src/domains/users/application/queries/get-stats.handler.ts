/**
 * Application Layer: Get User Stats Query Handler
 * 
 * Handles queries for retrieving user statistics and analytics.
 * Provides aggregated data about users in the system.
 */

import type { GetUserStatsQuery } from '../../domain/user.queries';
import type { UserState } from '../../domain/user.types';
import type { ProjectionBuilder } from '../../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';

/**
 * User statistics result
 */
export interface UserStatsResult {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  verifiedEmails: number;
  createdToday: number;
  lastActivity: string;
}

/**
 * Get user stats query handler
 * 
 * @param userProjection - User projection for reading user data
 * @param query - Get user stats query
 * @returns User statistics
 */
export async function getUserStatsHandler(
  userProjection: ProjectionBuilder<UserEvent, UserState>,
  query: GetUserStatsQuery
): Promise<UserStatsResult> {
  const users = userProjection.getAll();
  const today = new Date().toISOString().split('T')[0];
  
  const stats: UserStatsResult = {
    totalUsers: users.length,
    activeUsers: users.filter(user => !user.deleted).length,
    deletedUsers: users.filter(user => user.deleted).length,
    verifiedEmails: users.filter(user => user.emailVerified).length,
    createdToday: users.filter(user => user.createdAt && user.createdAt.startsWith(today!)).length,
    lastActivity: getLastActivity(users),
  };
  
  return stats;
}

/**
 * Get the timestamp of the most recent user activity
 */
function getLastActivity(users: UserState[]): string {
  if (users.length === 0) {
    return new Date().toISOString();
  }
  
  const lastUpdated = users
    .map(user => user.updatedAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .reverse()[0];
    
  return lastUpdated || new Date().toISOString();
} 