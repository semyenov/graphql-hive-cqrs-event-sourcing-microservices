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
import { UserCommandTypes, type UserCommand } from './commands/types';
import { createUserProjection } from './projections/user.projection';
import { createUserListProjection } from './projections/user-list.projection';
import { createUserStatsProjection } from './projections/user-stats.projection';
import { createUserCommandValidators } from './validators/command.validators';
import type { ICommandValidator } from '../../framework/core/command';
import type { UserEvent } from './events/types';
import { registerUserCommandHandlersWithPattern } from './commands/handlers';
import { registerUserQueryHandlersWithPattern } from './queries/handlers';
import { registerUserEventHandlers } from './events/handlers';

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
  commandBus: CommandBus;
  queryBus: QueryBus;
  eventBus: EventBus<UserEvent>;
  eventStore: IEventStore<UserEvent>;
  projections: {
    userProjection: ReturnType<typeof createUserProjection>;
    userListProjection: ReturnType<typeof createUserListProjection>;
    userStatsProjection: ReturnType<typeof createUserStatsProjection>;
  };
  validators: ReturnType<typeof createUserCommandValidators>;
}

/**
 * Initialize user domain with all components
 * 
 * @example
 * const { commandBus, queryBus, repository } = initializeUserDomain({
 *   enableCache: true,
 *   enableProjections: true,
 * });
 */
export function initializeUserDomain(
  config: UserDomainConfig = {}
): UserDomainContext {
  // Create or use provided event store
  const eventStore = config.eventStore || createEventStore<UserEvent>();
  
  // Create infrastructure
  const commandBus = createCommandBus();
  const queryBus = createQueryBus(config.enableCache);
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
  registerUserCommandHandlersWithPattern(commandBus, repository);
  
  // Register query handlers
  if (config.enableProjections !== false) {
    registerUserQueryHandlersWithPattern(queryBus, projections.userProjection);
  }
  
  // Register event handlers
  registerUserEventHandlers(eventBus, projections);
  
  // Add command validation middleware if enabled
  if (config.enableValidation !== false) {
    const validatorMap = new Map<string, ICommandValidator<UserCommand>>([
      [UserCommandTypes.CreateUser, validators.createUser],
      [UserCommandTypes.UpdateUser, validators.updateUser],
      [UserCommandTypes.DeleteUser, validators.deleteUser],
      [UserCommandTypes.VerifyUserEmail, validators.verifyEmail],
      [UserCommandTypes.UpdateUserProfile, validators.updateProfile],
    ]);

    commandBus.use({
      async execute(command, next) {
        // Validate command based on type
        const validator = validatorMap.get(command.type);
        if (validator) {
          const result = await validator.validate(command as UserCommand);
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
    eventStore,
    projections,
    validators,
  };
} 