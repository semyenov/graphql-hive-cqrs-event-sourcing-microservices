/**
 * Framework Effect: Combinators
 * 
 * Effect combinators for composing and transforming effects.
 * Provides functional programming patterns for CQRS operations.
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { pipe, flow } from 'effect/Function';
import type { ICommand, IEvent } from '../core/types';

/**
 * Fold an effect into a value by handling both success and failure cases
 */
export const fold = <R, E, A, B>(
  effect: Effect.Effect<A, E, R>,
  onError: (error: E) => B,
  onSuccess: (value: A) => B
): Effect.Effect<B, never, R> =>
  pipe(
    effect,
    Effect.matchEffect({
      onFailure: (e) => Effect.succeed(onError(e)),
      onSuccess: (a) => Effect.succeed(onSuccess(a)),
    })
  );

/**
 * Chain multiple effects sequentially, passing the result of each to the next
 */
export const chain = <R, E, A, R2, E2, B>(
  first: Effect.Effect<A, E, R>,
  f: (a: A) => Effect.Effect<B, E2, R2>
): Effect.Effect<B, E | E2, R | R2> =>
  pipe(first, Effect.flatMap(f));

/**
 * Apply a function wrapped in an effect to a value wrapped in an effect
 */
export const ap = <R, E, A, R2, E2, B>(
  fab: Effect.Effect<(a: A) => B, E, R>,
  fa: Effect.Effect<A, E2, R2>
): Effect.Effect<B, E | E2, R | R2> =>
  pipe(
    fab,
    Effect.flatMap((f) => pipe(fa, Effect.map(f)))
  );

/**
 * Map both success and error channels of an effect
 */
export const bimap = <R, E, A, E2, B>(
  effect: Effect.Effect<A, E, R>,
  mapError: (e: E) => E2,
  mapSuccess: (a: A) => B
): Effect.Effect<B, E2, R> =>
  pipe(effect, Effect.mapBoth({ onFailure: mapError, onSuccess: mapSuccess }));

/**
 * Combine two effects, keeping the result of the first if both succeed
 */
export const zipLeft = <R, E, A, R2, E2, B>(
  first: Effect.Effect<A, E, R>,
  second: Effect.Effect<B, E2, R2>
): Effect.Effect<A, E | E2, R | R2> =>
  pipe(
    first,
    Effect.flatMap((a) => pipe(second, Effect.map(() => a)))
  );

/**
 * Combine two effects, keeping the result of the second if both succeed
 */
export const zipRight = <R, E, A, R2, E2, B>(
  first: Effect.Effect<A, E, R>,
  second: Effect.Effect<B, E2, R2>
): Effect.Effect<B, E | E2, R | R2> =>
  pipe(
    first,
    Effect.flatMap(() => second)
  );

/**
 * Run effects in parallel and combine their results
 */
export const parZip = <R, E, A, R2, E2, B>(
  first: Effect.Effect<A, E, R>,
  second: Effect.Effect<B, E2, R2>
): Effect.Effect<[A, B], E | E2, R | R2> =>
  Effect.all([first, second], { concurrency: 'unbounded' });

/**
 * Select the first effect that succeeds
 */
export const race = <R, E, A, R2, E2, B>(
  first: Effect.Effect<A, E, R>,
  second: Effect.Effect<B, E2, R2>
): Effect.Effect<A | B, E | E2, R | R2> =>
  Effect.race(first, second);

/**
 * Conditional effect execution
 */
export const when = <R, E, A>(
  condition: boolean,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, E, R> =>
  condition ? pipe(effect, Effect.map(Option.some)) : Effect.succeed(Option.none());

/**
 * Execute effect only if condition is false
 */
export const unless = <R, E, A>(
  condition: boolean,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Option.Option<A>, E, R> =>
  when(!condition, effect);

/**
 * Tap into an effect without changing its value
 */
export const tap = <R, E, A, R2, E2>(
  effect: Effect.Effect<A, E, R>,
  f: (a: A) => Effect.Effect<unknown, E2, R2>
): Effect.Effect<A, E | E2, R | R2> =>
  pipe(
    effect,
    Effect.tap(f)
  );

/**
 * Tap into errors without changing them
 */
export const tapError = <R, E, A, R2, E2>(
  effect: Effect.Effect<A, E, R>,
  f: (e: E) => Effect.Effect<unknown, E2, R2>
): Effect.Effect<A, E | E2, R | R2> =>
  pipe(
    effect,
    Effect.tapError(f)
  );

/**
 * Filter and transform a collection in parallel
 */
export const filterMapPar = <A, R, E, B>(
  items: ReadonlyArray<A>,
  f: (a: A) => Effect.Effect<Option.Option<B>, E, R>,
  concurrency?: number
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  pipe(
    Effect.forEach(
      items,
      (item) =>
        pipe(
          f(item),
          Effect.map((opt) => (Option.isSome(opt) ? [opt.value] : []))
        ),
      { concurrency: concurrency ?? 'unbounded' }
    ),
    Effect.map((arrays) => arrays.flat())
  );

/**
 * Partition a collection based on an effectful predicate
 */
export const partitionPar = <A, R, E>(
  items: ReadonlyArray<A>,
  predicate: (a: A) => Effect.Effect<boolean, E, R>,
  concurrency?: number
): Effect.Effect<[ReadonlyArray<A>, ReadonlyArray<A>], E, R> =>
  pipe(
    Effect.forEach(
      items,
      (item) =>
        pipe(
          predicate(item),
          Effect.map((passes) => ({ item, passes }))
        ),
      { concurrency: concurrency ?? 'unbounded' }
    ),
    Effect.map((results) => {
      const pass: A[] = [];
      const fail: A[] = [];
      for (const { item, passes } of results) {
        if (passes) {
          pass.push(item);
        } else {
          fail.push(item);
        }
      }
      return [pass, fail] as [ReadonlyArray<A>, ReadonlyArray<A>];
    })
  );

/**
 * Traverse a collection with an effectful function
 */
export const traverse = <A, R, E, B>(
  items: ReadonlyArray<A>,
  f: (a: A) => Effect.Effect<B, E, R>
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  Effect.forEach(items, f);

/**
 * Sequence a collection of effects
 */
export const sequence = <R, E, A>(
  effects: ReadonlyArray<Effect.Effect<A, E, R>>
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  Effect.all(effects);

/**
 * Reduce a collection with an effectful reducer
 */
export const reduce = <A, B, R, E>(
  items: ReadonlyArray<A>,
  initial: B,
  f: (acc: B, item: A) => Effect.Effect<B, E, R>
): Effect.Effect<B, E, R> =>
  Effect.reduce(items, initial, f);

/**
 * Specialized combinators for CQRS patterns
 */

/**
 * Process a command and return events
 */
export const processCommand = <C extends ICommand, E extends IEvent, Err, R>(
  command: C,
  handler: (cmd: C) => Effect.Effect<E[], Err, R>
): Effect.Effect<E[], Err, R> =>
  pipe(
    Effect.succeed(command),
    Effect.flatMap(handler),
    Effect.tap((events) =>
      Effect.sync(() => {
        if (events.length === 0) {
          console.warn(`Command ${command.type} produced no events`);
        }
      })
    )
  );

/**
 * Apply events to state using a reducer
 */
export const applyEvents = <S, E extends IEvent, Err, R>(
  state: S,
  events: E[],
  reducer: (state: S, event: E) => Effect.Effect<S, Err, R>
): Effect.Effect<S, Err, R> =>
  reduce(events, state, reducer);

/**
 * Compose multiple command handlers
 */
export const composeHandlers = <C extends ICommand, R1, R2, E1, E2, A, B>(
  first: (cmd: C) => Effect.Effect<A, E1, R1>,
  second: (result: A) => Effect.Effect<B, E2, R2>
): ((cmd: C) => Effect.Effect<B, E1 | E2, R1 | R2>) =>
  flow(first, Effect.flatMap(second));

/**
 * Validate and execute a command
 */
export const validateAndExecute = <C extends ICommand, R, E, A>(
  command: C,
  validate: (cmd: C) => Effect.Effect<C, E, R>,
  execute: (cmd: C) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  pipe(validate(command), Effect.flatMap(execute));

/**
 * Execute commands in a transaction-like manner
 */
export const transaction = <R, E, A>(
  effects: ReadonlyArray<Effect.Effect<A, E, R>>,
  rollback: (completed: ReadonlyArray<A>, error: E) => Effect.Effect<void, never, R>
): Effect.Effect<ReadonlyArray<A>, E, R> => {
  const executeWithRollback = (
    remaining: ReadonlyArray<Effect.Effect<A, E, R>>,
    completed: A[]
  ): Effect.Effect<ReadonlyArray<A>, E, R> => {
    if (remaining.length === 0) {
      return Effect.succeed(completed);
    }

    const [current, ...rest] = remaining;
    if (!current) {
      return Effect.succeed(completed);
    }
    return pipe(
      current,
      Effect.flatMap((result) =>
        executeWithRollback(rest, [...completed, result])
      ),
      Effect.catchAll((error) =>
        pipe(
          rollback(completed, error),
          Effect.flatMap(() => Effect.fail(error))
        )
      )
    );
  };

  return executeWithRollback(effects, []);
};