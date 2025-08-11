/**
 * Framework Core: Public API
 * 
 * Re-exports all core framework abstractions for external use.
 */

// Event sourcing
export * from './event';
export * from './command';
export * from './query';
export * from './aggregate';
export * from './repository';
export * from './types';
export * from './errors';

// Type aliases for convenience
export type {
  IEvent,
  IEventMetadata,
  IEventStore,
  IEventBus,
} from './event';

export type {
  ICommand,
  ICommandResult,
  ICommandHandler,
  ICommandBus,
} from './command';

export type {
  IQuery,
  IQueryHandler,
  IQueryBus,
  IProjection,
  IProjectionBuilder,
} from './query';

export type {
  IAggregate,
  ISnapshot,
} from './aggregate';

export type {
  IAggregateRepository,
  IAggregateFactory,
  IUnitOfWork,
} from './repository';