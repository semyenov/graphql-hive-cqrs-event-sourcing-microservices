/**
 * Framework Effect: Retry Patterns
 * 
 * Simple retry strategies using Effect's Schedule API.
 */

import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Ref from 'effect/Ref';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxAttempts?: number;
  readonly initialDelay?: Duration.Duration;
  readonly factor?: number;
}

/**
 * Retry error
 */
export class RetryExhaustedError extends Data.TaggedError('RetryExhaustedError')<{
  readonly attempts: number;
  readonly lastError: unknown;
}> {}

/**
 * Create exponential backoff schedule
 */
export function exponentialBackoff(
  config: RetryConfig = {}
): Schedule.Schedule<unknown, unknown, never> {
  const {
    maxAttempts = 5,
    initialDelay = Duration.millis(100),
    factor = 2,
  } = config;

  const schedule = Schedule.exponential(initialDelay, factor);

  if (maxAttempts) {
    return pipe(schedule, Schedule.compose(Schedule.recurs(maxAttempts - 1))) as Schedule.Schedule<unknown, unknown, never>;
  }

  return schedule;
}

/**
 * Linear backoff schedule
 */
export function linearBackoff(
  config: {
    delay: Duration.Duration;
    maxAttempts?: number;
  }
): Schedule.Schedule<unknown, unknown, never> {
  const schedule = Schedule.spaced(config.delay);

  if (config.maxAttempts) {
    return pipe(schedule, Schedule.compose(Schedule.recurs(config.maxAttempts - 1)));
  }

  return schedule;
}

/**
 * Retry with fallback
 */
export function retryWithFallback<R, E, A>(
  primary: Effect.Effect<A, E, R>,
  fallback: Effect.Effect<A, E, R>,
  schedule: Schedule.Schedule<unknown, unknown, never> = exponentialBackoff()
): Effect.Effect<A, E, R> {
  return pipe(
    primary,
    Effect.retry(schedule),
    Effect.orElse(() => fallback)
  );
}

/**
 * Bulkhead pattern - limit concurrent executions
 */
export function bulkhead<R, E, A>(
  effect: Effect.Effect<A, E, R>,
  maxConcurrency: number
): Effect.Effect<A, E, R> {
  const semaphore = Effect.unsafeMakeSemaphore(maxConcurrency);
  
  return semaphore.withPermits(1)(effect);
}

/**
 * Timeout error
 */
export class TimeoutError {
  readonly _tag = 'TimeoutError';
  constructor(readonly duration: Duration.Duration) {}
}

/**
 * Retry with timeout
 */
export function retryWithTimeout<R, E, A>(
  effect: Effect.Effect<A, E, R>,
  timeout: Duration.Duration,
  schedule: Schedule.Schedule<unknown, unknown, never> = exponentialBackoff()
): Effect.Effect<A, E | TimeoutError, R> {
  return pipe(
    effect,
    Effect.timeoutFail({
      duration: timeout,
      onTimeout: () => new TimeoutError(timeout),
    }),
    Effect.retry(schedule)
  );
}

/**
 * Retry with logging
 */
export function retryWithLogging<R, E, A>(
  effect: Effect.Effect<A, E, R>,
  config: {
    schedule?: Schedule.Schedule<unknown, unknown, never>;
    onRetry?: (error: E, attempt: number) => Effect.Effect<void, never, never>;
  } = {}
): Effect.Effect<A, E, R> {
  const { schedule = exponentialBackoff(), onRetry } = config;
  
  return pipe(
    Ref.make(0),
    Effect.flatMap((attemptRef) =>
      pipe(
        effect,
        Effect.tapError((error) =>
          pipe(
            Ref.updateAndGet(attemptRef, (n) => n + 1),
            Effect.flatMap((attempt) =>
              onRetry
                ? onRetry(error, attempt)
                : Effect.log(`Retry attempt ${attempt} after error: ${error}`)
            )
          )
        ),
        Effect.retry(schedule)
      )
    )
  );
}

/**
 * Simple retry with exponential backoff
 */
export function retry<R, E, A>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig = {}
): Effect.Effect<A, E, R> {
  return pipe(
    effect,
    Effect.retry(exponentialBackoff(config))
  );
}

/**
 * Retry with custom schedule
 */
export function retryWith<R, E, A>(
  effect: Effect.Effect<A, E, R>,
  schedule: Schedule.Schedule<unknown, unknown, never>
): Effect.Effect<A, E, R> {
  return pipe(
    effect,
    Effect.retry(schedule)
  );
}