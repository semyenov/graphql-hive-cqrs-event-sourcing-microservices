/**
 * Framework Effect: Runtime Configuration
 * 
 * Effect runtime setup and configuration.
 */

import * as Runtime from 'effect/Runtime';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Scope from 'effect/Scope';  

/**
 * Default runtime for framework effects
 */
export const defaultRuntime = Runtime.defaultRuntime;

/**
 * Run an effect with the default runtime
 */
export function runEffect<E, A>(
  effect: Effect.Effect<A, E, never>
): Promise<A> {
  return Runtime.runPromise(defaultRuntime)(effect);
}

/**
 * Run an effect and handle errors
 */
export async function runSafe<E, A>(
  effect: Effect.Effect<A, E, never>
): Promise<{ success: true; data: A } | { success: false; error: E }> {
  try {
    const data = await runEffect(effect);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as E };
  }
}

/**
 * Create a custom runtime with layers
 */
export function createRuntime<R, E>(
  layer: Layer.Layer<R, E, never>
): Runtime.Runtime<R> {
  return pipe<Layer.Layer<R, E, never>, Effect.Effect<Runtime.Runtime<R>, E, Scope.Scope | never>, Runtime.Runtime<R>>(
    layer,  
    Layer.toRuntime,
    Effect.runSync as (effect: Effect.Effect<Runtime.Runtime<R>, E, Scope.Scope | never>) => Runtime.Runtime<R>
  );
}