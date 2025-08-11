/**
 * Framework Effect Module
 *
 * Complete Effect-TS integration with functional error handling,
 * dependency injection, streaming, and resilience patterns.
 */

// Core types
export type {
  EventHandler,
  IAggregateBehavior,
  ICommand,
  ICommandBus,
  ICommandHandler,
  ICommandResult,
  IEvent,
  IEventBus,
  IEventStore,
  IProjection,
  IQuery,
  IQueryBus,
  IQueryHandler,
  IQueryResult,
  ISnapshot,
} from "./core/types";

// Core Effect modules - Command Effects
export {
  AggregateNotFoundError as CommandAggregateNotFoundError,
  batchCommands,
  CommandContext,
  type CommandError,
  CommandExecutionError,
  CommandHandlerServiceLive,
  CommandPipeline,
  commandPipeline,
  commandSaga,
  CommandValidationError,
  ConcurrencyError,
  createCommandHandler,
  type EffectCommandHandler,
  executeCommand as executeCommandEffect,
  fromCommandHandler,
  parallel as parallelCommands,
  sequence,
  withCircuitBreaker as withCommandCircuitBreaker,
  withLogging as withCommandLogging,
  // Avoid conflicts - use prefixed exports
  withRetry as withCommandRetry,
  withTimeout,
} from "./core/command-effects";

// Core Effect modules - Event Effects
export {
  createEffectEventBus,
  createEventDispatcher,
  createEventHandler,
  createEventStream,
  createProjection,
  EffectEventBus,
  type EffectEventHandler,
  EventContext,
  EventDispatcher,
  type EventError,
  EventProcessingError,
  EventProjection,
  EventSourcing,
  EventStoreServiceLive,
  EventVersionConflict,
  fromEventHandler,
  ProjectionError,
} from "./core/event-effects";

// Core Effect modules - Repository Effects
export {
  AggregateNotFoundError,
  createCachedRepository,
  createRepository,
  createRepositoryLayer,
  type EffectRepository,
  PersistenceError,
  type RepositoryContext,
  RepositoryContextTag,
  type RepositoryError,
  SnapshotError,
  VersionConflictError,
  withLogging as withRepositoryLogging,
  withMetrics as withRepositoryMetrics,
  withOptimisticLocking,
  // Avoid conflicts - use prefixed exports
  withRetry as withRepositoryRetry,
  withTransaction,
} from "./core/repository-effects";

// Service layer with dependency injection
export * from "./services";

// Resilience patterns - Retry
export {
  bulkhead,
  exponentialBackoff,
  linearBackoff,
  retry,
  type RetryConfig,
  RetryExhaustedError,
  retryWith,
  retryWithFallback,
  retryWithLogging,
  retryWithTimeout,
  TimeoutError,
} from "./patterns/retry";

// Resilience patterns - Circuit Breaker
export {
  cascadeCircuitBreakers,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
  CircuitOpenError,
  type CircuitState,
  createCircuitBreaker,
  createMonitoredCircuitBreaker,
  getCircuitStatus,
} from "./patterns/circuit-breaker";

// Error types
export * from "./errors";

// Runtime configuration
export * from "./runtime";

// Keep simplified version for backward compatibility
export * from "./command-effects-simple";

/**
 * Effect-TS Re-exports for convenience
 * These are the most commonly used Effect modules in the framework
 */
export * as Effect from "effect/Effect";
export * as Context from "effect/Context";
export * as Layer from "effect/Layer";
export * as Data from "effect/Data";
export * as Either from "effect/Either";
export * as Option from "effect/Option";
export * as Schedule from "effect/Schedule";
export * as Duration from "effect/Duration";
export * as Stream from "effect/Stream";
export * as Queue from "effect/Queue";
export * as Ref from "effect/Ref";
export * as STM from "effect/STM";
export * as Fiber from "effect/Fiber";
export * as Exit from "effect/Exit";
export * as Cause from "effect/Cause";
export * as Config from "effect/Config";
export * as Cache from "effect/Cache";
export { pipe } from "effect/Function";

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
    services: Layer.Layer<R, never, never>,
  ): Promise<A> => {
    return pipe(
      effect,
      Effect.provide(services),
      Effect.runPromise,
    );
  },

  /**
   * Create a test runtime for effects
   */
  createTestRuntime: () => {
    return Layer.mergeAll(
      LoggerServiceLive,
      MetricsServiceLive,
      CacheServiceLive,
    );
  },

  /**
   * Convert Promise to Effect
   */
  fromPromise: <A>(
    promise: () => Promise<A>,
    mapError?: (error: unknown) => Error,
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
    fn: (callback: (error: Error | null, result?: A) => void) => void,
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
import {
  CacheServiceLive,
  LoggerServiceLive,
  MetricsServiceLive,
} from "./services";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";
