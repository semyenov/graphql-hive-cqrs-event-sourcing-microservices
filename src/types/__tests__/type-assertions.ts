// Type-level testing utilities
// These utilities help us test TypeScript types at compile time

// Type equality check
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// Assert types are equal
export type AssertEquals<X, Y> = Equals<X, Y> extends true ? true : never;

// Assert type extends another
export type AssertExtends<X, Y> = X extends Y ? true : never;

// Assert type does not extend another
export type AssertNotExtends<X, Y> = X extends Y ? never : true;

// Test that a type is never
export type AssertNever<T> = [T] extends [never] ? true : never;

// Test that a type is not never
export type AssertNotNever<T> = [T] extends [never] ? never : true;

// Test that a type is any
export type AssertAny<T> = 0 extends (1 & T) ? true : never;

// Test that a type is not any
export type AssertNotAny<T> = 0 extends (1 & T) ? never : true;

// Test that a type is unknown
export type AssertUnknown<T> = unknown extends T
  ? T extends unknown
    ? true
    : never
  : never;

// Test function parameter types
export type Parameters<T extends (...args: never[]) => unknown> = 
  T extends (...args: infer P) => unknown ? P : never;

// Test function return type
export type ReturnType<T extends (...args: never[]) => unknown> = 
  T extends (...args: never[]) => infer R ? R : never;

// Test if type is a union
export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Convert union to intersection
export type UnionToIntersection<U> = 
  (U extends unknown ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// Test if type is optional
export type IsOptional<T, K extends keyof T> = 
  {} extends Pick<T, K> ? true : false;

// Test if type is readonly
export type IsReadonly<T, K extends keyof T> = 
  Equals<Pick<T, K>, Readonly<Pick<T, K>>>;

// Type test runner that collects all test results
export type TypeTests<T extends Record<string, true>> = T;

// Utility to create test cases
export type TestCase<Name extends string, Result extends true> = {
  [K in Name]: Result;
};

// Compile-time test result type
export type CompileTimeTest = true;

// Helper to ensure tests pass at compile time
export function typeAssert<T extends true>(): T {
  return true as T;
}

// Helper to create a compile-time test suite
export function createTypeTestSuite<T extends Record<string, true>>(tests: T): T {
  return tests;
}