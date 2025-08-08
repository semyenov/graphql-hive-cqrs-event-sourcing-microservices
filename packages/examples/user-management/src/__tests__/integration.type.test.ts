// Integration tests for branded types, validation, and error handling
import type { UserId, Email, EventVersion, AggregateId } from '../branded';
import { BrandedTypes } from '../branded';

import type { ValidationResult, Validator } from '@cqrs-framework/validation';
import { ValidationBuilder, validate, ValidationException } from '@cqrs-framework/validation';

import type { AppError, Result, ValidationError as ErrorValidation, ErrorCode } from '@cqrs-framework/types';
import { ErrorFactory, ErrorGuards, Result as ResultHelpers } from '@cqrs-framework/types';

import type {
  AssertEquals,
  AssertExtends,
  TypeTests,
  CompileTimeTest
} from './type-assertions';

// Type-level integration tests
type IntegrationTypeTests = TypeTests<{
  // Test that branded types work with validation
  validatorForBrandedType: AssertExtends<
    Validator<Email>,
    (value: unknown) => ValidationResult<Email>
  >;
  
  // Test that error types work with Result
  resultWithBrandedType: AssertExtends<
    Result<UserId, ErrorValidation>,
    { success: true; value: UserId } | { success: false; error: ErrorValidation }
  >;
}>;

import { describe, it, expect } from 'bun:test';

// Integration test cases
describe('Type System Integration', () => {
  describe('Branded Types with Validation', () => {
    // Create a validator for branded Email type
    const emailValidator: Validator<Email> = (value) => {
      const stringResult = ValidationBuilder.string.email()(value);
      if (!stringResult.valid) {
        return stringResult as ValidationResult<Email>;
      }
      
      try {
        const email = BrandedTypes.email(stringResult.value);
        return { valid: true, value: email };
      } catch (error) {
        return {
          valid: false,
          errors: [{
            field: 'email',
            message: error instanceof Error ? error.message : 'Invalid email',
            code: 'INVALID_FORMAT'
          }]
        };
      }
    };
    
    it('should validate and create branded email', () => {
      const result = emailValidator('user@example.com');
      expect(result.valid).toBe(true);
      if (result.valid) {
        // TypeScript knows this is Email type
        const email: Email = result.value;
        expect(email).toBe(BrandedTypes.email('user@example.com'));
      }
    });
    
    it('should reject invalid emails', () => {
      const result = emailValidator('invalid');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Validation with Error Handling', () => {
    // Create a function that validates and returns Result
    function validateEmail(input: unknown): Result<Email, ErrorValidation> {
      const validator = ValidationBuilder.string.email();
      const result = validator(input);
      
      if (!result.valid) {
        return ResultHelpers.err(
          ErrorFactory.validation({
            code: 'INVALID_EMAIL' as ErrorCode,
            message: result.errors[0]?.message || 'Validation failed',
            field: 'email',
            value: input
          })
        );
      }
      
      try {
        const email = BrandedTypes.email(result.value);
        return ResultHelpers.ok(email);
      } catch (error) {
        return ResultHelpers.err(
          ErrorFactory.validation({
            code: 'INVALID_EMAIL' as ErrorCode,
            message: error instanceof Error ? error.message : 'Invalid email',
            field: 'email',
            value: input
          })
        );
      }
    }
    
    it('should return Ok result for valid email', () => {
      const result = validateEmail('user@example.com');
      expect(ResultHelpers.isOk(result)).toBe(true);
      if (result.success) {
        const email: Email = result.value;
        expect(email).toBe(BrandedTypes.email('user@example.com'));
      }
    });
    
    it('should return Err result for invalid email', () => {
      const result = validateEmail('invalid');
      expect(ResultHelpers.isErr(result)).toBe(true);
      if (!result.success) {
        expect(ErrorGuards.isValidationError(result.error)).toBe(true);
        if (ErrorGuards.isValidationError(result.error)) {
          expect(result.error.field).toBe('email');
        }
      }
    });
  });
  
  describe('Branded Types in Domain Logic', () => {
    // Example domain entity using branded types
    interface User {
      id: UserId;
      email: Email;
      aggregateId: AggregateId;
      version: EventVersion;
    }
    
    // Create user with validation
    function createUser(
      id: string,
      email: string,
      aggregateId: string,
      version: number
    ): Result<User, AppError> {
      try {
        // Validate and create branded types
        const userId = BrandedTypes.userId(id);
        const userEmail = BrandedTypes.email(email);
        const userAggregateId = BrandedTypes.aggregateId(aggregateId);
        const eventVersion = BrandedTypes.eventVersion(version);
        
        const user: User = {
          id: userId,
          email: userEmail,
          aggregateId: userAggregateId,
          version: eventVersion
        };
        
        return ResultHelpers.ok(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid user data';
        
        if (message.includes('email')) {
          return ResultHelpers.err(
            ErrorFactory.validation({
              code: 'INVALID_EMAIL' as ErrorCode,
              message,
              field: 'email',
              value: email
            })
          );
        } else if (message.includes('version')) {
          return ResultHelpers.err(
            ErrorFactory.validation({
              code: 'INVALID_VERSION',
              message,
              field: 'version',
              value: version
            })
          );
        }
        
        return ResultHelpers.err(
          ErrorFactory.businessRule({
            code: 'INVALID_USER_DATA',
            message,
            rule: 'user_creation',
            context: { id, email, aggregateId, version }
          })
        );
      }
    }
    
    it('should create user with valid data', () => {
      const result = createUser(
        'user-123',
        'user@example.com',
        'agg-123',
        1
      );
      
      expect(ResultHelpers.isOk(result)).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe(BrandedTypes.userId('user-123'));
        expect(result.value.email).toBe(BrandedTypes.email('user@example.com'));
        expect(result.value.version).toBe(BrandedTypes.eventVersion(1));
      }
    });
    
    it('should handle invalid email', () => {
      const result = createUser(
        'user-123',
        'invalid-email',
        'agg-123',
        1
      );
      
      expect(ResultHelpers.isErr(result)).toBe(true);
      if (!result.success) {
        expect(ErrorGuards.isValidationError(result.error)).toBe(true);
        if (ErrorGuards.isValidationError(result.error)) {
          expect(result.error.field).toBe('email');
        }
      }
    });
    
    it('should handle invalid version', () => {
      const result = createUser(
        'user-123',
        'user@example.com',
        'agg-123',
        0
      );
      
      expect(ResultHelpers.isErr(result)).toBe(true);
      if (!result.success) {
        expect(ErrorGuards.isValidationError(result.error)).toBe(true);
        if (ErrorGuards.isValidationError(result.error)) {
          expect(result.error.field).toBe('version');
        }
      }
    });
  });
  
  describe('Complex Validation with Branded Types', () => {
    // Create a complex validator combining multiple branded types
    interface CreateUserCommand {
      userId: UserId;
      email: Email;
      aggregateId: AggregateId;
    }
    
    const createUserCommandValidator = ValidationBuilder.object<CreateUserCommand>({
      userId: (value) => {
        if (typeof value !== 'string') {
          return {
            valid: false,
            errors: [{ field: 'userId', message: 'Must be string', code: 'INVALID_FORMAT' }]
          };
        }
        try {
          const userId = BrandedTypes.userId(value);
          return { valid: true, value: userId };
        } catch (error) {
          return {
            valid: false,
            errors: [{ 
              field: 'userId', 
              message: error instanceof Error ? error.message : 'Invalid user ID',
              code: 'INVALID_FORMAT'
            }]
          };
        }
      },
      email: (value) => {
        const emailResult = ValidationBuilder.string.email()(value);
        if (!emailResult.valid) return emailResult as ValidationResult<Email>;
        
        try {
          const email = BrandedTypes.email(emailResult.value);
          return { valid: true, value: email };
        } catch (error) {
          return {
            valid: false,
            errors: [{
              field: 'email',
              message: error instanceof Error ? error.message : 'Invalid email',
              code: 'INVALID_FORMAT'
            }]
          };
        }
      },
      aggregateId: (value) => {
        if (typeof value !== 'string') {
          return {
            valid: false,
            errors: [{ field: 'aggregateId', message: 'Must be string', code: 'INVALID_FORMAT' }]
          };
        }
        try {
          const aggregateId = BrandedTypes.aggregateId(value);
          return { valid: true, value: aggregateId };
        } catch (error) {
          return {
            valid: false,
            errors: [{
              field: 'aggregateId',
              message: error instanceof Error ? error.message : 'Invalid aggregate ID',
              code: 'INVALID_FORMAT'
            }]
          };
        }
      }
    });
    
    it('should validate complex command object', () => {
      const result = createUserCommandValidator({
        userId: 'user-123',
        email: 'user@example.com',
        aggregateId: 'agg-123'
      });
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        // TypeScript knows these are branded types
        const command: CreateUserCommand = result.value;
        expect(command.userId).toBe(BrandedTypes.userId('user-123'));
        expect(command.email).toBe(BrandedTypes.email('user@example.com'));
        expect(command.aggregateId).toBe(BrandedTypes.aggregateId('agg-123'));
      }
    });
    
    it('should collect all validation errors', () => {
      const result = createUserCommandValidator({
        userId: '',
        email: 'invalid',
        aggregateId: ''
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors.find(e => e.field?.includes('userId'))).toBeDefined();
        expect(result.errors.find(e => e.field?.includes('email'))).toBeDefined();
        expect(result.errors.find(e => e.field?.includes('aggregateId'))).toBeDefined();
      }
    });
  });
  
  describe('Error Chaining with Results', () => {
    // Helper function to create user in registration flow
    function createUserInRegistration(
      id: string,
      email: string,
      aggregateId: string,
      version: number
    ): Result<User, AppError> {
      try {
        const userId = BrandedTypes.userId(id);
        const userEmail = BrandedTypes.email(email);
        const userAggregateId = BrandedTypes.aggregateId(aggregateId);
        const eventVersion = BrandedTypes.eventVersion(version);
        
        const user: User = {
          id: userId,
          email: userEmail,
          aggregateId: userAggregateId,
          version: eventVersion
        };
        
        return ResultHelpers.ok(user);
      } catch (error) {
        return ResultHelpers.err(
          ErrorFactory.businessRule({
            code: 'INVALID_USER_DATA',
            message: error instanceof Error ? error.message : 'Invalid user data',
            rule: 'user_creation',
            context: { id, email, aggregateId, version }
          })
        );
      }
    }
    
    // Chain multiple operations that might fail
    function processUserRegistration(
      email: string,
      id: string
    ): Result<{ user: User; message: string }, AppError> {
      // Step 1: Validate email
      const emailResult = ValidationBuilder.string.email()(email);
      if (!emailResult.valid) {
        return ResultHelpers.err(
          ErrorFactory.validation({
            code: 'INVALID_EMAIL' as ErrorCode,
            message: 'Invalid email format',
            field: 'email',
            value: email
          })
        );
      }
      
      // Step 2: Create branded types
      const userResult = createUserInRegistration(
        id,
        emailResult.value,
        `agg-${id}`,
        1
      );
      
      // Step 3: Chain additional processing
      return ResultHelpers.chain(userResult, user => {
        // Simulate business rule check
        if (user.email === 'admin@example.com') {
          return ResultHelpers.err(
            ErrorFactory.businessRule({
              code: 'RESERVED_EMAIL',
              message: 'Cannot use reserved email',
              rule: 'reserved_email_check',
              aggregate: 'User',
              aggregateId: user.aggregateId
            })
          );
        }
        
        return ResultHelpers.ok({
          user,
          message: `User ${user.id} registered successfully`
        });
      });
    }
    
    it('should process valid registration', () => {
      const result = processUserRegistration('user@example.com', 'user-123');
      
      expect(ResultHelpers.isOk(result)).toBe(true);
      if (result.success) {
        expect(result.value.message).toContain('registered successfully');
        expect(result.value.user.email).toBe(BrandedTypes.email('user@example.com'));
      }
    });
    
    it('should fail on validation error', () => {
      const result = processUserRegistration('invalid', 'user-123');
      
      expect(ResultHelpers.isErr(result)).toBe(true);
      if (!result.success) {
        expect(ErrorGuards.isValidationError(result.error)).toBe(true);
      }
    });
    
    it('should fail on business rule violation', () => {
      const result = processUserRegistration('admin@example.com', 'user-123');
      
      expect(ResultHelpers.isErr(result)).toBe(true);
      if (!result.success) {
        expect(ErrorGuards.isBusinessRuleError(result.error)).toBe(true);
        if (ErrorGuards.isBusinessRuleError(result.error)) {
          expect(result.error.rule).toBe('reserved_email_check');
        }
      }
    });
  });
});

// Example of using the integrated type system in practice
interface User {
  id: UserId;
  email: Email;
  aggregateId: AggregateId;
  version: EventVersion;
}

// Type-safe user service
class UserService {
  async createUser(
    id: string,
    email: string
  ): Promise<Result<User, AppError>> {
    // Validate inputs
    const validationResult = ValidationBuilder.object({
      id: ValidationBuilder.string.minLength(1),
      email: ValidationBuilder.string.email()
    })({ id, email });
    
    if (!validationResult.valid) {
      return ResultHelpers.err(
        ErrorFactory.validation({
          code: 'INVALID_INPUT',
          message: 'Invalid user input',
          field: validationResult.errors[0]?.field || 'unknown',
          value: { id, email }
        })
      );
    }
    
    try {
      // Create branded types
      const user: User = {
        id: BrandedTypes.userId(id),
        email: BrandedTypes.email(email),
        aggregateId: BrandedTypes.aggregateId(`user-agg-${id}`),
        version: BrandedTypes.eventVersion(1)
      };
      
      return ResultHelpers.ok(user);
    } catch (error) {
      return ResultHelpers.err(
        ErrorFactory.businessRule({
          code: 'USER_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create user',
          rule: 'user_creation',
          context: { id, email }
        })
      );
    }
  }
}

// Compile-time assertion that all tests pass
const _integrationTypeTests: CompileTimeTest = true;