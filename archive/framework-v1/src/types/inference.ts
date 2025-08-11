/**
 * Framework Types: Type Inference Utilities
 * 
 * Advanced type inference utilities for better TypeScript developer experience.
 * Provides conditional types, mapped types, and template literal types.
 */

import type { z } from 'zod';
import type { ICommand, IEvent, IQuery } from '../effect/core/types';

/**
 * Infer command type from handler
 */
export type InferCommandFromHandler<T> = T extends (
  command: infer C
) => any
  ? C
  : never;

/**
 * Infer result type from handler
 */
export type InferResultFromHandler<T> = T extends (
  ...args: any[]
) => infer R
  ? R extends Promise<infer U>
    ? U
    : R
  : never;

/**
 * Infer event type from reducer
 */
export type InferEventFromReducer<T> = T extends (
  state: any,
  event: infer E
) => any
  ? E
  : never;

/**
 * Infer state type from reducer
 */
export type InferStateFromReducer<T> = T extends (
  state: infer S,
  event: any
) => any
  ? S
  : never;

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : T extends Function
  ? T
  : T extends object
  ? DeepReadonlyObject<T>
  : T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * Deep partial type
 */
export type DeepPartial<T> = T extends Function
  ? T
  : T extends (infer R)[]
  ? DeepPartialArray<R>
  : T extends object
  ? DeepPartialObject<T>
  : T | undefined;

interface DeepPartialArray<T> extends Array<DeepPartial<T>> {}

type DeepPartialObject<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

/**
 * Deep required type
 */
export type DeepRequired<T> = T extends Function
  ? T
  : T extends (infer R)[]
  ? DeepRequiredArray<R>
  : T extends object
  ? DeepRequiredObject<T>
  : T;

interface DeepRequiredArray<T> extends Array<DeepRequired<T>> {}

type DeepRequiredObject<T> = {
  [P in keyof T]-?: DeepRequired<T[P]>;
};

/**
 * Extract properties of specific type
 */
export type PropertiesOfType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Exclude properties of specific type
 */
export type ExcludePropertiesOfType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/**
 * Function property names
 */
export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

/**
 * Non-function property names
 */
export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * Pick only functions
 */
export type PickFunctions<T> = Pick<T, FunctionPropertyNames<T>>;

/**
 * Pick only properties (non-functions)
 */
export type PickProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

/**
 * Mutable type (removes readonly)
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Deep mutable type
 */
export type DeepMutable<T> = T extends (infer R)[]
  ? DeepMutableArray<R>
  : T extends Function
  ? T
  : T extends object
  ? DeepMutableObject<T>
  : T;

interface DeepMutableArray<T> extends Array<DeepMutable<T>> {}

type DeepMutableObject<T> = {
  -readonly [P in keyof T]: DeepMutable<T[P]>;
};

/**
 * Exact type (prevents excess properties)
 */
export type Exact<T, Shape> = T extends Shape
  ? Exclude<keyof T, keyof Shape> extends never
    ? T
    : never
  : never;

/**
 * Union to intersection
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Last element of union
 */
export type LastOfUnion<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

/**
 * Union to tuple
 */
export type UnionToTuple<T, L = LastOfUnion<T>, N = [T] extends [never] ? true : false> =
  true extends N ? [] : [...UnionToTuple<Exclude<T, L>>, L];

/**
 * Template literal types for commands/events
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

export type ConstantCase<S extends string> = Uppercase<SnakeCase<S>>;

/**
 * Command name builder
 */
export type CommandName<
  Action extends string,
  Entity extends string
> = `${PascalCase<Action>}${PascalCase<Entity>}Command`;

/**
 * Event name builder
 */
export type EventName<
  Entity extends string,
  Action extends string
> = `${ConstantCase<Entity>}_${ConstantCase<Action>}`;

/**
 * Query name builder
 */
export type QueryName<
  Action extends string,
  Entity extends string
> = `${PascalCase<Action>}${PascalCase<Entity>}Query`;

/**
 * Auto-generate handler type from command
 */
export type CommandHandler<C extends ICommand, R = void> = (
  command: C
) => Promise<R> | R;

/**
 * Auto-generate handler type from event
 */
export type EventHandler<E extends IEvent> = (
  event: E
) => Promise<void> | void;

/**
 * Auto-generate handler type from query
 */
export type QueryHandler<Q extends IQuery, R> = (
  query: Q
) => Promise<R> | R;

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

/**
 * Type-safe builder pattern
 */
export type Builder<T> = {
  [K in keyof T]-?: (value: T[K]) => Builder<T>;
} & {
  build(): T;
};

/**
 * Conditional type helpers
 */
export type If<C extends boolean, T, F> = C extends true ? T : F;

export type Not<T extends boolean> = T extends true ? false : true;

export type And<A extends boolean, B extends boolean> = A extends true
  ? B extends true
    ? true
    : false
  : false;

export type Or<A extends boolean, B extends boolean> = A extends true
  ? true
  : B extends true
  ? true
  : false;

export type Extends<T, U> = T extends U ? true : false;

export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/**
 * Type-level assertions
 */
export type Assert<T extends true> = T;

export type AssertEquals<X, Y> = Equals<X, Y> extends true ? true : never;

export type AssertExtends<T, U> = Extends<T, U> extends true ? true : never;

export type AssertNever<T extends never> = T;

/**
 * Async type helpers
 */
export type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

export type PromiseValue<T> = T extends Promise<infer U> ? U : never;

export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

/**
 * Tuple helpers
 */
export type Head<T extends readonly any[]> = T extends readonly [
  infer H,
  ...any[]
]
  ? H
  : never;

export type Tail<T extends readonly any[]> = T extends readonly [
  any,
  ...infer Rest
]
  ? Rest
  : [];

export type Last<T extends readonly any[]> = T extends readonly [
  ...any[],
  infer L
]
  ? L
  : never;

export type Length<T extends readonly any[]> = T['length'];

export type Reverse<T extends readonly any[]> = T extends readonly [
  ...infer Rest,
  infer Last
]
  ? [Last, ...Reverse<Rest>]
  : [];

/**
 * Object key manipulation
 */
export type Prefix<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<string & K>}`]: T[K];
};

export type Suffix<T, S extends string> = {
  [K in keyof T as `${string & K}${Capitalize<S>}`]: T[K];
};

export type RemovePrefix<T, P extends string> = {
  [K in keyof T as K extends `${P}${infer Rest}` ? Rest : K]: T[K];
};

export type RemoveSuffix<T, S extends string> = {
  [K in keyof T as K extends `${infer Rest}${S}` ? Rest : K]: T[K];
};

/**
 * JSON type representation
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: Json };
export type JsonArray = Json[];
export type Json = JsonPrimitive | JsonObject | JsonArray;

/**
 * Type-safe paths
 */
export type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Path<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

export type PathValue<T, P extends Path<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Path<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;