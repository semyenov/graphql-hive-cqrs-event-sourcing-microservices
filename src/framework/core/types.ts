/**
 * Framework Core: Type Definitions
 * 
 * Central type definitions and utility types for the framework.
 */

/**
 * Domain module interface for registering domain-specific components
 */
export interface IDomainModule<
  TEvents = unknown,
  TCommands = unknown,
  TQueries = unknown,
  TAggregates = unknown
> {
  readonly name: string;
  readonly version: string;
  readonly events?: TEvents;
  readonly commands?: TCommands;
  readonly queries?: TQueries;
  readonly aggregates?: TAggregates;
  readonly graphqlSchema?: string;
  readonly initialize?: () => Promise<void>;
  readonly shutdown?: () => Promise<void>;
}

/**
 * Domain registry for managing multiple domains
 */
export interface IDomainRegistry {
  register(module: IDomainModule): void;
  get(name: string): IDomainModule | null;
  getAll(): IDomainModule[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Framework configuration
 */
export interface IFrameworkConfig {
  readonly eventStore?: {
    readonly type: 'memory' | 'postgres' | 'mongodb';
    readonly connectionString?: string;
    readonly options?: Record<string, unknown>;
  };
  readonly commandBus?: {
    readonly middleware?: string[];
    readonly timeout?: number;
  };
  readonly queryBus?: {
    readonly cache?: boolean;
    readonly cacheTimeout?: number;
  };
  readonly graphql?: {
    readonly playground?: boolean;
    readonly introspection?: boolean;
    readonly tracing?: boolean;
  };
  readonly monitoring?: {
    readonly enabled?: boolean;
    readonly provider?: 'hive' | 'datadog' | 'prometheus';
  };
}

/**
 * Utility types
 */

/**
 * Make properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Non-nullable fields
 */
export type NonNullableFields<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

/**
 * Extract keys of type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Function type
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Omit methods from type
 */
export type OmitMethods<T> = Pick<
  T,
  KeysOfType<T, AnyFunction> extends never
    ? keyof T
    : Exclude<keyof T, KeysOfType<T, AnyFunction>>
>;

/**
 * Constructor type
 */
export type Constructor<T = object> = new (...args: unknown[]) => T;

/**
 * Mixin type
 */
export type Mixin<T extends Constructor> = T;

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Maybe type for optional values
 */
export type Maybe<T> = T | null | undefined;

/**
 * Brand type for nominal typing
 */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

/**
 * Type inference utilities for framework
 */

/**
 * Infer command payload type from command
 */
export type InferCommandPayload<T> = T extends ICommand<string, infer P> ? P : never;

/**
 * Infer command type string from command
 */
export type InferCommandType<T> = T extends ICommand<infer Type, unknown> ? Type : never;

/**
 * Infer query result type from query
 */
export type InferQueryResult<T> = T extends IQuery<string, unknown, infer R> ? R : never;

/**
 * Infer query parameters type from query
 */
export type InferQueryParams<T> = T extends IQuery<string, infer P, unknown> ? P : never;

/**
 * Infer event data type from event
 */
export type InferEventData<T> = T extends IEvent<string, infer D, AggregateId> ? D : never;

/**
 * Infer event type string from event
 */
export type InferEventType<T> = T extends IEvent<infer Type, unknown, AggregateId> ? Type : never;

// Import types for inference utilities
import type { ICommand } from './command';
import type { IQuery } from './query';
import type { IEvent } from './event';
import type { AggregateId } from './branded/types';