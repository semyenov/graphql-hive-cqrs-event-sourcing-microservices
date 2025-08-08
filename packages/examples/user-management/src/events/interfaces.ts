import type { EventReducer, Snapshot, Command } from './generic-types';
import type { AggregateId, Event } from '@cqrs-framework/core';

// Event Store interface for persistence
export interface IEventStore<TEvent extends Event = Event> {
  append(event: TEvent): Promise<void>;
  appendBatch(events: TEvent[]): Promise<void>;
  getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<TEvent, { aggregateId: TAggregateId }>>>;
  getAllEvents(fromPosition?: number): Promise<TEvent[]>;
  getEventsByType<TType extends TEvent['type']>(
    type: TType
  ): Promise<Array<Extract<TEvent, { type: TType }>>>;
  subscribe(callback: (event: TEvent) => void): () => void;
}

// Aggregate interface for external access
export interface IAggregate<TState, TEvent extends Event, TAggregateId extends AggregateId = AggregateId> {
  getId(): TAggregateId;
  getVersion(): number;
  getState(): TState | null;
  getUncommittedEvents(): readonly TEvent[];
  markEventsAsCommitted(): void;
  createSnapshot(): Snapshot<TState, TAggregateId>;
}

// Internal aggregate interface for protected member access
export interface IAggregateInternal<TState, TEvent extends Event> {
  applyEvent(event: TEvent, isNew: boolean): void;
}

// Aggregate constructor interface
export interface IAggregateConstructor<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId,
  TAggregate extends IAggregate<TState, TEvent, TAggregateId>
> {
  new (id: TAggregateId): TAggregate;
  fromEvents(id: TAggregateId, events: TEvent[]): Promise<TAggregate>;
  fromSnapshot(snapshot: Snapshot<TState, TAggregateId>, events: TEvent[]): Promise<TAggregate>;
}

// Command handler interface
export interface ICommandHandler<TCommand extends Command, TEvent extends Event> {
  handle(command: TCommand): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
}

// Repository interface
export interface IAggregateRepository<
  TAggregate extends IAggregate<unknown, Event>,
  TAggregateId extends AggregateId = AggregateId
> {
  get(id: TAggregateId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  exists(id: TAggregateId): Promise<boolean>;
}

// Projection builder interface
export interface IProjectionBuilder<TEvent extends { aggregateId: AggregateId }, TProjection> {
  rebuild(events: TEvent[]): Promise<void>;
  get(id: AggregateId): TProjection | null;
  getAll(): TProjection[];
  search(predicate: (projection: TProjection) => boolean): TProjection[];
}

// Query handler interface
export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// Saga interface for handling cross-aggregate transactions
export interface ISaga<TEvent extends Event> {
  handleEvent(event: TEvent): Promise<Command[]>;
}

// Snapshot store interface
export interface ISnapshotStore<TState, TAggregateId extends AggregateId = AggregateId> {
  save(snapshot: Snapshot<TState, TAggregateId>): Promise<void>;
  get(aggregateId: TAggregateId): Promise<Snapshot<TState, TAggregateId> | null>;
}

// Event handler for projections
export interface IEventHandler<TEvent extends Event> {
  canHandle(event: TEvent): boolean;
  handle(event: TEvent): Promise<void>;
}

// Aggregate factory interface
export interface IAggregateFactory<
  TAggregate extends IAggregate<unknown, Event>,
  TAggregateId extends AggregateId = AggregateId
> {
  create(id: TAggregateId): TAggregate;
  load(id: TAggregateId): Promise<TAggregate>;
}