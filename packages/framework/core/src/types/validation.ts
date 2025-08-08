// Universal validation framework for CQRS/Event Sourcing
// Advanced validation types using template literal types and conditional types

// String length validation types
export type MinLength<T extends string, N extends number> = 
  T extends `${infer _}${infer Rest}` 
    ? Rest extends '' 
      ? N extends 1 
        ? T 
        : never
      : MinLength<Rest, N extends 1 ? 0 : N extends 2 ? 1 : never>
    : never;

export type MaxLength<T extends string, N extends number> = 
  T extends `${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}` 
    ? N extends 10 
      ? never 
      : T
    : T;

// Email validation at type level
export type ValidEmail<T extends string> = 
  T extends `${string}@${string}.${string}` ? T : never;

// UUID validation at type level
export type ValidUUID<T extends string> = 
  T extends `${string}-${string}-${string}-${string}-${string}` ? T : never;

// Numeric range types
export type Range<Min extends number, Max extends number> = number & {
  __min: Min;
  __max: Max;
};

// String pattern types
export type Pattern<TPattern extends string> = string & {
  __pattern: TPattern;
};

// Validation result types
export type ValidationResult<T> = 
  | { valid: true; value: T }
  | { valid: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
}

export type ValidationErrorCode = 
  | 'REQUIRED'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'PATTERN'
  | 'MIN_VALUE'
  | 'MAX_VALUE'
  | 'INVALID_FORMAT'
  | 'CUSTOM';

// Validator function types
export type Validator<T> = (value: unknown) => ValidationResult<T>;
export type AsyncValidator<T> = (value: unknown) => Promise<ValidationResult<T>>;

// Composite validator types
export type ValidatorChain<T> = {
  and<U>(validator: Validator<U>): ValidatorChain<T & U>;
  or<U>(validator: Validator<U>): ValidatorChain<T | U>;
  validate(value: unknown): ValidationResult<T>;
};

// Field validation types
export interface FieldValidation<T> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: Validator<T>;
}

// Object validation schema
export type ValidationSchema<T> = {
  [K in keyof T]-?: FieldValidation<T[K]> | Validator<T[K]>;
};

// Validation builder for common scenarios
export class ValidationBuilder {
  // String validators
  static string = {
    required: (): Validator<string> => (value) => {
      if (typeof value !== 'string' || value.length === 0) {
        return {
          valid: false,
          errors: [{ field: '', message: 'String is required', code: 'REQUIRED' }]
        };
      }
      return { valid: true, value };
    },

    minLength: (min: number): Validator<string> => (value) => {
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (value.length < min) {
        return {
          valid: false,
          errors: [{ field: '', message: `String must be at least ${min} characters`, code: 'MIN_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    maxLength: (max: number): Validator<string> => (value) => {
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (value.length > max) {
        return {
          valid: false,
          errors: [{ field: '', message: `String must be at most ${max} characters`, code: 'MAX_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    pattern: (regex: RegExp, message?: string): Validator<string> => (value) => {
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (!regex.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: message || 'String does not match required pattern', code: 'PATTERN' }]
        };
      }
      return { valid: true, value };
    },

    email: (): Validator<string> => (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Email must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (!emailRegex.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Invalid email format', code: 'INVALID_FORMAT' }]
        };
      }
      return { valid: true, value };
    },

    uuid: (): Validator<string> => (value) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'UUID must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (!uuidRegex.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Invalid UUID format', code: 'INVALID_FORMAT' }]
        };
      }
      return { valid: true, value };
    },
  };

  // Number validators
  static number = {
    required: (): Validator<number> => (value) => {
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Number is required', code: 'REQUIRED' }]
        };
      }
      return { valid: true, value };
    },

    min: (min: number): Validator<number> => (value) => {
      if (typeof value !== 'number') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a number', code: 'INVALID_FORMAT' }]
        };
      }
      if (value < min) {
        return {
          valid: false,
          errors: [{ field: '', message: `Number must be at least ${min}`, code: 'MIN_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    max: (max: number): Validator<number> => (value) => {
      if (typeof value !== 'number') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a number', code: 'INVALID_FORMAT' }]
        };
      }
      if (value > max) {
        return {
          valid: false,
          errors: [{ field: '', message: `Number must be at most ${max}`, code: 'MAX_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    range: (min: number, max: number): Validator<number> => (value) => {
      if (typeof value !== 'number') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a number', code: 'INVALID_FORMAT' }]
        };
      }
      if (value < min || value > max) {
        return {
          valid: false,
          errors: [{ field: '', message: `Number must be between ${min} and ${max}`, code: 'MIN_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    positive: (): Validator<number> => (value) => {
      if (typeof value !== 'number') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a number', code: 'INVALID_FORMAT' }]
        };
      }
      if (value <= 0) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Number must be positive', code: 'MIN_VALUE' }]
        };
      }
      return { valid: true, value };
    },
  };

  // Boolean validators
  static boolean = {
    required: (): Validator<boolean> => (value) => {
      if (typeof value !== 'boolean') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Boolean is required', code: 'REQUIRED' }]
        };
      }
      return { valid: true, value };
    },
  };

  // Array validators
  static array = {
    required: <T>(): Validator<T[]> => (value) => {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Array is required', code: 'REQUIRED' }]
        };
      }
      return { valid: true, value };
    },

    minLength: <T>(min: number): Validator<T[]> => (value) => {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an array', code: 'INVALID_FORMAT' }]
        };
      }
      if (value.length < min) {
        return {
          valid: false,
          errors: [{ field: '', message: `Array must have at least ${min} items`, code: 'MIN_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    maxLength: <T>(max: number): Validator<T[]> => (value) => {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an array', code: 'INVALID_FORMAT' }]
        };
      }
      if (value.length > max) {
        return {
          valid: false,
          errors: [{ field: '', message: `Array must have at most ${max} items`, code: 'MAX_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    each: <T>(validator: Validator<T>): Validator<T[]> => (value) => {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an array', code: 'INVALID_FORMAT' }]
        };
      }
      const errors: ValidationError[] = [];
      const validatedItems: T[] = [];

      for (let i = 0; i < value.length; i++) {
        const result = validator(value[i]);
        if (!result.valid) {
          errors.push(...result.errors.map(err => ({
            ...err,
            field: `[${i}]${err.field ? '.' + err.field : ''}`
          })));
        } else {
          validatedItems.push(result.value);
        }
      }

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      return { valid: true, value: validatedItems };
    },
  };

  // Object validators
  static object = {
    shape: <T>(schema: ValidationSchema<T>): Validator<T> => (value) => {
      if (typeof value !== 'object' || value === null) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an object', code: 'INVALID_FORMAT' }]
        };
      }

      const errors: ValidationError[] = [];
      const result = {} as T;

      for (const [key, fieldValidator] of Object.entries(schema)) {
        const fieldValue = (value as Record<string, unknown>)[key];
        let validator: Validator<unknown>;

        if (typeof fieldValidator === 'function') {
          validator = fieldValidator as Validator<unknown>;
        } else {
          // Convert field validation config to validator
          const config = fieldValidator as FieldValidation<unknown>;
          validator = (val: unknown) => {
            if (config.required && (val === undefined || val === null)) {
              return {
                valid: false,
                errors: [{ field: key, message: `${key} is required`, code: 'REQUIRED' }]
              };
            }
            if (config.custom) {
              return config.custom(val);
            }
            return { valid: true, value: val };
          };
        }

        const fieldResult = validator(fieldValue);
        if (!fieldResult.valid) {
          errors.push(...fieldResult.errors.map(err => ({
            ...err,
            field: key + (err.field ? '.' + err.field : '')
          })));
        } else {
          (result as Record<string, unknown>)[key] = fieldResult.value;
        }
      }

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      return { valid: true, value: result };
    },
  };

  // Utility validators
  static combine = {
    all: <T>(...validators: Validator<T>[]): Validator<T> => (value) => {
      for (const validator of validators) {
        const result = validator(value);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true, value: value as T };
    },

    any: <T>(...validators: Validator<T>[]): Validator<T> => (value) => {
      const allErrors: ValidationError[] = [];
      
      for (const validator of validators) {
        const result = validator(value);
        if (result.valid) {
          return result;
        }
        allErrors.push(...result.errors);
      }
      
      return { valid: false, errors: allErrors };
    },
  };
}

// Validation utility functions
export const validate = <T>(validator: Validator<T>, value: unknown): T => {
  const result = validator(value);
  if (!result.valid) {
    throw new ValidationException(result.errors);
  }
  return result.value;
};

export const validateAsync = async <T>(validator: AsyncValidator<T>, value: unknown): Promise<T> => {
  const result = await validator(value);
  if (!result.valid) {
    throw new ValidationException(result.errors);
  }
  return result.value;
};

// Custom validation exception
export class ValidationException extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'ValidationException';
  }
}

// Type-safe validation helpers
export const isValid = <T>(result: ValidationResult<T>): result is { valid: true; value: T } => {
  return result.valid;
};

export const getErrors = <T>(result: ValidationResult<T>): ValidationError[] => {
  return result.valid ? [] : result.errors;
};