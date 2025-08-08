// Type-level assertion utilities for testing TypeScript types

// Test if two types are exactly equal
export type AssertEquals<T, U> = 
  (<G>() => G extends T ? 1 : 2) extends
  (<G>() => G extends U ? 1 : 2)
    ? true
    : false;

// Test if T extends U
export type AssertExtends<T, U> = T extends U ? true : false;

// Test if T does not extend U
export type AssertNotExtends<T, U> = T extends U ? false : true;

// Test if type is never
export type AssertNever<T> = [T] extends [never] ? true : false;

// Test if type is any
export type AssertAny<T> = 0 extends 1 & T ? true : false;

// Test if type is unknown
export type AssertUnknown<T> = unknown extends T
  ? T extends unknown
    ? true
    : false
  : false;

// Test if two types are mutually assignable
export type AssertMutuallyAssignable<T, U> = 
  AssertExtends<T, U> extends true
    ? AssertExtends<U, T>
    : false;

// Test if type is a union
export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Helper type to convert union to intersection
type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

// Test if type is a function
export type IsFunction<T> = T extends (...args: any[]) => any ? true : false;

// Test if type is an object
export type IsObject<T> = T extends object
  ? T extends any[]
    ? false
    : T extends (...args: any[]) => any
      ? false
      : true
  : false;

// Test if type is an array
export type IsArray<T> = T extends any[] ? true : false;

// Test if type is a promise
export type IsPromise<T> = T extends Promise<any> ? true : false;

// Test if type has a specific property
export type HasProperty<T, K extends PropertyKey> = K extends keyof T ? true : false;

// Test if type is readonly
export type IsReadonly<T> = Equal<T, Readonly<T>>;

// Helper type for exact equality check
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// Test suite container type
export type TypeTests<T extends Record<string, boolean>> = T;

// Compile-time test assertion
export type CompileTimeTest<T extends true> = T;

// Runtime test helpers for development
export const assertType = <T>(value: T): T => value;

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${value}`);
};

// Type guard helpers
export const isString = (value: unknown): value is string => 
  typeof value === 'string';

export const isNumber = (value: unknown): value is number => 
  typeof value === 'number';

export const isBoolean = (value: unknown): value is boolean => 
  typeof value === 'boolean';

export const isObject = (value: unknown): value is object => 
  typeof value === 'object' && value !== null;

export const isArray = <T = unknown>(value: unknown): value is T[] => 
  Array.isArray(value);

export const isFunction = (value: unknown): value is Function => 
  typeof value === 'function';

export const isDefined = <T>(value: T | undefined): value is T => 
  value !== undefined;

export const isNotNull = <T>(value: T | null): value is T => 
  value !== null;

export const isNotNullOrUndefined = <T>(value: T | null | undefined): value is T => 
  value !== null && value !== undefined;