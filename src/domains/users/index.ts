/**
 * User Domain Module
 * 
 * Best-in-class domain module for user management with CQRS/Event Sourcing.
 * This serves as a comprehensive template for implementing new domains.
 */

import type { IDomainModule } from '../../framework/core/types';

// Public API exports (domain-only)
export * from './events/types';
export * from './events/factories';
export * from './aggregates/user';
export * from './aggregates/repository';
export * from './commands/types';
export * from './queries/types';
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