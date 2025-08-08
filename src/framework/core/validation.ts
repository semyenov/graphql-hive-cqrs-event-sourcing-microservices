/**
 * Framework Core: Validation
 * 
 * Type-safe validation framework for commands, queries, and domain objects.
 */

import type { ICommand } from './command';
import type { IQuery } from './query';

/**
 * Validation error
 */
export interface IValidationError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
  readonly value?: unknown;
}

/**
 * Validation result
 */
export interface IValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<IValidationError>;
}

/**
 * Validator interface
 */
export interface IValidator<T> {
  validate(value: T): IValidationResult | Promise<IValidationResult>;
}

/**
 * Command validator
 */
export interface ICommandValidator<TCommand extends ICommand = ICommand> 
  extends IValidator<TCommand> {}

/**
 * Query validator
 */
export interface IQueryValidator<TQuery extends IQuery = IQuery> 
  extends IValidator<TQuery> {}

/**
 * Validation rule
 */
export type ValidationRule<T> = (value: T) => IValidationError | null | Promise<IValidationError | null>;

/**
 * Validation schema
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]> | ValidationRule<T[K]>[];
};

/**
 * Base validator implementation
 */
export abstract class BaseValidator<T> implements IValidator<T> {
  protected rules: ValidationRule<T>[] = [];

  /**
   * Add validation rule
   */
  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Validate value
   */
  async validate(value: T): Promise<IValidationResult> {
    const errors: IValidationError[] = [];

    for (const rule of this.rules) {
      const error = await rule(value);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Schema-based validator
 */
export class SchemaValidator<T extends Record<string, unknown>> 
  extends BaseValidator<T> {
  
  constructor(private readonly schema: ValidationSchema<T>) {
    super();
    this.buildRules();
  }

  /**
   * Build rules from schema
   */
  private buildRules(): void {
    for (const [field, rules] of Object.entries(this.schema)) {
      const fieldRules = Array.isArray(rules) ? rules : [rules];
      
      for (const rule of fieldRules) {
        if (rule) {
          this.addRule(async (value) => {
            const fieldValue = value[field as keyof T];
            const error = await (rule as ValidationRule<unknown>)(fieldValue);
            return error ? { ...error, field } : null;
          });
        }
      }
    }
  }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  /**
   * Required field
   */
  required(message = 'Field is required'): ValidationRule<unknown> {
    return (value) => {
      if (value === null || value === undefined || value === '') {
        return { field: '', message, code: 'REQUIRED' };
      }
      return null;
    };
  },

  /**
   * String length
   */
  length(min: number, max: number, message?: string): ValidationRule<string> {
    return (value) => {
      if (value.length < min || value.length > max) {
        return {
          field: '',
          message: message ?? `Length must be between ${min} and ${max}`,
          code: 'LENGTH',
          value,
        };
      }
      return null;
    };
  },

  /**
   * Pattern match
   */
  pattern(regex: RegExp, message = 'Invalid format'): ValidationRule<string> {
    return (value) => {
      if (!regex.test(value)) {
        return { field: '', message, code: 'PATTERN', value };
      }
      return null;
    };
  },

  /**
   * Email validation
   */
  email(message = 'Invalid email address'): ValidationRule<string> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return ValidationRules.pattern(emailRegex, message);
  },

  /**
   * Number range
   */
  range(min: number, max: number, message?: string): ValidationRule<number> {
    return (value) => {
      if (value < min || value > max) {
        return {
          field: '',
          message: message ?? `Value must be between ${min} and ${max}`,
          code: 'RANGE',
          value,
        };
      }
      return null;
    };
  },

  /**
   * Custom validation
   */
  custom<T>(
    validator: (value: T) => boolean | Promise<boolean>,
    message: string
  ): ValidationRule<T> {
    return async (value) => {
      const isValid = await validator(value);
      if (!isValid) {
        return { field: '', message, code: 'CUSTOM', value };
      }
      return null;
    };
  },

  /**
   * Enum validation
   */
  oneOf<T>(values: T[], message?: string): ValidationRule<T> {
    return (value) => {
      if (!values.includes(value)) {
        return {
          field: '',
          message: message ?? `Value must be one of: ${values.join(', ')}`,
          code: 'ENUM',
          value,
        };
      }
      return null;
    };
  },

  /**
   * UUID validation
   */
  uuid(message = 'Invalid UUID format'): ValidationRule<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return ValidationRules.pattern(uuidRegex, message);
  },

  /**
   * URL validation
   */
  url(message = 'Invalid URL'): ValidationRule<string> {
    return (value) => {
      try {
        new URL(value);
        return null;
      } catch {
        return { field: '', message, code: 'URL', value };
      }
    };
  },

  /**
   * Date validation
   */
  date(message = 'Invalid date'): ValidationRule<string | Date> {
    return (value) => {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) {
        return { field: '', message, code: 'DATE', value };
      }
      return null;
    };
  },

  /**
   * Array validation
   */
  array<T>(
    itemValidator?: ValidationRule<T>,
    minLength?: number,
    maxLength?: number
  ): ValidationRule<T[]> {
    return async (value) => {
      if (!Array.isArray(value)) {
        return { field: '', message: 'Value must be an array', code: 'ARRAY' };
      }

      if (minLength !== undefined && value.length < minLength) {
        return {
          field: '',
          message: `Array must have at least ${minLength} items`,
          code: 'ARRAY_MIN',
        };
      }

      if (maxLength !== undefined && value.length > maxLength) {
        return {
          field: '',
          message: `Array must have at most ${maxLength} items`,
          code: 'ARRAY_MAX',
        };
      }

      if (itemValidator) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (item !== undefined) {
            const error = await itemValidator(item);
            if (error) {
              return {
                ...error,
                field: `[${i}]`,
              };
            }
          }
        }
      }

      return null;
    };
  },

  /**
   * Nested object validation
   */
  nested<T extends Record<string, unknown>>(
    schema: ValidationSchema<T>
  ): ValidationRule<T> {
    return async (value) => {
      if (!value) {
        return { field: '', message: 'Value is required', code: 'REQUIRED' };
      }
      const validator = new SchemaValidator(schema);
      const result = await validator.validate(value);
      if (!result.isValid && result.errors.length > 0) {
        return result.errors[0] || null;
      }
      return null;
    };
  },
};

/**
 * Validation builder for fluent API
 */
export class ValidationBuilder<T> {
  private rules: ValidationRule<T>[] = [];

  /**
   * Add rule
   */
  rule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Required
   */
  required(message?: string): this {
    return this.rule(ValidationRules.required(message) as ValidationRule<T>);
  }

  /**
   * Custom rule
   */
  custom(
    validator: (value: T) => boolean | Promise<boolean>,
    message: string
  ): this {
    return this.rule(ValidationRules.custom(validator, message));
  }

  /**
   * Build validator
   */
  build(): IValidator<T> {
    return {
      validate: async (value: T) => {
        const errors: IValidationError[] = [];

        for (const rule of this.rules) {
          const error = await rule(value);
          if (error) {
            errors.push(error);
          }
        }

        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    };
  }
}

/**
 * Create validator from schema
 */
export function createValidator<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>
): IValidator<T> {
  return new SchemaValidator(schema);
}

/**
 * Create command validator
 */
export function createCommandValidator<TCommand extends ICommand>(
  schema: ValidationSchema<Record<string, unknown>>
): ICommandValidator<TCommand> {
  const payloadValidator = new SchemaValidator(schema);
  
  return {
    validate: async (command: TCommand) => {
      return payloadValidator.validate(command.payload as Record<string, unknown>);
    },
  };
}

/**
 * Create query validator
 */
export function createQueryValidator<TQuery extends IQuery>(
  schema: ValidationSchema<Record<string, unknown>>
): IQueryValidator<TQuery> {
  const parametersValidator = new SchemaValidator(schema);
  
  return {
    validate: async (query: TQuery) => {
      if (!query.parameters) {
        return { isValid: true, errors: [] };
      }
      return parametersValidator.validate(query.parameters as Record<string, unknown>);
    },
  };
}

/**
 * Combine validators
 */
export function combineValidators<T>(
  ...validators: IValidator<T>[]
): IValidator<T> {
  return {
    validate: async (value: T) => {
      const allErrors: IValidationError[] = [];
      
      for (const validator of validators) {
        const result = await validator.validate(value);
        if (!result.isValid) {
          allErrors.push(...result.errors);
        }
      }
      
      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
      };
    },
  };
}