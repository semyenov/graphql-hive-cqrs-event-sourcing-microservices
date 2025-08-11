/**
 * User Domain: Query Definitions
 * 
 * Query types for the user domain read model.
 * All queries are immutable and use Data.struct.
 */

import * as Data from 'effect/Data';
import type { IQuery } from '@cqrs/framework';
import type { UserId, Email, Username, UserRole, UserStatus } from '../core/types';

/**
 * User query types enumeration
 */
export enum UserQueryType {
  GET_USER_BY_ID = 'GET_USER_BY_ID',
  GET_USER_BY_EMAIL = 'GET_USER_BY_EMAIL',
  GET_USER_BY_USERNAME = 'GET_USER_BY_USERNAME',
  LIST_USERS = 'LIST_USERS',
  SEARCH_USERS = 'SEARCH_USERS',
  GET_USER_STATS = 'GET_USER_STATS',
  GET_USER_SESSIONS = 'GET_USER_SESSIONS',
  GET_USER_ACTIVITY = 'GET_USER_ACTIVITY',
  GET_USER_PERMISSIONS = 'GET_USER_PERMISSIONS',
  CHECK_EMAIL_AVAILABILITY = 'CHECK_EMAIL_AVAILABILITY',
  CHECK_USERNAME_AVAILABILITY = 'CHECK_USERNAME_AVAILABILITY',
  GET_USERS_BY_ROLE = 'GET_USERS_BY_ROLE',
  GET_SUSPENDED_USERS = 'GET_SUSPENDED_USERS',
  GET_DELETED_USERS = 'GET_DELETED_USERS',
  GET_RECENT_REGISTRATIONS = 'GET_RECENT_REGISTRATIONS'
}

/**
 * Base user query interface
 */
export interface UserQuery<TType extends UserQueryType = UserQueryType, TPayload = unknown> extends IQuery {
  readonly type: TType;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly requestedBy?: UserId;
  };
  readonly payload: TPayload;
}

/**
 * Pagination parameters
 */
export type PaginationParams = {
  readonly offset?: number;
  readonly limit?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
};

/**
 * Filter parameters
 */
export type UserFilterParams = {
  readonly status?: UserStatus | UserStatus[];
  readonly role?: UserRole | UserRole[];
  readonly emailVerified?: boolean;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly hasProfile?: boolean;
  readonly hasTwoFactor?: boolean;
  readonly tags?: string[];
};

/**
 * Get user by ID query
 */
export interface GetUserByIdQuery extends UserQuery<UserQueryType.GET_USER_BY_ID> {
  readonly type: UserQueryType.GET_USER_BY_ID;
  readonly payload: {
    readonly userId: UserId;
    readonly includeDeleted?: boolean;
  };
}

/**
 * Get user by email query
 */
export interface GetUserByEmailQuery extends UserQuery<UserQueryType.GET_USER_BY_EMAIL> {
  readonly type: UserQueryType.GET_USER_BY_EMAIL;
  readonly payload: {
    readonly email: Email;
    readonly includeDeleted?: boolean;
  };
}

/**
 * Get user by username query
 */
export interface GetUserByUsernameQuery extends UserQuery<UserQueryType.GET_USER_BY_USERNAME> {
  readonly type: UserQueryType.GET_USER_BY_USERNAME;
  readonly payload: {
    readonly username: Username;
    readonly includeDeleted?: boolean;
  };
}

/**
 * List users query
 */
export interface ListUsersQuery extends UserQuery<UserQueryType.LIST_USERS> {
  readonly type: UserQueryType.LIST_USERS;
  readonly payload: {
    readonly pagination?: PaginationParams;
    readonly filters?: UserFilterParams;
  };
}

/**
 * Search users query
 */
export interface SearchUsersQuery extends UserQuery<UserQueryType.SEARCH_USERS> {
  readonly type: UserQueryType.SEARCH_USERS;
  readonly payload: {
    readonly searchTerm: string;
    readonly searchFields?: ('email' | 'username' | 'firstName' | 'lastName' | 'displayName')[];
    readonly pagination?: PaginationParams;
    readonly filters?: UserFilterParams;
  };
}

/**
 * Get user stats query
 */
export interface GetUserStatsQuery extends UserQuery<UserQueryType.GET_USER_STATS> {
  readonly type: UserQueryType.GET_USER_STATS;
  readonly payload: {
    readonly period?: 'day' | 'week' | 'month' | 'year' | 'all';
    readonly groupBy?: 'status' | 'role' | 'source';
  };
}

/**
 * Get user sessions query
 */
export interface GetUserSessionsQuery extends UserQuery<UserQueryType.GET_USER_SESSIONS> {
  readonly type: UserQueryType.GET_USER_SESSIONS;
  readonly payload: {
    readonly userId: UserId;
    readonly activeOnly?: boolean;
  };
}

/**
 * Get user activity query
 */
export interface GetUserActivityQuery extends UserQuery<UserQueryType.GET_USER_ACTIVITY> {
  readonly type: UserQueryType.GET_USER_ACTIVITY;
    readonly payload: {
    readonly userId: UserId;
    readonly fromDate?: string;
    readonly toDate?: string;
    readonly eventTypes?: string[];
    readonly pagination?: PaginationParams;
  };
}

/**
 * Check email availability query
 */
export interface CheckEmailAvailabilityQuery extends UserQuery<UserQueryType.CHECK_EMAIL_AVAILABILITY> {
  readonly type: UserQueryType.CHECK_EMAIL_AVAILABILITY;
  readonly payload: {
    readonly email: string;
  };
}

/**
 * Check username availability query
 */
export interface CheckUsernameAvailabilityQuery extends UserQuery<UserQueryType.CHECK_USERNAME_AVAILABILITY> {
  readonly type: UserQueryType.CHECK_USERNAME_AVAILABILITY;
  readonly payload: {
    readonly username: string;
  };
}

/**
 * Get users by role query
 */
export interface GetUsersByRoleQuery extends UserQuery<UserQueryType.GET_USERS_BY_ROLE> {
  readonly type: UserQueryType.GET_USERS_BY_ROLE;
  readonly payload: {
    readonly role: UserRole;
    readonly pagination?: PaginationParams;
  };
}

/**
 * Union type of all user queries
 */
export type UserDomainQuery =
  | GetUserByIdQuery
  | GetUserByEmailQuery
  | GetUserByUsernameQuery
  | ListUsersQuery
  | SearchUsersQuery
  | GetUserStatsQuery
  | GetUserSessionsQuery
  | GetUserActivityQuery
  | CheckEmailAvailabilityQuery
  | CheckUsernameAvailabilityQuery
  | GetUsersByRoleQuery;

/**
 * Query result types
 */
export namespace UserQueryResults {
  export type UserDTO = {
    readonly id: UserId;
    readonly email: Email;
    readonly username: Username;
    readonly status: UserStatus;
    readonly role: UserRole;
    readonly profile: {
      readonly firstName: string;
      readonly lastName: string;
      readonly displayName: string;
      readonly bio?: string;
      readonly avatarUrl?: string;
      readonly location?: string;
      readonly website?: string;
    };
    readonly emailVerified: boolean;
    readonly emailVerifiedAt?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastLoginAt?: string;
    readonly twoFactorEnabled: boolean;
  };

  export type UserListResult = {
    readonly users: readonly UserDTO[];
    readonly total: number;
    readonly offset: number;
    readonly limit: number;
  };

  export type UserStatsResult = {
    readonly total: number;
    readonly active: number;
    readonly pending: number;
    readonly suspended: number;
    readonly deleted: number;
    readonly verified: number;
    readonly withTwoFactor: number;
    readonly newToday: number;
    readonly newThisWeek: number;
    readonly newThisMonth: number;
    readonly byRole: Record<UserRole, number>;
    readonly bySource: Record<string, number>;
  };

  export type UserSessionDTO = {
    readonly sessionId: string;
    readonly userId: UserId;
    readonly createdAt: string;
    readonly lastActivityAt: string;
    readonly expiresAt: string;
    readonly ipAddress: string;
    readonly userAgent?: string;
    readonly isActive: boolean;
  };

  export type UserActivityDTO = {
    readonly eventType: string;
    readonly timestamp: string;
    readonly metadata?: Record<string, unknown>;
  };

  export type AvailabilityResult = {
    readonly available: boolean;
    readonly suggestions?: readonly string[];
  };
}

/**
 * Query factory functions
 */
export const UserQueryFactories = {
  getUserById: (userId: UserId, includeDeleted = false): GetUserByIdQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_BY_ID,
      payload: Data.struct({
        userId,
        includeDeleted
      })
    }),

  getUserByEmail: (email: Email, includeDeleted = false): GetUserByEmailQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_BY_EMAIL,
      payload: Data.struct({
        email,
        includeDeleted
      })
    }),

  getUserByUsername: (username: Username, includeDeleted = false): GetUserByUsernameQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_BY_USERNAME,
      payload: Data.struct({
        username,
        includeDeleted
      })
    }),

  listUsers: (params?: {
    pagination?: PaginationParams;
    filters?: UserFilterParams;
  }): ListUsersQuery =>
    Data.struct({
      type: UserQueryType.LIST_USERS,
      payload: Data.struct({
        pagination: params?.pagination,
        filters: params?.filters
      })
    }),

  searchUsers: (params: {
    searchTerm: string;
    searchFields?: SearchUsersQuery['payload']['searchFields'];
    pagination?: PaginationParams;
    filters?: UserFilterParams;
  }): SearchUsersQuery =>
    Data.struct({
      type: UserQueryType.SEARCH_USERS,
      payload: Data.struct({
        searchTerm: params.searchTerm,
        searchFields: params.searchFields || ['email', 'username', 'displayName'],
        pagination: params.pagination,
        filters: params.filters
      })
    }),

  getUserStats: (params?: {
    period?: GetUserStatsQuery['payload']['period'];
    groupBy?: GetUserStatsQuery['payload']['groupBy'];
  }): GetUserStatsQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_STATS,
      payload: Data.struct({
        period: params?.period || 'all',
        groupBy: params?.groupBy
      })
    }),

  getUserSessions: (userId: UserId, activeOnly = false): GetUserSessionsQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_SESSIONS,
      payload: Data.struct({
        userId,
        activeOnly
      })
    }),

  getUserActivity: (params: {
    userId: UserId;
    fromDate?: string;
    toDate?: string;
    eventTypes?: string[];
    pagination?: PaginationParams;
  }): GetUserActivityQuery =>
    Data.struct({
      type: UserQueryType.GET_USER_ACTIVITY,
      payload: Data.struct(params)
    }),

  checkEmailAvailability: (email: string): CheckEmailAvailabilityQuery =>
    Data.struct({
      type: UserQueryType.CHECK_EMAIL_AVAILABILITY,
      payload: Data.struct({ email })
    }),

  checkUsernameAvailability: (username: string): CheckUsernameAvailabilityQuery =>
    Data.struct({
      type: UserQueryType.CHECK_USERNAME_AVAILABILITY,
      payload: Data.struct({ username })
    }),

  getUsersByRole: (role: UserRole, pagination?: PaginationParams): GetUsersByRoleQuery =>
    Data.struct({
      type: UserQueryType.GET_USERS_BY_ROLE,
      payload: Data.struct({
        role,
        pagination
      })
    })
} as const;