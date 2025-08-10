/**
 * Framework Effect: Error Types
 * 
 * Effect-specific error types for better error handling.
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import * as Schedule from 'effect/Schedule';
import { pipe } from 'effect/Function';

/**
 * Base class for Effect-related errors
 */
export class EffectError extends Data.TaggedError('EffectError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Command execution error
 */
export class CommandError extends Data.TaggedError('CommandError')<{
  readonly command: unknown;
  readonly cause: unknown;
}> {}

/**
 * Event processing error
 */
export class EventError extends Data.TaggedError('EventError')<{
  readonly event: unknown;
  readonly cause: unknown;
}> {}

/**
 * Repository operation error
 */
export class RepositoryError extends Data.TaggedError('RepositoryError')<{
  readonly operation: string;
  readonly entityId: string;
  readonly cause: unknown;
}> {}

/**
 * Validation error in Effect context
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
}> {}

/**
 * Timeout error
 */
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
  readonly operation: string;
  readonly duration: Duration.Duration;
}> {}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Data.TaggedError('CircuitBreakerError')<{
  readonly service: string;
  readonly remainingTimeout: number;
}> {}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends Data.TaggedError('RetryExhaustedError')<{
  readonly operation: string;
  readonly attempts: number;
  readonly lastError: unknown;
}> {}

/**
 * Connection error
 */
export class ConnectionError extends Data.TaggedError('ConnectionError')<{
  readonly endpoint: string;
  readonly cause: unknown;
}> {}

/**
 * Authentication error
 */
export class AuthenticationError extends Data.TaggedError('AuthenticationError')<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Authorization error
 */
export class AuthorizationError extends Data.TaggedError('AuthorizationError')<{
  readonly resource: string;
  readonly action: string;
  readonly userId?: string;
}> {}

/**
 * Resource not found error
 */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly resource: string;
  readonly id: string;
}> {}

/**
 * Conflict error
 */
export class ConflictError extends Data.TaggedError('ConflictError')<{
  readonly resource: string;
  readonly id: string;
  readonly reason: string;
}> {}

/**
 * Rate limit error
 */
export class RateLimitError extends Data.TaggedError('RateLimitError')<{
  readonly service: string;
  readonly retryAfter?: number;
}> {}

/**
 * Error utilities for Effect
 */
export const ErrorUtils = {
  /**
   * Map error to a specific type
   */
  mapError: <E, F>(mapper: (error: E) => F) =>
    <R, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, F, R> =>
      pipe(effect, Effect.mapError(mapper)),

  /**
   * Catch specific error types
   */
  catchTag: <E extends { _tag: string }, F>(
    tag: string,
    handler: (error: E) => Effect.Effect<never, F, never>
  ) =>
    <R, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, F, R> =>
      pipe(
        effect,
        Effect.catchIf(
          (error): error is E => (error as { _tag: string })._tag === tag,
          handler
        )
      ),

  /**
   * Log errors with context
   */
  logError: <E>(context?: unknown) =>
    <R, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      pipe(
        effect,
        Effect.tapError((error) =>
          Effect.logError(`Error occurred${context ? ` in ${JSON.stringify(context)}` : ''}: ${error}`)
        )
      ),

  /**
   * Convert error to success with fallback
   */
  orElse: <E, A>(fallback: A) =>
    <R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, never, R> =>
      pipe(
        effect,
        Effect.catchAll(() => Effect.succeed(fallback))
      ),

  /**
   * Ensure cleanup on error
   */
  ensuring: <R>(cleanup: Effect.Effect<void, never, R>) =>
    <E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      pipe(
        effect,
        Effect.ensuring(cleanup)
      ),
} as const;

/**
 * Error recovery strategies
 */
export const ErrorRecovery = {
  /**
   * Retry with exponential backoff
   */
  retryWithBackoff: <E>(
    maxAttempts: number = 3,
    initialDelay: Duration.Duration = Duration.millis(100)
  ) =>
    <R, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      const schedule = pipe(
        Schedule.exponential(initialDelay, 2),
        Schedule.compose(Schedule.recurs(maxAttempts - 1))
      );
      return pipe(effect, Effect.retry(schedule));
    },

  /**
   * Fallback to alternative effect
   */
  fallback: <E, A>(alternative: Effect.Effect<A, E, unknown>) =>
    <R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      pipe(effect, Effect.orElse(() => alternative as Effect.Effect<A, E, R>)),

  /**
   * Timeout with fallback
   */
  timeoutWithFallback: <E, A>(
    timeout: Duration.Duration,
    fallback: A
  ) =>
    <R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, never, R> =>
      pipe(
        effect,
        Effect.timeout(timeout),
        Effect.catchAll(() => Effect.succeed(fallback))
      ),

  /**
   * Circuit breaker with fallback
   */
  circuitBreakerWithFallback: <E, A>(
    fallback: A,
    config: {
      failureThreshold: number;
      resetTimeout: Duration.Duration;
    }
  ) =>
    <R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, never, R> => {
      // Simplified circuit breaker implementation
      return pipe(
        effect,
        Effect.catchAll(() => Effect.succeed(fallback))
      );
    },
} as const;

/**
 * Error classification utilities
 */
export const ErrorClassification = {
  /**
   * Check if error is retryable
   */
  isRetryable: (error: unknown): boolean => {
    if (error instanceof ConnectionError) return true;
    if (error instanceof TimeoutError) return true;
    if (error instanceof RateLimitError) return true;
    if (error instanceof CircuitBreakerError) return true;
    
    // Check for network errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('connection') ||
             message.includes('retry');
    }
    
    return false;
  },

  /**
   * Check if error is permanent
   */
  isPermanent: (error: unknown): boolean => {
    if (error instanceof ValidationError) return true;
    if (error instanceof AuthenticationError) return true;
    if (error instanceof AuthorizationError) return true;
    if (error instanceof NotFoundError) return true;
    
    return false;
  },

  /**
   * Check if error is transient
   */
  isTransient: (error: unknown): boolean => {
    return !ErrorClassification.isPermanent(error) && 
           !ErrorClassification.isRetryable(error);
  },

  /**
   * Classify error for retry strategy
   */
  classify: (error: unknown): 'retryable' | 'permanent' | 'transient' => {
    if (ErrorClassification.isRetryable(error)) return 'retryable';
    if (ErrorClassification.isPermanent(error)) return 'permanent';
    return 'transient';
  },
} as const;