// Plugin System and Extensibility Framework
// Comprehensive plugin system for CQRS/Event Sourcing applications

// Command middleware system
export {
  CommandPipeline,
  CommandLoggingMiddleware,
  CommandValidationMiddleware,
  CommandPerformanceMiddleware,
  type CommandMiddleware,
  type CommandContext,
  type CommandPipelineStatistics,
  type ValidationResult,
  type PerformanceMetrics,
  CommandMiddlewareError,
  type CommandMiddlewareErrorCode
} from './middleware/CommandMiddleware';

// Event middleware system
export {
  EventPipeline,
  EventLoggingMiddleware,
  EventFilterMiddleware,
  EventEnrichmentMiddleware,
  EventMetricsMiddleware,
  type EventMiddleware,
  type EventContext,
  type EventPipelineStatistics,
  type EventBatchResult,
  type EventMetrics,
  EventMiddlewareError,
  type EventMiddlewareErrorCode
} from './middleware/EventMiddleware';

// Lifecycle hooks system
export {
  HookManager,
  LifecycleHookRegistry,
  globalLifecycleHooks,
  CommandLoggingHook,
  MetricsCollectionHook,
  HealthCheckHook,
  HookPriority,
  type Hook,
  type CommandLifecycleHooks,
  type EventLifecycleHooks,
  type AggregateLifecycleHooks,
  type ApplicationLifecycleHooks,
  type HookExecutionResult,
  type HookRegistryStatistics,
  HookExecutionError,
  type HookExecutionErrorCode
} from './hooks/LifecycleHooks';

// Decorator system
export {
  CommandHandler,
  EventHandler,
  Saga,
  AggregateRoot,
  Validate,
  Cache,
  RateLimit,
  CircuitBreaker,
  DecoratorReflection,
  COMMAND_HANDLER_METADATA,
  EVENT_HANDLER_METADATA,
  SAGA_METADATA,
  AGGREGATE_METADATA,
  type CommandHandlerOptions,
  type EventHandlerOptions,
  type SagaOptions,
  type AggregateOptions,
  type CacheOptions,
  type RateLimitOptions,
  type CircuitBreakerOptions,
  type CommandHandlerMetadata,
  type EventHandlerMetadata,
  type SagaMetadata,
  type AggregateMetadata,
  ValidationDecoratorError,
  RateLimitDecoratorError,
  CircuitBreakerDecoratorError,
  type ValidationDecoratorErrorCode,
  type RateLimitDecoratorErrorCode,
  type CircuitBreakerDecoratorErrorCode
} from './decorators/CQRSDecorators';