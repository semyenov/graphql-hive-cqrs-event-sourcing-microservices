/**
 * User Domain Module
 * 
 * Best-in-class domain module for user management with CQRS/Event Sourcing.
 * This serves as a comprehensive template for implementing new domains.
 */

import type { IDomainModule } from '../../framework/core/types';
import type { IEventStore } from '../../framework/core/event';
import { 
  createCommandBus, 
  createEventBus, 
  createQueryBus,
  type CommandBus, 
  type EventBus, 
  type QueryBus 
} from '../../framework/infrastructure/bus';
import { createEventStore } from '../../framework/infrastructure/event-store/memory';

// Domain components
import { UserRepository, createUserRepository } from './aggregates/repository';
import { registerUserCommandHandlers } from './commands/handlers';
import { UserCommandTypes, type UserCommand } from './commands/types';
import { registerUserQueryHandlers } from './queries/handlers';
import type { UserQuery } from './queries/types';
import { registerUserEventHandlers } from './events/handlers';
import { createUserProjection } from './projections/user.projection';
import { createUserListProjection } from './projections/user-list.projection';
import { createUserStatsProjection } from './projections/user-stats.projection';
import { createUserCommandValidators } from './validators/command.validators';
import type { ICommandValidator } from '../../framework/core/command';
import type { UserEvent } from './events/types';

// Public API exports
export * from './events/types';
export * from './events/factories';
export * from './events/handlers';
export * from './aggregates/user';
export * from './aggregates/repository';
export * from './commands/types';
export * from './commands/handlers';
export * from './queries/types';
export * from './queries/handlers';
export * from './queries/specifications';
export * from './validators/command.validators';
export * from './projections/user.projection';
export * from './projections/user-list.projection';
export * from './projections/user-stats.projection';

// Convenience re-exports
export { UserAggregate, type UserState } from './aggregates/user';
export { UserRepository, createUserRepository } from './aggregates/repository';
export { UserEventFactories } from './events/factories';
export { UserEventTypes, type UserEvent } from './events/types';
export { UserCommandTypes, type UserCommand } from './commands/types';
export { UserQueryTypes, type UserQuery } from './queries/types';
export { UserSpecifications, filterBySpecification } from './queries/specifications';

/**
 * User domain configuration
 */
export interface UserDomainConfig {
  eventStore?: IEventStore<UserEvent>;
  enableCache?: boolean;
  enableValidation?: boolean;
  enableProjections?: boolean;
}

/**
 * User domain context with all components
 */
export interface UserDomainContext {
  repository: UserRepository;
  commandBus: CommandBus<UserCommand>;
  queryBus: QueryBus<UserQuery>;
  eventBus: EventBus<UserEvent>;
  projections: {
    userProjection: ReturnType<typeof createUserProjection>;
    userListProjection: ReturnType<typeof createUserListProjection>;
    userStatsProjection: ReturnType<typeof createUserStatsProjection>;
  };
  validators: ReturnType<typeof createUserCommandValidators>;
}

/**
 * User domain module definition
 */
export const UserDomainModule: IDomainModule = {
  name: 'users',
  version: '1.0.0',
  
  async initialize() {
    console.log('[UserDomain] Module initialized');
  },
  
  async shutdown() {
    console.log('[UserDomain] Module shut down');
  },
};

/**
 * Initialize user domain with all components
 */
export function initializeUserDomain(
  config: UserDomainConfig = {}
): UserDomainContext {
  // Create or use provided event store
  const eventStore = config.eventStore || createEventStore<UserEvent>();
  
  // Create infrastructure with proper typing
  const commandBus = createCommandBus<UserCommand>();
  const queryBus = createQueryBus<UserQuery>(config.enableCache);
  const eventBus = createEventBus<UserEvent>();
  
  // Create repository
  const repository = createUserRepository(eventStore);
  
  // Create projections
  const projections = {
    userProjection: createUserProjection(),
    userListProjection: createUserListProjection(),
    userStatsProjection: createUserStatsProjection(),
  };
  
  // Create validators
  const validators = createUserCommandValidators();
  
  // Register command handlers
  registerUserCommandHandlers(commandBus, repository);
  
  // Register query handlers
  if (config.enableProjections !== false) {
    registerUserQueryHandlers(queryBus, projections.userProjection);
  }
  
  // Register event handlers
  registerUserEventHandlers(eventBus, projections);
  
  // Add command validation middleware if enabled
  if (config.enableValidation !== false) {
    const validatorMap = new Map<string, ICommandValidator<UserCommand>>([
      [UserCommandTypes.CreateUser, validators.createUser as ICommandValidator<UserCommand>],
      [UserCommandTypes.UpdateUser, validators.updateUser as ICommandValidator<UserCommand>],
      [UserCommandTypes.DeleteUser, validators.deleteUser as ICommandValidator<UserCommand>],
      [UserCommandTypes.VerifyUserEmail, validators.verifyEmail as ICommandValidator<UserCommand>],
      [UserCommandTypes.UpdateUserProfile, validators.updateProfile as ICommandValidator<UserCommand>],
    ]);

    commandBus.use({
      async execute(command, next) {
        // Check if this command type has a validator
        if (validatorMap.has(command.type)) {
          const validator = validatorMap.get(command.type)!;
          const result = await validator.validate(command as unknown as UserCommand);
          if (!result.isValid) {
            throw new Error(`Validation failed: ${JSON.stringify(result.errors)}`);
          }
        }
        return next(command);
      },
    });
  }
  
  return {
    repository,
    commandBus,
    queryBus,
    eventBus,
    projections,
    validators,
  };
}

/**
 * GraphQL schema for user domain
 */
export const userGraphQLSchema = `
  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    deleted: Boolean!
    createdAt: String!
    updatedAt: String!
    profile: UserProfile
  }

  type UserProfile {
    bio: String
    avatar: String
    location: String
  }

  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    deletedUsers: Int!
    verifiedEmails: Int!
    createdToday: Int!
  }

  input CreateUserInput {
    name: String!
    email: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  input UpdateUserProfileInput {
    bio: String
    avatar: String
    location: String
  }

  input UserSearchInput {
    searchTerm: String!
    fields: [String!]
  }

  input PaginationInput {
    offset: Int!
    limit: Int!
    sortBy: String
    sortOrder: String
  }

  type UserMutationResponse {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type UserListResponse {
    users: [User!]!
    total: Int!
    hasNext: Boolean!
  }

  type Error {
    field: String!
    message: String!
    code: String
  }

  extend type Query {
    # Get single user by ID
    user(id: ID!): User
    
    # Get user by email
    userByEmail(email: String!): User
    
    # List users with pagination
    users(pagination: PaginationInput!, includeDeleted: Boolean): UserListResponse!
    
    # Search users
    searchUsers(input: UserSearchInput!): [User!]!
    
    # Get user statistics
    userStats: UserStats!
  }

  extend type Mutation {
    # Create a new user
    createUser(input: CreateUserInput!): UserMutationResponse!
    
    # Update user details
    updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    
    # Delete user (soft delete)
    deleteUser(id: ID!, reason: String): UserMutationResponse!
    
    # Verify user email
    verifyUserEmail(id: ID!, token: String!): UserMutationResponse!
    
    # Update user profile
    updateUserProfile(id: ID!, input: UpdateUserProfileInput!): UserMutationResponse!
  }
`;