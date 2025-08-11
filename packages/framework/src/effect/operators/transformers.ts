/**
 * Framework Effect: Transformers
 * 
 * Effect transformers for value and error transformations.
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Either from 'effect/Either';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

/**
 * Transform error type
 */
export const mapError = <R, E, A, E2>(
  effect: Effect.Effect<A, E, R>,
  f: (error: E) => E2
): Effect.Effect<A, E2, R> =>
  Effect.mapError(effect, f);

/**
 * Transform both success and error types
 */
export const mapBoth = <R, E, A, B, E2>(
  effect: Effect.Effect<A, E, R>,
  onError: (error: E) => E2,
  onSuccess: (value: A) => B
): Effect.Effect<B, E2, R> =>
  pipe(effect, Effect.map(onSuccess), Effect.mapError(onError));

/**
 * Bimap - alias for mapBoth
 */
export const bimap = mapBoth;

/**
 * Filter or fail with error
 */
export const filterOrFail = <R, E, A, E2>(
  effect: Effect.Effect<A, E, R>,
  predicate: (a: A) => boolean,
  onFalse: (a: A) => E2
): Effect.Effect<A, E | E2, R> =>
  pipe(
    effect,
    Effect.filterOrFail(predicate, onFalse)
  );

/**
 * Filter or provide alternative
 */
export const filterOrElse = <R, E, A, R2, E2, B>(
  effect: Effect.Effect<A, E, R>,
  predicate: (a: A) => boolean,
  onFalse: (a: A) => Effect.Effect<B, E2, R2>
): Effect.Effect<A | B, E | E2, R | R2> =>
  Effect.flatMap(effect, (value) => {
    if (predicate(value)) { 
      return Effect.succeed(value as unknown as B);
    }
    return onFalse(value);
  });

/**
 * Refine or die with defect
 */
export const refineOrDie = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  pf: (e: E) => Option.Option<E>
): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.catchAll((error) =>
      pipe(
        pf(error),
        Option.match({
          onNone: () => Effect.die(error),
          onSome: Effect.fail,
        })
      )
    )
  );

/**
 * Validate effect result
 */
export const validate = <R, E, A, E2>(
  effect: Effect.Effect<A, E, R>,
  validation: (a: A) => Either.Either<A, E2>
): Effect.Effect<A, E | E2, R> =>
  pipe(
    effect,
    Effect.flatMap((value) => {
      const result = validation(value);
      return Either.isRight(result)
        ? Effect.succeed(result.right)
        : Effect.fail(result.left);
    })
  );

/**
 * From Either to Effect
 */
const fromEither = <A, E>(either: Either.Either<A, E>): Effect.Effect<A, E, never> =>
  Either.isRight(either)
    ? Effect.succeed(either.right)
    : Effect.fail(either.left);

/**
 * Convert nullable to Option
 */
export const fromNullable = <A>(value: A | null | undefined): Option.Option<A> =>
  value === null || value === undefined ? Option.none() : Option.some(value);

/**
 * Error type for validation failures
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
}> {}

/**
 * Error type for business rule violations
 */
export class BusinessRuleError extends Data.TaggedError('BusinessRuleError')<{
  readonly rule: string;
  readonly message: string;
  readonly context?: unknown;
}> {}

/**
 * Validate with multiple validators
 */
export const validateAll = <R, E, A>(
  value: A,
  validators: ReadonlyArray<(a: A) => Effect.Effect<void, E, R>>
): Effect.Effect<A, E, R> =>
  pipe(
    Effect.forEach(validators, (validator) => validator(value), {
      concurrency: 'unbounded',
      discard: true,
    }),
    Effect.map(() => value)
  );

/**
 * Validate with first passing validator
 */
export const validateAny = <R, E, A>(
  value: A,
  validators: ReadonlyArray<(a: A) => Effect.Effect<void, E, R>>
): Effect.Effect<A, E[], R> => {
  const errors: E[] = [];
  
  const tryValidators = (
    remaining: ReadonlyArray<(a: A) => Effect.Effect<void, E, R>>
  ): Effect.Effect<A, E[], R> => {
    if (remaining.length === 0) {
      return Effect.fail(errors);
    }
    
    const [current, ...rest] = remaining;
    if (!current) {
      return Effect.fail(errors);
    }
    
    return pipe(
      current(value),
      Effect.map(() => value),
      Effect.catchAll((e) => {
        errors.push(e);
        return tryValidators(rest);
      })
    );
  };
  
  return tryValidators(validators);
};

/**
 * Transform success value with validation
 */
export const mapValidated = <R, E, A, B, E2>(
  effect: Effect.Effect<A, E, R>,
  transform: (a: A) => B,
  validate: (b: B) => Effect.Effect<void, E2, never>
): Effect.Effect<B, E | E2, R> =>
  pipe(
    effect,
    Effect.map(transform),
    Effect.tap(validate)
  );

/**
 * Enrich errors with metadata
 */
export const enrichError = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  metadata: Record<string, unknown>
): Effect.Effect<A, { error: E; metadata: typeof metadata }, R> =>
  pipe(
    effect,
    Effect.mapError((error) => ({ error, metadata }))
  );

/**
 * Timeout an effect with a custom error
 */
export const timeoutWithError = <R, E, A, E2>(
  effect: Effect.Effect<A, E, R>,
  duration: number,
  onTimeout: () => E2
): Effect.Effect<A, E | E2, R> =>
  pipe(
    effect,
    Effect.timeoutFail({
      duration: Duration.millis(duration),
      onTimeout,
    })
  );

/**
 * Cache the result of an effect
 */
export const memoize = <R, E, A>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<() => Effect.Effect<A, E, R>, never, R> =>
  Effect.gen(function* (_) {
    let cached: Option.Option<Either.Either<A, E>> = Option.none();
    
    return () => {
      if (Option.isSome(cached)) {
        return fromEither(cached.value);
      }
      
      return pipe(
        effect,
        Effect.either,
        Effect.tap((result) =>
          Effect.sync(() => {
            cached = Option.some(result);
          })
        ),
        Effect.flatMap(fromEither)
      );
    };
  });

/**
 * Cache with TTL
 */
export const cached = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  ttl: Duration.DurationInput
): Effect.Effect<() => Effect.Effect<A, E, R>, never, R> =>
  Effect.gen(function* () {
    let cached: Option.Option<{ value: Either.Either<A, E>; expiry: number }> = Option.none();
    
    return () => {
      const now = Date.now();
      
      if (Option.isSome(cached) && cached.value.expiry > now) {
        return fromEither(cached.value.value);
      }
      
      return pipe(
        effect,
        Effect.either,
        Effect.tap((result) =>
          Effect.sync(() => {
            cached = Option.some({
              value: result,
              expiry: now + Duration.toMillis(ttl),
            });
          })
        ),
        Effect.flatMap(fromEither)
      );
    };
  });