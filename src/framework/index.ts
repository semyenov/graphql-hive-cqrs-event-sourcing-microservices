/**
 * CQRS/Event Sourcing Framework
 * 
 * A generic framework for building event-sourced applications
 * with CQRS pattern, designed to be domain-agnostic and extensible.
 */

// Core abstractions - selective exports to avoid conflicts
export {
  // Event
  type IEvent,
  type IEventMetadata,
  type IEventStore,
  type IEventBus,
  type EventHandler,
  type EventReducer,
  type EventPattern,
  // Event utils
  matchEvent,
  createEventMatcher,
  createEventTypeGuard,
  // Command
  type ICommand,
  type ICommandResult,
  type ICommandHandler,
  type ICommandBus,
  type ICommandMiddleware,
  // Query
  type IQuery,
  type IQueryHandler,
  type IQueryBus,
  type IProjection,
  type IProjectionBuilder,
  // Aggregate
  Aggregate,
  type IAggregate,
  type ISnapshot,
  type IAggregateBehavior,
  // Repository
  type IAggregateRepository,
  type IAggregateFactory,
  type IUnitOfWork,
  // Types
  type IDomainModule,
  type IDomainRegistry,
  type IFrameworkConfig,
  type PartialBy,
  type RequiredBy,
  type DeepPartial,
  type DeepReadonly,
  type NonNullableFields,
  type KeysOfType,
  type OmitMethods,
  type Constructor,
  type Mixin,
  type Result,
  // Helpers
  createEventMetadata,
  createEvent,
  createCommandResult,
  success,
  failure,
  isSuccess,
  isFailure,
  createCommand,
  createQuery,
  EventVersionHelpers,
  AggregateHelpers,
  retry,
  batch,
  debounce,
  throttle,
  // Validation
  type IValidationError,
  type IValidationResult,
  type IValidator,
  type ICommandValidator,
  type IQueryValidator,
  type ValidationRule,
  type ValidationSchema,
  BaseValidator,
  SchemaValidator,
  ValidationRules,
  ValidationBuilder,
  createValidator,
  createCommandValidator,
  createQueryValidator,
  combineValidators,
} from './core';

// Branded types for type safety - selective exports
export {
  type AggregateId,
  type EventId,
  type CommandId,
  type UserId,
  type CorrelationId,
  type CausationId,
  type EventVersion,
  type AggregateVersion,
  type Timestamp,
  type Email,
  type PersonName,
  type Money,
  type Percentage,
  BrandedTypes,
} from './core/branded';

// Infrastructure components
export * from './infrastructure/event-store/memory';
export * from './infrastructure/repository/aggregate';
export * from './infrastructure/projections/builder';
export * from './infrastructure/bus';

// Type aliases for convenience
export type {
  IEvent as Event,
  ICommand as Command,
  IQuery as Query,
  IAggregate as AggregateRoot,
  ISnapshot as Snapshot,
  ICommandHandler as CommandHandler,
  ICommandResult as CommandResult,
  IQueryHandler as QueryHandler,
  IProjection as Projection,
} from './core';

export {
  // Infrastructure
  InMemoryEventStore,
  createEventStore,
} from './infrastructure/event-store/memory';

export {
  AggregateRepository,
} from './infrastructure/repository/aggregate';

export {
  ProjectionBuilder,
  createProjectionBuilder,
  EventDrivenProjectionBuilder,
  SnapshotProjectionBuilder,
  IndexedProjectionBuilder,
} from './infrastructure/projections/builder';

export {
  CommandBus,
  createCommandBus,
  EventBus,
  ReplayableEventBus,
  createEventBus,
  QueryBus,
  createQueryBus,
  subscribeToEvent,
  subscribeToEvents,
} from './infrastructure/bus';

// Simple domain builder (recommended for new projects)
export {
  type ISimpleRegistry,
  type IDomainContext,
  type ISimpleDomainOptions,
  SimpleDomainBuilder,
  createSimpleDomainBuilder,
  SimpleDiscovery,
  createSimpleDiscovery,
  DiscoveryHelpers,
  DomainBuilder,
} from './core';

// GraphQL integration (simple resolvers + middleware)
export {
  type ISimpleResolverContext,
  createCommandResolver,
  createQueryResolver,
  createBatchResolver,
  SimpleResolverBuilder,
  createResolverBuilder,
  ResolverHelpers,
} from './graphql/simple-resolvers';

export {
  type ResolverMiddleware,
  withValidation,
  withErrorHandling,
  withMetrics,
  withAuth,
  withCache,
  withRateLimit,
  compose,
  MiddlewarePresets,
} from './graphql/resolver-middleware';

// Framework version
export const VERSION = '2.0.0'; // Bumped for KISS refactoring

/**
 * Framework configuration helper
 */
export interface FrameworkConfig {
  eventStore?: 'memory' | 'custom';
  enableCache?: boolean;
  enableMonitoring?: boolean;
}

/**
 * Initialize framework with configuration
 */
export function initializeFramework(config?: FrameworkConfig) {
  return {
    eventStore: config?.eventStore || 'memory',
    cache: config?.enableCache || false,
    monitoring: config?.enableMonitoring || false,
  };
}