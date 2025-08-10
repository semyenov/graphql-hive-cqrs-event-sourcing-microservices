/**
 * Framework Validation: Validators
 * 
 * Validation utilities and middleware for commands, events, and queries.
 */

import { z } from 'zod';
import type { ICommand, ICommandValidator, ValidationResult, ValidationError as IValidationError } from '../core/command';
import type { IEvent } from '../core/event';
import type { IQuery } from '../core/query';
import { ValidationError } from './errors';

/**
 * Generic validator that uses Zod schemas
 */
export class ZodValidator<T> implements ICommandValidator<T extends ICommand ? T : never> {
  constructor(private readonly schema: z.ZodSchema<T>) {}

  async validate(input: T): Promise<ValidationResult> {
    const result = await this.schema.safeParseAsync(input);
    
    if (result.success) {
      return { isValid: true };
    }

    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Create a validator from a Zod schema
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return new ZodValidator(schema);
}

/**
 * Validation middleware for command bus
 */
export function validationMiddleware<T extends ICommand>(
  schema: z.ZodSchema<T>
) {
  return async (command: T, next: () => Promise<void>) => {
    const result = await schema.safeParseAsync(command);
    
    if (!result.success) {
      throw new ValidationError(
        'Command validation failed',
        result.error.errors
      );
    }
    
    return next();
  };
}

/**
 * Composite validator that runs multiple validators
 */
export class CompositeValidator<T extends ICommand> implements ICommandValidator<T> {
  private validators: ICommandValidator<T>[] = [];

  add(validator: ICommandValidator<T>): this {
    this.validators.push(validator);
    return this;
  }

  async validate(command: T): Promise<ValidationResult> {
    const allErrors: Array<IValidationError> = [];
    
    for (const validator of this.validators) {
      const result = await validator.validate(command);
      if (!result.isValid && result.errors) {
        allErrors.push(...result.errors);
      }
    }

    if (allErrors.length > 0) {
      return {
        isValid: false,
        errors: allErrors,
      };
    }

    return { isValid: true };
  }
}

/**
 * Validate and transform input using schema
 */
export async function validateAndTransform<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): Promise<T> {
  try {
    return await schema.parseAsync(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Validation failed',
        error.errors
      );
    }
    throw error;
  }
}

/**
 * Type-safe validation helpers
 */
export const Validators = {
  /**
   * Validate command with schema
   */
  command<T extends ICommand>(schema: z.ZodSchema<T>) {
    return createValidator(schema);
  },

  /**
   * Validate event with schema
   */
  event<T extends IEvent>(schema: z.ZodSchema<T>) {
    return async (event: T): Promise<ValidationResult> => {
      const result = await schema.safeParseAsync(event);
      return result.success 
        ? { isValid: true }
        : { isValid: false, errors: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))};
    };
  },

  /**
   * Validate query with schema
   */
  query<T extends IQuery>(schema: z.ZodSchema<T>) {
    return async (query: T): Promise<ValidationResult> => {
      const result = await schema.safeParseAsync(query);
      return result.success 
        ? { isValid: true }
        : { isValid: false, errors: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))};
    };
  },

  /**
   * Create custom validator with predicate
   */
  custom<T>(
    predicate: (value: T) => boolean | Promise<boolean>,
    errorMessage: string
  ): ICommandValidator<T extends ICommand ? T : never> {
    return {
      async validate(value: T): Promise<ValidationResult> {
        const isValidResult = await predicate(value);
        return isValidResult
          ? { isValid: true }
          : { isValid: false, errors: [{ field: '', message: errorMessage }] };
      },
    };
  },
};