/**
 * User Domain Module
 * 
 * Best-in-class domain module for user management with CQRS/Event Sourcing.
 * This serves as a comprehensive template for implementing new domains.
 */

import type { IDomainModule } from '../../framework/core/types';
import type { IEventStore, IEventBus, ICommandBus, IQueryBus } from '../../framework/core';
import { 
  createCommandBus, 
  createEventBus, 
  createQueryBus,
  createEventStore,
  type CommandBus, 
  type EventBus, 
  type QueryBus 
} from '../../framework';

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
export type { UserListItem } from './projections/user-list.projection';
export type { UserStats } from './projections/user-stats.projection';

// Convenience re-exports
export { UserAggregate, type UserState } from './aggregates/user';
export { UserRepository, createUserRepository } from './aggregates/repository';
export { UserEventFactories } from './events/factories';
export { UserEventTypes, type UserEvent } from './events/types';
export { UserCommandTypes, type UserCommand } from './commands/types';
export { UserQueryTypes, type UserQuery } from './queries/types';
export { UserFilters, combineFilters, filterUsers } from './queries/specifications';

/**
 * User domain configuration
 */
export interface UserDomainConfig {
  eventStore?: IEventStore<UserEvent>;
  enableCache?: boolean;
  enableValidation?: boolean;
  enableProjections?: boolean;
  enableEventReplay?: boolean;
  enableSnapshotting?: boolean;
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
  eventStore: IEventStore<UserEvent>;
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
  
  // Create repository with event bus integration
  const repository = createUserRepository(eventStore, eventBus);
  
  // Create projections with enhanced builders
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
    registerUserQueryHandlers(queryBus, projections);
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

  // Repository now handles event publishing automatically!
  // No need for complex event publishing middleware
  
  return {
    repository,
    commandBus,
    queryBus,
    eventBus,
    projections,
    validators,
    eventStore,
  };
}

// Re-export GraphQL schema
export { userGraphQLSchema } from './schema.graphql';