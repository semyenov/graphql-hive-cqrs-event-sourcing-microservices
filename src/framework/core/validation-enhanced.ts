/**
 * Framework Core: Enhanced Validation System v2
 * 
 * Improved type inference and elimination of type assertion workarounds.
 */

import type { ICommand } from './command';
import type { IQuery } from './query';

/**
 * Enhanced validation error with better context
 */
export interface IValidationErrorV2 {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: unknown;
  readonly path?: string; // Nested field path
}

/**
 * Enhanced validation result
 */
export interface IValidationResultV2 {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<IValidationErrorV2>;
  readonly summary?: string; // Human-readable summary
}

/**
 * Enhanced validation rule with better type inference
 */
export type ValidationRuleV2<T = unknown> = {
  (value: T): IValidationErrorV2 | null;
} | {
  (value: T): Promise<IValidationErrorV2 | null>;
};

/**
 * Type-safe validation rule creator
 */
export interface RuleCreator<T> {
  (value: T): IValidationErrorV2 | null | Promise<IValidationErrorV2 | null>;
}

/**
 * Enhanced validation schema with automatic type inference
 */
export type ValidationSchemaV2<T> = {
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
    : ValidationRuleV2<T[K]> | ValidationRuleV2<T[K]>[];
};

/**
 * Specialized validation rule types for better inference
 */
export type StringValidationRule = ValidationRuleV2<string>;
export type NumberValidationRule = ValidationRuleV2<number>;
export type BooleanValidationRule = ValidationRuleV2<boolean>;
export type ArrayValidationRule<T> = ValidationRuleV2<T[]>;
export type NestedValidationRule<T> = ValidationRuleV2<T>;

/**
 * Enhanced validator interface
 */
export interface IValidatorV2<T> {
  validate(value: T): IValidationResultV2 | Promise<IValidationResultV2>;
  validateField(field: keyof T, value: T[keyof T]): Promise<IValidationErrorV2 | null>;
}

/**
 * Enhanced command validator with better typing
 */
export interface ICommandValidatorV2<TCommand extends ICommand> extends IValidatorV2<TCommand> {
  validatePayload(payload: TCommand['payload']): Promise<IValidationResultV2>;
}

/**
 * Enhanced query validator with better typing
 */
export interface IQueryValidatorV2<TQuery extends IQuery> extends IValidatorV2<TQuery> {
  validateParameters(parameters: TQuery['parameters']): Promise<IValidationResultV2>;
}

/**
 * Enhanced base validator with auto-inference
 */
export abstract class BaseValidatorV2<T> implements IValidatorV2<T> {
  protected rules: ValidationRuleV2<T>[] = [];
  protected fieldRules: Map<keyof T, ValidationRuleV2<T[keyof T]>[]> = new Map();

  /**
   * Add global validation rule
   */
  addRule(rule: ValidationRuleV2<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Add field-specific validation rule
   */
  addFieldRule<K extends keyof T>(field: K, rule: ValidationRuleV2<T[K]>): this {
    const existing = this.fieldRules.get(field) || [];
    existing.push(rule as ValidationRuleV2<T[keyof T]>);
    this.fieldRules.set(field, existing);
    return this;
  }

  /**
   * Validate entire value
   */
  async validate(value: T): Promise<IValidationResultV2> {
    const errors: IValidationErrorV2[] = [];

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
  async validateField(field: keyof T, value: T[keyof T]): Promise<IValidationErrorV2 | null> {
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
export class SchemaValidatorV2<T extends Record<string, unknown>> extends BaseValidatorV2<T> {
  constructor(private readonly schema: ValidationSchemaV2<T>) {
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
          this.addFieldRule(typedField, rule as ValidationRuleV2<T[keyof T]>);
        }
      }
    }
  }
}

/**
 * Enhanced validation rules with better type inference
 */
export const ValidationRulesV2 = {
  /**
   * Required field with type safety
   */
  required<T>(message = 'Field is required', code = 'REQUIRED'): ValidationRuleV2<T | null | undefined> {
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
      return ValidationRulesV2.string.pattern(emailRegex, message);
    },

    uuid(message = 'Invalid UUID format'): StringValidationRule {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return ValidationRulesV2.string.pattern(uuidRegex, message);
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

    items<T>(itemRule: ValidationRuleV2<T>, message?: string): ArrayValidationRule<T> {
      return async (value) => {
        for (let i = 0; i < value.length; i++) {
          const error = await itemRule(value[i]);
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
  ): ValidationRuleV2<T> {
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
    rule: ValidationRuleV2<T>,
    elseRule?: ValidationRuleV2<T>
  ): ValidationRuleV2<T> {
    return async (value, context) => {
      if (condition(value, context as TContext)) {
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
  oneOf<T>(values: readonly T[], message?: string): ValidationRuleV2<T> {
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
    schema: ValidationSchemaV2<T>
  ): NestedValidationRule<T> {
    return async (value) => {
      if (!value) {
        return { field: '', message: 'Nested object is required', code: 'NESTED_REQUIRED' };
      }
      const validator = new SchemaValidatorV2(schema);
      const result = await validator.validate(value);
      if (!result.isValid && result.errors.length > 0) {
        return result.errors[0];
      }
      return null;
    };
  },
};

/**
 * Enhanced fluent validation builder with type safety
 */
export class ValidationBuilderV2<T> {
  private rules: ValidationRuleV2<T>[] = [];

  /**
   * Add custom rule
   */
  rule(rule: ValidationRuleV2<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Require value
   */
  required(message?: string): this {
    return this.rule(ValidationRulesV2.required<T>(message));
  }

  /**
   * Custom validation
   */
  custom(
    validator: (value: T) => boolean | Promise<boolean>,
    message: string,
    code?: string
  ): this {
    return this.rule(ValidationRulesV2.custom(validator, message, code));
  }

  /**
   * Conditional validation
   */
  when<TContext>(
    condition: (value: T, context?: TContext) => boolean,
    thenBuilder: (builder: ValidationBuilderV2<T>) => ValidationBuilderV2<T>,
    elseBuilder?: (builder: ValidationBuilderV2<T>) => ValidationBuilderV2<T>
  ): this {
    const thenRule = thenBuilder(new ValidationBuilderV2<T>()).build();
    const elseRule = elseBuilder ? elseBuilder(new ValidationBuilderV2<T>()).build() : undefined;

    return this.rule(ValidationRulesV2.when(
      condition,
      (value) => thenRule.validate(value as T),
      elseRule ? (value) => elseRule.validate(value as T) : undefined
    ) as ValidationRuleV2<T>);
  }

  /**
   * Build validator
   */
  build(): IValidatorV2<T> {
    const rules = [...this.rules];
    return {
      validate: async (value: T) => {
        const errors: IValidationErrorV2[] = [];

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
export function createValidatorV2<T extends Record<string, unknown>>(
  schema: ValidationSchemaV2<T>
): IValidatorV2<T> {
  return new SchemaValidatorV2(schema);
}

export function createCommandValidatorV2<TCommand extends ICommand>(
  schema: ValidationSchemaV2<TCommand['payload']>
): ICommandValidatorV2<TCommand> {
  const payloadValidator = new SchemaValidatorV2(schema);

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

export function createQueryValidatorV2<TQuery extends IQuery>(
  schema: ValidationSchemaV2<NonNullable<TQuery['parameters']>>
): IQueryValidatorV2<TQuery> {
  const parametersValidator = new SchemaValidatorV2(schema);

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
export function validatorV2<T>(): ValidationBuilderV2<T> {
  return new ValidationBuilderV2<T>();
}

/**
 * Convenience functions for common patterns
 */
export const Validate = {
  string: (value: string) => validatorV2<string>().rule(ValidationRulesV2.string.notEmpty()),
  email: (value: string) => validatorV2<string>().rule(ValidationRulesV2.string.email()),
  required: <T>(value: T) => validatorV2<T>().required(),
  array: <T>(value: T[]) => validatorV2<T[]>().rule(ValidationRulesV2.array.notEmpty()),
  number: (value: number) => validatorV2<number>().rule(ValidationRulesV2.number.positive()),
};