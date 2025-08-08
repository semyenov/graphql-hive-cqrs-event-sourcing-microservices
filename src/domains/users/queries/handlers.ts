/**
 * User Domain: Query Handlers
 * 
 * Query handlers for user domain read operations.
 */

import type { IQueryHandler } from '../../../framework/core/query';
import type { ProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserState } from '../aggregates/user';
import type { UserEvent } from '../events/types';
import type { UserQuery } from './types';
import * as Queries from './types';

/**
 * Get user by ID query handler
 */
export class GetUserByIdQueryHandler implements IQueryHandler<
  Queries.GetUserByIdQuery,
  UserState | null
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.GetUserByIdQuery): Promise<UserState | null> {
    if (!query.parameters) return null;
    return this.userProjection.get(query.parameters.userId as string);
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === Queries.UserQueryTypes.GetUserById;
  }
}

/**
 * Get user by email query handler
 */
export class GetUserByEmailQueryHandler implements IQueryHandler<
  Queries.GetUserByEmailQuery,
  UserState | null
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.GetUserByEmailQuery): Promise<UserState | null> {
    if (!query.parameters) return null;
    const users = this.userProjection.search(user => 
      user.email === query.parameters!.email
    );
    return users[0] || null;
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === Queries.UserQueryTypes.GetUserByEmail;
  }
}

/**
 * List users query handler
 */
export class ListUsersQueryHandler implements IQueryHandler<
  Queries.ListUsersQuery,
  { users: UserState[]; total: number; hasNext: boolean }
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.ListUsersQuery): Promise<{
    users: UserState[];
    total: number;
    hasNext: boolean;
  }> {
    if (!query.parameters) {
      return { users: [], total: 0, hasNext: false };
    }
    
    const { pagination, includeDeleted = false } = query.parameters;
    const { offset, limit } = pagination;

    // Get all users
    let users = this.userProjection.getAll();

    // Filter by deleted status
    if (!includeDeleted) {
      users = users.filter(user => !user.deleted);
    }

    // Apply pagination
    const total = users.length;
    const paginatedUsers = users.slice(offset, offset + limit);
    const hasNext = offset + limit < total;

    return {
      users: paginatedUsers,
      total,
      hasNext,
    };
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === Queries.UserQueryTypes.ListUsers;
  }
}

/**
 * Search users query handler
 */
export class SearchUsersQueryHandler implements IQueryHandler<
  Queries.SearchUsersQuery,
  UserState[]
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.SearchUsersQuery): Promise<UserState[]> {
    if (!query.parameters) return [];
    
    const { searchTerm, fields = ['name', 'email'] } = query.parameters;
    const searchLower = searchTerm.toLowerCase();

    return this.userProjection.search(user => {
      if (user.deleted) return false;

      return fields.some((field: string) => {
        switch (field) {
          case 'name':
            return user.name.toLowerCase().includes(searchLower);
          case 'email':
            return user.email.toLowerCase().includes(searchLower);
          default:
            return false;
        }
      });
    });
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === Queries.UserQueryTypes.SearchUsers;
  }
}

/**
 * Get user stats query handler
 */
export class GetUserStatsQueryHandler implements IQueryHandler<
  Queries.GetUserStatsQuery,
  {
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    verifiedEmails: number;
    createdToday: number;
  }
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(_query: Queries.GetUserStatsQuery): Promise<{
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    verifiedEmails: number;
    createdToday: number;
  }> {
    const users = this.userProjection.getAll();
    const today = new Date().toISOString().split('T')[0] || '';

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => !u.deleted).length,
      deletedUsers: users.filter(u => u.deleted).length,
      verifiedEmails: users.filter(u => u.emailVerified && !u.deleted).length,
      createdToday: users.filter(u => u.createdAt.startsWith(today)).length,
    };

    return stats;
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === Queries.UserQueryTypes.GetUserStats;
  }
}

/**
 * Register all user query handlers
 */
export function registerUserQueryHandlers(
  queryBus: { registerWithType: (type: string, handler: IQueryHandler<UserQuery, unknown>) => void },
  projections: {
    userProjection: ProjectionBuilder<UserEvent, UserState>;
    userListProjection: ProjectionBuilder<UserEvent, any>;
    userStatsProjection?: ProjectionBuilder<UserEvent, any>;
  }
): void {
  queryBus.registerWithType(Queries.UserQueryTypes.GetUserById, new GetUserByIdQueryHandler(projections.userProjection));
  queryBus.registerWithType(Queries.UserQueryTypes.GetUserByEmail, new GetUserByEmailQueryHandler(projections.userProjection));
  queryBus.registerWithType(Queries.UserQueryTypes.ListUsers, new ListUsersQueryHandler(projections.userProjection));
  queryBus.registerWithType(Queries.UserQueryTypes.SearchUsers, new SearchUsersQueryHandler(projections.userProjection));
  queryBus.registerWithType(Queries.UserQueryTypes.GetUserStats, new GetUserStatsQueryHandler(projections.userProjection));
}