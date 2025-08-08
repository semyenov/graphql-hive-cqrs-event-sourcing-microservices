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
export { 
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
} from './validation';

// Enhanced validation system V2 (recommended)
export { 
  type IValidationErrorV2,
  type IValidationResultV2,
  type IValidatorV2,
  type ICommandValidatorV2,
  type IQueryValidatorV2,
  type ValidationRuleV2,
  type ValidationSchemaV2,
  type StringValidationRule,
  type NumberValidationRule,
  type BooleanValidationRule,
  type ArrayValidationRule,
  type NestedValidationRule,
  BaseValidatorV2,
  SchemaValidatorV2,
  ValidationRulesV2,
  ValidationBuilderV2,
  createValidatorV2,
  createCommandValidatorV2,
  createQueryValidatorV2,
  validatorV2,
  Validate,
} from './validation-enhanced';

// Domain registration
export { 
  type IDomainComponents,
  type IDomainContext,
  DomainBuilder,
  createDomainBuilder,
  initializeDomain,
} from './domain-registry';

// Auto-discovery system (Phase 4 enhancement)
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

// Enhanced domain builder with auto-discovery
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