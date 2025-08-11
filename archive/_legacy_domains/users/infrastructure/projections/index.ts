/**
 * Infrastructure Layer: Projections
 * 
 * Exports all user domain projections for optimized read operations.
 * Each projection serves specific query patterns and use cases.
 */

export { createUserDetailsProjection } from './user-details.projection';
export { createUserListProjection, type UserListItem } from './user-list.projection';
export { createUserStatsProjection, type UserStats } from './user-stats.projection'; 