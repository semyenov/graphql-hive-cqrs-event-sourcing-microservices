/**
 * User Domain Module
 * 
 * Domain module for user management with event sourcing.
 */

import type { IDomainModule } from '../../framework/core/types';
import type { InMemoryEventStore } from '../../framework/infrastructure/event-store/memory';
import type { CommandBus, QueryBus } from '../../framework/infrastructure/bus';
import { UserRepository } from './aggregates/repository';
import type { UserEvent } from './events/types';

// Export domain components
export * from './events/types';
export * from './events/factories';
export * from './aggregates/user';
export * from './aggregates/repository';
export * from './commands/types';
export * from './commands/handlers';

// Convenience exports
export { UserAggregate } from './aggregates/user';
export { UserRepository, createUserRepository } from './aggregates/repository';
export { UserEventFactories } from './events/factories';
export { UserEventTypes, type UserEvent } from './events/types';
export { UserCommandTypes, type UserCommand } from './commands/types';

/**
 * User domain module definition
 */
export const UserDomainModule: IDomainModule = {
  name: 'users',
  version: '1.0.0',
  
  async initialize() {
    console.log('User domain module initialized');
  },
  
  async shutdown() {
    console.log('User domain module shut down');
  },
};

/**
 * GraphQL schema for user domain
 */
export const userGraphQLSchema = `
  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    createdAt: String!
    updatedAt: String!
    profile: UserProfile
  }

  type UserProfile {
    bio: String
    avatar: String
    location: String
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

  type UserMutationResponse {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type Error {
    message: String!
    code: String
  }

  extend type Query {
    user(id: ID!): User
    users: [User!]!
    userByEmail(email: String!): User
  }

  extend type Mutation {
    createUser(input: CreateUserInput!): UserMutationResponse!
    updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    deleteUser(id: ID!, reason: String): UserMutationResponse!
    verifyUserEmail(id: ID!, token: String!): UserMutationResponse!
    updateUserProfile(id: ID!, input: UpdateUserProfileInput!): UserMutationResponse!
  }
`;

/**
 * Register user domain with framework
 */
export function registerUserDomain(
  eventStore: InMemoryEventStore<UserEvent>,
  commandBus: CommandBus,
  queryBus: QueryBus
) {
  // Create repository
  const repository = new UserRepository(eventStore);
  
  // Register command handlers
  // registerUserCommandHandlers(commandBus, repository);
  
  // Register query handlers
  // TODO: Implement query handlers
  
  return {
    repository,
    module: UserDomainModule,
  };
}