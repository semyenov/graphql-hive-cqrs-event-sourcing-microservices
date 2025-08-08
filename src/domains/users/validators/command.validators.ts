/**
 * User Domain: Command Validators
 * 
 * Validation logic for user commands using framework's SchemaValidator.
 */

import {
  createCommandValidator,
  ValidationRules,
  ValidationBuilder,
  type ICommandValidator,
} from '../../../framework/core/validation';
import type * as Commands from '../commands/types';

/**
 * CreateUser command validator using SchemaValidator
 */
export const createUserCommandValidator: ICommandValidator<Commands.CreateUserCommand> = 
  createCommandValidator<Commands.CreateUserCommand>({
    name: [
      ValidationRules.required('Name is required'),
      ValidationRules.string.length(2, 100, 'Name must be between 2 and 100 characters'),
    ],
    email: [
      ValidationRules.required('Email is required'),
      ValidationRules.string.email('Invalid email format'),
    ],
  });

/**
 * UpdateUser command validator using SchemaValidator
 */
export const updateUserCommandValidator: ICommandValidator<Commands.UpdateUserCommand> = 
  createCommandValidator<Commands.UpdateUserCommand>({
    name: ValidationRules.required('Name is required'),
    email: ValidationRules.required('Email is required'),
  });

/**
 * DeleteUser command validator using SchemaValidator
 */
export const deleteUserCommandValidator: ICommandValidator<Commands.DeleteUserCommand> = 
  createCommandValidator<Commands.DeleteUserCommand>({
    reason: ValidationRules.custom(
      (value: unknown) => !value || (typeof value === 'string' && value.length <= 500),
      'Deletion reason must not exceed 500 characters'
    ),
  });

/**
 * VerifyUserEmail command validator using SchemaValidator
 */
export const verifyUserEmailCommandValidator: ICommandValidator<Commands.VerifyUserEmailCommand> = 
  createCommandValidator<Commands.VerifyUserEmailCommand>({
    verificationToken: [
      ValidationRules.required('Verification token is required'),
      ValidationRules.custom(
        (token: unknown) => typeof token === 'string' && token.trim().length >= 10,
        'Invalid verification token'
      ),
    ],
  });

/**
 * UpdateUserProfile command validator using SchemaValidator
 */
export const updateUserProfileCommandValidator: ICommandValidator<Commands.UpdateUserProfileCommand> = 
  createCommandValidator<Commands.UpdateUserProfileCommand>({
    bio: ValidationRules.custom(
      (value: unknown) => !value || (typeof value === 'string' && value.length <= 1000),
      'Bio must not exceed 1000 characters'
    ),
    avatar: ValidationRules.custom(
      (value: unknown) => {
        if (!value) return true;
        if (typeof value !== 'string') return false;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      'Avatar must be a valid URL'
    ),
    location: ValidationRules.custom(
      (value: unknown) => !value || (typeof value === 'string' && value.length <= 100),
      'Location must not exceed 100 characters'
    ),
  });

/**
 * Advanced validator for ChangeUserPassword using ValidationBuilder
 */
export function createChangePasswordValidator(
  requireCurrentPassword = true,
  minPasswordLength = 8
): ICommandValidator<Commands.ChangeUserPasswordCommand> {
  const builder = new ValidationBuilder<Commands.ChangeUserPasswordCommand['payload']>();
  
  if (requireCurrentPassword) {
    builder.rule(
      ValidationRules.required('Current password is required') as any
    );
  }
  
  builder
    .rule((payload) => {
      const newPassword = payload.newPassword;
      if (!newPassword || newPassword.length < minPasswordLength) {
        return {
          field: 'newPassword',
          message: `Password must be at least ${minPasswordLength} characters`,
          code: 'PASSWORD_TOO_SHORT',
        };
      }
      return null;
    })
    .rule((payload) => {
      const newPassword = payload.newPassword;
      // Check for at least one uppercase, one lowercase, one number
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumber) {
        return {
          field: 'newPassword',
          message: 'Password must contain uppercase, lowercase, and numbers',
          code: 'PASSWORD_WEAK',
        };
      }
      return null;
    });
  
  const validator = builder.build();
  
  return {
    validate: async (command: Commands.ChangeUserPasswordCommand) => {
      return validator.validate(command.payload);
    },
    validatePayload: async (payload: any) => {
      return validator.validate(payload);
    },
    validateField: async (field: string, value: any) => {
      return null; // Simplified field validation
    },
  };
}

/**
 * Create all validators for user commands
 */
export function createUserCommandValidators() {
  return {
    createUser: createUserCommandValidator,
    updateUser: updateUserCommandValidator,
    deleteUser: deleteUserCommandValidator,
    verifyEmail: verifyUserEmailCommandValidator,
    updateProfile: updateUserProfileCommandValidator,
    changePassword: createChangePasswordValidator(),
  };
}

