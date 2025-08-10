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
import { registerQueryPattern } from '../../../framework/infrastructure/bus/query-bus';

/**
 * Register all user query handlers with the query bus using a pattern-based approach
 */
export function registerUserQueryHandlersWithPattern(
  queryBus: Parameters<typeof registerQueryPattern<UserQuery, unknown>>[0],
  userProjection: ProjectionBuilder<UserEvent, UserState>
): void {
  registerQueryPattern<UserQuery, unknown>(queryBus, {
    [UserQueryTypes.GetUserById]: async (query: Queries.GetUserByIdQuery) => {
      const userId = query.parameters.userId as string;
      return userProjection.get(userId);
    },
    [UserQueryTypes.GetUserByEmail]: async (query: Queries.GetUserByEmailQuery) => {
      const users = userProjection.search(user => user.email === query.parameters.email);
      return users[0] || null;
    },
    [UserQueryTypes.ListUsers]: async (query: Queries.ListUsersQuery) => {
      const { pagination, includeDeleted = false } = query.parameters;
      let users = userProjection.getAll();
      if (!includeDeleted) users = users.filter(u => !u.deleted);
      if (pagination.sortBy) {
        users.sort((a, b) => {
          const aVal = a[pagination.sortBy as keyof UserState];
          const bVal = b[pagination.sortBy as keyof UserState];
          if (pagination.sortOrder === 'desc') return aVal && bVal ? (aVal > bVal ? -1 : aVal < bVal ? 1 : 0) : 0;
          return aVal && bVal ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : 0;
        });
      }
      const total = users.length;
      const start = pagination.offset;
      const end = start + pagination.limit;
      const paginatedUsers = users.slice(start, end);
      return { users: paginatedUsers, total, hasNext: end < total };
    },
    [UserQueryTypes.SearchUsers]: async (query: Queries.SearchUsersQuery) => {
      const { searchTerm, fields = ['name', 'email'] } = query.parameters;
      const searchLower = searchTerm.toLowerCase();
      return userProjection.search(user => {
        if (user.deleted) return false;
        return fields.some(field => {
          const value = user[field as keyof UserState];
          return typeof value === 'string' && value.toLowerCase().includes(searchLower);
        });
      });
    },
    [UserQueryTypes.GetUserStats]: async (_query: Queries.GetUserStatsQuery) => {
      const users = userProjection.getAll();
      const today = new Date(); today.setHours(0,0,0,0);
      const stats = { totalUsers: users.length, activeUsers: 0, deletedUsers: 0, verifiedEmails: 0, createdToday: 0 };
      for (const user of users) {
        if (!user.deleted) stats.activeUsers++; else stats.deletedUsers++;
        if (user.emailVerified) stats.verifiedEmails++;
        const createdDate = new Date(user.createdAt); createdDate.setHours(0,0,0,0);
        if (createdDate.getTime() === today.getTime()) stats.createdToday++;
      }
      return stats;
    },
  });
}