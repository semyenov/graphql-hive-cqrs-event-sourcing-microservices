/**
 * User Domain Module
 * 
 * Main module that bootstraps and configures all user domain components
 * using the new layered architecture.
 */

import type { IEventStore } from '@cqrs/framework/core/event';
import { bootstrapFramework } from '@cqrs/framework';
import type { CommandBus, EventBus, QueryBus } from '@cqrs/framework/infrastructure/bus';
import { createEventStore } from '@cqrs/framework/infrastructure/event-store/memory';

// Domain layer
import { UserEventTypes } from './domain/user.events';
import type { UserEvent } from './domain/user.events';
import type { UserCommand } from './domain/user.commands';

// Application layer
import * as CommandHandlers from './application/commands';
import * as QueryHandlers from './application/queries';

// Infrastructure layer
import {
  UserRepository,
  createUserRepository,
  createUserDetailsProjection,
  createUserListProjection,
  createUserStatsProjection,
  createCreateUserValidator,
  createUpdateUserValidator,
  ProjectionEventHandler,
  EmailNotificationHandler,
  registerUserEventHandlers,
} from './infrastructure';

// API layer
import { userGraphQLSchema } from './api';

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
    userDetailsProjection: ReturnType<typeof createUserDetailsProjection>;
    userListProjection: ReturnType<typeof createUserListProjection>;
    userStatsProjection: ReturnType<typeof createUserStatsProjection>;
  };
  validators: {
    createUserValidator: ReturnType<typeof createCreateUserValidator>;
    updateUserValidator: ReturnType<typeof createUpdateUserValidator>;
  };
  handlers: {
    commands: typeof CommandHandlers;
    queries: typeof QueryHandlers;
  };
  schema: string;
}

/**
 * Initialize user domain with all components
 */
export async function initializeUserDomain(
  config: UserDomainConfig = {}
): Promise<UserDomainContext> {
  
  // Initialize framework
  const framework = await bootstrapFramework<UserEvent>();
  const { commandBus, queryBus, eventBus } = framework;

  // Initialize event store
  const eventStore = config.eventStore || createEventStore<UserEvent>();

  // Initialize repository  
  const repository = createUserRepository(eventStore, eventBus);

  // Initialize projections
  const userDetailsProjection = createUserDetailsProjection();
  const userListProjection = createUserListProjection();
  const userStatsProjection = createUserStatsProjection();

  // Initialize validators
  const createUserValidator = createCreateUserValidator();
  const updateUserValidator = createUpdateUserValidator();

  // Initialize event handlers
  const projectionHandler = new ProjectionEventHandler(
    userDetailsProjection,
    userListProjection,
    userStatsProjection
  );

  const emailHandler = new EmailNotificationHandler();

  // Register event handlers
  registerUserEventHandlers(eventBus, projectionHandler, emailHandler);

  // Note: Command and query handler registration would be done differently
  // in a real implementation, but simplified for this migration

  return {
    repository,
    commandBus,
    queryBus,
    eventBus,
    eventStore,
    projections: {
      userDetailsProjection,
      userListProjection,
      userStatsProjection,
    },
    validators: {
      createUserValidator,
      updateUserValidator,
    },
    handlers: {
      commands: CommandHandlers,
      queries: QueryHandlers,
    },
    schema: userGraphQLSchema,
  };
}

// Command and query handler registration would be implemented
// based on the specific framework requirements

/**
 * Create a configured user domain instance
 */
export async function createUserDomain(config?: UserDomainConfig): Promise<UserDomainContext> {
  return initializeUserDomain(config);
} 