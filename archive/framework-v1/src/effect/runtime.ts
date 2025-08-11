/**
 * Framework Effect: Runtime Configuration
 * 
 * Effect runtime setup and configuration.
 */

import * as Runtime from 'effect/Runtime';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Exit from 'effect/Exit';
import * as Cause from 'effect/Cause';
import { pipe } from 'effect/Function';

/**
 * Run an effect with the default runtime
 */
export function runEffect<A, E>(
  effect: Effect.Effect<A, E, never>
): Promise<A> {
  return Effect.runPromise(effect);
}

/**
 * Run an effect and handle errors
 */
export async function runSafe<A, E>(
  effect: Effect.Effect<A, E, never>
): Promise<{ success: true; data: A } | { success: false; error: E }> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return { success: true as const, data: exit.value };
  } else {
    // Extract the error from the cause
    const failures = Cause.failures(exit.cause);
    const error = failures.length > 0 ? failures[0] : (new Error('Unknown error') as unknown as E);
    return { success: false as const, error };
  }
}

/**
 * Create a managed runtime with layers
 */
export function createManagedRuntime<R, E>(
  layer: Layer.Layer<R, E, never>
): ManagedRuntime.ManagedRuntime<R, E> {
  return ManagedRuntime.make(layer);
}

/**
 * Run an effect with a custom runtime
 */
export function runWithRuntime<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  runtime: ManagedRuntime.ManagedRuntime<R, never>
): Promise<A> {
  return runtime.runPromise(effect);
}

/**
 * Create a test runtime with common services
 */
export function createTestRuntime<R, E>(
  layer: Layer.Layer<R, E, never>
): ManagedRuntime.ManagedRuntime<R, E> {
  return ManagedRuntime.make(layer);
}