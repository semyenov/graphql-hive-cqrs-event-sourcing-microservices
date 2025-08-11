/**
 * User Domain: Query Handlers
 * 
 * Effect-based query handlers for the user domain.
 * Reads from projections and provides read model data.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Option from 'effect/Option';
import * as ReadonlyArray from 'effect/ReadonlyArray';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';
import type {
  GetUserByIdQuery,
  GetUserByEmailQuery,
  GetUserByUsernameQuery,
  ListUsersQuery,
  SearchUsersQuery,
  GetUserStatsQuery,
  GetUserSessionsQuery,
  CheckEmailAvailabilityQuery,
  CheckUsernameAvailabilityQuery,
  UserDomainQuery,
  UserQueryResults
} from './queries';
import { UserQueryType } from './queries';
import type { UserId, Email, Username, UserState } from '../core/types';
import * as Errors from '../core/errors';

/**
 * User projection store interface
 */
export interface UserProjectionStore {
  readonly getUserById: (id: UserId) => Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never>;
  readonly getUserByEmail: (email: Email) => Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never>;
  readonly getUserByUsername: (username: Username) => Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never>;
  readonly listUsers: (params: {
    offset: number;
    limit: number;
    filters?: ListUsersQuery['payload']['filters'];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => Effect.Effect<UserQueryResults.UserListResult, never, never>;
  readonly searchUsers: (params: {
    searchTerm: string;
    searchFields: string[];
    offset: number;
    limit: number;
    filters?: SearchUsersQuery['payload']['filters'];
  }) => Effect.Effect<UserQueryResults.UserListResult, never, never>;
  readonly getUserStats: (params: {
    period: string;
    groupBy?: string;
  }) => Effect.Effect<UserQueryResults.UserStatsResult, never, never>;
  readonly getUserSessions: (userId: UserId, activeOnly: boolean) => Effect.Effect<readonly UserQueryResults.UserSessionDTO[], never, never>;
  readonly checkEmailExists: (email: string) => Effect.Effect<boolean, never, never>;
  readonly checkUsernameExists: (username: string) => Effect.Effect<boolean, never, never>;
}

/**
 * Query handler context
 */
export interface UserQueryContext {
  readonly projectionStore: UserProjectionStore;
}

export const UserQueryContextTag = Context.GenericTag<UserQueryContext>('UserQueryContext');

/**
 * Base query handler type
 */
export interface UserQueryHandler<TQuery extends UserDomainQuery, TResult = unknown> {
  readonly type: TQuery['type'];
  readonly canHandle: (query: TQuery) => query is TQuery;
  readonly handle: (query: TQuery) => Effect.Effect<TResult, Errors.UserError, UserQueryContext>;
}

/**
 * Get user by ID query handler
 */
export const getUserByIdHandler: UserQueryHandler<GetUserByIdQuery, UserQueryResults.UserDTO> = {
  type: UserQueryType.GET_USER_BY_ID,
  canHandle: (query): query is GetUserByIdQuery => query.type === UserQueryType.GET_USER_BY_ID,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => context.projectionStore.getUserById(query.payload.userId)),
      Effect.flatMap((userOption) =>
        pipe(
          userOption,
          Option.match({
            onNone: () => Effect.fail(Errors.UserErrors.notFound({ userId: query.payload.userId })),
            onSome: (user) => {
              // Check if we should include deleted users
              if (user.status === 'DELETED' && !query.payload.includeDeleted) {
                return Effect.fail(Errors.UserErrors.notFound({ userId: query.payload.userId }));
              }
              return Effect.succeed(user);
            }
          })
        )
      )
    )
};

/**
 * Get user by email query handler
 */
export const getUserByEmailHandler: UserQueryHandler<GetUserByEmailQuery, UserQueryResults.UserDTO> = {
  type: UserQueryType.GET_USER_BY_EMAIL,
  canHandle: (query): query is GetUserByEmailQuery => query.type === UserQueryType.GET_USER_BY_EMAIL,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => context.projectionStore.getUserByEmail(query.payload.email)),
      Effect.flatMap((userOption) =>
        pipe(
          userOption,
          Option.match({
            onNone: () => Effect.fail(Errors.UserErrors.notFound({ email: query.payload.email })),
            onSome: (user) => {
              if (user.status === 'DELETED' && !query.payload.includeDeleted) {
                return Effect.fail(Errors.UserErrors.notFound({ email: query.payload.email }));
              }
              return Effect.succeed(user);
            }
          })
        )
      )
    )
};

/**
 * Get user by username query handler
 */
export const getUserByUsernameHandler: UserQueryHandler<GetUserByUsernameQuery, UserQueryResults.UserDTO> = {
  type: UserQueryType.GET_USER_BY_USERNAME,
  canHandle: (query): query is GetUserByUsernameQuery => query.type === UserQueryType.GET_USER_BY_USERNAME,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => context.projectionStore.getUserByUsername(query.payload.username)),
      Effect.flatMap((userOption) =>
        pipe(
          userOption,
          Option.match({
            onNone: () => Effect.fail(Errors.UserErrors.notFound({ username: query.payload.username })),
            onSome: (user) => {
              if (user.status === 'DELETED' && !query.payload.includeDeleted) {
                return Effect.fail(Errors.UserErrors.notFound({ username: query.payload.username }));
              }
              return Effect.succeed(user);
            }
          })
        )
      )
    )
};

/**
 * List users query handler
 */
export const listUsersHandler: UserQueryHandler<ListUsersQuery, UserQueryResults.UserListResult> = {
  type: UserQueryType.LIST_USERS,
  canHandle: (query): query is ListUsersQuery => query.type === UserQueryType.LIST_USERS,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => {
        const offset = query.payload.pagination?.offset || 0;
        const limit = Math.min(query.payload.pagination?.limit || 20, 100); // Max 100 items
        
        return context.projectionStore.listUsers({
          offset,
          limit,
          filters: query.payload.filters,
          sortBy: query.payload.pagination?.sortBy,
          sortOrder: query.payload.pagination?.sortOrder
        });
      })
    )
};

/**
 * Search users query handler
 */
export const searchUsersHandler: UserQueryHandler<SearchUsersQuery, UserQueryResults.UserListResult> = {
  type: UserQueryType.SEARCH_USERS,
  canHandle: (query): query is SearchUsersQuery => query.type === UserQueryType.SEARCH_USERS,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => {
        const offset = query.payload.pagination?.offset || 0;
        const limit = Math.min(query.payload.pagination?.limit || 20, 100);
        
        return context.projectionStore.searchUsers({
          searchTerm: query.payload.searchTerm,
          searchFields: query.payload.searchFields || ['email', 'username', 'displayName'],
          offset,
          limit,
          filters: query.payload.filters
        });
      })
    )
};

/**
 * Get user stats query handler
 */
export const getUserStatsHandler: UserQueryHandler<GetUserStatsQuery, UserQueryResults.UserStatsResult> = {
  type: UserQueryType.GET_USER_STATS,
  canHandle: (query): query is GetUserStatsQuery => query.type === UserQueryType.GET_USER_STATS,
  
  handle: (query) => 
    pipe(
      UserQueryContextTag,
      Effect.flatMap((context) => 
        context.projectionStore.getUserStats({
          period: query.payload.period || 'all',
          groupBy: query.payload.groupBy
        })
      )
    )
};

/**
 * Get user sessions query handler
 */
export const getUserSessionsHandler: UserQueryHandler<GetUserSessionsQuery, readonly UserQueryResults.UserSessionDTO[]> = {
  type: UserQueryType.GET_USER_SESSIONS,
  canHandle: (query): query is GetUserSessionsQuery => query.type === UserQueryType.GET_USER_SESSIONS,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => 
        context.projectionStore.getUserSessions(
          query.payload.userId,
          query.payload.activeOnly || false
        )
      )
    )
};

/**
 * Check email availability query handler
 */
export const checkEmailAvailabilityHandler: UserQueryHandler<CheckEmailAvailabilityQuery, UserQueryResults.AvailabilityResult> = {
  type: UserQueryType.CHECK_EMAIL_AVAILABILITY,
  canHandle: (query): query is CheckEmailAvailabilityQuery => query.type === UserQueryType.CHECK_EMAIL_AVAILABILITY,
  
  handle: (query) => 
    pipe(
      UserQueryContextTag,
      Effect.flatMap((context) => context.projectionStore.checkEmailExists(query.payload.email)),
      Effect.map((exists) => {
        const result: UserQueryResults.AvailabilityResult = Data.struct({
          available: !exists,
          suggestions: !exists ? undefined : generateEmailSuggestions(query.payload.email)
        });
        return result;
      })
    )
};

/**
 * Check username availability query handler
 */
export const checkUsernameAvailabilityHandler: UserQueryHandler<CheckUsernameAvailabilityQuery, UserQueryResults.AvailabilityResult> = {
  type: UserQueryType.CHECK_USERNAME_AVAILABILITY,
  canHandle: (query): query is CheckUsernameAvailabilityQuery => query.type === UserQueryType.CHECK_USERNAME_AVAILABILITY,
  
  handle: (query) => 
    UserQueryContextTag.pipe(
      Effect.flatMap((context) => context.projectionStore.checkUsernameExists(query.payload.username)),
      Effect.map((exists) => {
        const result: UserQueryResults.AvailabilityResult = Data.struct({
          available: !exists,
          suggestions: !exists ? undefined : generateUsernameSuggestions(query.payload.username)
        });
        return result;
      })
    )
};

/**
 * Helper function to generate email suggestions
 */
function generateEmailSuggestions(email: string): readonly string[] {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return [];
  
  const suggestions: string[] = [];
  const timestamp = Date.now().toString().slice(-4);
  
  suggestions.push(`${localPart}${timestamp}@${domain}`);
  suggestions.push(`${localPart}.${timestamp}@${domain}`);
  suggestions.push(`${localPart}_${timestamp}@${domain}`);
  
  return suggestions.slice(0, 3);
}

/**
 * Helper function to generate username suggestions
 */
function generateUsernameSuggestions(username: string): readonly string[] {
  const suggestions: string[] = [];
  const timestamp = Date.now().toString().slice(-4);
  
  suggestions.push(`${username}${timestamp}`);
  suggestions.push(`${username}_${timestamp}`);
  suggestions.push(`${username}.${timestamp}`);
  
  // Add random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  suggestions.push(`${username}_${randomSuffix}`);
  
  return suggestions.slice(0, 4);
}

/**
 * Collection of all user query handlers
 */
export const userQueryHandlers: UserQueryHandler<UserDomainQuery, UserQueryResults.UserDTO>[] = [
  getUserByIdHandler,
  getUserByEmailHandler,
  getUserByUsernameHandler,
  listUsersHandler,
  searchUsersHandler,
  getUserStatsHandler,
  getUserSessionsHandler,
  checkEmailAvailabilityHandler,
  checkUsernameAvailabilityHandler
];

/**
 * Query dispatcher
 */
export const dispatchUserQuery = <TResult>(
  query: UserDomainQuery
): Effect.Effect<TResult, Errors.UserError | Error, UserQueryContext> => {
  const handler = userQueryHandlers.find(h => h.canHandle(query));
  
  if (!handler) {
    return Effect.fail(new Error(`No handler found for query type: ${query.type}`));
  }
  
  return handler.handle(query as UserDomainQuery) as Effect.Effect<TResult, Errors.UserError, UserQueryContext>;
};