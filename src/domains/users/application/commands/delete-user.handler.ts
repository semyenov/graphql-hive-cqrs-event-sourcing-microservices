/**
 * Application Layer: Delete User Command Handler
 * 
 * Handles the business use case of deleting a user from the system.
 * Marks user as deleted while preserving audit trail.
 */

import type { ICommandResult } from '../../../../framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { DeleteUserCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '../../../../framework/core/command';

/**
 * Delete user command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Delete user command
 * @returns Command result with deleted user ID
 */
export async function deleteUserHandler(
  repository: UserRepository,
  command: DeleteUserCommand
): Promise<ICommandResult> {
  // Load existing aggregate
  const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
  
  // Execute domain logic
  aggregate.delete(command.payload.reason);
  
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