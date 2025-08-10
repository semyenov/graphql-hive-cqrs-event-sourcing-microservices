/**
 * Framework Patterns: Type-Safe Matchers
 * 
 * Simplified utility functions for pattern matching without complex ts-pattern usage.
 */

import { match, P } from 'ts-pattern';

/**
 * Create a type-safe matcher for a discriminated union
 */
export function createTypeSafeMatcher<T extends { type: string }>() {
  return <R>(
    value: T,
    handlers: {
      [K in T['type']]: (value: Extract<T, { type: K }>) => R;
    }
  ): R => {
    const handler = handlers[value.type as T['type']];
    return handler(value as any);
  };
}

/**
 * Match with default value - simplified version
 */
export function matchWithDefault<T, R>(
  value: T,
  predicate: (v: T) => boolean,
  result: R,
  defaultValue: R
): R {
  return predicate(value) ? result : defaultValue;
}

/**
 * Create conditional matcher - simplified version
 */
export function createConditionalMatcher<T, R>(
  value: T,
  guards: Array<{
    guard: (value: T) => boolean;
    handler: (value: T) => R;
  }>,
  defaultHandler?: (value: T) => R
): R | undefined {
  for (const { guard, handler } of guards) {
    if (guard(value)) {
      return handler(value);
    }
  }
  return defaultHandler ? defaultHandler(value) : undefined;
}

/**
 * Match async operations
 */
export async function matchAsync<T, R>(
  value: Promise<T>,
  patterns: {
    resolved: (value: T) => R | Promise<R>;
    rejected?: (error: any) => R | Promise<R>;
  }
): Promise<R> {
  try {
    const resolved = await value;
    return await patterns.resolved(resolved);
  } catch (error) {
    if (patterns.rejected) {
      return await patterns.rejected(error);
    }
    throw error;
  }
}

/**
 * Match all items in an array
 */
export function matchAll<T, R>(
  items: T[],
  pattern: (item: T) => R | undefined
): R[] {
  return items
    .map(pattern)
    .filter((result): result is R => result !== undefined);
}

/**
 * Match any item in an array
 */
export function matchAny<T>(
  items: T[],
  predicate: (item: T) => boolean
): T | undefined {
  return items.find(predicate);
}

/**
 * Match with multiple patterns - simplified
 */
export function matchMultiple<T, R>(
  value: T,
  patterns: Array<{
    when: (value: T) => boolean;
    then: (value: T) => R;
  }>
): R | undefined {
  for (const pattern of patterns) {
    if (pattern.when(value)) {
      return pattern.then(value);
    }
  }
  return undefined;
}

/**
 * Match array patterns - simplified
 */
export function matchArray<T, R>(
  array: T[],
  patterns: {
    empty?: () => R;
    single?: (item: T) => R;
    multiple?: (items: T[]) => R;
  }
): R | undefined {
  if (array.length === 0 && patterns.empty) {
    return patterns.empty();
  }
  if (array.length === 1 && patterns.single) {
    return patterns.single(array[0]!);
  }
  if (array.length > 1 && patterns.multiple) {
    return patterns.multiple(array);
  }
  return undefined;
}

/**
 * Match number ranges - simplified
 */
export function matchRange(
  value: number,
  ranges: Array<{
    min?: number;
    max?: number;
    handler: (value: number) => any;
  }>
): any {
  for (const range of ranges) {
    const minOk = range.min === undefined || value >= range.min;
    const maxOk = range.max === undefined || value <= range.max;
    if (minOk && maxOk) {
      return range.handler(value);
    }
  }
  return undefined;
}

/**
 * Type guard creator
 */
export function createGuard<T, S extends T>(
  predicate: (value: T) => value is S
): (value: T) => value is S {
  return predicate;
}

/**
 * Simple type check
 */
export function isType<T>(
  value: unknown,
  check: (value: unknown) => boolean
): value is T {
  return check(value);
}

/**
 * Property existence check
 */
export function hasProperty<T, K extends PropertyKey>(
  value: T,
  property: K
): value is T & Record<K, unknown> {
  return property in (value as any);
}

/**
 * Strict equality matcher
 */
export function matchStrict<T, R>(
  value: T,
  cases: Map<T, R>,
  defaultValue?: R
): R | undefined {
  return cases.get(value) ?? defaultValue;
}

/**
 * Match with transformation
 */
export function matchTransform<T, S, R>(
  value: T,
  transform: (value: T) => S,
  handler: (transformed: S) => R
): R {
  return handler(transform(value));
}

/**
 * Match with side effects
 */
export function matchWithEffect<T, R>(
  value: T,
  patterns: Array<{
    when: (value: T) => boolean;
    effect?: (value: T) => void | Promise<void>;
    then: (value: T) => R;
  }>
): R | undefined {
  for (const pattern of patterns) {
    if (pattern.when(value)) {
      if (pattern.effect) {
        Promise.resolve(pattern.effect(value)).catch(console.error);
      }
      return pattern.then(value);
    }
  }
  return undefined;
}

/**
 * Match nullable values
 */
export function matchNullable<T, R>(
  value: T | null | undefined,
  patterns: {
    null?: () => R;
    undefined?: () => R;
    some: (value: T) => R;
  }
): R {
  if (value === null && patterns.null) {
    return patterns.null();
  }
  if (value === undefined && patterns.undefined) {
    return patterns.undefined();
  }
  return patterns.some(value!);
}