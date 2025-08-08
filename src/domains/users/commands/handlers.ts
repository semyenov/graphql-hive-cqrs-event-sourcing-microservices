/**
 * User Domain: Command Handlers
 * 
 * Command handlers for user domain operations.
 */

import type { ICommandHandler, ICommandResult } from '../../../framework/core/command';
import { success, failure } from '../../../framework/core/helpers';
import type { UserRepository } from '../aggregates/repository';
import type { UserAggregate } from '../aggregates/user';
import * as Commands from './types';

/**
 * Extended command result with user-specific data
 */
interface UserCommandResult extends ICommandResult {
  userId?: string;
  user?: any;
}

/**
 * Create user command handler
 */
export class CreateUserCommandHandler implements ICommandHandler<
  Commands.CreateUserCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.CreateUserCommand): Promise<UserCommandResult> {
    try {
      const user = this.repository.createAggregate(command.aggregateId);
      
      user.create(command.payload);
      
      // Repository automatically publishes events to event bus!
      await this.repository.save(user);
      
      return success({
        userId: command.aggregateId as string,
        user: user.getUser(),
      });
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Failed to create user'));
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === Commands.UserCommandTypes.CreateUser;
  }
}

/**
 * Update user command handler
 */
export class UpdateUserCommandHandler implements ICommandHandler<
  Commands.UpdateUserCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.UpdateUserCommand): Promise<UserCommandResult> {
    try {
      const user = await this.repository.get(command.aggregateId);
      
      if (!user) {
        return failure(new Error('User not found'));
      }

      user.update(command.payload);
      
      // Repository automatically publishes events to event bus!
      await this.repository.save(user);
      
      return success({
        userId: command.aggregateId as string,
        user: user.getUser(),
      });
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Failed to update user'));
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === Commands.UserCommandTypes.UpdateUser;
  }
}

/**
 * Delete user command handler
 */
export class DeleteUserCommandHandler implements ICommandHandler<
  Commands.DeleteUserCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.DeleteUserCommand): Promise<UserCommandResult> {
    try {
      const user = await this.repository.get(command.aggregateId);
      
      if (!user) {
        return failure(new Error('User not found'));
      }

      user.delete(command.payload.reason);
      
      // Repository automatically publishes events to event bus!
      await this.repository.save(user);
      
      return success({
        userId: command.aggregateId as string,
        user: user.getUser(),
      });
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Failed to delete user'));
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === Commands.UserCommandTypes.DeleteUser;
  }
}

/**
 * Verify user email command handler
 */
export class VerifyUserEmailCommandHandler implements ICommandHandler<
  Commands.VerifyUserEmailCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.VerifyUserEmailCommand): Promise<UserCommandResult> {
    try {
      const user = await this.repository.get(command.aggregateId);
      
      if (!user) {
        return failure(new Error('User not found'));
      }

      // In a real application, you would validate the token here
      // For now, we'll just verify the email
      user.verifyEmail();
      
      // Repository automatically publishes events to event bus!
      await this.repository.save(user);
      
      return success({
        userId: command.aggregateId as string,
        user: user.getUser(),
      });
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Failed to verify user email'));
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === Commands.UserCommandTypes.VerifyUserEmail;
  }
}

/**
 * Update user profile command handler
 */
export class UpdateUserProfileCommandHandler implements ICommandHandler<
  Commands.UpdateUserProfileCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.UpdateUserProfileCommand): Promise<UserCommandResult> {
    try {
      const user = await this.repository.get(command.aggregateId);
      
      if (!user) {
        return failure(new Error('User not found'));
      }

      user.updateProfile(command.payload);
      
      // Repository automatically publishes events to event bus!
      await this.repository.save(user);
      
      return success({
        userId: command.aggregateId as string,
        user: user.getUser(),
      });
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Failed to update user profile'));
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === Commands.UserCommandTypes.UpdateUserProfile;
  }
}

/**
 * Register all user command handlers
 */
export function registerUserCommandHandlers(
  commandBus: any, // Using any temporarily to access registerWithType
  repository: UserRepository
): void {
  // Use registerWithType for explicit command type registration
  commandBus.registerWithType(Commands.UserCommandTypes.CreateUser, new CreateUserCommandHandler(repository));
  commandBus.registerWithType(Commands.UserCommandTypes.UpdateUser, new UpdateUserCommandHandler(repository));
  commandBus.registerWithType(Commands.UserCommandTypes.DeleteUser, new DeleteUserCommandHandler(repository));
  commandBus.registerWithType(Commands.UserCommandTypes.VerifyUserEmail, new VerifyUserEmailCommandHandler(repository));
  commandBus.registerWithType(Commands.UserCommandTypes.UpdateUserProfile, new UpdateUserProfileCommandHandler(repository));
}