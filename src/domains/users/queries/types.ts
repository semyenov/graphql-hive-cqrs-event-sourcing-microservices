/**
 * User Domain: Query Types
 * 
 * Query definitions for reading user data from projections.
 */

import type { IQuery, IPaginationParams } from '../../../framework/core/query';
import type { AggregateId, Email } from '../../../framework/core/branded/types';
import type { UserState } from '../aggregates/user';

/**
 * Query types enum
 */
export enum UserQueryTypes {
  GetUserById = 'GetUserById',
  GetUserByEmail = 'GetUserByEmail',
  ListUsers = 'ListUsers',
  SearchUsers = 'SearchUsers',
  GetUserStats = 'GetUserStats',
}

/**
 * Get user by ID query
 */
export interface GetUserByIdQuery extends IQuery<UserState | null> {
  readonly type: UserQueryTypes.GetUserById;
  readonly parameters: {
    readonly userId: AggregateId;
  };
}

/**
 * Get user by email query
 */
export interface GetUserByEmailQuery extends IQuery<UserState | null> {
  readonly type: UserQueryTypes.GetUserByEmail;
  readonly parameters: {
    readonly email: Email;
  };
}

/**
 * List users query with pagination
 */
export interface ListUsersQuery extends IQuery<{
  users: UserState[];
  total: number;
  hasNext: boolean;
}> {
  readonly type: UserQueryTypes.ListUsers;
  readonly parameters: {
    readonly pagination: IPaginationParams;
    readonly includeDeleted?: boolean;
  };
}

/**
 * Search users query
 */
export interface SearchUsersQuery extends IQuery<UserState[]> {
  readonly type: UserQueryTypes.SearchUsers;
  readonly parameters: {
    readonly searchTerm: string;
    readonly fields?: ('name' | 'email')[];
  };
}

/**
 * Get user statistics query
 */
export interface GetUserStatsQuery extends IQuery<{
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  verifiedEmails: number;
  createdToday: number;
}> {
  readonly type: UserQueryTypes.GetUserStats;
  readonly parameters?: {
    readonly fromDate?: Date;
    readonly toDate?: Date;
  };
}

/**
 * Union type for all user queries
 */
export type UserQuery =
  | GetUserByIdQuery
  | GetUserByEmailQuery
  | ListUsersQuery
  | SearchUsersQuery
  | GetUserStatsQuery;