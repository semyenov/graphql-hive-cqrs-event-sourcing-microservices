// Type-level tests for validation types
import type {
  MinLength,
  MaxLength,
  ValidEmail,
  ValidUUID,
  Range,
  Pattern,
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
  Validator,
  AsyncValidator,
  ValidatorChain,
  FieldValidation,
  ValidationSchema
} from '@cqrs-framework/validation';

import {
  ValidationBuilder,
  validate,
  validateAsync,
  ValidationException
} from '@cqrs-framework/validation';

import type {
  AssertEquals,
  AssertExtends,
  AssertNever,
  TypeTests,
  CompileTimeTest
} from './type-assertions';

// Test template literal validation types
type StringValidationTests = TypeTests<{
  // MinLength tests
  minLength2Valid: AssertEquals<MinLength<'ab', 2>, 'ab'>;
  minLength2Invalid: AssertEquals<MinLength<'a', 2>, never>;
  
  // ValidEmail tests
  validEmailFormat: AssertEquals<ValidEmail<'user@example.com'>, 'user@example.com'>;
  invalidEmailFormat: AssertEquals<ValidEmail<'invalid'>, never>;
  
  // ValidUUID tests
  validUUIDFormat: AssertEquals<ValidUUID<'550e8400-e29b-41d4-a716-446655440000'>, '550e8400-e29b-41d4-a716-446655440000'>;
  invalidUUIDFormat: AssertEquals<ValidUUID<'invalid'>, never>;
}>;

// Test validation result types
type ValidationResultTests = TypeTests<{
  // Success result
  successResult: AssertEquals<
    ValidationResult<string>,
    { valid: true; value: string } | { valid: false; errors: ValidationError[] }
  >;
  
  // Error code union
  errorCodeUnion: AssertExtends<
    'REQUIRED' | 'MIN_LENGTH' | 'MAX_LENGTH',
    ValidationErrorCode
  >;
}>;

// Test validator function types
type ValidatorTypeTests = TypeTests<{
  // Basic validator
  validatorType: AssertEquals<
    Validator<string>,
    (value: unknown) => ValidationResult<string>
  >;
  
  // Async validator
  asyncValidatorType: AssertEquals<
    AsyncValidator<string>,
    (value: unknown) => Promise<ValidationResult<string>>
  >;
}>;

import { describe, it, expect } from 'bun:test';

// Runtime tests for ValidationBuilder
describe('ValidationBuilder', () => {
  describe('string validators', () => {
    describe('required', () => {
      const validator = ValidationBuilder.string.required();
      
      it('should validate non-empty strings', () => {
        const result = validator('hello');
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.value).toBe('hello');
        }
      });
      
      it('should reject empty strings', () => {
        const result = validator('');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]?.code).toBe('REQUIRED');
        }
      });
      
      it('should reject non-strings', () => {
        const result = validator(123);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]?.code).toBe('REQUIRED');
        }
      });
    });
    
    describe('minLength', () => {
      const validator = ValidationBuilder.string.minLength(5);
      
      it('should validate strings meeting minimum length', () => {
        const result = validator('hello');
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.value).toBe('hello');
        }
      });
      
      it('should reject strings below minimum length', () => {
        const result = validator('hi');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]?.code).toBe('MIN_LENGTH');
          expect(result.errors[0]?.message).toBe('Minimum length is 5');
        }
      });
    });
    
    describe('email', () => {
      const validator = ValidationBuilder.string.email();
      
      it('should validate email addresses', () => {
        const validEmails = [
          'user@example.com',
          'test.user@example.co.uk',
          'user+tag@example.com'
        ];
        
        validEmails.forEach(email => {
          const result = validator(email);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.value).toBe(email);
          }
        });
      });
      
      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'invalid',
          '@example.com',
          'user@',
          'user@.com',
          123
        ];
        
        invalidEmails.forEach(email => {
          const result = validator(email);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
          }
        });
      });
    });
    
    describe('uuid', () => {
      const validator = ValidationBuilder.string.uuid();
      
      it('should validate UUIDs', () => {
        const validUUIDs = [
          '550e8400-e29b-41d4-a716-446655440000',
          '550E8400-E29B-41D4-A716-446655440000',
          '00000000-0000-0000-0000-000000000000'
        ];
        
        validUUIDs.forEach(uuid => {
          const result = validator(uuid);
          expect(result.valid).toBe(true);
        });
      });
      
      it('should reject invalid UUIDs', () => {
        const invalidUUIDs = [
          'invalid',
          '550e8400-e29b-41d4-a716',
          '550e8400-e29b-41d4-a716-446655440000-extra',
          'g50e8400-e29b-41d4-a716-446655440000'
        ];
        
        invalidUUIDs.forEach(uuid => {
          const result = validator(uuid);
          expect(result.valid).toBe(false);
        });
      });
    });
  });
  
  describe('number validators', () => {
    describe('required', () => {
      const validator = ValidationBuilder.number.required();
      
      it('should validate numbers', () => {
        expect(validator(42).valid).toBe(true);
        expect(validator(0).valid).toBe(true);
        expect(validator(-1).valid).toBe(true);
      });
      
      it('should reject non-numbers', () => {
        expect(validator('42').valid).toBe(false);
        expect(validator(NaN).valid).toBe(false);
        expect(validator(undefined).valid).toBe(false);
      });
    });
    
    describe('between', () => {
      const validator = ValidationBuilder.number.between(0, 100);
      
      it('should validate numbers in range', () => {
        expect(validator(0).valid).toBe(true);
        expect(validator(50).valid).toBe(true);
        expect(validator(100).valid).toBe(true);
      });
      
      it('should reject numbers out of range', () => {
        const result1 = validator(-1);
        expect(result1.valid).toBe(false);
        if (!result1.valid) {
          expect(result1.errors[0]?.message).toBe('Value must be between 0 and 100');
        }
        
        const result2 = validator(101);
        expect(result2.valid).toBe(false);
      });
    });
    
    describe('positive', () => {
      const validator = ValidationBuilder.number.positive();
      
      it('should validate positive numbers', () => {
        expect(validator(1).valid).toBe(true);
        expect(validator(0.1).valid).toBe(true);
      });
      
      it('should reject non-positive numbers', () => {
        expect(validator(0).valid).toBe(false);
        expect(validator(-1).valid).toBe(false);
      });
    });
  });
  
  describe('array validators', () => {
    describe('items', () => {
      const validator = ValidationBuilder.array.items(
        ValidationBuilder.string.email()
      );
      
      it('should validate arrays of valid items', () => {
        const result = validator(['user1@example.com', 'user2@example.com']);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.value).toHaveLength(2);
        }
      });
      
      it('should reject arrays with invalid items', () => {
        const result = validator(['user1@example.com', 'invalid']);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]?.field).toBe('[1]');
          expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
        }
      });
    });
  });
  
  describe('composite validators', () => {
    describe('optional', () => {
      const validator = ValidationBuilder.compose.optional(
        ValidationBuilder.string.email()
      );
      
      it('should allow undefined', () => {
        const result = validator(undefined);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.value).toBeUndefined();
        }
      });
      
      it('should validate defined values', () => {
        expect(validator('user@example.com').valid).toBe(true);
        expect(validator('invalid').valid).toBe(false);
      });
    });
    
    describe('nullable', () => {
      const validator = ValidationBuilder.compose.nullable(
        ValidationBuilder.string.email()
      );
      
      it('should allow null', () => {
        const result = validator(null);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.value).toBeNull();
        }
      });
      
      it('should validate non-null values', () => {
        expect(validator('user@example.com').valid).toBe(true);
        expect(validator('invalid').valid).toBe(false);
      });
    });
  });
  
  describe('object validator', () => {
    interface User {
      email: string;
      age: number;
      name?: string;
    }
    
    const userValidator = ValidationBuilder.object<User>({
      email: ValidationBuilder.string.email(),
      age: ValidationBuilder.number.between(0, 150),
      name: ValidationBuilder.compose.optional(
        ValidationBuilder.string.minLength(2)
      )
    });
    
    it('should validate valid objects', () => {
      const result = userValidator({
        email: 'user@example.com',
        age: 25,
        name: 'John'
      });
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value.email).toBe('user@example.com');
        expect(result.value.age).toBe(25);
        expect(result.value.name).toBe('John');
      }
    });
    
    it('should validate objects with optional fields', () => {
      const result = userValidator({
        email: 'user@example.com',
        age: 25
      });
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid objects', () => {
      const result = userValidator({
        email: 'invalid',
        age: 200,
        name: 'J'
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors.find(e => e.field === 'email')).toBeDefined();
        expect(result.errors.find(e => e.field === 'age')).toBeDefined();
        expect(result.errors.find(e => e.field === 'name')).toBeDefined();
      }
    });
  });
});

describe('validate helpers', () => {
  const emailValidator = ValidationBuilder.string.email();
  
  describe('validate', () => {
    it('should return value for valid input', () => {
      const value = validate(emailValidator, 'user@example.com');
      expect(value).toBe('user@example.com');
    });
    
    it('should throw ValidationException for invalid input', () => {
      expect(() => validate(emailValidator, 'invalid')).toThrow(ValidationException);
      
      try {
        validate(emailValidator, 'invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        if (error instanceof ValidationException) {
          expect(error.errors).toHaveLength(1);
          expect(error.errors[0]?.code).toBe('INVALID_FORMAT');
        }
      }
    });
  });
  
  describe('validateAsync', () => {
    const asyncValidator: AsyncValidator<string> = async (value) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return emailValidator(value);
    };
    
    it('should return value for valid input', async () => {
      const value = await validateAsync(asyncValidator, 'user@example.com');
      expect(value).toBe('user@example.com');
    });
    
    it('should throw ValidationException for invalid input', async () => {
      await expect(validateAsync(asyncValidator, 'invalid')).rejects.toThrow(ValidationException);
    });
  });
});

describe('ValidationException', () => {
  it('should serialize to JSON', () => {
    const errors: ValidationError[] = [
      { field: 'email', message: 'Invalid format', code: 'INVALID_FORMAT' }
    ];
    
    const exception = new ValidationException(errors);
    const json = exception.toJSON();
    
    expect(json).toEqual({
      name: 'ValidationException',
      message: 'Validation failed',
      errors
    });
  });
});

// Compile-time assertion that all tests pass
const _validationTypeTests: CompileTimeTest = true;