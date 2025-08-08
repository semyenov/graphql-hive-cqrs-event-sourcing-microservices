/**
 * Framework Core: Validation System
 * 
 * Type-safe validation with improved inference and clean API.
 * This replaces the old validation system with a simpler, more powerful approach.
 */

import type { ICommand } from './command';
import type { IQuery } from './query';

/**
 * Enhanced validation error with better context
 */
export interface IValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: unknown;
  readonly path?: string; // Nested field path
}

/**
 * Enhanced validation result
 */
export interface IValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<IValidationError>;
  readonly summary?: string; // Human-readable summary
}

/**
 * Enhanced validation rule with better type inference
 */
export type ValidationRule<T = unknown> = {
  (value: T): IValidationError | null;
} | {
  (value: T): Promise<IValidationError | null>;
};

/**
 * Type-safe validation rule creator
 */
export interface RuleCreator<T> {
  (value: T): IValidationError | null | Promise<IValidationError | null>;
}

/**
 * Enhanced validation schema with automatic type inference
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: T[K] extends string 
    ? StringValidationRule | StringValidationRule[]
    : T[K] extends number 
    ? NumberValidationRule | NumberValidationRule[] 
    : T[K] extends boolean
    ? BooleanValidationRule | BooleanValidationRule[]
    : T[K] extends Array<infer U>
    ? ArrayValidationRule<U> | ArrayValidationRule<U>[]
    : T[K] extends Record<string, unknown>
    ? NestedValidationRule<T[K]> | NestedValidationRule<T[K]>[]
    : ValidationRule<T[K]> | ValidationRule<T[K]>[];
};

/**
 * Specialized validation rule types for better inference
 */
export type StringValidationRule = ValidationRule<string>;
export type NumberValidationRule = ValidationRule<number>;
export type BooleanValidationRule = ValidationRule<boolean>;
export type ArrayValidationRule<T> = ValidationRule<T[]>;
export type NestedValidationRule<T> = ValidationRule<T>;

/**
 * Enhanced validator interface
 */
export interface IValidator<T> {
  validate(value: T): IValidationResult | Promise<IValidationResult>;
  validateField(field: keyof T, value: T[keyof T]): Promise<IValidationError | null>;
}

/**
 * Enhanced command validator with better typing
 */
export interface ICommandValidator<TCommand extends ICommand> extends IValidator<TCommand> {
  validatePayload(payload: TCommand['payload']): Promise<IValidationResult>;
}

/**
 * Enhanced query validator with better typing
 */
export interface IQueryValidator<TQuery extends IQuery> extends IValidator<TQuery> {
  validateParameters(parameters: TQuery['parameters']): Promise<IValidationResult>;
}

/**
 * Enhanced base validator with auto-inference
 */
export abstract class BaseValidator<T> implements IValidator<T> {
  protected rules: ValidationRule<T>[] = [];
  protected fieldRules: Map<keyof T, ValidationRule<T[keyof T]>[]> = new Map();

  /**
   * Add global validation rule
   */
  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Add field-specific validation rule
   */
  addFieldRule<K extends keyof T>(field: K, rule: ValidationRule<T[K]>): this {
    const existing = this.fieldRules.get(field) || [];
    existing.push(rule as ValidationRule<T[keyof T]>);
    this.fieldRules.set(field, existing);
    return this;
  }

  /**
   * Validate entire value
   */
  async validate(value: T): Promise<IValidationResult> {
    const errors: IValidationError[] = [];

    // Run global rules
    for (const rule of this.rules) {
      const error = await rule(value);
      if (error) {
        errors.push(error);
      }
    }

    // Run field-specific rules
    for (const [field, fieldRules] of this.fieldRules) {
      const fieldValue = value[field];
      for (const rule of fieldRules) {
        const error = await rule(fieldValue);
        if (error) {
          errors.push({
            ...error,
            field: String(field),
            path: String(field),
          });
        }
      }
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      summary: isValid ? 'Valid' : `${errors.length} validation error(s)`,
    };
  }

  /**
   * Validate single field
   */
  async validateField(field: keyof T, value: T[keyof T]): Promise<IValidationError | null> {
    const fieldRules = this.fieldRules.get(field) || [];
    for (const rule of fieldRules) {
      const error = await rule(value);
      if (error) {
        return {
          ...error,
          field: String(field),
          path: String(field),
        };
      }
    }
    return null;
  }
}

/**
 * Enhanced schema validator with automatic type inference
 */
export class SchemaValidator<T extends Record<string, unknown>> extends BaseValidator<T> {
  constructor(private readonly schema: ValidationSchema<T>) {
    super();
    this.buildRules();
  }

  /**
   * Build rules from schema with type inference
   */
  private buildRules(): void {
    for (const [field, rules] of Object.entries(this.schema)) {
      const typedField = field as keyof T;
      const fieldRules = Array.isArray(rules) ? rules : [rules];

      for (const rule of fieldRules) {
        if (rule) {
          this.addFieldRule(typedField, rule as ValidationRule<T[keyof T]>);
        }
      }
    }
  }
}

/**
 * Enhanced validation rules with better type inference
 */
export const ValidationRules = {
  /**
   * Required field with type safety
   */
  required<T>(message = 'Field is required', code = 'REQUIRED'): ValidationRule<T | null | undefined> {
    return (value) => {
      if (value === null || value === undefined || value === '') {
        return { field: '', message, code };
      }
      return null;
    };
  },

  /**
   * String validation rules
   */
  string: {
    length(min: number, max: number, message?: string): StringValidationRule {
      return (value) => {
        if (value.length < min || value.length > max) {
          return {
            field: '',
            message: message ?? `Length must be between ${min} and ${max}`,
            code: 'STRING_LENGTH',
            value,
          };
        }
        return null;
      };
    },

    pattern(regex: RegExp, message = 'Invalid format'): StringValidationRule {
      return (value) => {
        if (!regex.test(value)) {
          return { field: '', message, code: 'STRING_PATTERN', value };
        }
        return null;
      };
    },

    email(message = 'Invalid email address'): StringValidationRule {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return ValidationRules.string.pattern(emailRegex, message);
    },

    uuid(message = 'Invalid UUID format'): StringValidationRule {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return ValidationRules.string.pattern(uuidRegex, message);
    },

    url(message = 'Invalid URL'): StringValidationRule {
      return (value) => {
        try {
          new URL(value);
          return null;
        } catch {
          return { field: '', message, code: 'STRING_URL', value };
        }
      };
    },

    notEmpty(message = 'Field cannot be empty'): StringValidationRule {
      return (value) => {
        if (value.trim().length === 0) {
          return { field: '', message, code: 'STRING_EMPTY', value };
        }
        return null;
      };
    },
  },

  /**
   * Number validation rules
   */
  number: {
    range(min: number, max: number, message?: string): NumberValidationRule {
      return (value) => {
        if (value < min || value > max) {
          return {
            field: '',
            message: message ?? `Value must be between ${min} and ${max}`,
            code: 'NUMBER_RANGE',
            value,
          };
        }
        return null;
      };
    },

    min(minValue: number, message?: string): NumberValidationRule {
      return (value) => {
        if (value < minValue) {
          return {
            field: '',
            message: message ?? `Value must be at least ${minValue}`,
            code: 'NUMBER_MIN',
            value,
          };
        }
        return null;
      };
    },

    max(maxValue: number, message?: string): NumberValidationRule {
      return (value) => {
        if (value > maxValue) {
          return {
            field: '',
            message: message ?? `Value must be at most ${maxValue}`,
            code: 'NUMBER_MAX',
            value,
          };
        }
        return null;
      };
    },

    integer(message = 'Value must be an integer'): NumberValidationRule {
      return (value) => {
        if (!Number.isInteger(value)) {
          return { field: '', message, code: 'NUMBER_INTEGER', value };
        }
        return null;
      };
    },

    positive(message = 'Value must be positive'): NumberValidationRule {
      return (value) => {
        if (value <= 0) {
          return { field: '', message, code: 'NUMBER_POSITIVE', value };
        }
        return null;
      };
    },
  },

  /**
   * Array validation rules
   */
  array: {
    length<T>(min: number, max: number, message?: string): ArrayValidationRule<T> {
      return (value) => {
        if (value.length < min || value.length > max) {
          return {
            field: '',
            message: message ?? `Array length must be between ${min} and ${max}`,
            code: 'ARRAY_LENGTH',
          };
        }
        return null;
      };
    },

    notEmpty<T>(message = 'Array cannot be empty'): ArrayValidationRule<T> {
      return (value) => {
        if (value.length === 0) {
          return { field: '', message, code: 'ARRAY_EMPTY' };
        }
        return null;
      };
    },

    unique<T>(message = 'Array must contain unique values'): ArrayValidationRule<T> {
      return (value) => {
        const seen = new Set(value);
        if (seen.size !== value.length) {
          return { field: '', message, code: 'ARRAY_UNIQUE' };
        }
        return null;
      };
    },

    items<T>(itemRule: ValidationRule<T>, message?: string): ArrayValidationRule<T> {
      return (value) => {
        for (let i = 0; i < value.length; i++) {
          const error = itemRule(value[i]!);
          if (error) {
            return {
              ...error,
              field: `[${i}]`,
              path: `[${i}]`,
              message: message ?? `Invalid item at index ${i}: ${error.message}`,
            };
          }
        }
        return null;
      };
    },
  },

  /**
   * Custom validation with type inference
   */
  custom<T>(
    validator: (value: T) => boolean | Promise<boolean>,
    message: string,
    code = 'CUSTOM'
  ): ValidationRule<T> {
    return async (value) => {
      const isValid = await validator(value);
      if (!isValid) {
        return { field: '', message, code, value };
      }
      return null;
    };
  },

  /**
   * Conditional validation
   */
  when<T, TContext>(
    condition: (value: T, context?: TContext) => boolean,
    rule: ValidationRule<T>,
    elseRule?: ValidationRule<T>
  ): ValidationRule<T> {
    return async (value: T, context?: TContext) => {
      if (condition(value, context)) {
        return rule(value);
      } else if (elseRule) {
        return elseRule(value);
      }
      return null;
    };
  },

  /**
   * Enum/OneOf validation with type inference
   */
  oneOf<T>(values: readonly T[], message?: string): ValidationRule<T> {
    return (value) => {
      if (!values.includes(value)) {
        return {
          field: '',
          message: message ?? `Value must be one of: ${values.join(', ')}`,
          code: 'ONE_OF',
          value,
        };
      }
      return null;
    };
  },

  /**
   * Nested object validation with type inference
   */
  nested<T extends Record<string, unknown>>(
    schema: ValidationSchema<T>
  ): NestedValidationRule<T> {
    return (value) => {
      if (!value) {
        return { field: '', message: 'Nested object is required', code: 'NESTED_REQUIRED' };
      }
      // Simplified nested validation - return null for now
      return null;
    };
  },
};

/**
 * Enhanced fluent validation builder with type safety
 */
export class ValidationBuilder<T> {
  private rules: ValidationRule<T>[] = [];

  /**
   * Add custom rule
   */
  rule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Require value
   */
  required(message?: string): this {
    return this.rule(ValidationRules.required<T>(message));
  }

  /**
   * Custom validation
   */
  custom(
    validator: (value: T) => boolean | Promise<boolean>,
    message: string,
    code?: string
  ): this {
    return this.rule(ValidationRules.custom(validator, message, code));
  }

  /**
   * Conditional validation
   */
  when<TContext>(
    condition: (value: T, context?: TContext) => boolean,
    thenBuilder: (builder: ValidationBuilder<T>) => ValidationBuilder<T>,
    elseBuilder?: (builder: ValidationBuilder<T>) => ValidationBuilder<T>
  ): this {
    const thenRule = thenBuilder(new ValidationBuilder<T>()).build();
    const elseRule = elseBuilder ? elseBuilder(new ValidationBuilder<T>()).build() : undefined;

    return this.rule(ValidationRules.when(
      condition,
      (value) => thenRule.validate(value as T),
      elseRule ? (value) => elseRule.validate(value as T) : undefined
    ) as ValidationRule<T>);
  }

  /**
   * Build validator
   */
  build(): IValidator<T> {
    const rules = [...this.rules];
    return {
      validate: async (value: T) => {
        const errors: IValidationError[] = [];

        for (const rule of rules) {
          const error = await rule(value);
          if (error) {
            errors.push(error);
          }
        }

        return {
          isValid: errors.length === 0,
          errors,
          summary: errors.length === 0 ? 'Valid' : `${errors.length} error(s)`,
        };
      },

      validateField: async () => null, // Not applicable for builder validators
    };
  }
}

/**
 * Enhanced factory functions
 */
export function createValidator<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>
): IValidator<T> {
  return new SchemaValidator(schema);
}

export function createCommandValidator<TCommand extends ICommand>(
  schema: ValidationSchema<TCommand['payload']>
): ICommandValidator<TCommand> {
  const payloadValidator = new SchemaValidator(schema);

  return {
    validate: async (command: TCommand) => {
      return payloadValidator.validate(command.payload);
    },

    validateField: async (field, value) => {
      return payloadValidator.validateField(field, value);
    },

    validatePayload: async (payload: TCommand['payload']) => {
      return payloadValidator.validate(payload);
    },
  };
}

export function createQueryValidator<TQuery extends IQuery>(
  schema: ValidationSchema<NonNullable<TQuery['parameters']>>
): IQueryValidator<TQuery> {
  const parametersValidator = new SchemaValidator(schema);

  return {
    validate: async (query: TQuery) => {
      if (!query.parameters) {
        return { isValid: true, errors: [], summary: 'Valid (no parameters)' };
      }
      return parametersValidator.validate(query.parameters);
    },

    validateField: async (field, value) => {
      return parametersValidator.validateField(field, value);
    },

    validateParameters: async (parameters: TQuery['parameters']) => {
      if (!parameters) {
        return { isValid: true, errors: [], summary: 'Valid (no parameters)' };
      }
      return parametersValidator.validate(parameters);
    },
  };
}

/**
 * Type-safe validator builder function
 */
export function validator<T>(): ValidationBuilder<T> {
  return new ValidationBuilder<T>();
}

/**
 * Convenience functions for common patterns
 */
export const Validate = {
  string: () => validator<string>().rule(ValidationRules.string.notEmpty()),
  email: () => validator<string>().rule(ValidationRules.string.email()),
  required: <T>() => validator<T>().required(),
  array: <T>() => validator<T[]>().rule(ValidationRules.array.notEmpty()),
  number: () => validator<number>().rule(ValidationRules.number.positive()),
};

/**
 * Combine multiple validators into one
 */
export function combineValidators<T>(...validators: IValidator<T>[]): IValidator<T> {
  return {
    async validate(value: T): Promise<IValidationResult> {
      const allErrors: IValidationError[] = [];
      let isValid = true;

      for (const validator of validators) {
        const result = await validator.validate(value);
        if (!result.isValid) {
          isValid = false;
          allErrors.push(...result.errors);
        }
      }

      return {
        isValid,
        errors: allErrors,
        summary: isValid ? 'Validation passed' : `Validation failed with ${allErrors.length} errors`
      };
    },
    
    async validateField(field: keyof T, value: T[keyof T]): Promise<IValidationError | null> {
      for (const validator of validators) {
        if ('validateField' in validator) {
          const error = await validator.validateField(field, value);
          if (error) return error;
        }
      }
      return null;
    }
  };
}