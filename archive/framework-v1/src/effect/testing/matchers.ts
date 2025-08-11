/**
 * Effect Test Matchers
 *
 * Custom matchers and assertion utilities for Effect-based testing
 */

import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Option from "effect/Option";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";

/**
 * Effect test matchers for better assertions
 */
export const EffectMatchers = {
  /**
   * Assert that an Effect succeeds with expected value
   */
  toSucceedWith: <A, E>(expected: A) => (effect: Effect.Effect<A, E, never>) =>
    pipe(
      effect,
      Effect.exit,
      Effect.runSync,
      Exit.match({
        onFailure: (cause) => {
          throw new Error(
            `Expected success with ${
              JSON.stringify(expected)
            }, but failed with: ${cause}`,
          );
        },
        onSuccess: (actual) => {
          if (!Object.is(actual, expected)) {
            throw new Error(
              `Expected ${JSON.stringify(expected)}, got ${
                JSON.stringify(actual)
              }`,
            );
          }
          return true;
        },
      }),
    ),

  /**
   * Assert that an Effect succeeds with any value
   */
  toSucceed: <A, E>(effect: Effect.Effect<A, E, never>) =>
    pipe(
      effect,
      Effect.exit,
      Effect.runSync,
      Exit.match({
        onFailure: (cause) => {
          throw new Error(`Expected success, but failed with: ${cause}`);
        },
        onSuccess: () => true,
      }),
    ),

  /**
   * Assert that an Effect fails with specific error
   */
  toFailWith:
    <E>(expectedError: E) => <A>(effect: Effect.Effect<A, E, never>) =>
      pipe(
        effect,
        Effect.flip,
        Effect.exit,
        Effect.runSync,
        Exit.match({
          onFailure: () => {
            throw new Error(
              `Expected failure with ${
                JSON.stringify(expectedError)
              }, but succeeded`,
            );
          },
          onSuccess: (actualError) => {
            if (!Object.is(actualError, expectedError)) {
              throw new Error(
                `Expected error ${JSON.stringify(expectedError)}, got ${
                  JSON.stringify(actualError)
                }`,
              );
            }
            return true;
          },
        }),
      ),

  /**
   * Assert that an Effect fails with any error
   */
  toFail: <A, E>(effect: Effect.Effect<A, E, never>) =>
    pipe(
      effect,
      Effect.flip,
      Effect.exit,
      Effect.runSync,
      Exit.match({
        onFailure: () => {
          throw new Error("Expected failure, but succeeded");
        },
        onSuccess: () => true,
      }),
    ),

  /**
   * Assert that an Effect completes (success or failure) within timeout
   */
  toCompleteWithin:
    (milliseconds: number) => <A, E>(effect: Effect.Effect<A, E, never>) => {
      const start = Date.now();
      return pipe(
        effect,
        Effect.either,
        Effect.runPromise,
      ).then(() => {
        const duration = Date.now() - start;
        if (duration > milliseconds) {
          throw new Error(
            `Expected completion within ${milliseconds}ms, took ${duration}ms`,
          );
        }
        return true;
      });
    },

  /**
   * Assert that an Option is Some with expected value
   */
  toBeSome: <A>(expected: A) => (option: Option.Option<A>) => {
    if (Option.isNone(option)) {
      throw new Error(`Expected Some(${JSON.stringify(expected)}), got None`);
    }
    if (!Object.is(option.value, expected)) {
      throw new Error(
        `Expected Some(${JSON.stringify(expected)}), got Some(${
          JSON.stringify(option.value)
        })`,
      );
    }
    return true;
  },

  /**
   * Assert that an Option is None
   */
  toBeNone: <A>(option: Option.Option<A>) => {
    if (Option.isSome(option)) {
      throw new Error(
        `Expected None, got Some(${JSON.stringify(option.value)})`,
      );
    }
    return true;
  },

  /**
   * Assert that an Either is Right with expected value
   */
  toBeRight: <R>(expected: R) => <L>(either: Either.Either<R, L>) => {
    if (Either.isLeft(either)) {
      throw new Error(
        `Expected Right(${JSON.stringify(expected)}), got Left(${
          JSON.stringify(either.left)
        })`,
      );
    }
    if (!Object.is(either.right, expected)) {
      throw new Error(
        `Expected Right(${JSON.stringify(expected)}), got Right(${
          JSON.stringify(either.right)
        })`,
      );
    }
    return true;
  },

  /**
   * Assert that an Either is Left with expected value
   */
  toBeLeft: <L>(expected: L) => <R>(either: Either.Either<R, L>) => {
    if (Either.isRight(either)) {
      throw new Error(
        `Expected Left(${JSON.stringify(expected)}), got Right(${
          JSON.stringify(either.right)
        })`,
      );
    }
    if (!Object.is(either.left, expected)) {
      throw new Error(
        `Expected Left(${JSON.stringify(expected)}), got Left(${
          JSON.stringify(either.left)
        })`,
      );
    }
    return true;
  },
};

/**
 * Assertion utilities for common testing patterns
 */
export const Assertions: {
  assertEqual: <T>(actual: T, expected: T, message?: string) => void;
  assertTrue: (condition: boolean, message?: string) => void;
  assertFalse: (condition: boolean, message?: string) => void;
  assertDefined: <T>(
    value: T | null | undefined,
    message?: string,
  ) => asserts value is T;
  assertContains: <T>(array: T[], item: T, message?: string) => void;
  assertLength: <T>(
    array: T[],
    expectedLength: number,
    message?: string,
  ) => void;
} = {
  /**
   * Assert that two values are deeply equal
   */
  assertEqual: <T>(actual: T, expected: T, message?: string) => {
    if (!deepEqual(actual, expected)) {
      throw new Error(
        message ||
          `Assertion failed: expected ${JSON.stringify(expected)}, got ${
            JSON.stringify(actual)
          }`,
      );
    }
  },

  /**
   * Assert that a condition is true
   */
  assertTrue: (condition: boolean, message?: string) => {
    if (!condition) {
      throw new Error(message || "Assertion failed: expected true");
    }
  },

  /**
   * Assert that a condition is false
   */
  assertFalse: (condition: boolean, message?: string) => {
    if (condition) {
      throw new Error(message || "Assertion failed: expected false");
    }
  },

  /**
   * Assert that a value is defined (not null or undefined)
   */
  assertDefined: <T>(
    value: T | null | undefined,
    message?: string,
  ): asserts value is T => {
    if (value === null || value === undefined) {
      throw new Error(
        message || "Assertion failed: expected value to be defined",
      );
    }
  },

  /**
   * Assert that an array contains a specific item
   */
  assertContains: <T>(array: T[], item: T, message?: string) => {
    if (!array.includes(item)) {
      throw new Error(
        message ||
          `Assertion failed: array does not contain ${JSON.stringify(item)}`,
      );
    }
  },

  /**
   * Assert that an array has expected length
   */
  assertLength: <T>(array: T[], expectedLength: number, message?: string) => {
    if (array.length !== expectedLength) {
      throw new Error(
        message ||
          `Assertion failed: expected length ${expectedLength}, got ${array.length}`,
      );
    }
  },
};

/**
 * Simple deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
      keysB.includes(key) && deepEqual(a[key], b[key])
    );
  }

  return false;
}
