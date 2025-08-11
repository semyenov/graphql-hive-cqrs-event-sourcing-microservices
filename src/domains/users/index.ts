  /**
 * User Domain Module
 * 
 * Main entry point for the user domain.
 * Wires together all components using Effect-TS dependency injection.
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

// Core exports
export * from './core/types';
export * from './core/errors';
export * from './core/events';
export { UserAggregate } from './core/aggregate';

// Application exports
export * from './application/commands';
export * from './application/queries';
export * from './application/command-handlers';
export * from './application/query-handlers';
export { UserCommandType } from './application/commands';
export { UserQueryType } from './application/queries';

// Infrastructure exports
export * from './infrastructure/repository';
export * from './infrastructure/projections';

// API exports
export { userGraphQLSchema } from './api/graphql-schema';

// Import necessary types and implementations
import type { 
  UserCommandContext,
  PasswordHasher,
  EmailService,
  SessionManager,
  UserRepository as UserRepositoryInterface
} from './application/command-handlers';
import {
  PasswordHasherTag,
  EmailServiceTag,
  SessionManagerTag,
  UserRepositoryTag,
  userCommandHandlers
} from './application/command-handlers';
import type { UserQueryContext, UserProjectionStore } from './application/query-handlers';
import { UserQueryContextTag, userQueryHandlers, dispatchUserQuery } from './application/query-handlers';
import { UserRepositoryImpl, InMemoryStores } from './infrastructure/repository';
import { UserProjectionProcessor, ProjectionContextTag } from './infrastructure/projections';

/**
 * Default password hasher implementation
 */
class DefaultPasswordHasher implements PasswordHasher {
  hash(password: string): Effect.Effect<string, never, never> {
    // In production, use bcrypt or argon2
    return Effect.succeed(`hashed_${password}_${Date.now()}`);
  }
  
  verify(password: string, hash: string): Effect.Effect<boolean, never, never> {
    // Simplified for demo
    return Effect.succeed(hash.startsWith(`hashed_${password}_`));
  }
}

/**
 * Default email service implementation
 */
class DefaultEmailService implements EmailService {
  sendVerificationEmail(email: string, token: string): Effect.Effect<void, never, never> {
    return Effect.log(`Sending verification email to ${email} with token ${token}`);
    // In production, integrate with email provider
  }
  
  sendPasswordResetEmail(email: string, token: string): Effect.Effect<void, never, never> {
    return Effect.log(`Sending password reset email to ${email} with token ${token}`);
    // In production, integrate with email provider
  }
}

/**
 * Default session manager implementation
 */
class DefaultSessionManager implements SessionManager {
  private sessions: Map<string, { userId: string; metadata?: unknown }> = new Map();
  
  createSession(userId: string, metadata?: unknown): Effect.Effect<string, never, never> {
    const sessionId = `session_${userId}_${Date.now()}`;
    this.sessions.set(sessionId, { userId, metadata });
    return Effect.succeed(sessionId);
  }
  
  revokeSession(sessionId: string): Effect.Effect<void, never, never> {
    const sessions = this.sessions;
    return Effect.succeed(sessions.delete(sessionId));
  }
  
  revokeAllSessions(userId: string): Effect.Effect<void, never, never> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
    return Effect.succeed(undefined);
  }
}

/**
 * Service layers for dependency injection
 */

// Password hasher service layer
const PasswordHasherLive = Layer.succeed(PasswordHasherTag, new DefaultPasswordHasher());

// Email service layer
const EmailServiceLive = Layer.succeed(EmailServiceTag, new DefaultEmailService());

// Session manager service layer
const SessionManagerLive = Layer.succeed(SessionManagerTag, new DefaultSessionManager());

// Import the tags from repository
import { 
  UserRepositoryContextTag,
  UserEventStoreTag,
  UserSnapshotStoreTag,
  UserIndexStoreTag 
} from './infrastructure/repository';

// Event store layer
const EventStoreLive = Layer.succeed(
  UserEventStoreTag,
  new InMemoryStores.InMemoryEventStore()
);

// Snapshot store layer
const SnapshotStoreLive = Layer.succeed(
  UserSnapshotStoreTag,
  new InMemoryStores.InMemorySnapshotStore()
);

// Index store layer
const IndexStoreLive = Layer.succeed(
  UserIndexStoreTag,
  new InMemoryStores.InMemoryIndexStore()
);

// Repository context layer - create the full context
const RepositoryContextLive = Layer.succeed(
  UserRepositoryContextTag,
  {
    eventStore: new InMemoryStores.InMemoryEventStore(),
    snapshotStore: new InMemoryStores.InMemorySnapshotStore(),
    indexStore: new InMemoryStores.InMemoryIndexStore(),
    addEmailIndex: (email, userId) => Effect.succeed(undefined),
    addUsernameIndex: (username, userId) => Effect.succeed(undefined),
    getUserIdByEmail: (email) => Effect.succeed(null),
    getUserIdByUsername: (username) => Effect.succeed(null),
    removeEmailIndex: (email) => Effect.succeed(undefined),
    removeUsernameIndex: (username) => Effect.succeed(undefined)
  }
);

// User repository layer
const UserRepositoryLive = Layer.effect(
  UserRepositoryTag,
  pipe(
    UserRepositoryImpl.create({
      cacheSize: 1000,
      cacheTTL: Duration.minutes(5),
      snapshotFrequency: 10
    }),
    Effect.map((repository) => repository as UserRepositoryInterface)
  )
).pipe(Layer.provide(RepositoryContextLive));

// Command context layer
const UserCommandContextLive = Layer.mergeAll(
  PasswordHasherLive,
  EmailServiceLive,
  SessionManagerLive,
  UserRepositoryLive
);

// Projection store implementation
class InMemoryProjectionStore implements UserProjectionStore {
  private projectionProcessor: UserProjectionProcessor | null = null;
  
  async initialize(): Promise<void> {
    const processor = await Effect.runPromise(UserProjectionProcessor.create('user-projections'));
    this.projectionProcessor = processor;
  }
  
  getUserById(id: UserId): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Option.none());
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => HashMap.get(state.users, id))
    );
  }
  
  getUserByEmail(email: Email): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Option.none());
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => {
        return pipe(
          HashMap.get(state.emailIndex, email),
          Option.flatMap((userId) => HashMap.get(state.users, userId))
        );
      })
    );
  }
  
  getUserByUsername(username: Username): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Option.none());
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => {
        return pipe(
          HashMap.get(state.usernameIndex, username),
          Option.flatMap((userId) => HashMap.get(state.users, userId))
        );
      })
    );
  }
  
  listUsers(params: {
    offset: number;
    limit: number;
    filters?: any;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Effect.Effect<UserQueryResults.UserListResult, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Data.struct({
        users: [],
        total: 0,
        offset: params.offset,
        limit: params.limit
      }));
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => {
        const allUsers = Array.from(HashMap.values(state.users));
        
        // Apply filters
        let filteredUsers = allUsers;
        if (params.filters) {
          // Implement filtering logic
        }
        
        // Sort
        if (params.sortBy) {
          // Implement sorting logic
        }
        
        // Paginate
        const paginatedUsers = filteredUsers.slice(params.offset, params.offset + params.limit);
        
        return Data.struct({
          users: paginatedUsers,
          total: filteredUsers.length,
          offset: params.offset,
          limit: params.limit
        });
      })
    );
  }
  
  searchUsers(params: {
    searchTerm: string;
    searchFields: string[];
    offset: number;
    limit: number;
    filters?: any;
  }): Effect.Effect<UserQueryResults.UserListResult, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Data.struct({
        users: [],
        total: 0,
        offset: params.offset,
        limit: params.limit
      }));
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => {
        const allUsers = Array.from(HashMap.values(state.users));
        
        // Search logic
        const searchResults = allUsers.filter(user => {
          const searchTerm = params.searchTerm.toLowerCase();
          return params.searchFields.some(field => {
            const value = (user as any)[field];
            return value && value.toString().toLowerCase().includes(searchTerm);
          });
        });
        
        // Paginate
        const paginatedUsers = searchResults.slice(params.offset, params.offset + params.limit);
        
        return Data.struct({
          users: paginatedUsers,
          total: searchResults.length,
          offset: params.offset,
          limit: params.limit
        });
      })
    );
  }
  
  getUserStats(params: {
    period: string;
    groupBy?: string;
  }): Effect.Effect<UserQueryResults.UserStatsResult, never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed(Data.struct({
        total: 0,
        active: 0,
        pending: 0,
        suspended: 0,
        deleted: 0,
        verified: 0,
        withTwoFactor: 0,
        newToday: 0,
        newThisWeek: 0,
        newThisMonth: 0,
        byRole: {},
        bySource: {}
      }));
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => Data.struct({
        total: state.stats.total,
        active: state.stats.byStatus.ACTIVE || 0,
        pending: state.stats.byStatus.PENDING || 0,
        suspended: state.stats.byStatus.SUSPENDED || 0,
        deleted: state.stats.byStatus.DELETED || 0,
        verified: state.stats.verified,
        withTwoFactor: state.stats.withTwoFactor,
        newToday: state.stats.registrations.today,
        newThisWeek: state.stats.registrations.thisWeek,
        newThisMonth: state.stats.registrations.thisMonth,
        byRole: state.stats.byRole,
        bySource: {}
      }))
    );
  }
  
  getUserSessions(userId: UserId, activeOnly: boolean): Effect.Effect<readonly UserQueryResults.UserSessionDTO[], never, never> {
    const projectionProcessor = this.projectionProcessor;
    if (!projectionProcessor) {
      return Effect.succeed([]);
    }
    return pipe(
      projectionProcessor.getState(),
      Effect.map((state) => {
        const sessions = HashMap.get(state.sessions, userId);
        
        if (Option.isNone(sessions)) {
          return [];
        }
        
        if (activeOnly) {
          return sessions.value.filter(s => s.isActive);
        }
        
        return sessions.value;
      })
    );
  }
  
  checkEmailExists(email: string): Effect.Effect<boolean, never, never> {
    return pipe(
      this.getUserByEmail(UserTypes.email(email)),
      Effect.map((result) => Option.isSome(result))
    );
  }
  
  checkUsernameExists(username: string): Effect.Effect<boolean, never, never> {
    return pipe(
      this.getUserByUsername(UserTypes.username(username)),
      Effect.map((result) => Option.isSome(result))
    );
  }
}

// Query context layer
const UserQueryContextLive = Layer.succeed(
  UserQueryContextTag,
  {
    projectionStore: new InMemoryProjectionStore()
  }
);

// Complete user domain layer
export const UserDomainLive = Layer.mergeAll(
  UserCommandContextLive,
  UserQueryContextLive
);

/**
 * User domain service interface
 */
export interface UserDomainService {
  readonly executeCommand: <TResult>(command: any) => Effect.Effect<TResult, any, never>;
  readonly executeQuery: <TResult>(query: any) => Effect.Effect<TResult, any, never>;
  readonly startProjections: () => Effect.Effect<never, Error, never>;
}

/**
 * Create user domain service
 */
export const createUserDomainService = (): Effect.Effect<UserDomainService, never, never> => {
  return pipe(
    UserProjectionProcessor.create('user-projections'),
    Effect.map((projectionProcessor) => {
      const service: UserDomainService = {
      executeCommand: <TResult>(command: any) => {
        const handler = userCommandHandlers.find(h => h.canHandle(command));
        if (!handler) {
          return Effect.fail(new Error(`No handler for command: ${command.type}`));
        }
        return pipe(
          handler.handle(command),
          Effect.provide(UserDomainLive),
          Effect.runPromise
        ) as any;
      },
      
      executeQuery: <TResult>(query: any) => {
        return pipe(
          dispatchUserQuery<TResult>(query),
          Effect.provide(UserDomainLive),
          Effect.runPromise
        ) as any;
      },
      
      startProjections: () => {
        return pipe(
          projectionProcessor.startProcessing(),
          Effect.provide(ProjectionContextLive)
        );
      }
    };
    
    return service;
    })
  );
};

// Import missing types
import * as Option from 'effect/Option';
import * as HashMap from 'effect/HashMap';
import * as Data from 'effect/Data';
import type { UserId, Email, Username } from './core/types';
import { UserTypes } from './core/types';
import type { UserQueryResults } from './application/queries';

// User projection processor layer
const UserProjectionProcessorLive = UserProjectionProcessor.create('user-projections');

// Projection context implementation
const ProjectionContextLive = Layer.succeed(
  ProjectionContextTag,
  {
    eventStore: {
      subscribe: (fromVersion: number) => {
        // In production, this would connect to a real event stream
        return Stream.empty;
      },
      getEvents: (aggregateId: UserId) => {
        return Effect.succeed([]);
      }
    },
    snapshotStore: {
      save: () => Effect.succeed(undefined),
      load: () => Effect.succeed(Option.none())
    }
  }
);

import * as Stream from 'effect/Stream';
import * as Option from 'effect/Option';

/**
 * Initialize the user domain with all dependencies
 */
export async function initializeUserDomain(options?: {
  enableCache?: boolean;
  enableProjections?: boolean;
  enableValidation?: boolean;
}) {
  // Create the complete service layer
  const AppLive = Layer.mergeAll(
    UserCommandContextLive,
    UserQueryContextLive,
    ProjectionContextLive
  );
  
  // Create empty objects to match expected interface
  const repository = {};
  const projections = {};
  const eventStore = new InMemoryStores.InMemoryEventStore();
  const commandBus = {};
  const eventBus = {};
  const queryBus = {};
  const validators = {};
  
  return {
    repository,
    projections,
    eventStore,
    commandBus,
    eventBus,
    queryBus,
    validators,
    commandHandlers: userCommandHandlers,
    queryHandlers: userQueryHandlers,
    stop: async () => {
      // Stop logic here if needed
    }
  };
}