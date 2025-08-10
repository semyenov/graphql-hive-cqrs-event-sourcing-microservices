/**
 * User Domain: Domain Queries
 * 
 * Queries represent requests for user information.
 * These define what data can be read from the user domain.
 */

import type { IQuery } from '../../../framework/core/query';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * User query types - string literals for better type safety
 */
export const UserQueryTypes = {
  GetUserById: 'GET_USER_BY_ID',
  GetUserByEmail: 'GET_USER_BY_EMAIL',
  ListUsers: 'LIST_USERS',
  SearchUsers: 'SEARCH_USERS',
  GetUserStats: 'GET_USER_STATS',
} as const;

export type UserQueryType = typeof UserQueryTypes[keyof typeof UserQueryTypes];

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly offset: number;
  readonly limit: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Get user by ID query - retrieve a specific user
 */
export interface GetUserByIdQuery extends IQuery {
  readonly type: typeof UserQueryTypes.GetUserById;
  readonly parameters: {
    readonly userId: AggregateId;
  };
}

/**
 * Get user by email query - find user by email address
 */
export interface GetUserByEmailQuery extends IQuery {
  readonly type: typeof UserQueryTypes.GetUserByEmail;
  readonly parameters: {
    readonly email: string;
  };
}

/**
 * List users query - get paginated list of users
 */
export interface ListUsersQuery extends IQuery {
  readonly type: typeof UserQueryTypes.ListUsers;
  readonly parameters: {
    readonly pagination: PaginationParams;
    readonly includeDeleted?: boolean;
  };
}

/**
 * Search users query - search users by term
 */
export interface SearchUsersQuery extends IQuery {
  readonly type: typeof UserQueryTypes.SearchUsers;
  readonly parameters: {
    readonly searchTerm: string;
    readonly fields?: ReadonlyArray<string>;
  };
}

/**
 * Get user stats query - retrieve user statistics
 */
export interface GetUserStatsQuery extends IQuery {
  readonly type: typeof UserQueryTypes.GetUserStats;
  readonly parameters: Record<string, never>;
}

/**
 * Union type of all user queries
 */
export type UserQuery =
  | GetUserByIdQuery
  | GetUserByEmailQuery
  | ListUsersQuery
  | SearchUsersQuery
  | GetUserStatsQuery; 