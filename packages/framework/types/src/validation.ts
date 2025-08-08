// Universal validation system for CQRS/Event Sourcing framework
import type { Result, BaseError, ValidationError, MultiResult } from './errors';
import { ErrorFactory } from './errors';
import type { Brand } from './branded';

// Validation rule type
export type ValidationRule<T> = (value: T) => ValidationError | null;

// Validation result type
export type ValidationResult<T> = Result<T, ValidationError>;

// Object validation result type  
export type ObjectValidationResult<T> = MultiResult<T, ValidationError>;

// Field validator interface
export interface FieldValidator<T> {
  field: string;
  rules: ValidationRule<T>[];
  validate(value: T): ValidationError[];
}

// Object validator interface
export interface ObjectValidator<T extends Record<string, unknown>> {
  validators: { [K in keyof T]?: FieldValidator<T[K]> };
  validate(obj: T): ValidationError[];
}

// ============================================================================
// Basic Validation Rules
// ============================================================================

export const ValidationRules = {
  // String validation rules
  required: <T>(field: string) => (value: T): ValidationError | null => {
    if (value === null || value === undefined || value === '') {
      return ErrorFactory.validation({
        code: 'FIELD_REQUIRED',
        message: `${field} is required`,
        field,
        value,
      });
    }
    return null;
  },

  minLength: (field: string, min: number) => (value: string): ValidationError | null => {
    if (typeof value === 'string' && value.length < min) {
      return ErrorFactory.validation({
        code: 'VALUE_TOO_SHORT',
        message: `${field} must be at least ${min} characters long`,
        field,
        value,
        constraints: { minLength: min },
      });
    }
    return null;
  },

  maxLength: (field: string, max: number) => (value: string): ValidationError | null => {
    if (typeof value === 'string' && value.length > max) {
      return ErrorFactory.validation({
        code: 'VALUE_TOO_LONG',
        message: `${field} must be no more than ${max} characters long`,
        field,
        value,
        constraints: { maxLength: max },
      });
    }
    return null;
  },

  pattern: (field: string, regex: RegExp, message?: string) => (value: string): ValidationError | null => {
    if (typeof value === 'string' && !regex.test(value)) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: message || `${field} has invalid format`,
        field,
        value,
        constraints: { pattern: regex.source },
      });
    }
    return null;
  },

  email: (field: string) => (value: string): ValidationError | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value === 'string' && !emailRegex.test(value)) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be a valid email address`,
        field,
        value,
      });
    }
    return null;
  },

  // Numeric validation rules
  min: (field: string, min: number) => (value: number): ValidationError | null => {
    if (typeof value === 'number' && value < min) {
      return ErrorFactory.validation({
        code: 'VALUE_OUT_OF_RANGE',
        message: `${field} must be at least ${min}`,
        field,
        value,
        constraints: { min },
      });
    }
    return null;
  },

  max: (field: string, max: number) => (value: number): ValidationError | null => {
    if (typeof value === 'number' && value > max) {
      return ErrorFactory.validation({
        code: 'VALUE_OUT_OF_RANGE',
        message: `${field} must be no more than ${max}`,
        field,
        value,
        constraints: { max },
      });
    }
    return null;
  },

  integer: (field: string) => (value: number): ValidationError | null => {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be an integer`,
        field,
        value,
      });
    }
    return null;
  },

  positive: (field: string) => (value: number): ValidationError | null => {
    if (typeof value === 'number' && value <= 0) {
      return ErrorFactory.validation({
        code: 'VALUE_OUT_OF_RANGE',
        message: `${field} must be positive`,
        field,
        value,
      });
    }
    return null;
  },

  nonNegative: (field: string) => (value: number): ValidationError | null => {
    if (typeof value === 'number' && value < 0) {
      return ErrorFactory.validation({
        code: 'VALUE_OUT_OF_RANGE',
        message: `${field} must be non-negative`,
        field,
        value,
      });
    }
    return null;
  },

  // Array validation rules
  arrayMinLength: (field: string, min: number) => (value: unknown[]): ValidationError | null => {
    if (Array.isArray(value) && value.length < min) {
      return ErrorFactory.validation({
        code: 'VALUE_TOO_SHORT',
        message: `${field} must contain at least ${min} items`,
        field,
        value,
        constraints: { minItems: min },
      });
    }
    return null;
  },

  arrayMaxLength: (field: string, max: number) => (value: unknown[]): ValidationError | null => {
    if (Array.isArray(value) && value.length > max) {
      return ErrorFactory.validation({
        code: 'VALUE_TOO_LONG',
        message: `${field} must contain no more than ${max} items`,
        field,
        value,
        constraints: { maxItems: max },
      });
    }
    return null;
  },

  // Type validation rules
  isString: (field: string) => (value: unknown): ValidationError | null => {
    if (typeof value !== 'string') {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be a string`,
        field,
        value,
      });
    }
    return null;
  },

  isNumber: (field: string) => (value: unknown): ValidationError | null => {
    if (typeof value !== 'number' || isNaN(value)) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be a valid number`,
        field,
        value,
      });
    }
    return null;
  },

  isBoolean: (field: string) => (value: unknown): ValidationError | null => {
    if (typeof value !== 'boolean') {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be a boolean`,
        field,
        value,
      });
    }
    return null;
  },

  isArray: (field: string) => (value: unknown): ValidationError | null => {
    if (!Array.isArray(value)) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be an array`,
        field,
        value,
      });
    }
    return null;
  },

  isDate: (field: string) => (value: unknown): ValidationError | null => {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return ErrorFactory.validation({
        code: 'INVALID_FORMAT',
        message: `${field} must be a valid date`,
        field,
        value,
      });
    }
    return null;
  },

  // Custom validation
  custom: <T>(field: string, predicate: (value: T) => boolean, message: string) => 
    (value: T): ValidationError | null => {
      if (!predicate(value)) {
        return ErrorFactory.validation({
          code: 'BUSINESS_RULE_VIOLATION',
          message,
          field,
          value,
        });
      }
      return null;
    },
} as const;

// ============================================================================
// Validator Builders
// ============================================================================

// Field validator builder
export class FieldValidatorBuilder<T> {
  protected _field: string;
  private _rules: ValidationRule<T>[] = [];

  constructor(field: string) {
    this._field = field;
  }

  rule(rule: ValidationRule<T>): this {
    this._rules.push(rule);
    return this;
  }

  required(): this {
    return this.rule(ValidationRules.required(this._field));
  }

  build(): FieldValidator<T> {
    return {
      field: this._field,
      rules: [...this._rules],
      validate: (value: T) => {
        const errors: ValidationError[] = [];
        for (const rule of this._rules) {
          const error = rule(value);
          if (error) {
            errors.push(error);
          }
        }
        return errors;
      },
    };
  }
}

// String validator builder
export class StringValidatorBuilder extends FieldValidatorBuilder<string> {
  minLength(min: number): this {
    return this.rule(ValidationRules.minLength(this._field, min));
  }

  maxLength(max: number): this {
    return this.rule(ValidationRules.maxLength(this._field, max));
  }

  pattern(regex: RegExp, message?: string): this {
    return this.rule(ValidationRules.pattern(this._field, regex, message));
  }

  email(): this {
    return this.rule(ValidationRules.email(this._field));
  }
}

// Number validator builder
export class NumberValidatorBuilder extends FieldValidatorBuilder<number> {
  min(min: number): this {
    return this.rule(ValidationRules.min(this._field, min));
  }

  max(max: number): this {
    return this.rule(ValidationRules.max(this._field, max));
  }

  integer(): this {
    return this.rule(ValidationRules.integer(this._field));
  }

  positive(): this {
    return this.rule(ValidationRules.positive(this._field));
  }

  nonNegative(): this {
    return this.rule(ValidationRules.nonNegative(this._field));
  }
}

// Array validator builder
export class ArrayValidatorBuilder<T> extends FieldValidatorBuilder<T[]> {
  minLength(min: number): this {
    return this.rule(ValidationRules.arrayMinLength(this._field, min));
  }

  maxLength(max: number): this {
    return this.rule(ValidationRules.arrayMaxLength(this._field, max));
  }
}

// ============================================================================
// Validation Builder Factory
// ============================================================================

export const field = (name: string) => ({
  string: () => new StringValidatorBuilder(name),
  number: () => new NumberValidatorBuilder(name),
  array: <T>() => new ArrayValidatorBuilder<T>(name),
  custom: <T>() => new FieldValidatorBuilder<T>(name),
});

// ============================================================================
// Object Validation
// ============================================================================

// Object validator builder
export class ObjectValidatorBuilder<T extends Record<string, unknown>> {
  private _validators: { [K in keyof T]?: FieldValidator<T[K]> } = {};

  field<K extends keyof T>(key: K, validator: FieldValidator<T[K]>): this {
    this._validators[key] = validator;
    return this;
  }

  build(): ObjectValidator<T> {
    return {
      validators: { ...this._validators },
      validate: (obj: T) => {
        const errors: ValidationError[] = [];
        
        for (const [key, validator] of Object.entries(this._validators)) {
          if (validator) {
            const value = obj[key as keyof T];
            const fieldErrors = validator.validate(value);
            errors.push(...fieldErrors);
          }
        }
        
        return errors;
      },
    };
  }
}

// Object validator factory
export const object = <T extends Record<string, unknown>>() => 
  new ObjectValidatorBuilder<T>();

// ============================================================================
// Validation Helpers
// ============================================================================

// Validate a value with a single validator
export const validateField = <T>(
  validator: FieldValidator<T>,
  value: T
): ValidationResult<T> => {
  const errors = validator.validate(value);
  
  if (errors.length > 0) {
    return { success: false, error: errors[0]! };
  }
  
  return { success: true, value };
};

// Validate an object with an object validator
export const validateObject = <T extends Record<string, unknown>>(
  validator: ObjectValidator<T>,
  obj: T
): MultiResult<T, ValidationError> => {
  const errors = validator.validate(obj);
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, value: obj };
};

// Combine multiple field validators
export const combineValidators = <T>(
  ...validators: FieldValidator<T>[]
): FieldValidator<T> => ({
  field: validators[0]?.field || 'unknown',
  rules: validators.flatMap(v => v.rules),
  validate: (value: T) => {
    const errors: ValidationError[] = [];
    for (const validator of validators) {
      errors.push(...validator.validate(value));
    }
    return errors;
  },
});

// Async validation support
export type AsyncValidationRule<T> = (value: T) => Promise<ValidationError | null>;

export interface AsyncFieldValidator<T> {
  field: string;
  rules: AsyncValidationRule<T>[];
  validate(value: T): Promise<ValidationError[]>;
}

export const validateFieldAsync = async <T>(
  validator: AsyncFieldValidator<T>,
  value: T
): Promise<ValidationResult<T>> => {
  const errors = await validator.validate(value);
  
  if (errors.length > 0) {
    return { success: false, error: errors[0]! };
  }
  
  return { success: true, value };
};

// ============================================================================
// Common Validation Patterns
// ============================================================================

// Create a branded type validator
export const createBrandedValidator = <T, TBrand extends string>(
  baseName: string,
  constructor: (value: T) => Brand<T, TBrand>,
  baseValidator: FieldValidator<T>
) => {
  return field(baseName).custom<T>()
    .rule((value: T) => {
      // First validate the base value
      const baseErrors = baseValidator.validate(value);
      if (baseErrors.length > 0) {
        return baseErrors[0]!;
      }
      
      // Then try to construct the branded type
      try {
        constructor(value);
        return null;
      } catch (error) {
        return ErrorFactory.validation({
          code: 'INVALID_FORMAT',
          message: error instanceof Error ? error.message : `Invalid ${baseName}`,
          field: baseName,
          value,
        });
      }
    })
    .build();
};

// Conditional validation
export const conditionalValidator = <T>(
  condition: (value: T) => boolean,
  validator: FieldValidator<T>
): ValidationRule<T> => {
  return (value: T) => {
    if (condition(value)) {
      const errors = validator.validate(value);
      return errors[0] || null;
    }
    return null;
  };
};

// Optional field validation (only validates if present)
export const optionalValidator = <T>(
  validator: FieldValidator<T>
): ValidationRule<T | undefined | null> => {
  return (value: T | undefined | null) => {
    if (value != null) {
      const errors = validator.validate(value);
      return errors[0] || null;
    }
    return null;
  };
};