/**
 * Application Layer: Create User Command Handler
 * 
 * Handles the business use case of creating a new user.
 * Orchestrates domain logic and infrastructure concerns.
 */

import type { ICommandResult } from '../../../../framework/core/command';
import type { UserRepository } from '../../infrastructure/persistence/user.repository';
import type { CreateUserCommand } from '../../domain/user.commands';
import { makeCommandSuccess } from '../../../../framework/core/command';

/**
 * Create user command handler
 * 
 * @param repository - User repository for persistence
 * @param command - Create user command
 * @returns Command result with created user ID
 */
export async function createUserHandler(
  repository: UserRepository,
  command: CreateUserCommand
): Promise<ICommandResult> {
  // Create new aggregate
  const aggregate = repository.createAggregate(command.aggregateId);
  
  // Execute domain logic
  aggregate.create(command.payload);
  
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