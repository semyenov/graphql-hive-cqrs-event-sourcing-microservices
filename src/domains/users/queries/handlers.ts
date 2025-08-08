/**
 * User Domain: Query Handlers
 * 
 * Handlers that process queries and return data from projections.
 */

import type { IQueryHandler } from '../../../framework/core/query';
import type { ProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserState } from '../aggregates/user';
import type { UserEvent } from '../events/types';
import type * as Queries from './types';
import { UserQueryTypes, type UserQuery } from './types';

/**
 * Handler for GetUserById query
 */
export class GetUserByIdQueryHandler implements IQueryHandler<
  Queries.GetUserByIdQuery,
  UserState | null
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.GetUserByIdQuery): Promise<UserState | null> {
    const userId = query.parameters.userId as string;
    return this.userProjection.get(userId);
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === UserQueryTypes.GetUserById;
  }
}

/**
 * Handler for GetUserByEmail query
 */
export class GetUserByEmailQueryHandler implements IQueryHandler<
  Queries.GetUserByEmailQuery,
  UserState | null
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.GetUserByEmailQuery): Promise<UserState | null> {
    const users = this.userProjection.search(
      user => user.email === query.parameters.email
    );
    return users[0] || null;
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === UserQueryTypes.GetUserByEmail;
  }
}

/**
 * Handler for ListUsers query with pagination
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
    const { pagination, includeDeleted = false } = query.parameters;
    
    // Get all users and filter
    let users = this.userProjection.getAll();
    
    if (!includeDeleted) {
      users = users.filter(user => !user.deleted);
    }

    // Sort
    if (pagination.sortBy) {
      users.sort((a, b) => {
        const aVal = a[pagination.sortBy as keyof UserState];
        const bVal = b[pagination.sortBy as keyof UserState];
        
        if (pagination.sortOrder === 'desc') {
          return aVal && bVal ? (aVal > bVal ? -1 : aVal < bVal ? 1 : 0) : 0;
        }
        return aVal && bVal ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : 0;
      });
    }

    const total = users.length;
    
    // Paginate
    const start = pagination.offset;
    const end = start + pagination.limit;
    const paginatedUsers = users.slice(start, end);
    
    return {
      users: paginatedUsers,
      total,
      hasNext: end < total,
    };
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === UserQueryTypes.ListUsers;
  }
}

/**
 * Handler for SearchUsers query
 */
export class SearchUsersQueryHandler implements IQueryHandler<
  Queries.SearchUsersQuery,
  UserState[]
> {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>
  ) {}

  async handle(query: Queries.SearchUsersQuery): Promise<UserState[]> {
    const { searchTerm, fields = ['name', 'email'] } = query.parameters;
    const searchLower = searchTerm.toLowerCase();
    
    return this.userProjection.search(user => {
      if (user.deleted) return false;
      
      return fields.some(field => {
        const value = user[field as keyof UserState];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchLower);
        }
        return false;
      });
    });
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === UserQueryTypes.SearchUsers;
  }
}

/**
 * Handler for GetUserStats query
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

  async handle(query: Queries.GetUserStatsQuery): Promise<{
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    verifiedEmails: number;
    createdToday: number;
  }> {
    const users = this.userProjection.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = {
      totalUsers: users.length,
      activeUsers: 0,
      deletedUsers: 0,
      verifiedEmails: 0,
      createdToday: 0,
    };
    
    for (const user of users) {
      if (!user.deleted) {
        stats.activeUsers++;
      } else {
        stats.deletedUsers++;
      }
      
      if (user.emailVerified) {
        stats.verifiedEmails++;
      }
      
      const createdDate = new Date(user.createdAt);
      createdDate.setHours(0, 0, 0, 0);
      if (createdDate.getTime() === today.getTime()) {
        stats.createdToday++;
      }
    }
    
    return stats;
  }

  canHandle(query: Queries.UserQuery): boolean {
    return query.type === UserQueryTypes.GetUserStats;
  }
}

/**
 * Register all user query handlers with the query bus
 */
export function registerUserQueryHandlers(
  queryBus: { registerWithType: (type: string, handler: IQueryHandler<UserQuery, unknown>) => void },
  userProjection: ProjectionBuilder<UserEvent, UserState>
): void {
  const handlers = [
    { type: UserQueryTypes.GetUserById, handler: new GetUserByIdQueryHandler(userProjection) },
    { type: UserQueryTypes.GetUserByEmail, handler: new GetUserByEmailQueryHandler(userProjection) },
    { type: UserQueryTypes.ListUsers, handler: new ListUsersQueryHandler(userProjection) },
    { type: UserQueryTypes.SearchUsers, handler: new SearchUsersQueryHandler(userProjection) },
    { type: UserQueryTypes.GetUserStats, handler: new GetUserStatsQueryHandler(userProjection) },
  ];

  handlers.forEach(({ type, handler }) => {
    queryBus.registerWithType(type, handler);
  });
}