/**
 * User Domain: Command Handlers
 * 
 * Handlers that process user commands and generate events.
 */

import type { ICommandHandler, ICommandResult } from '../../../framework/core/command';
import type { UserRepository } from '../aggregates/repository';
import { BrandedTypes } from '../../../framework/core/branded/factories';
import type * as Commands from './types';
import { UserCommandTypes, type UserCommand } from './types';

/**
 * Base result for user commands
 */
interface UserCommandResult extends ICommandResult {
  userId?: string;
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
      // Create new aggregate
      const aggregate = this.repository.createAggregate(command.aggregateId);
      
      // Execute command
      aggregate.create(command.payload);
      
      // Save aggregate (persists events)
      await this.repository.save(aggregate);
      
      return {
        success: true,
        userId: command.aggregateId as string,
        metadata: {
          executionTime: Date.now(),
          version: aggregate.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metadata: {
          executionTime: Date.now(),
        },
      };
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === UserCommandTypes.CreateUser;
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
      // Load aggregate
      const aggregate = await this.repository.get(command.aggregateId);
      if (!aggregate) {
        throw new Error('User not found');
      }
      
      // Execute command
      aggregate.update(command.payload);
      
      // Save aggregate
      await this.repository.save(aggregate);
      
      return {
        success: true,
        userId: command.aggregateId as string,
        metadata: {
          executionTime: Date.now(),
          version: aggregate.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metadata: {
          executionTime: Date.now(),
        },
      };
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === UserCommandTypes.UpdateUser;
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
      // Load aggregate
      const aggregate = await this.repository.get(command.aggregateId);
      if (!aggregate) {
        throw new Error('User not found');
      }
      
      // Execute command
      aggregate.delete(command.payload.reason);
      
      // Save aggregate
      await this.repository.save(aggregate);
      
      return {
        success: true,
        userId: command.aggregateId as string,
        metadata: {
          executionTime: Date.now(),
          version: aggregate.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metadata: {
          executionTime: Date.now(),
        },
      };
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === UserCommandTypes.DeleteUser;
  }
}

/**
 * Verify email command handler
 */
export class VerifyUserEmailCommandHandler implements ICommandHandler<
  Commands.VerifyUserEmailCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.VerifyUserEmailCommand): Promise<UserCommandResult> {
    try {
      // Load aggregate
      const aggregate = await this.repository.get(command.aggregateId);
      if (!aggregate) {
        throw new Error('User not found');
      }
      
      // TODO: Verify token
      // In production, validate the verification token
      
      // Execute command
      aggregate.verifyEmail();
      
      // Save aggregate
      await this.repository.save(aggregate);
      
      return {
        success: true,
        userId: command.aggregateId as string,
        metadata: {
          executionTime: Date.now(),
          version: aggregate.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metadata: {
          executionTime: Date.now(),
        },
      };
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === UserCommandTypes.VerifyUserEmail;
  }
}

/**
 * Update profile command handler
 */
export class UpdateUserProfileCommandHandler implements ICommandHandler<
  Commands.UpdateUserProfileCommand,
  UserCommandResult
> {
  constructor(private readonly repository: UserRepository) {}

  async handle(command: Commands.UpdateUserProfileCommand): Promise<UserCommandResult> {
    try {
      // Load aggregate
      const aggregate = await this.repository.get(command.aggregateId);
      if (!aggregate) {
        throw new Error('User not found');
      }
      
      // Execute command
      aggregate.updateProfile(command.payload);
      
      // Save aggregate
      await this.repository.save(aggregate);
      
      return {
        success: true,
        userId: command.aggregateId as string,
        metadata: {
          executionTime: Date.now(),
          version: aggregate.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        metadata: {
          executionTime: Date.now(),
        },
      };
    }
  }

  canHandle(command: Commands.UserCommand): boolean {
    return command.type === UserCommandTypes.UpdateUserProfile;
  }
}

/**
 * Register all user command handlers
 */
export function registerUserCommandHandlers(
  commandBus: { registerWithType?: (type: string, handler: ICommandHandler<UserCommand>) => void; register: (handler: ICommandHandler<UserCommand>) => void },
  repository: UserRepository
): void {
  const handlers = [
    { type: UserCommandTypes.CreateUser, handler: new CreateUserCommandHandler(repository) },
    { type: UserCommandTypes.UpdateUser, handler: new UpdateUserCommandHandler(repository) },
    { type: UserCommandTypes.DeleteUser, handler: new DeleteUserCommandHandler(repository) },
    { type: UserCommandTypes.VerifyUserEmail, handler: new VerifyUserEmailCommandHandler(repository) },
    { type: UserCommandTypes.UpdateUserProfile, handler: new UpdateUserProfileCommandHandler(repository) },
  ];

  handlers.forEach(({ type, handler }) => {
    // Register with command bus using the framework's registration helper
    commandBus.registerWithType?.(type, handler) || commandBus.register(handler);
  });
}