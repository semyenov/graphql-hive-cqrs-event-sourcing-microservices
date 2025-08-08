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