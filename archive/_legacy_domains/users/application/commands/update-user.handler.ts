/**
 * Application Layer: Update User Command Handler
 * 
 * Handles the business use case of updating user information.
 * Retrieves existing user, applies changes, and persists updates.
 */

import type { ICommandResult } from '@cqrs/framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { UpdateUserCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '@cqrs/framework/core/command';

/**
 * Update user command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Update user command
 * @returns Command result with updated user ID
 */
export async function updateUserHandler(
  repository: UserRepository,
  command: UpdateUserCommand
): Promise<ICommandResult> {
  // Load existing aggregate
  const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
  
  // Execute domain logic
  aggregate.update(command.payload);
  
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