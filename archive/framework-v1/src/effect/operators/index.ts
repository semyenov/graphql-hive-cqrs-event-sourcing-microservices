/**
 * Framework Effect: Operators Module
 * 
 * Custom Effect operators and combinators for CQRS/Event Sourcing patterns.
 * Provides specialized operators for command and event processing.
 */

// Core combinators
export * from './combinators';

// Effect transformers (excluding conflicting exports)
export {
  mapError,
  mapBoth,
  bimap,
  filterOrFail,
  filterOrElse,
  refineOrDie,
  validate,
  validateAll,
  memoize,
  cached,
  // Note: debounce and throttle are exported from schedulers
} from './transformers';

// Scheduling operators
export * from './schedulers';

// Resource management
export * from './resource-management';

/**
 * Quick reference for Effect operators:
 * 
 * 1. Combinators:
 * ```typescript
 * import { fold, chain, bimap } from '@cqrs/framework/effect/operators';
 * 
 * const result = fold(
 *   effect,
 *   (error) => handleError(error),
 *   (value) => handleSuccess(value)
 * );
 * ```
 * 
 * 2. Transformers:
 * ```typescript
 * import { mapError, filterOrFail } from '@cqrs/framework/effect/operators';
 * 
 * const enhanced = pipe(
 *   effect,
 *   mapError((e) => new CustomError(e)),
 *   filterOrFail(
 *     (value) => value > 0,
 *     () => new ValidationError('Value must be positive')
 *   )
 * );
 * ```
 * 
 * 3. Schedulers:
 * ```typescript
 * import { retryWithBackoff, repeatEvery } from '@cqrs/framework/effect/operators';
 * 
 * const resilient = retryWithBackoff(effect, {
 *   maxAttempts: 5,
 *   initialDelay: 1000,
 *   maxDelay: 30000,
 *   factor: 2
 * });
 * ```
 * 
 * 4. Resources:
 * ```typescript
 * import { bracketEffect, using } from '@cqrs/framework/effect/operators';
 * 
 * const withResource = bracketEffect(
 *   acquire,
 *   use,
 *   release
 * );
 * ```
 */