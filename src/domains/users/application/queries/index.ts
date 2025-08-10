/**
 * Application Layer: Query Handlers
 * 
 * Exports all query handlers for the user domain.
 * Each handler represents a specific data retrieval use case.
 */

export { getUserHandler, getUserByEmailHandler } from './get-user.handler';
export { listUsersHandler, type ListUsersResult } from './list-users.handler';
export { getUserStatsHandler, type UserStatsResult } from './get-stats.handler'; 