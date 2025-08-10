/**
 * Application Layer: Update Profile Command Handler
 * 
 * Handles the business use case of updating a user's profile information.
 * Updates bio, avatar, location and other profile data.
 */

import type { ICommandResult } from '../../../../framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { UpdateUserProfileCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '../../../../framework/core/command';

/**
 * Update profile command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Update profile command
 * @returns Command result with updated user ID
 */
export async function updateProfileHandler(
  repository: UserRepository,
  command: UpdateUserProfileCommand
): Promise<ICommandResult> {
  // Load existing aggregate
  const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
  
  // Execute domain logic
  aggregate.updateProfile(command.payload);
  
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