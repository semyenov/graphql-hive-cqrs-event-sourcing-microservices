/**
 * Framework Validation: Type Utilities
 * 
 * Advanced TypeScript type utilities for validation and type inference.
 * Provides compile-time type safety and runtime validation integration.
 */

import type { z } from 'zod';
import { ICommand } from '../_legacy/core/command';

/**
 * Infer the TypeScript type from a Zod schema
 */
export type InferSchema<T extends z.ZodSchema> = z.infer<T>;

/**
 * Extract the input type of a Zod schema (before transformations)
 */
export type InferInput<T extends z.ZodSchema> = z.input<T>;

/**
 * Extract the output type of a Zod schema (after transformations)
 */
export type InferOutput<T extends z.ZodSchema> = z.output<T>;

/**
 * Make specific properties optional in a schema type
 */
export type PartialSchema<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required in a schema type
 */
export type RequiredSchema<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type for nested objects
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Deep required type for nested objects
 */
export type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

/**
 * Extract keys that have string values
 */
export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

/**
 * Extract keys that have number values
 */
export type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/**
 * Extract keys that have boolean values
 */
export type BooleanKeys<T> = {
  [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

/**
 * Validated type wrapper
 */
export type Validated<T> = {
  readonly _tag: 'Validated';
  readonly value: T;
};

/**
 * Create a validated type
 */
export const validated = <T>(value: T): Validated<T> => ({
  _tag: 'Validated',
  value,
});

/**
 * Type guard for validated types
 */
export const isValidated = <T>(value: unknown): value is Validated<T> =>
  typeof value === 'object' &&
  value !== null &&
  '_tag' in value &&
  value._tag === 'Validated';

/**
 * Extract value from validated type
 */
export const unwrapValidated = <T>(validated: Validated<T>): T => validated.value;

/**
 * Schema type with metadata
 */
export interface SchemaWithMetadata<T extends z.ZodSchema> {
  schema: T;
  version: number;
  description?: string;
  deprecated?: boolean;
  migration?: {
    from: number;
    to: number;
    transform: (data: unknown) => unknown;
  };
}

/**
 * Command schema type with validation
 */
export interface ValidatedCommand<T> {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: T;
  readonly metadata?: {
    readonly validated: true;
    readonly validatedAt: string;
    readonly schemaVersion: number;
  };
}

/**
 * Event schema type with validation
 */
export interface ValidatedEvent<T> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly version: number;
  readonly data: T;
  readonly metadata?: {
    readonly validated: true;
    readonly validatedAt: string;
    readonly schemaVersion: number;
  };
}

/**
 * Type-safe schema builder
 */
export class SchemaBuilder<T = {}> {
  private shape: T;

  constructor(shape: T = {} as T) {
    this.shape = shape;
  }

  add<K extends string, V>(
    key: K,
    value: V
  ): SchemaBuilder<T & Record<K, V>> {
    return new SchemaBuilder({
      ...this.shape,
      [key]: value,
    } as T & Record<K, V>);
  }

  optional<K extends keyof T>(
    key: K
  ): SchemaBuilder<Omit<T, K> & Partial<Pick<T, K>>> {
    return new SchemaBuilder(this.shape) as any;
  }

  required<K extends keyof T>(
    key: K
  ): SchemaBuilder<Omit<T, K> & Required<Pick<T, K>>> {
    return new SchemaBuilder(this.shape) as any;
  }

  build(): T {
    return this.shape;
  }
}

/**
 * Conditional type for validation results
 */
export type ValidationResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Type predicate for successful validation
 */
export const isValidationSuccess = <T, E>(
  result: ValidationResult<T, E>
): result is { success: true; data: T } => result.success === true;

/**
 * Type predicate for failed validation
 */
export const isValidationError = <T, E>(
  result: ValidationResult<T, E>
): result is { success: false; error: E } => result.success === false;

/**
 * Schema composition types
 */
export type MergeSchemas<T, U> = T & U;
export type UnionSchemas<T, U> = T | U;
export type IntersectionSchemas<T, U> = T extends U ? T : U extends T ? U : T & U;

/**
 * Template literal types for event/command names
 */
export type PascalCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

export type CamelCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S;

export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${SnakeCase<U>}`
    : `${Lowercase<T>}_${SnakeCase<U>}`
  : S;

export type KebabCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${KebabCase<U>}`
    : `${Lowercase<T>}-${KebabCase<U>}`
  : S;

/**
 * Event name builder type
 */
export type EventName<
  Domain extends string,
  Entity extends string,
  Action extends string
> = `${Uppercase<Domain>}_${Uppercase<Entity>}_${Uppercase<Action>}`;

/**
 * Command name builder type
 */
export type CommandName<
  Action extends string,
  Entity extends string
> = `${PascalCase<Action>}${PascalCase<Entity>}`;

/**
 * Branded validation types
 */
export type ValidatedString<Brand extends string> = string & {
  readonly __brand: Brand;
  readonly __validated: true;
};

export type ValidatedNumber<Brand extends string> = number & {
  readonly __brand: Brand;
  readonly __validated: true;
};

/**
 * Create branded validated types
 */
export const brandString = <Brand extends string>(
  value: string,
  brand: Brand
): ValidatedString<Brand> => value as ValidatedString<Brand>;

export const brandNumber = <Brand extends string>(
  value: number,
  brand: Brand
): ValidatedNumber<Brand> => value as ValidatedNumber<Brand>;

/**
 * Discriminated union helpers
 */
export type DiscriminatedUnion<T extends { type: string }> = T;

export type ExtractByType<
  T extends { type: string },
  Type extends T['type']
> = Extract<T, { type: Type }>;

export type ExcludeByType<
  T extends { type: string },
  Type extends T['type']
> = Exclude<T, { type: Type }>;

export type CommandMiddleware<TCommand extends ICommand, TResult> = (
  command: TCommand
) => TResult;

/**
 * Validation middleware type
 */
export type ValidationMiddleware<TInput, TOutput> = (
  input: TInput
) => Promise<ValidationResult<TOutput>>;

/**
 * Schema registry type
 */
export interface SchemaRegistry {
  register<T>(name: string, schema: z.ZodSchema<T>): void;
  get<T>(name: string): z.ZodSchema<T> | undefined;
  has(name: string): boolean;
  list(): string[];
}

/**
 * Type-safe error types for validation
 */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code?: string;
  expected?: string;
  received?: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  data?: unknown;
  timestamp: string;
}