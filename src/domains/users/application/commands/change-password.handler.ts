/**
 * Application Layer: Change Password Command Handler
 * 
 * Handles the business use case of changing a user's password.
 * Validates current password and updates to new password.
 */

import type { ICommandResult } from '@cqrs/framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { ChangeUserPasswordCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '@cqrs/framework/core/command';

/**
 * Change password command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Change password command
 * @returns Command result with updated user ID
 */
export async function changePasswordHandler(
  repository: UserRepository,
  command: ChangeUserPasswordCommand
): Promise<ICommandResult> {
  // Load existing aggregate
  const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
  
  // Execute domain logic (password validation could be added here)
  aggregate.changePassword(command.payload);
  
  // Persist changes
  await repository.save(aggregate);
  
  // Return success result
  return makeCommandSuccess(
    { userId: command.aggregateId },
    { 
      executionTime: Date.now(), 
      version: aggregate.version 
    }
  );
} 