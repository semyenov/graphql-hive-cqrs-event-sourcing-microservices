/**
 * User Domain Module
 * 
 * Best-in-class domain module for user management with CQRS/Event Sourcing.
 * This serves as a comprehensive template for implementing new domains.
 */

import type { IDomainModule } from '../../framework/core/types';

// Barrel exports for users domain – import ONLY from this file in other modules

// Branded helpers
export * from './helpers/types';
export { UserBrandedTypes } from './helpers/factories';
export { UserBrandedTypeGuards } from './helpers/guards';

// Core domain contracts
export * from './commands/types';
export * from './queries/types';
export * from './events/types';

// Aggregate + repository
export { UserAggregate } from './aggregates/user';
export { createUserRepository, UserRepository } from './aggregates/repository';

// GraphQL schema
export { userGraphQLSchema } from './user.schema';

// Setup/bootstrap
export { initializeUserDomain } from './user.setup';

// Event handler helpers
export { buildUserEventHandlers, registerUserEventHandlers } from './events/handlers';

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