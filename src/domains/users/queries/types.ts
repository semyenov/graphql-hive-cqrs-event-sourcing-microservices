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
export interface GetUserByIdQuery extends IQuery<
  UserQueryTypes.GetUserById,
  { readonly userId: AggregateId },
  UserState | null
> {}

/**
 * Get user by email query
 */
export interface GetUserByEmailQuery extends IQuery<
  UserQueryTypes.GetUserByEmail,
  { readonly email: Email },
  UserState | null
> {}

/**
 * List users query with pagination
 */
export interface ListUsersQuery extends IQuery<
  UserQueryTypes.ListUsers,
  {
    readonly pagination: IPaginationParams;
    readonly includeDeleted?: boolean;
  },
  {
    users: UserState[];
    total: number;
    hasNext: boolean;
  }
> {}

/**
 * Search users query
 */
export interface SearchUsersQuery extends IQuery<
  UserQueryTypes.SearchUsers,
  {
    readonly searchTerm: string;
    readonly fields?: ('name' | 'email')[];
  },
  UserState[]
> {}

/**
 * Get user statistics query
 */
export interface GetUserStatsQuery extends IQuery<
  UserQueryTypes.GetUserStats,
  {
    readonly fromDate?: Date;
    readonly toDate?: Date;
  },
  {
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    verifiedEmails: number;
    createdToday: number;
  }
> {}

/**
 * Union type for all user queries
 */
export type UserQuery =
  | GetUserByIdQuery
  | GetUserByEmailQuery
  | ListUsersQuery
  | SearchUsersQuery
  | GetUserStatsQuery;