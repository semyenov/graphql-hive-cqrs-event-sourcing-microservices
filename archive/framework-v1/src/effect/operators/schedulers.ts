/**
 * Framework Effect: Schedulers
 * 
 * Effect-based scheduling patterns for retry, delay, and periodic execution.
 */

import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as Fiber from 'effect/Fiber';

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly delay?: number;
  readonly backoffFactor?: number;
  readonly maxDelay?: number;
  readonly jitter?: boolean;
}

/**
 * Exponential backoff retry
 */
export const retryWithBackoff = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig
): Effect.Effect<A, E, R> => {
  const schedule = Schedule.exponential(Duration.millis(config.delay ?? 100), config.backoffFactor ?? 2);
  const withJitter = config.jitter
    ? Schedule.jittered(schedule)
    : schedule;
  const limited = pipe(
    withJitter,
    Schedule.either(Schedule.recurs(config.maxAttempts - 1))
  );
  
  return Effect.retry(effect, limited);
};

/**
 * Linear backoff retry
 */
export const retryWithLinearBackoff = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  attempts: number,
  delay: number
): Effect.Effect<A, E, R> =>
  Effect.retry(
    effect,
    pipe(
      Schedule.spaced(Duration.millis(delay)),
      Schedule.either(Schedule.recurs(attempts - 1))
    )
  );

/**
 * Retry with custom policy
 */
export const retryWithPolicy = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  shouldRetry: (error: E, attempt: number) => boolean,
  schedule: Schedule.Schedule<any, unknown, never>
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, {
    while: (error) => Effect.succeed(shouldRetry(error as E, 0)),
    schedule,
  });

/**
 * Delay effect execution
 */
export const delay = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  milliseconds: number
): Effect.Effect<A, E, R> =>
  pipe(
    Effect.sleep(Duration.millis(milliseconds)),
    Effect.flatMap(() => effect)
  );

/**
 * Debounce effect execution
 */
export const debounce = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  milliseconds: Duration.DurationInput
): Effect.Effect<A, E, R> => {
  return pipe(
    Effect.gen(function* (_) {
      yield* _(Effect.sleep(Duration.toMillis(milliseconds)));
      return yield* _(effect);
    }),
  );
};

/**
 * Throttle effect execution
 */
export const throttle = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  milliseconds: Duration.DurationInput
): Effect.Effect<A, E, R> => {
  let lastExecution = 0;
  
  return Effect.suspend(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecution;
    
    if (timeSinceLastExecution >= Duration.toMillis(milliseconds)) {
      lastExecution = now;
      return effect;
    }
    
    return Effect.fail(new Error('Throttled') as E);
    });
};

/**
 * Schedule periodic execution
 */
export const schedulePeriodic = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  interval: Duration.DurationInput
): Effect.Effect<Fiber.RuntimeFiber<number, E>, never, R> =>
  pipe(
    effect, 
    Effect.repeat(Schedule.spaced(Duration.toMillis(interval))),
    Effect.forkDaemon
  );

/**
 * Execute at fixed rate
 */
export const scheduleAtFixedRate = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  initialDelay: Duration.DurationInput,
  period: Duration.DurationInput
): Effect.Effect<Fiber.RuntimeFiber<number, E>, never, R> =>
  pipe(
    Effect.sleep(Duration.toMillis(initialDelay)),
    Effect.flatMap(() =>
      pipe(
        effect,
        Effect.repeat(Schedule.spaced(Duration.toMillis(period))),
        Effect.forkDaemon
      )
    )
  );

/**
 * Execute with timeout
 */
export const withTimeout = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  duration: Duration.DurationInput
): Effect.Effect<Option.Option<A>, E, R> =>
  pipe(
    effect,
    Effect.timeoutTo({
      onTimeout: () => Option.none(),
      onSuccess: Option.some,
      duration: Duration.toMillis(duration),
    })
  );

/**
 * Execute with deadline
 */
export const withDeadline = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  deadline: Date
): Effect.Effect<Option.Option<A>, E, R> => {
  const timeUntilDeadline = deadline.getTime() - Date.now();
  
  if (timeUntilDeadline <= 0) {
    return Effect.succeed(Option.none());
  }
  
  return withTimeout(effect, timeUntilDeadline);
};

/**
 * Rate limiting with token bucket
 */
export const rateLimit = <R, E, A>(
  createEffect: () => Effect.Effect<A, E, R>,
  maxPerSecond: number
): Effect.Effect<() => Effect.Effect<A, E, R>, never, never> =>
  Effect.gen(function* (_) {
    const minInterval = 1000 / maxPerSecond;
    const lastExecutionRef = yield* _(Ref.make(0));
    
    return (): Effect.Effect<A, E, R> =>
      Effect.gen(function* (_) {
        const now = Date.now();
        const lastExecution = yield* _(Ref.get(lastExecutionRef));
        const elapsed = now - lastExecution;
        
        if (elapsed < minInterval) {
          yield* _(Effect.sleep(Duration.millis(minInterval - elapsed)));
        }
        
        yield* _(Ref.set(lastExecutionRef, Date.now()));
        return yield* _(createEffect());
      });
  });

/**
 * Execute with jitter
 */
export const withJitter = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  maxJitter: number
): Effect.Effect<A, E, R> => {
  const jitter = Math.random() * maxJitter;
  return delay(effect, jitter);
};

/**
 * Cron-like scheduling
 */
export interface CronConfig {
  readonly second?: number | '*';
  readonly minute?: number | '*';
  readonly hour?: number | '*';
  readonly dayOfMonth?: number | '*';
  readonly month?: number | '*';
  readonly dayOfWeek?: number | '*';
}

/**
 * Calculate next cron execution time
 */
const calculateNextCronTime = (config: CronConfig): Date => {
  const now = new Date();
  const next = new Date(now);
  
  // Simple implementation - just advances to next minute for demonstration
  if (config.minute && config.minute !== '*') {
    next.setMinutes(config.minute as number);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
  } else {
    next.setMinutes(next.getMinutes() + 1);
  }
  
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  return next;
};

/**
 * Schedule with cron expression
 */
export const scheduleCron = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  config: CronConfig
): Effect.Effect<Fiber.RuntimeFiber<number, E>, never, R> =>
  Effect.gen(function* (_) {
    const fiber = yield* _(Effect.fork(
      Effect.gen(function* (_) {
        while (true) {
          const nextTime = calculateNextCronTime(config);
          const delay = nextTime.getTime() - Date.now();
          
          if (delay > 0) {
            yield* _(Effect.sleep(Duration.millis(delay)));
          }
          
          yield* _(effect);
        }
      })
    ));
    
    return fiber;
  });

/**
 * Execute with circuit breaker
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly timeout: Duration.Duration;
  readonly resetTimeout: Duration.Duration;
}

export const withCircuitBreaker = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  config: CircuitBreakerConfig
): Effect.Effect<A, E | 'CircuitOpen', R> =>
  Effect.gen(function* (_) {
    const failures = yield* _(Ref.make(0));
    const lastFailureTime = yield* _(Ref.make(0));
    const isOpen = yield* _(Ref.make(false));
    
    return yield* _(Effect.suspend(() =>
      Effect.gen(function* (_) {
        const open = yield* _(Ref.get(isOpen));
        
        if (open) {
          const lastFailure = yield* _(Ref.get(lastFailureTime));
          const now = Date.now();
          const resetTime = Duration.toMillis(config.resetTimeout);
          
          if (now - lastFailure > resetTime) {
            yield* _(Ref.set(isOpen, false));
            yield* _(Ref.set(failures, 0));
          } else {
            return yield* _(Effect.fail('CircuitOpen' as const));
          }
        }
        
        return yield* _(pipe(
          effect,
          Effect.tapError(() =>
            Effect.gen(function* (_) {
              const count = yield* _(Ref.updateAndGet(failures, (n) => n + 1));
              yield* _(Ref.set(lastFailureTime, Date.now()));
              
              if (count >= config.failureThreshold) {
                yield* _(Ref.set(isOpen, true));
              }
            })
          ),
          Effect.tap(() => Ref.set(failures, 0))
        ));
      })
    ));
  });

/**
 * Polling with exponential backoff
 */
export const poll = <R, E, A>(
  check: () => Effect.Effect<Option.Option<A>, E, R>,
  config: {
    readonly maxAttempts?: number;
    readonly initialDelay?: number;
    readonly maxDelay?: number;
    readonly backoffFactor?: number;
  } = {}
): Effect.Effect<A, E | 'PollTimeout', R> =>
  Effect.gen(function* (_) {
    const maxAttempts = config.maxAttempts ?? 10;
    const initialDelay = config.initialDelay ?? 100;
    const maxDelay = config.maxDelay ?? 10000;
    const backoffFactor = config.backoffFactor ?? 2;
    
    let delay = initialDelay;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = yield* _(check());
      
      if (Option.isSome(result)) {
        return result.value;
      }
      
      if (attempt < maxAttempts - 1) {
        yield* _(Effect.sleep(Duration.millis(delay)));
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }
    
    return yield* _(Effect.fail('PollTimeout' as const));
  });