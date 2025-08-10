/**
 * CQRS/Event Sourcing Framework
 * 
 * A generic framework for building event-sourced applications
 * with CQRS pattern, designed to be domain-agnostic and extensible.
 */

// Core abstractions
export * from './core';
export * from './core/errors';

// Branded types for type safety (avoid duplicating Brand/Maybe from core)
export { BrandedTypes, BrandedTypeGuards } from './core/branded';
export type {
  AggregateId,
  EventId,
  CommandId,
  QueryId,
  UserId,
  CorrelationId,
  CausationId,
  TransactionId,
  SessionId,
  Email,
  PersonName,
  CompanyName,
  PhoneNumber,
  URL,
  UUID,
  JSONString,
  Base64String,
  JWTToken,
  Timestamp,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  ExpiredAt,
  EventVersion,
  AggregateVersion,
  SchemaVersion,
  APIVersion,
  PositiveNumber,
  NonNegativeNumber,
  Percentage,
  Money,
  Count,
  Index,
  UnBrand,
  ReBrand,
  Nullable,
  Optional,
} from './core/branded/types';

// Infrastructure components
export * from './infrastructure/event-store/memory';
export * from './infrastructure/repository/aggregate';
// Avoid naming collision with type ProjectionBuilder from core
export { 
  ProjectionBuilder as ProjectionBuilderImpl, 
  createProjectionBuilder 
} from './infrastructure/projections/builder';
// Avoid naming collision with type CommandBus/EventBus/QueryBus from core
export {
  CommandBus as CommandBusImpl,
  createCommandBus,
  EventBus as EventBusImpl,
  ReplayableEventBus,
  createEventBus,
  QueryBus as QueryBusImpl,
  createQueryBus,
} from './infrastructure/bus';

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

/**
 * Framework version
 * @deprecated Prefer importing from your package.json or build metadata instead.
 */
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

/**
 * DX alias for initializeFramework
 */
export const newFramework = initializeFramework;