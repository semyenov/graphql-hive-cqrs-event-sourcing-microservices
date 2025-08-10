/**
 * Framework Effect: Error Types
 * 
 * Effect-specific error types for better error handling.
 */

import { DomainError } from '../core/errors';

/**
 * Base class for Effect-related errors
 */
export class EffectError extends DomainError {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'EffectError';
  }
}

/**
 * Command execution error
 */
export class CommandError extends EffectError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CommandError';
  }
}

/**
 * Event processing error
 */
export class EventError extends EffectError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'EventError';
  }
}

/**
 * Repository operation error
 */
export class RepositoryError extends EffectError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'RepositoryError';
  }
}

/**
 * Validation error in Effect context
 */
export class ValidationEffectError extends EffectError {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ValidationEffectError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends EffectError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends EffectError {
  constructor(service: string) {
    super(`Circuit breaker is open for service: ${service}`);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends EffectError {
  constructor(operation: string, attempts: number) {
    super(`Retry exhausted for operation "${operation}" after ${attempts} attempts`);
    this.name = 'RetryExhaustedError';
  }
}