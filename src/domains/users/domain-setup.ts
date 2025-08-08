/**
 * User Domain: Simplified Setup with Convention-Based Registration
 * 
 * Demonstrates how the new convention-based system dramatically reduces boilerplate.
 */

import {
  createCommandBus,
  createEventBus,
  createQueryBus,
  createEventStore,
} from '../../framework';
import { createDomainBuilder } from '../../framework/core/domain-registry';
import type { UserEvent, UserCommand, UserQuery } from './index';
import { createUserRepository } from './aggregates/repository';
import {
  CreateUserCommandHandler,
  UpdateUserCommandHandler,
  DeleteUserCommandHandler,
  VerifyUserEmailCommandHandler,
  UpdateUserProfileCommandHandler,
} from './commands/handlers';
import {
  GetUserByIdQueryHandler,
  GetUserByEmailQueryHandler,
  ListUsersQueryHandler,
  SearchUsersQueryHandler,
  GetUserStatsQueryHandler,
} from './queries/handlers';
import { createUserProjection } from './projections/user.projection';
import { createUserListProjection } from './projections/user-list.projection';
import { createUserStatsProjection } from './projections/user-stats.projection';
import { registerUserEventHandlers } from './events/handlers';

/**
 * Initialize user domain with convention-based registration (< 30 lines!)
 */
export function initializeUserDomainV2(config: any = {}) {
  // 1. Create infrastructure
  const eventStore = createEventStore<UserEvent>();
  const commandBus = createCommandBus<UserCommand>();
  const queryBus = createQueryBus<UserQuery>(config.enableCache);
  const eventBus = createEventBus<UserEvent>();
  
  // 2. Create repository with auto event publishing
  const repository = createUserRepository(eventStore, eventBus);
  
  // 3. Create projections
  const projections = {
    userProjection: createUserProjection(),
    userListProjection: createUserListProjection(),
    userStatsProjection: createUserStatsProjection(),
  };

  // 4. Convention-based registration (THE MAGIC!)
  const domain = createDomainBuilder<UserEvent, UserCommand, UserQuery>()
    .withCommandHandlers({
      // Convention: handler name -> command type (createUserHandler -> CREATE_USER)
      createUserHandler: new CreateUserCommandHandler(repository),
      updateUserHandler: new UpdateUserCommandHandler(repository),
      deleteUserHandler: new DeleteUserCommandHandler(repository),
      verifyUserEmailHandler: new VerifyUserEmailCommandHandler(repository),
      updateUserProfileHandler: new UpdateUserProfileCommandHandler(repository),
    })
    .withQueryHandlers({
      // Convention: handler name -> query type (getUserByIdHandler -> GET_USER_BY_ID)
      getUserByIdHandler: new GetUserByIdQueryHandler(projections.userProjection),
      getUserByEmailHandler: new GetUserByEmailQueryHandler(projections.userProjection),
      listUsersHandler: new ListUsersQueryHandler(projections.userProjection),
      searchUsersHandler: new SearchUsersQueryHandler(projections.userProjection),
      getUserStatsHandler: new GetUserStatsQueryHandler(projections.userProjection),
    })
    .withProjections(projections)
    .build({ eventStore, commandBus, queryBus, eventBus, repository });

  // 5. Register event handlers for projections
  registerUserEventHandlers(eventBus, projections);

  return {
    repository,
    commandBus,
    queryBus,
    eventBus,
    projections,
    eventStore,
    domain, // New domain components registry
  };
}