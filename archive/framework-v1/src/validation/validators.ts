/**
 * Framework Validation: Validators
 * 
 * Runtime validation functions for commands, events, and queries.
 * Provides middleware and utilities for integrating validation into the CQRS pipeline.
 */

import { z } from 'zod';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import type { ICommand, IEvent, IQuery } from '../effect/core/types';
import { CommandValidationError } from '../effect/core/command-effects';
import { EventProcessingError } from '../effect/core/event-effects';

/**
 * Validation error with detailed information
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  static fromZodError(error: z.ZodError, data?: unknown): ValidationError {
    const message = error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return new ValidationError(message, error.errors, data);
  }
}

/**
 * Validate data against a Zod schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Either.Either<T, ValidationError> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return Either.right(result.data);
  } else {
    return Either.left(ValidationError.fromZodError(result.error, data));
  }
}

/**
 * Validate data with Effect
 */
export function validateEffect<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Effect.Effect<T, ValidationError, never> {
  return pipe(
    Effect.sync(() => schema.safeParse(data)),
    Effect.flatMap((result) =>
      result.success
        ? Effect.succeed(result.data)
        : Effect.fail(ValidationError.fromZodError(result.error, data))
    )
  );
}

/**
 * Async validation with Effect
 */
export function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  asyncValidators?: Array<(value: T) => Effect.Effect<void, ValidationError, never>>
): Effect.Effect<T, ValidationError, never> {
  return pipe(
    validateEffect(schema, data),
    Effect.flatMap((validated) =>
      asyncValidators && asyncValidators.length > 0
        ? pipe(
            Effect.all(asyncValidators.map(v => v(validated))),
            Effect.map(() => validated)
          )
        : Effect.succeed(validated)
    )
  );
}

/**
 * Command validation middleware
 */
export function validateCommand<T extends ICommand>(
  schema: z.ZodSchema<T>
) {
  return <R>(
    handler: (command: T) => Effect.Effect<R, CommandValidationError, never>
  ) => {
    return (command: unknown): Effect.Effect<R, CommandValidationError, never> =>
      pipe(
        validateEffect(schema, command),
        Effect.mapError((error) =>
          new CommandValidationError({
            command: command as T,
            errors: error.issues.map(issue => issue.message),
          })
        ),
        Effect.flatMap(handler)
      );
  };
}

/**
 * Event validation middleware
 */
export function validateEvent<T extends IEvent>(
  schema: z.ZodSchema<T>
) {
  return <R>(
    handler: (event: T) => Effect.Effect<R, EventProcessingError, never>
  ) => {
    return (event: unknown): Effect.Effect<R, EventProcessingError, never> =>
      pipe(
        validateEffect(schema, event),
        Effect.mapError((error) =>
          new EventProcessingError({
            event: event as T,
            cause: error,
          })
        ),
        Effect.flatMap(handler)
      );
  };
}

/**
 * Query validation
 */
export function validateQuery<T extends IQuery>(
  schema: z.ZodSchema<T>,
  query: unknown
): Either.Either<T, ValidationError> {
  return validate(schema, query);
}

/**
 * Validation middleware for command handlers
 */
export function withValidation<TCommand extends ICommand, TResult>(
  schema: z.ZodSchema<TCommand>,
  handler: (command: TCommand) => Promise<TResult> | TResult
) {
  return async (command: unknown): Promise<TResult> => {
    const validation = validate(schema, command);
    
    if (Either.isLeft(validation)) {
      throw validation.left;
    }
    
    return handler(validation.right);
  };
}

/**
 * Batch validation
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[]
): Either.Either<T[], ValidationError[]> {
  const results = items.map(item => validate(schema, item));
  const errors = results.filter(Either.isLeft).map(r => (r as Either.Left<any, ValidationError>).left);
  
  if (errors.length > 0) {
    return Either.left(errors);
  }
  
  const validated = results.map(r => (r as Either.Right<T, any>).right);
  return Either.right(validated);
}

/**
 * Partial validation (validates only specified fields)
 */
export function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fields: Array<keyof T>
): Either.Either<Partial<T>, ValidationError> {
  const filteredData = Object.fromEntries(
    Object.entries(data as any).filter(([key]) => fields.includes(key as keyof T))
  );
  
  return validate(schema, filteredData);
}

/**
 * Schema composition utilities
 */
export const SchemaComposer = {
  /**
   * Merge multiple schemas
   */
  merge<T extends z.ZodRawShape, U extends z.ZodRawShape>(
    schema1: z.ZodObject<T>,
    schema2: z.ZodObject<U>
  ): z.ZodObject<T & U> {
    return schema1.merge(schema2) as z.ZodObject<T & U>;
  },

  /**
   * Extend a schema with additional fields
   */
  extend<T extends z.ZodRawShape, U extends z.ZodRawShape>(
    base: z.ZodObject<T>,
    extension: U
  ): z.ZodObject<T & U> {
    return base.extend(extension) as z.ZodObject<T & U>;
  },

  /**
   * Pick specific fields from a schema
   */
  pick<T extends z.ZodRawShape, K extends keyof T>(
    schema: z.ZodSchema<T>,
    keys: K[]
  ): z.ZodObject<Pick<T, K>> {
    return Object.fromEntries(
      Object.entries(schema).filter(([key]) => keys.includes(key as K))
    ) as z.ZodObject<Pick<T, K>>;
  },

  /**
   * Omit specific fields from a schema
   */
  omit<T extends z.ZodRawShape, K extends keyof T>(
    schema: z.ZodSchema<T>,
    keys: K[]
  ): z.ZodObject<Omit<T, K>> {
    return Object.fromEntries(
      Object.entries(schema).filter(([key]) => !keys.includes(key as K))
    ) as z.ZodObject<Omit<T, K>>;
  },
};

/**
 * Custom validators
 */
export const CustomValidators = {
  /**
   * Validate business rules
   */
  businessRule<T>(
    rule: (value: T) => boolean,
    message: string
  ): (value: T) => Effect.Effect<void, ValidationError, never> {
    return (value) =>
      rule(value)
        ? Effect.succeed(undefined)
        : Effect.fail(new ValidationError(message, [], value));
  },

  /**
   * Validate uniqueness (requires async check)
   */
  unique<T>(
    checkUnique: (value: T) => Promise<boolean>,
    field: string
  ): (value: T) => Effect.Effect<void, ValidationError, never> {
    return (value) =>
      pipe(
        Effect.tryPromise({
          try: () => checkUnique(value),
          catch: () => new ValidationError(`Failed to check uniqueness of ${field}`, [], value),
        }),
        Effect.flatMap((isUnique) =>
          isUnique
            ? Effect.succeed(undefined)
            : Effect.fail(new ValidationError(`${field} must be unique`, [], value))
        )
      );
  },

  /**
   * Validate dependencies between fields
   */
  dependency<T>(
    check: (value: T) => boolean,
    message: string
  ): (value: T) => Effect.Effect<void, ValidationError, never> {
    return (value) =>
      check(value)
        ? Effect.succeed(undefined)
        : Effect.fail(new ValidationError(message, [], value));
  },
};

/**
 * Validation cache for performance
 */
class ValidationCache {
  private cache = new Map<string, { result: any; timestamp: number }>();
  private ttl: number;

  constructor(ttlMs: number = 5000) {
    this.ttl = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result;
    }
    this.cache.delete(key);
    return undefined;
  }

  set<T>(key: string, result: T): void {
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const validationCache = new ValidationCache();

/**
 * Cached validation
 */
export function validateCached<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  cacheKey: string
): Either.Either<T, ValidationError> {
  const cached = validationCache.get<Either.Either<T, ValidationError>>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const result = validate(schema, data);
  validationCache.set(cacheKey, result);
  return result;
}