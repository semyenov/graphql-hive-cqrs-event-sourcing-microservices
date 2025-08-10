/**
 * Framework Effect Module
 * 
 * Complete Effect-TS integration with functional error handling,
 * dependency injection, streaming, and resilience patterns.
 */

// Core Effect modules - Command Effects
export {
  CommandContext,
  CommandValidationError,
  CommandExecutionError,
  ConcurrencyError,
  type CommandError,
  type EffectCommandHandler,
  createCommandHandler,
  withTimeout,
  batchCommands,
  CommandPipeline,
  commandPipeline,
  fromCommandHandler,
  CommandHandlerServiceLive,
  commandSaga,
  sequence,
  // Avoid conflicts - use prefixed exports
  withRetry as withCommandRetry,
  withCircuitBreaker as withCommandCircuitBreaker,
  withLogging as withCommandLogging,
  executeCommand as executeCommandEffect,
  parallel as parallelCommands,
  AggregateNotFoundError as CommandAggregateNotFoundError
} from './core/command-effects';

// Core Effect modules - Event Effects
export {
  EventContext,
  EventProcessingError,
  EventVersionConflict,
  ProjectionError,
  type EventError,
  type EffectEventHandler,
  createEventHandler,
  createEventStream,
  EventProjection,
  createProjection,
  EventSourcing,
  EventDispatcher,
  createEventDispatcher,
  EffectEventBus,
  createEffectEventBus,
  EventStoreServiceLive,
  fromEventHandler
} from './core/event-effects';

// Core Effect modules - Repository Effects
export {
  type RepositoryContext,
  RepositoryContextTag,
  AggregateNotFoundError,
  VersionConflictError,
  PersistenceError,
  SnapshotError,
  type RepositoryError,
  type EffectRepository,
  createRepository,
  withOptimisticLocking,
  createCachedRepository,
  withTransaction,
  createRepositoryLayer,
  // Avoid conflicts - use prefixed exports
  withRetry as withRepositoryRetry,
  withLogging as withRepositoryLogging,
  withMetrics as withRepositoryMetrics
} from './core/repository-effects';

// Service layer with dependency injection
export * from './services';

// Resilience patterns - Retry
export {
  type RetryConfig,
  RetryExhaustedError,
  exponentialBackoff,
  linearBackoff,
  retryWithFallback,
  bulkhead,
  TimeoutError,
  retryWithTimeout,
  retryWithLogging,
  retry,
  retryWith
} from './patterns/retry';

// Resilience patterns - Circuit Breaker
export {
  type CircuitState,
  type CircuitBreakerConfig,
  CircuitOpenError,
  type CircuitBreakerMetrics,
  createCircuitBreaker,
  withCircuitBreaker,
  getCircuitStatus,
  createMonitoredCircuitBreaker,
  cascadeCircuitBreakers
} from './patterns/circuit-breaker';

// Error types
export * from './errors';

// Runtime configuration
export * from './runtime';

// Keep simplified version for backward compatibility
export * from './command-effects-simple';

/**
 * Effect-TS Re-exports for convenience
 * These are the most commonly used Effect modules in the framework
 */
export { 
  Effect,
  pipe,
  Context,
  Layer,
  Data,
  Either,
  Option,
  Schedule,
  Duration,
  Stream,
  Queue,
  Ref,
  STM,
  Fiber,
  Exit,
  Cause,
  Config,
  Cache,
} from 'effect';

/**
 * Quick start guide for Effect integration:
 * 
 * 1. Command Handling:
 * ```typescript
 * import { createCommandHandler, CommandContext } from '@cqrs/framework/effect';
 * 
 * const handler = createCommandHandler({
 *   canHandle: (cmd) => cmd.type === 'CreateUser',
 *   execute: (cmd) => Effect.succeed({ userId: '123' }),
 * });
 * ```
 * 
 * 2. Event Processing:
 * ```typescript
 * import { createEventHandler, EventContext } from '@cqrs/framework/effect';
 * 
 * const handler = createEventHandler({
 *   canHandle: (event) => event.type === 'UserCreated',
 *   process: (event) => Effect.log(`User created: ${event.data.name}`),
 * });
 * ```
 * 
 * 3. Repository with Effects:
 * ```typescript
 * import { createRepository, withOptimisticLocking } from '@cqrs/framework/effect';
 * 
 * const repository = withOptimisticLocking(
 *   createRepository({
 *     createAggregate: (id) => new UserAggregate(id),
 *     snapshotFrequency: 10,
 *   })
 * );
 * ```
 * 
 * 4. Service Composition:
 * ```typescript
 * import { Layer, pipe } from '@cqrs/framework/effect';
 * 
 * const AppLive = Layer.mergeAll(
 *   EventStoreServiceLive,
 *   CommandBusServiceLive,
 *   CoreServicesLive
 * );
 * ```
 * 
 * 5. Resilience Patterns:
 * ```typescript
 * import { exponentialBackoff, withCircuitBreaker } from '@cqrs/framework/effect';
 * 
 * const resilientEffect = pipe(
 *   effect,
 *   Effect.retry(exponentialBackoff({ maxAttempts: 5 })),
 *   withCircuitBreaker({
 *     failureThreshold: 3,
 *     timeout: Duration.seconds(30),
 *   })
 * );
 * ```
 */

/**
 * Type-safe Effect utilities
 */
export const EffectUtils = {
  /**
   * Run an effect with all standard services
   */
  runWithServices: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    services: Layer.Layer<R, never, never>
  ): Promise<A> => {
    return pipe(
      effect,
      Effect.provide(services),
      Effect.runPromise
    );
  },

  /**
   * Create a test runtime for effects
   */
  createTestRuntime: () => {
    return Layer.mergeAll(
      LoggerServiceLive,
      MetricsServiceLive,
      CacheServiceLive
    );
  },

  /**
   * Convert Promise to Effect
   */
  fromPromise: <A>(
    promise: () => Promise<A>,
    mapError?: (error: unknown) => Error
  ): Effect.Effect<A, Error, never> => {
    return Effect.tryPromise({
      try: promise,
      catch: mapError ?? ((error) => new Error(String(error))),
    });
  },

  /**
   * Convert callback to Effect
   */
  fromCallback: <A>(
    fn: (callback: (error: Error | null, result?: A) => void) => void
  ): Effect.Effect<A, Error, never> => {
    return Effect.async<A, Error>((resume) => {
      fn((error, result) => {
        if (error) {
          resume(Effect.fail(error));
        } else {
          resume(Effect.succeed(result!));
        }
      });
    });
  },
} as const;

// Import necessary services for the utilities
import { LoggerServiceLive, MetricsServiceLive, CacheServiceLive } from './services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';