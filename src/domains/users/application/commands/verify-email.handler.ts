/**
 * Application Layer: Verify Email Command Handler
 * 
 * Handles the business use case of verifying a user's email address.
 * Confirms email ownership and updates verification status.
 */

import type { ICommandResult } from '@cqrs/framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { VerifyUserEmailCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '@cqrs/framework/core/command';

/**
 * Verify email command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Verify email command
 * @returns Command result with verified user ID
 */
export async function verifyEmailHandler(
  repository: UserRepository,
  command: VerifyUserEmailCommand
): Promise<ICommandResult> {
  // Load existing aggregate
  const aggregate = await repository.getOrThrow(command.aggregateId, 'User not found');
  
  // Execute domain logic (token validation could be added here)
  aggregate.verifyEmail(command.payload);
  
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