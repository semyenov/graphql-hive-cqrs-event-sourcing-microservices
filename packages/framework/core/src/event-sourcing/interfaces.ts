// Core interfaces for CQRS/Event Sourcing framework
import type { AggregateId, EventVersion } from '../types/branded';
import type { Event, EventReducer } from './events';
import type { Command } from './commands';
import type { Snapshot } from './snapshots';

// Re-export imported types for convenience
export type { Event, EventReducer } from './events';
export type { Command } from './commands';
export type { Snapshot } from './snapshots';

// ============================================================================
// Event Store Interface
// ============================================================================

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

// ============================================================================
// Aggregate Interfaces
// ============================================================================

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

// Aggregate root interface
export interface AggregateRoot<TState, TEvent extends Event, TAggregateId extends AggregateId = AggregateId> 
  extends IAggregate<TState, TEvent, TAggregateId> {
  loadFromHistory(events: TEvent[]): void;
  loadFromSnapshot(snapshot: Snapshot<TState, TAggregateId>, events: TEvent[]): void;
}

// ============================================================================
// Repository Interface
// ============================================================================

// Repository interface
export interface IAggregateRepository<
  TAggregate extends IAggregate<unknown, Event>,
  TAggregateId extends AggregateId = AggregateId
> {
  get(id: TAggregateId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  exists(id: TAggregateId): Promise<boolean>;
  delete?(id: TAggregateId): Promise<void>;
}

// ============================================================================
// Command and Query Interfaces
// ============================================================================

// Command handler interface
export interface ICommandHandler<TCommand extends Command, TEvent extends Event> {
  handle(command: TCommand): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
}

// Query handler interface
export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// ============================================================================
// Saga Interface
// ============================================================================

// Saga interface for handling cross-aggregate transactions
export interface ISaga<TEvent extends Event> {
  handleEvent(event: TEvent): Promise<Command[]>;
  getSagaId(): string;
  isComplete(): boolean;
}

// Saga manager interface
export interface ISagaManager<TEvent extends Event> {
  register(saga: ISaga<TEvent>): void;
  handleEvent(event: TEvent): Promise<void>;
  getSaga(sagaId: string): ISaga<TEvent> | undefined;
}

// ============================================================================
// Event Handler Interface
// ============================================================================

// Event handler for projections
export interface IEventHandler<TEvent extends Event> {
  canHandle(event: TEvent): boolean;
  handle(event: TEvent): Promise<void>;
  getHandledEventTypes?(): string[];
}

// ============================================================================
// Factory Interfaces
// ============================================================================

// Aggregate factory interface
export interface IAggregateFactory<
  TAggregate extends IAggregate<unknown, Event>,
  TAggregateId extends AggregateId = AggregateId
> {
  create(id: TAggregateId): TAggregate;
  load(id: TAggregateId): Promise<TAggregate>;
}

// Event factory interface
export interface IEventFactory<TEvent extends Event> {
  createEvent<TType extends TEvent['type']>(
    type: TType,
    aggregateId: AggregateId,
    data: Extract<TEvent, { type: TType }>['data']
  ): Extract<TEvent, { type: TType }>;
}

// Command factory interface
export interface ICommandFactory<TCommand extends Command> {
  createCommand<TType extends TCommand['type']>(
    type: TType,
    aggregateId: AggregateId,
    payload: Extract<TCommand, { type: TType }>['payload']
  ): Extract<TCommand, { type: TType }>;
}

// ============================================================================
// Event Bus Interface
// ============================================================================

// Event bus interface
export interface IEventBus<TEvent extends Event = Event> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: (event: TSpecificEvent) => void | Promise<void>
  ): () => void;
  subscribeAll(handler: (event: TEvent) => void | Promise<void>): () => void;
}

// ============================================================================
// Subscription Interfaces
// ============================================================================

// Subscription options
export interface SubscriptionOptions {
  fromVersion?: EventVersion;
  toVersion?: EventVersion;
  batchSize?: number;
  filter?: (event: Event) => boolean;
}

// Event subscription
export interface EventSubscription<TEvent extends Event> {
  id: string;
  eventTypes: TEvent['type'][];
  handler: (event: TEvent) => void | Promise<void>;
  options?: SubscriptionOptions;
}

// ============================================================================
// Stream Processing Interfaces
// ============================================================================

// Event stream for reactive processing
export interface EventStream<TEvent extends Event> {
  subscribe(handler: (event: TEvent) => void | Promise<void>): () => void;
  pipe<TResult>(transform: (event: TEvent) => TResult): EventStream<Event<string, TResult>>;
  filter(predicate: (event: TEvent) => boolean): EventStream<TEvent>;
  take(count: number): EventStream<TEvent>;
  skip(count: number): EventStream<TEvent>;
  buffer(size: number): EventStream<TEvent>;
  debounce(ms: number): EventStream<TEvent>;
  throttle(ms: number): EventStream<TEvent>;
}

// Event processor with backpressure
export interface EventProcessor<TEvent extends Event> {
  process(event: TEvent): Promise<void>;
  pause(): void;
  resume(): void;
  getQueueSize(): number;
  setMaxQueueSize(size: number): void;
  onBackpressure(handler: () => void): void;
}

// ============================================================================
// Read Model Interfaces
// ============================================================================

// Read model store interface
export interface IReadModelStore<TModel> {
  save(id: string, model: TModel): Promise<void>;
  get(id: string): Promise<TModel | null>;
  getAll(): Promise<TModel[]>;
  delete(id: string): Promise<void>;
  search(predicate: (model: TModel) => boolean): Promise<TModel[]>;
}

// Read model projector interface
export interface IReadModelProjector<TEvent extends Event, TModel> {
  project(events: TEvent[]): Promise<TModel>;
  update(model: TModel, event: TEvent): Promise<TModel>;
  canHandle(event: TEvent): boolean;
}