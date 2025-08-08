/**
 * CQRS/Event Sourcing Framework
 * 
 * A generic framework for building event-sourced applications
 * with CQRS pattern, designed to be domain-agnostic and extensible.
 */

// Core abstractions
export * from './core';

// Infrastructure components
export * from './infrastructure/event-store/memory';
export * from './infrastructure/repository/aggregate';
export * from './infrastructure/projections/builder';
export * from './infrastructure/bus';

// Convenience exports for common use cases
export {
  // Core
  Aggregate,
  type IEvent as Event,
  type ICommand as Command,
  type IQuery as Query,
  type IAggregate as AggregateRoot,
  type ISnapshot as Snapshot,
  type EventReducer,
  type EventHandler,
  type EventPattern,
  type ICommandHandler as CommandHandler,
  type ICommandResult as CommandResult,
  type IQueryHandler as QueryHandler,
  type IProjection as Projection,
  type IProjectionBuilder as ProjectionBuilder,
} from './core';

export {
  // Infrastructure
  InMemoryEventStore,
  createEventStore,
  AggregateRepository,
  ProjectionBuilder,
  createProjectionBuilder,
  CommandBus,
  createCommandBus,
  EventBus,
  ReplayableEventBus,
  createEventBus,
  QueryBus,
  createQueryBus,
} from './infrastructure/bus';

// Framework version
export const VERSION = '1.0.0';

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