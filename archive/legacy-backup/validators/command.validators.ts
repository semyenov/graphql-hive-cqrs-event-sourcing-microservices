/**
 * User Domain: Command Validators
 * 
 * Validation logic for user commands using framework interfaces.
 */

import type { 
  ICommandValidator, 
  ValidationResult, 
  ValidationError 
} from '../../../framework/core/command';
import type * as Commands from '../commands/types';
import { BrandedTypes } from '../../../framework/core/branded/factories';

/**
 * Validator for CreateUser command
 */
export class CreateUserCommandValidator implements ICommandValidator<Commands.CreateUserCommand> {
  async validate(command: Commands.CreateUserCommand): Promise<ValidationResult> {
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
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Validator for UpdateUser command
 */
export class UpdateUserCommandValidator implements ICommandValidator<Commands.UpdateUserCommand> {
  async validate(command: Commands.UpdateUserCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // At least one field must be provided
    if (!command.payload.name && !command.payload.email) {
      errors.push({
        field: 'payload',
        message: 'At least one field must be provided for update',
        code: 'NO_FIELDS_TO_UPDATE'
      });
    }
    
    // Validate name if provided
    if (command.payload.name !== undefined) {
      if (command.payload.name.trim().length < 2) {
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
      if (!emailRegex.test(command.payload.email)) {
        errors.push({
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Validator for DeleteUser command
 */
export class DeleteUserCommandValidator implements ICommandValidator<Commands.DeleteUserCommand> {
  async validate(command: Commands.DeleteUserCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Validate reason if provided
    if (command.payload.reason && command.payload.reason.length > 500) {
      errors.push({
        field: 'reason',
        message: 'Deletion reason must not exceed 500 characters',
        code: 'REASON_TOO_LONG'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Validator for VerifyUserEmail command
 */
export class VerifyUserEmailCommandValidator implements ICommandValidator<Commands.VerifyUserEmailCommand> {
  async validate(command: Commands.VerifyUserEmailCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Validate token
    if (!command.payload.verificationToken || command.payload.verificationToken.trim().length === 0) {
      errors.push({
        field: 'verificationToken',
        message: 'Verification token is required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    // In production, validate token format and expiry
    if (command.payload.verificationToken && command.payload.verificationToken.length < 10) {
      errors.push({
        field: 'verificationToken',
        message: 'Invalid verification token',
        code: 'INVALID_TOKEN'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Validator for UpdateUserProfile command
 */
export class UpdateUserProfileCommandValidator implements ICommandValidator<Commands.UpdateUserProfileCommand> {
  async validate(command: Commands.UpdateUserProfileCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Validate bio
    if (command.payload.bio !== undefined && command.payload.bio.length > 1000) {
      errors.push({
        field: 'bio',
        message: 'Bio must not exceed 1000 characters',
        code: 'BIO_TOO_LONG'
      });
    }
    
    // Validate avatar URL
    if (command.payload.avatar !== undefined) {
      try {
        new URL(command.payload.avatar);
      } catch {
        errors.push({
          field: 'avatar',
          message: 'Avatar must be a valid URL',
          code: 'INVALID_AVATAR_URL'
        });
      }
    }
    
    // Validate location
    if (command.payload.location !== undefined && command.payload.location.length > 100) {
      errors.push({
        field: 'location',
        message: 'Location must not exceed 100 characters',
        code: 'LOCATION_TOO_LONG'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Create all validators for user commands
 */
export function createUserCommandValidators() {
  return {
    createUser: new CreateUserCommandValidator(),
    updateUser: new UpdateUserCommandValidator(),
    deleteUser: new DeleteUserCommandValidator(),
    verifyEmail: new VerifyUserEmailCommandValidator(),
    updateProfile: new UpdateUserProfileCommandValidator(),
  };
}