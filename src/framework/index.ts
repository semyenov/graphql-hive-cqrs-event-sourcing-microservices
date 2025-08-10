/**
 * CQRS/Event Sourcing Framework
 * 
 * A generic framework for building event-sourced applications
 * with CQRS pattern, designed to be domain-agnostic and extensible.
 */

import type { IEvent, IEventStore, IEventBus } from './core/event';
import type { ICommandBus } from './core/command';
import type { IQueryBus } from './core/query';
import type { CommandBus, EventBus, QueryBus } from './infrastructure/bus';
import type { InMemoryEventStore } from './infrastructure/event-store/memory';

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
  CorrelationId,
  CausationId,
  TransactionId,
  SessionId,
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
  /** @deprecated Use IFrameworkConfig from core/types instead */
  eventStore?: 'memory' | 'custom';
  /** @deprecated Use IFrameworkConfig from core/types instead */
  enableCache?: boolean;
  /** @deprecated Use IFrameworkConfig from core/types instead */
  enableMonitoring?: boolean;
}

// Unified bootstrap using IFrameworkConfig
export type { IFrameworkConfig } from './core/types';

export function createFramework(config?: import('./core/types').IFrameworkConfig) {
  // For now, just pass through minimal normalized view; future: wire buses/store based on config
  return {
    eventStore: config?.eventStore?.type ?? 'memory',
    commandBus: { middleware: config?.commandBus?.middleware ?? [], timeout: config?.commandBus?.timeout },
    queryBus: { cache: config?.queryBus?.cache ?? false, cacheTimeout: config?.queryBus?.cacheTimeout },
    graphql: config?.graphql ?? {},
    monitoring: config?.monitoring ?? {},
  };
}

/**
 * Convenience boot-strap that wires an in-memory event store and buses ready for use
 *   const { commandBus, queryBus, eventBus, eventStore } = bootstrapFramework();
 */
export async function bootstrapFramework<
  TEvent extends IEvent = IEvent
>(opts?: import('./core/types').IFrameworkConfig): Promise<{
  eventStore: InMemoryEventStore<TEvent>;
  commandBus: CommandBus;
  queryBus: QueryBus;
  eventBus: EventBus<TEvent>;
}> {
  const { createCommandBus, createQueryBus, createEventBus } = await import('./infrastructure/bus');
  const { createEventStore } = await import('./infrastructure/event-store/memory');

  const eventStore = createEventStore<TEvent>();
  const commandBus = createCommandBus();
  const queryBus = createQueryBus(opts?.queryBus?.cache, opts?.queryBus?.cacheTimeout);
  const eventBus = createEventBus<TEvent>();
  return { eventStore, commandBus, queryBus, eventBus } as const;
}