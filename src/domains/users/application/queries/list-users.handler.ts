/**
 * Application Layer: List Users Query Handler
 * 
 * Handles queries for retrieving paginated lists of users.
 * Supports filtering, sorting, and pagination.
 */

import type { ListUsersQuery, PaginationParams } from '../../domain/user.queries';
import type { UserState } from '../../domain/user.types';
import type { ProjectionBuilder } from '../../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';

/**
 * List users result
 */
export interface ListUsersResult {
  users: UserState[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * List users query handler
 * 
 * @param userProjection - User projection for reading user data
 * @param query - List users query
 * @returns Paginated list of users
 */
export async function listUsersHandler(
  userProjection: ProjectionBuilder<UserEvent, UserState>,
  query: ListUsersQuery
): Promise<ListUsersResult> {
  const { pagination, includeDeleted = false } = query.parameters;
  
  // Get all users
  let users = userProjection.getAll();
  
  // Filter deleted users if needed
  if (!includeDeleted) {
    users = users.filter(user => !user.deleted);
  }
  
  // Apply sorting
  if (pagination.sortBy) {
    users = sortUsers(users, pagination);
  }
  
  // Calculate pagination
  const total = users.length;
  const offset = pagination.offset;
  const limit = pagination.limit;
  
  // Apply pagination
  const paginatedUsers = users.slice(offset, offset + limit);
  
  return {
    users: paginatedUsers,
    total,
    offset,
    limit,
  };
}

/**
 * Sort users by the specified field
 */
function sortUsers(users: UserState[], pagination: PaginationParams): UserState[] {
  const { sortBy, sortOrder = 'asc' } = pagination;
  
  if (!sortBy) return users;
  
  return users.sort((a, b) => {
    const aVal = a[sortBy as keyof UserState];
    const bVal = b[sortBy as keyof UserState];
    
    if (aVal === undefined || bVal === undefined) return 0;
    
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    else if (aVal > bVal) comparison = 1;
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
} 