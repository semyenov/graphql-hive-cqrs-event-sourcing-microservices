/**
 * Framework Effect: Circuit Breaker Pattern
 * 
 * Circuit breaker implementation for fault tolerance and resilience.
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly successThreshold?: number;
  readonly timeout: Duration.Duration;
  readonly resetTimeout?: Duration.Duration;
  readonly onStateChange?: (from: CircuitState, to: CircuitState) => Effect.Effect<void, never, never>;
}

/**
 * Circuit breaker error
 */
export class CircuitOpenError extends Data.TaggedError('CircuitOpenError')<{
  readonly remainingTimeout: number;
}> {}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  readonly state: CircuitState;
  readonly failures: number;
  readonly successes: number;
  readonly lastFailureTime: number | null;
  readonly lastStateChangeTime: number;
}

/**
 * Create a circuit breaker
 */
export function createCircuitBreaker<R, E, A>(
  config: CircuitBreakerConfig
): (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | CircuitOpenError, R> {
  const {
    failureThreshold,
    successThreshold = 1,
    timeout,
    resetTimeout = timeout,
    onStateChange,
  } = config;

  const stateRef = Ref.unsafeMake<CircuitBreakerState>({
    state: 'closed',
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    lastStateChangeTime: Date.now(),
  });

  const changeState = (
    from: CircuitState,
    to: CircuitState
  ): Effect.Effect<void, never, never> => {
    if (from === to) return Effect.succeed(undefined);
    
    return pipe(
      Ref.update(stateRef, (state) => ({
        ...state,
        state: to,
        lastStateChangeTime: Date.now(),
        failures: 0,
        successes: 0,
      })),
      Effect.flatMap(() =>
        onStateChange ? onStateChange(from, to) : Effect.succeed(undefined)
      )
    );
  };

  return <R, E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | CircuitOpenError, R> =>
    pipe(
      Ref.get(stateRef),
      Effect.flatMap((state) => {
        const now = Date.now();

        // Check if circuit should transition from open to half-open
        if (state.state === 'open') {
          const timeSinceLastFailure = state.lastFailureTime
            ? now - state.lastFailureTime
            : Infinity;

          if (timeSinceLastFailure >= Duration.toMillis(resetTimeout)) {
            return pipe(
              changeState('open', 'half-open'),
              Effect.flatMap(() => executeWithCircuitBreaker(effect))
            );
          } else {
            const remainingTimeout = Duration.toMillis(resetTimeout) - timeSinceLastFailure;
            return Effect.fail(new CircuitOpenError({ remainingTimeout }));
          }
        }

        return executeWithCircuitBreaker(effect);
      })
    );

  function executeWithCircuitBreaker<R, E, A>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | CircuitOpenError, R> {
    return pipe(
      effect,
      Effect.tap(() =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) => {
            if (state.state === 'half-open') {
              // Success in half-open state
              if (state.successes + 1 >= successThreshold) {
                return changeState('half-open', 'closed');
              } else {
                return Ref.update(stateRef, (s) => ({
                  ...s,
                  successes: s.successes + 1,
                }));
              }
            } else if (state.state === 'closed') {
              // Reset failure count on success
              if (state.failures > 0) {
                return Ref.update(stateRef, (s) => ({
                  ...s,
                  failures: 0,
                }));
              }
            }
            return Effect.succeed(undefined);
          })
        )
      ),
      Effect.tapError(() =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) => {
            const now = Date.now();

            if (state.state === 'half-open') {
              // Failure in half-open state - back to open
              return pipe(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  state: 'open' as CircuitState,
                  lastFailureTime: now,
                  failures: 1,
                })),
                Effect.flatMap(() => changeState('half-open', 'open'))
              );
            } else if (state.state === 'closed') {
              // Check if we've reached failure threshold
              const newFailures = state.failures + 1;
              if (newFailures >= failureThreshold) {
                return pipe(
                  Ref.update(stateRef, (s) => ({
                    ...s,
                    state: 'open' as CircuitState,
                    lastFailureTime: now,
                    failures: newFailures,
                  })),
                  Effect.flatMap(() => changeState('closed', 'open'))
                );
              } else {
                return Ref.update(stateRef, (s) => ({
                  ...s,
                  failures: newFailures,
                  lastFailureTime: now,
                }));
              }
            }
            return Effect.succeed(undefined);
          })
        )
      )
    );
  }
}

/**
 * Circuit breaker with exponential backoff
 */
export function withCircuitBreaker<R, E, A>(
  config: CircuitBreakerConfig
): (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | CircuitOpenError, R> {
  return createCircuitBreaker(config);
}

/**
 * Get circuit breaker status
 */
export function getCircuitStatus<R, E, A>(
  circuitBreaker: (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | CircuitOpenError, R>
): Effect.Effect<CircuitState, never, never> {
  // This would need access to the internal state
  // For now, return a placeholder
  return Effect.succeed('closed' as CircuitState);
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  readonly state: CircuitState;
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly openCount: number;
  readonly lastOpenTime: Date | null;
  readonly lastCloseTime: Date | null;
}

/**
 * Create a monitored circuit breaker with metrics
 */
export function createMonitoredCircuitBreaker<R, E, A>(
  config: CircuitBreakerConfig & {
    onMetricsUpdate?: (metrics: CircuitBreakerMetrics) => Effect.Effect<void, never, never>;
  }
): {
  readonly wrap: <R, E, A>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | CircuitOpenError, R>;
  readonly getMetrics: () => Effect.Effect<CircuitBreakerMetrics, never, never>;
} {
  const metricsRef = Ref.unsafeMake<CircuitBreakerMetrics>({
    state: 'closed',
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    openCount: 0,
    lastOpenTime: null,
    lastCloseTime: null,
  });

  const breaker = createCircuitBreaker({
    ...config,
    onStateChange: (from, to) => {
      const updateMetrics = pipe(
        Ref.update(metricsRef, (metrics) => ({
          ...metrics,
          state: to,
          openCount: to === 'open' ? metrics.openCount + 1 : metrics.openCount,
          lastOpenTime: to === 'open' ? new Date() : metrics.lastOpenTime,
          lastCloseTime: to === 'closed' ? new Date() : metrics.lastCloseTime,
        })),
        Effect.flatMap(() =>
          config.onMetricsUpdate
            ? pipe(Ref.get(metricsRef), Effect.flatMap(config.onMetricsUpdate))
            : Effect.succeed(undefined)
        )
      );

      return pipe(
        updateMetrics,
        Effect.flatMap(() =>
          config.onStateChange ? config.onStateChange(from, to) : Effect.succeed(undefined)
        )
      );
    },
  });

  return {
    wrap: <R, E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | CircuitOpenError, R> =>
      pipe(
        Ref.update(metricsRef, (m) => ({ ...m, totalRequests: m.totalRequests + 1 })),
        Effect.flatMap(() => breaker(effect) as Effect.Effect<A, E | CircuitOpenError, R>),
        Effect.tap(() =>
          Ref.update(metricsRef, (m) => ({
            ...m,
            successfulRequests: m.successfulRequests + 1,
          }))
        ),
        Effect.tapError(() =>
          Ref.update(metricsRef, (m) => ({
            ...m,
            failedRequests: m.failedRequests + 1,
          }))
        )
      ),
    getMetrics: () => Ref.get(metricsRef),
  };
}

/**
 * Cascade circuit breakers for multiple services
 */
export function cascadeCircuitBreakers<R, E, A>(
  primary: Effect.Effect<A, E, R>,
  fallbacks: Array<Effect.Effect<A, E, R>>,
  config: CircuitBreakerConfig
): Effect.Effect<A, E | CircuitOpenError, R> {
  const breakers = [primary, ...fallbacks].map((effect) =>
    withCircuitBreaker(config)(effect)
  );

  const tryNext = (index: number): Effect.Effect<A, E | CircuitOpenError, R> => {
    if (index >= breakers.length) {
      return Effect.fail(new CircuitOpenError({ remainingTimeout: 0 }));
    }

    return pipe(
      breakers[index]! as Effect.Effect<A, E | CircuitOpenError, R>,
      Effect.catchIf(
        (error): error is CircuitOpenError =>
          error instanceof CircuitOpenError,
        () => tryNext(index + 1)
      )
    );
  };

  return tryNext(0);
}