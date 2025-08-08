/**
 * Framework Core: Public API
 * 
 * Re-exports all core framework abstractions for external use.
 */

// Event sourcing
export { 
  type IEvent,
  type IEventMetadata,
  type IEventStore,
  type IEventBus,
  type EventHandler,
  type EventReducer,
  type EventPattern,
} from './event';
export * from './event-utils';
export { 
  type ICommand,
  type ICommandResult,
  type ICommandHandler,
  type ICommandBus,
  type ICommandMiddleware,
} from './command';
export * from './query';
export * from './aggregate';
export * from './repository';
export * from './types';
export * from './helpers';
export * from './naming-conventions';

// Framework builder for complete applications
export {
  type IFrameworkConfig,
  type IFrameworkApp,
  FrameworkBuilder,
  FrameworkApp,
  createFrameworkBuilder,
  Framework,
} from './framework-builder';
// Validation System (unified from enhanced version)
export { 
  type IValidationError,
  type IValidationResult,
  type IValidator,
  type ICommandValidator,
  type IQueryValidator,
  type ValidationRule,
  type ValidationSchema,
  type StringValidationRule,
  type NumberValidationRule,
  type BooleanValidationRule,
  type ArrayValidationRule,
  type NestedValidationRule,
  BaseValidator,
  SchemaValidator,
  ValidationRules,
  ValidationBuilder,
  createValidator,
  createCommandValidator,
  createQueryValidator,
  combineValidators,
  validator,
  Validate,
} from './validation';

// Simple domain registration (recommended)
export {
  type ISimpleRegistry,
  SimpleDiscovery,
  createSimpleDiscovery,
  DiscoveryHelpers,
} from './simple-discovery';

export {
  type IDomainContext,
  type ISimpleDomainOptions,
  SimpleDomainBuilder,
  createSimpleDomainBuilder,
  DomainBuilder,
} from './simple-domain-builder';

// Legacy domain registration (deprecated - use SimpleDomainBuilder)
export { 
  type IDomainComponents,
  DomainBuilder as LegacyDomainBuilder,
  createDomainBuilder,
  initializeDomain,
} from './domain-registry';

// Legacy auto-discovery system (deprecated - use SimpleDomainBuilder.fromModule)
export {
  type IDiscoveryConfig,
  type IDiscoveredComponent,
  type IDiscoveryResult,
  AutoDiscovery,
  FileSystemDiscovery,
  ComponentNameAnalyzer,
  createAutoDiscovery,
  DiscoveryPresets,
  DEFAULT_DISCOVERY_CONFIG,
} from './auto-discovery';

// Legacy enhanced domain builder (deprecated - use SimpleDomainBuilder)
export {
  type IEnhancedDomainOptions,
  EnhancedDomainBuilder,
  createEnhancedDomainBuilder,
  DomainBuilderFactory,
} from './enhanced-domain-builder';

// Repository lifecycle management (Phase 5 enhancement)
export {
  type RepositoryLifecycleEvent,
  type ILifecycleContext,
  type LifecycleHook,
  type IRepositoryConfig,
  type IRepositoryMetrics,
  LifecycleAwareRepository,
  RepositoryHooks,
  createLifecycleRepository,
  RepositoryBuilder,
  createRepositoryBuilder,
} from './repository-lifecycle';

// Type aliases for convenience
export type {
  IEvent as Event,
  IEventMetadata as EventMetadata,
  IEventStore as EventStore,
  IEventBus as EventBus,
} from './event';

export type {
  ICommand as Command,
  ICommandResult as CommandResult,
  ICommandHandler as CommandHandler,
  ICommandBus as CommandBus,
} from './command';

export type {
  IQuery as Query,
  IQueryHandler as QueryHandler,
  IQueryBus as QueryBus,
  IProjection as Projection,
  IProjectionBuilder as ProjectionBuilder,
} from './query';

export type {
  IAggregate as AggregateRoot,
  ISnapshot as Snapshot,
} from './aggregate';

export type {
  IAggregateRepository as Repository,
  IAggregateFactory as Factory,
  IUnitOfWork as UnitOfWork,
} from './repository';