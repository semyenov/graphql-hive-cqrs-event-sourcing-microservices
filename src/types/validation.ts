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

// Validation builder
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
          errors: [{ field: '', message: `Minimum length is ${min}`, code: 'MIN_LENGTH' }]
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
          errors: [{ field: '', message: `Maximum length is ${max}`, code: 'MAX_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    pattern: (pattern: RegExp): Validator<string> => (value) => {
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      if (!pattern.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: `Value does not match pattern`, code: 'PATTERN' }]
        };
      }
      return { valid: true, value };
    },

    email: (): Validator<string> => (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string' || !emailRegex.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Invalid email format', code: 'INVALID_FORMAT' }]
        };
      }
      return { valid: true, value };
    },

    uuid: (): Validator<string> => (value) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof value !== 'string' || !uuidRegex.test(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Invalid UUID format', code: 'INVALID_FORMAT' }]
        };
      }
      return { valid: true, value };
    },

    url: (): Validator<string> => (value) => {
      if (typeof value !== 'string') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a string', code: 'INVALID_FORMAT' }]
        };
      }
      try {
        new URL(value);
        return { valid: true, value };
      } catch {
        return {
          valid: false,
          errors: [{ field: '', message: 'Invalid URL format', code: 'INVALID_FORMAT' }]
        };
      }
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
          errors: [{ field: '', message: `Minimum value is ${min}`, code: 'MIN_VALUE' }]
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
          errors: [{ field: '', message: `Maximum value is ${max}`, code: 'MAX_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    between: (min: number, max: number): Validator<number> => (value) => {
      if (typeof value !== 'number') {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a number', code: 'INVALID_FORMAT' }]
        };
      }
      if (value < min || value > max) {
        return {
          valid: false,
          errors: [{ field: '', message: `Value must be between ${min} and ${max}`, code: 'CUSTOM' }]
        };
      }
      return { valid: true, value };
    },

    positive: (): Validator<number> => (value) => {
      if (typeof value !== 'number' || value <= 0) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be positive', code: 'MIN_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    integer: (): Validator<number> => (value) => {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an integer', code: 'INVALID_FORMAT' }]
        };
      }
      return { valid: true, value };
    },
  };

  // Boolean validator
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

  // Date validators
  static date = {
    required: (): Validator<Date> => (value) => {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Valid date is required', code: 'REQUIRED' }]
        };
      }
      return { valid: true, value };
    },

    after: (date: Date): Validator<Date> => (value) => {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a valid date', code: 'INVALID_FORMAT' }]
        };
      }
      if (value <= date) {
        return {
          valid: false,
          errors: [{ field: '', message: `Date must be after ${date.toISOString()}`, code: 'MIN_VALUE' }]
        };
      }
      return { valid: true, value };
    },

    before: (date: Date): Validator<Date> => (value) => {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be a valid date', code: 'INVALID_FORMAT' }]
        };
      }
      if (value >= date) {
        return {
          valid: false,
          errors: [{ field: '', message: `Date must be before ${date.toISOString()}`, code: 'MAX_VALUE' }]
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
          errors: [{ field: '', message: `Minimum length is ${min}`, code: 'MIN_LENGTH' }]
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
          errors: [{ field: '', message: `Maximum length is ${max}`, code: 'MAX_LENGTH' }]
        };
      }
      return { valid: true, value };
    },

    items: <T>(itemValidator: Validator<T>): Validator<T[]> => (value) => {
      if (!Array.isArray(value)) {
        return {
          valid: false,
          errors: [{ field: '', message: 'Value must be an array', code: 'INVALID_FORMAT' }]
        };
      }
      
      const errors: ValidationError[] = [];
      const validatedItems: T[] = [];
      
      for (let i = 0; i < value.length; i++) {
        const result = itemValidator(value[i]);
        if (!result.valid) {
          errors.push(...result.errors.map(e => ({
            ...e,
            field: `[${i}]${e.field ? '.' + e.field : ''}`
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

  // Composite validators
  static compose = {
    and: <T, U>(v1: Validator<T>, v2: Validator<U>): Validator<T & U> => (value) => {
      const r1 = v1(value);
      if (!r1.valid) return r1 as ValidationResult<T & U>;
      
      const r2 = v2(value);
      if (!r2.valid) return r2 as ValidationResult<T & U>;
      
      return { valid: true, value: value as T & U };
    },

    or: <T, U>(v1: Validator<T>, v2: Validator<U>): Validator<T | U> => (value) => {
      const r1 = v1(value);
      if (r1.valid) return r1;
      
      const r2 = v2(value);
      if (r2.valid) return r2;
      
      return {
        valid: false,
        errors: [...r1.errors, ...r2.errors]
      };
    },

    optional: <T>(validator: Validator<T>): Validator<T | undefined> => (value) => {
      if (value === undefined) {
        return { valid: true, value: undefined };
      }
      return validator(value);
    },

    nullable: <T>(validator: Validator<T>): Validator<T | null> => (value) => {
      if (value === null) {
        return { valid: true, value: null };
      }
      return validator(value);
    },
  };

  // Object validator
  static object = <T extends Record<string, unknown>>(
    schema: ValidationSchema<T>
  ): Validator<T> => (value) => {
    if (typeof value !== 'object' || value === null) {
      return {
        valid: false,
        errors: [{ field: '', message: 'Value must be an object', code: 'INVALID_FORMAT' }]
      };
    }

    const errors: ValidationError[] = [];
    const result = {} as T;

    for (const [key, fieldValidator] of Object.entries(schema)) {
      const fieldValue = (value as any)[key];
      const validator = typeof fieldValidator === 'function' 
        ? fieldValidator 
        : createFieldValidator(fieldValidator as FieldValidation<any>);
      
      const validationResult = validator(fieldValue);
      
      if (!validationResult.valid) {
        errors.push(...validationResult.errors.map((e: ValidationError) => ({
          ...e,
          field: key + (e.field ? '.' + e.field : '')
        })));
      } else {
        (result as any)[key] = validationResult.value;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: result };
  };
}

// Helper function to create validator from field validation config
function createFieldValidator<T>(config: FieldValidation<T>): Validator<T> {
  return (value) => {
    if (config.required && (value === undefined || value === null)) {
      return {
        valid: false,
        errors: [{ field: '', message: 'Field is required', code: 'REQUIRED' }]
      };
    }

    if (value === undefined || value === null) {
      return { valid: true, value: value as T };
    }

    const errors: ValidationError[] = [];

    if (typeof value === 'string') {
      if (config.minLength !== undefined && value.length < config.minLength) {
        errors.push({ field: '', message: `Minimum length is ${config.minLength}`, code: 'MIN_LENGTH' });
      }
      if (config.maxLength !== undefined && value.length > config.maxLength) {
        errors.push({ field: '', message: `Maximum length is ${config.maxLength}`, code: 'MAX_LENGTH' });
      }
      if (config.pattern && !config.pattern.test(value)) {
        errors.push({ field: '', message: 'Value does not match pattern', code: 'PATTERN' });
      }
    }

    if (config.custom) {
      const customResult = config.custom(value);
      if (!customResult.valid) {
        errors.push(...customResult.errors);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: value as T };
  };
}

// Type-safe validation utilities
export const validate = <T>(
  validator: Validator<T>,
  value: unknown
): T => {
  const result = validator(value);
  if (!result.valid) {
    throw new ValidationException(result.errors);
  }
  return result.value;
};

export const validateAsync = async <T>(
  validator: AsyncValidator<T>,
  value: unknown
): Promise<T> => {
  const result = await validator(value);
  if (!result.valid) {
    throw new ValidationException(result.errors);
  }
  return result.value;
};

// Validation exception
export class ValidationException extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}