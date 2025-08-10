/**
 * User Domain: Command Handlers
 * 
 * Handlers that process user commands and generate events.
 */

import type { ICommandHandler, ICommandResult } from '../../../framework/core/command';
import type { UserRepository } from '../aggregates/repository';
import type * as Commands from './types';
import { UserCommandTypes, type UserCommand } from './types';
import { registerCommandPattern } from '../../../framework/infrastructure/bus/command-bus';
import { makeCommandSuccess } from '../../../framework';
import { AggregateNotFoundError } from '../../../framework/core/errors';

/**
 * Register all user command handlers with pattern-based registration
 */
export function registerUserCommandHandlersWithPattern(
  commandBus: Parameters<typeof registerCommandPattern<UserCommand, ICommandResult>>[0],
  repository: UserRepository
): void {
  const pattern = {
    [UserCommandTypes.CreateUser]: async (command: Commands.CreateUserCommand) => {
      const aggregate = repository.createAggregate(command.aggregateId);
      aggregate.create(command.payload);
      await repository.save(aggregate);
      return makeCommandSuccess({ userId: command.aggregateId as string }, { executionTime: Date.now(), version: aggregate.version });
    },
    [UserCommandTypes.UpdateUser]: async (command: Commands.UpdateUserCommand) => {
      const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
      aggregate.update(command.payload);
      await repository.save(aggregate);
      return makeCommandSuccess({ userId: command.aggregateId as string }, { executionTime: Date.now(), version: aggregate.version });
    },
    [UserCommandTypes.DeleteUser]: async (command: Commands.DeleteUserCommand) => {
      const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
      aggregate.delete(command.payload.reason);
      await repository.save(aggregate);
      return makeCommandSuccess({ userId: command.aggregateId as string }, { executionTime: Date.now(), version: aggregate.version });
    },
    [UserCommandTypes.VerifyUserEmail]: async (command: Commands.VerifyUserEmailCommand) => {
      const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
      aggregate.verifyEmail();
      await repository.save(aggregate);
      return makeCommandSuccess({ userId: command.aggregateId as string }, { executionTime: Date.now(), version: aggregate.version });
    },
    [UserCommandTypes.UpdateUserProfile]: async (command: Commands.UpdateUserProfileCommand) => {
      const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
      aggregate.updateProfile(command.payload);
      await repository.save(aggregate);
      return makeCommandSuccess({ userId: command.aggregateId as string }, { executionTime: Date.now(), version: aggregate.version });
    },
  } as const;

  registerCommandPattern(commandBus as any, pattern as any);
}