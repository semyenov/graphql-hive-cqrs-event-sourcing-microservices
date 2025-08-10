/**
 * Infrastructure Layer: Command Validators
 * 
 * Validation logic for user commands using framework interfaces.
 * Ensures data integrity and business rule compliance.
 */

import type { 
  ICommandValidator, 
  ValidationResult, 
  ValidationError 
} from '../../../../framework/core/command';
import type { CreateUserCommand, UpdateUserCommand } from '../../domain/user.commands';
import { BrandedTypes } from '../../../../framework/core/branded/factories';

/**
 * Validator for CreateUser command
 */
export class CreateUserCommandValidator implements ICommandValidator<CreateUserCommand> {
  async validate(command: CreateUserCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Validate name
    if (!command.payload.name || command.payload.name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Name must be at least 2 characters long',
        code: 'NAME_TOO_SHORT'
      });
    }
    
    if (command.payload.name && command.payload.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Name must not exceed 100 characters',
        code: 'NAME_TOO_LONG'
      });
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!command.payload.email || !emailRegex.test(command.payload.email)) {
      errors.push({
        field: 'email',
        message: 'Valid email address is required',
        code: 'INVALID_EMAIL'
      });
    }
    
    if (command.payload.email && command.payload.email.length > 254) {
      errors.push({
        field: 'email',
        message: 'Email address must not exceed 254 characters',
        code: 'EMAIL_TOO_LONG'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Validator for UpdateUser command
 */
export class UpdateUserCommandValidator implements ICommandValidator<UpdateUserCommand> {
  async validate(command: UpdateUserCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check if at least one field is provided
    if (!command.payload.name && !command.payload.email) {
      errors.push({
        field: 'payload',
        message: 'At least one field must be provided for update',
        code: 'NO_UPDATE_FIELDS'
      });
    }
    
    // Validate name if provided
    if (command.payload.name !== undefined) {
      if (!command.payload.name || command.payload.name.trim().length < 2) {
        errors.push({
          field: 'name',
          message: 'Name must be at least 2 characters long',
          code: 'NAME_TOO_SHORT'
        });
      }
      
      if (command.payload.name.length > 100) {
        errors.push({
          field: 'name',
          message: 'Name must not exceed 100 characters',
          code: 'NAME_TOO_LONG'
        });
      }
    }
    
    // Validate email if provided
    if (command.payload.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!command.payload.email || !emailRegex.test(command.payload.email)) {
        errors.push({
          field: 'email',
          message: 'Valid email address is required',
          code: 'INVALID_EMAIL'
        });
      }
      
      if (command.payload.email.length > 254) {
        errors.push({
          field: 'email',
          message: 'Email address must not exceed 254 characters',
          code: 'EMAIL_TOO_LONG'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Factory functions for validators
 */
export function createCreateUserValidator(): CreateUserCommandValidator {
  return new CreateUserCommandValidator();
}

export function createUpdateUserValidator(): UpdateUserCommandValidator {
  return new UpdateUserCommandValidator();
} 