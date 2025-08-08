/**
 * User Domain: Enhanced Command Validators V2
 * 
 * Demonstrates enhanced validation system with automatic type inference
 * and elimination of type assertion workarounds.
 */

import {
  createCommandValidatorV2,
  ValidationRulesV2,
  ValidationBuilderV2,
  validatorV2,
  type ICommandValidatorV2,
} from '../../../framework/core/validation-enhanced';
import type { ICommand } from '../../../framework/core/command';
import type * as Commands from '../commands/types';

/**
 * CreateUser command validator - NO TYPE ASSERTIONS NEEDED!
 */
export const createUserCommandValidatorV2: ICommandValidatorV2<Commands.CreateUserCommand> = 
  createCommandValidatorV2<Commands.CreateUserCommand>({
    name: [
      ValidationRulesV2.required('Name is required'),
      ValidationRulesV2.string.length(2, 100, 'Name must be between 2 and 100 characters'),
      ValidationRulesV2.string.notEmpty('Name cannot be empty'),
    ],
    email: [
      ValidationRulesV2.required('Email is required'),
      ValidationRulesV2.string.email('Invalid email format'),
    ],
  });

/**
 * UpdateUser command validator - Optional fields with proper typing
 */
export const updateUserCommandValidatorV2: ICommandValidatorV2<Commands.UpdateUserCommand> = 
  createCommandValidatorV2<Commands.UpdateUserCommand>({
    name: ValidationRulesV2.string.length(2, 100, 'Name must be between 2 and 100 characters'),
    email: ValidationRulesV2.string.email('Invalid email format'),
  });

/**
 * DeleteUser command validator - Clean optional validation
 */
export const deleteUserCommandValidatorV2: ICommandValidatorV2<Commands.DeleteUserCommand> = 
  createCommandValidatorV2<Commands.DeleteUserCommand>({
    reason: ValidationRulesV2.custom(
      (value: string | undefined) => !value || value.length <= 500,
      'Deletion reason must not exceed 500 characters'
    ),
  });

/**
 * VerifyUserEmail command validator - Chained validations
 */
export const verifyUserEmailCommandValidatorV2: ICommandValidatorV2<Commands.VerifyUserEmailCommand> = 
  createCommandValidatorV2<Commands.VerifyUserEmailCommand>({
    verificationToken: [
      ValidationRulesV2.required('Verification token is required'),
      ValidationRulesV2.string.length(10, 500, 'Invalid verification token length'),
      ValidationRulesV2.string.notEmpty('Verification token cannot be empty'),
    ],
  });

/**
 * UpdateUserProfile command validator - Complex nested validation
 */
export const updateUserProfileCommandValidatorV2: ICommandValidatorV2<Commands.UpdateUserProfileCommand> = 
  createCommandValidatorV2<Commands.UpdateUserProfileCommand>({
    bio: ValidationRulesV2.custom(
      (value: string | undefined) => !value || value.length <= 1000,
      'Bio must not exceed 1000 characters'
    ),
    avatar: [
      ValidationRulesV2.string.url('Avatar must be a valid URL'),
      ValidationRulesV2.custom(
        (value: string | undefined) => {
          if (!value) return true;
          // Additional validation for supported image formats
          return /\.(jpg|jpeg|png|gif|webp)$/i.test(value);
        },
        'Avatar must be an image URL (jpg, jpeg, png, gif, webp)'
      ),
    ],
    location: ValidationRulesV2.custom(
      (value: string | undefined) => !value || value.length <= 100,
      'Location must not exceed 100 characters'
    ),
  });

/**
 * Enhanced password validator using fluent ValidationBuilder - NO TYPE ASSERTIONS!
 */
export function createChangePasswordValidatorV2(
  requireCurrentPassword = true,
  minPasswordLength = 8
): ICommandValidatorV2<Commands.ChangeUserPasswordCommand> {
  const payloadValidator = validatorV2<Commands.ChangeUserPasswordCommand['payload']>()
    // Conditional validation for current password
    .when(
      () => requireCurrentPassword,
      (builder) => builder.rule(
        ValidationRulesV2.custom(
          (payload) => !!payload.currentPassword,
          'Current password is required'
        )
      )
    )
    // New password validation
    .rule(ValidationRulesV2.custom(
      (payload) => {
        const newPassword = payload.newPassword;
        return newPassword && newPassword.length >= minPasswordLength;
      },
      `Password must be at least ${minPasswordLength} characters`
    ))
    // Password strength validation
    .rule(ValidationRulesV2.custom(
      (payload) => {
        const newPassword = payload.newPassword;
        if (!newPassword) return false;
        
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
        
        return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
      },
      'Password must contain uppercase, lowercase, number, and special character'
    ))
    // Password confirmation validation
    .rule(ValidationRulesV2.custom(
      (payload) => payload.newPassword === payload.confirmPassword,
      'Password confirmation must match new password'
    ))
    .build();

  return {
    validate: async (command: Commands.ChangeUserPasswordCommand) => {
      return payloadValidator.validate(command.payload);
    },
    
    validateField: async (field, value) => {
      // Type-safe field validation
      return null; // Simplified for this example
    },
    
    validatePayload: async (payload: Commands.ChangeUserPasswordCommand['payload']) => {
      return payloadValidator.validate(payload);
    },
  };
}

/**
 * Advanced email validation with domain checking
 */
export const createAdvancedEmailValidator = () => 
  validatorV2<string>()
    .required('Email is required')
    .rule(ValidationRulesV2.string.email())
    .rule(ValidationRulesV2.custom(
      async (email) => {
        // Example: Check against blocked domains
        const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        return !blockedDomains.includes(domain || '');
      },
      'Email domain is not allowed'
    ))
    .build();

/**
 * Complex nested object validation example
 */
export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisible: boolean;
    searchable: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
}

export const userPreferencesValidator = createCommandValidatorV2<{
  type: string;
  aggregateId: string;
  payload: UserPreferences;
}>({
  notifications: ValidationRulesV2.nested({
    email: ValidationRulesV2.required('Email notification preference is required'),
    push: ValidationRulesV2.required('Push notification preference is required'),
    sms: ValidationRulesV2.required('SMS notification preference is required'),
  }),
  privacy: ValidationRulesV2.nested({
    profileVisible: ValidationRulesV2.required('Profile visibility preference is required'),
    searchable: ValidationRulesV2.required('Searchable preference is required'),
  }),
  theme: ValidationRulesV2.oneOf(['light', 'dark', 'auto'], 'Theme must be light, dark, or auto'),
});

/**
 * Array validation example
 */
export interface UpdateUserTagsCommand extends ICommand {
  payload: {
    tags: string[];
    categories: Array<{ name: string; priority: number }>;
  };
}

export const updateUserTagsValidator = createCommandValidatorV2<UpdateUserTagsCommand>({
  tags: [
    ValidationRulesV2.array.length(0, 10, 'User can have at most 10 tags'),
    ValidationRulesV2.array.unique('Tags must be unique'),
    ValidationRulesV2.array.items(
      ValidationRulesV2.string.length(1, 50, 'Each tag must be 1-50 characters'),
      'Invalid tag format'
    ),
  ],
  categories: [
    ValidationRulesV2.array.length(1, 5, 'User must have 1-5 categories'),
    ValidationRulesV2.array.items(
      ValidationRulesV2.nested({
        name: [
          ValidationRulesV2.required('Category name is required'),
          ValidationRulesV2.string.length(1, 100),
        ],
        priority: [
          ValidationRulesV2.required('Category priority is required'),
          ValidationRulesV2.number.range(1, 10, 'Priority must be 1-10'),
          ValidationRulesV2.number.integer('Priority must be an integer'),
        ],
      })
    ),
  ],
});

/**
 * Create all enhanced validators
 */
export function createUserCommandValidatorsV2() {
  return {
    createUser: createUserCommandValidatorV2,
    updateUser: updateUserCommandValidatorV2,
    deleteUser: deleteUserCommandValidatorV2,
    verifyEmail: verifyUserEmailCommandValidatorV2,
    updateProfile: updateUserProfileCommandValidatorV2,
    changePassword: createChangePasswordValidatorV2(),
    advancedEmail: createAdvancedEmailValidator(),
    userPreferences: userPreferencesValidator,
    updateTags: updateUserTagsValidator,
  };
}

/**
 * Usage examples and patterns
 */
export const ValidationExamples = {
  /**
   * Simple field validation
   */
  simpleEmail: ValidationRulesV2.string.email(),
  
  /**
   * Composite validation
   */
  strongPassword: validatorV2<string>()
    .required()
    .rule(ValidationRulesV2.string.length(8, 128))
    .custom(
      (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value),
      'Password must contain uppercase, lowercase, and numbers'
    )
    .build(),
    
  /**
   * Conditional validation based on other fields
   */
  conditionalValidation: validatorV2<{ type: string; value: string }>()
    .when(
      (data) => data.type === 'email',
      (builder) => builder.rule(ValidationRulesV2.custom(
        (data) => ValidationRulesV2.string.email()(data.value) === null,
        'Invalid email format'
      )),
      (builder) => builder.rule(ValidationRulesV2.custom(
        (data) => data.value.length > 0,
        'Value is required'
      ))
    )
    .build(),
};

// Demonstration: Migration from old to new validation system
export const MigrationComparison = {
  // OLD (with type assertions)
  old: `
    ValidationRules.required('Current password is required') as any
    // Type assertion workaround ^
  `,
  
  // NEW (fully typed)
  new: `
    ValidationRulesV2.required('Current password is required')
    // No type assertions needed! ^
  `,
};