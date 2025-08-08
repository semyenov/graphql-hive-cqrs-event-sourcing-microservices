/**
 * Domain layer interfaces - depends only on core types
 */

import type {
  IEvent,
  ICommand,
  ICommandResult,
  ISnapshot,
  IAggregate,
  EventReducer,
  EventHandler,
} from '../core/types';
import type { AggregateId, EventVersion } from '../core/branded';

// ============================================================================
// Event Store Interfaces
// ============================================================================

/**
 * Event store interface for persistence
 */
export interface IEventStore<TEvent extends IEvent = IEvent> {
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
  subscribe(callback: EventHandler<TEvent>): () => void;
}

/**
 * Snapshot store interface for optimization
 */
export interface ISnapshotStore<
  TState,
  TAggregateId extends AggregateId = AggregateId
> {
  save(snapshot: ISnapshot<TState, TAggregateId>): Promise<void>;
  get(aggregateId: TAggregateId): Promise<ISnapshot<TState, TAggregateId> | null>;
}

// ============================================================================
// Aggregate Interfaces
// ============================================================================

/**
 * Aggregate behavior interface
 */
export interface IAggregateBehavior<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId = AggregateId
> extends IAggregate<TState, TEvent, TAggregateId> {
  applyEvent(event: TEvent, isNew: boolean): void;
  markEventsAsCommitted(): void;
  createSnapshot(): ISnapshot<TState, TAggregateId>;
  loadFromHistory(events: TEvent[]): void;
  loadFromSnapshot(snapshot: ISnapshot<TState, TAggregateId>): void;
}

/**
 * Aggregate constructor interface
 */
export interface IAggregateConstructor<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TAggregateId>
> {
  new (id: TAggregateId): TAggregate;
  fromEvents(id: TAggregateId, events: TEvent[]): Promise<TAggregate>;
  fromSnapshot(
    snapshot: ISnapshot<TState, TAggregateId>,
    events: TEvent[]
  ): Promise<TAggregate>;
}

/**
 * Aggregate factory interface
 */
export interface IAggregateFactory<
  TAggregate extends IAggregateBehavior<unknown, IEvent>,
  TAggregateId extends AggregateId = AggregateId
> {
  create(id: TAggregateId): TAggregate;
  load(id: TAggregateId): Promise<TAggregate>;
}

/**
 * Aggregate repository interface
 */
export interface IAggregateRepository<
  TAggregate extends IAggregateBehavior<unknown, IEvent>,
  TAggregateId extends AggregateId = AggregateId
> {
  get(id: TAggregateId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  exists(id: TAggregateId): Promise<boolean>;
}

// ============================================================================
// Command & Query Interfaces
// ============================================================================

/**
 * Command handler interface
 */
export interface ICommandHandler<
  TCommand extends ICommand,
  TResult = ICommandResult
> {
  handle(command: TCommand): Promise<TResult>;
  canHandle(command: ICommand): boolean;
}

/**
 * Command bus interface
 */
export interface ICommandBus {
  send<TCommand extends ICommand, TResult = ICommandResult>(
    command: TCommand
  ): Promise<TResult>;
  register<TCommand extends ICommand>(
    handler: ICommandHandler<TCommand>
  ): void;
}

/**
 * Query interface
 */
export interface IQuery<TResult = unknown> {
  type: string;
  parameters?: Record<string, unknown>;
}

/**
 * Query handler interface
 */
export interface IQueryHandler<TQuery extends IQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
  canHandle(query: IQuery): boolean;
}

/**
 * Query bus interface
 */
export interface IQueryBus {
  ask<TQuery extends IQuery, TResult>(query: TQuery): Promise<TResult>;
  register<TQuery extends IQuery, TResult>(
    handler: IQueryHandler<TQuery, TResult>
  ): void;
}

// ============================================================================
// Projection Interfaces
// ============================================================================

/**
 * Projection builder interface
 */
export interface IProjectionBuilder<
  TEvent extends IEvent,
  TProjection
> {
  rebuild(events: TEvent[]): Promise<void>;
  get(id: string): TProjection | null;
  getAll(): TProjection[];
  search(predicate: (projection: TProjection) => boolean): TProjection[];
}

/**
 * Projection rebuilder interface
 */
export interface IProjectionRebuilder {
  rebuild(): Promise<void>;
  rebuildFrom(version: EventVersion): Promise<void>;
}

// ============================================================================
// Event Handling Interfaces
// ============================================================================

/**
 * Event handler for projections and side effects
 */
export interface IEventHandler<TEvent extends IEvent> {
  canHandle(event: TEvent): boolean;
  handle(event: TEvent): Promise<void>;
}

/**
 * Event publisher interface
 */
export interface IEventPublisher<TEvent extends IEvent> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
}

/**
 * Event bus interface
 */
export interface IEventBus<TEvent extends IEvent = IEvent> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: EventHandler<TSpecificEvent>
  ): () => void;
  subscribeAll(handler: EventHandler<TEvent>): () => void;
}

// ============================================================================
// Saga Interface
// ============================================================================

/**
 * Saga interface for handling cross-aggregate transactions
 */
export interface ISaga<TEvent extends IEvent, TCommand extends ICommand> {
  handleEvent(event: TEvent): Promise<TCommand[]>;
  getHandledEventTypes(): TEvent['type'][];
}