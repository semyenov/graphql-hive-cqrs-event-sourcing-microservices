import type {
  IEvent,
  EventReducer,
  EventPattern,
  ISnapshot,
  ICommand,
} from '../../core/types';
import type {
  IAggregateBehavior,
  IAggregateConstructor,
  ICommandHandler,
  IEventStore,
  IAggregateRepository,
  IAggregateFactory,
} from '../interfaces';
import { BrandedTypes, type AggregateId, type EventVersion, type Timestamp } from '../../core/branded';

// Generic aggregate base class with full type inference
export abstract class Aggregate<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId = AggregateId
> implements IAggregateBehavior<TState, TEvent, TAggregateId> {
  protected state: TState | null = null;
  protected version = 0;
  protected uncommittedEvents: TEvent[] = [];

  constructor(
    protected readonly id: TAggregateId,
    protected readonly reducer: EventReducer<TEvent, TState>,
    protected readonly initialState: TState
  ) { }

  getState(): TState | null {
    return this.state;
  }

  getVersion(): number {
    return this.version;
  }

  getId(): TAggregateId {
    return this.id;
  }

  getUncommittedEvents(): readonly TEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  applyEvent(event: TEvent, isNew = false): void {
    if (event.aggregateId !== this.id) {
      throw new Error(`Event aggregate ID mismatch: ${event.aggregateId} !== ${this.id}`);
    }

    this.state = this.reducer(this.state ?? this.initialState, event);
    this.version = event.version;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  // Load aggregate from event history
  loadFromHistory(events: TEvent[]): void {
    events.forEach(event => this.applyEvent(event, false));
  }

  // Load aggregate from snapshot
  loadFromSnapshot(snapshot: ISnapshot<TState, TAggregateId>): void {
    if (snapshot.aggregateId !== this.id) {
      throw new Error(`Snapshot aggregate ID mismatch: ${snapshot.aggregateId} !== ${this.id}`);
    }
    this.state = snapshot.state;
    this.version = snapshot.version;
  }

  // Load aggregate from events
  static async fromEvents<
    TState,
    TEvent extends IEvent,
    TAggregateId extends AggregateId,
    TAggregate extends Aggregate<TState, TEvent, TAggregateId>
  >(
    this: new (id: TAggregateId) => TAggregate,
    id: TAggregateId,
    events: TEvent[]
  ): Promise<TAggregate> {
    const aggregate = new this(id);
    events.forEach(event => aggregate.applyEvent(event, false));
    return aggregate;
  }

  // Load from snapshot and events
  static async fromSnapshot<
    TState,
    TEvent extends IEvent,
    TAggregateId extends AggregateId,
    TAggregate extends Aggregate<TState, TEvent, TAggregateId>
  >(
    this: new (id: TAggregateId) => TAggregate,
    snapshot: ISnapshot<TState, TAggregateId>,
    events: TEvent[]
  ): Promise<TAggregate> {
    const aggregate = new this(snapshot.aggregateId);

    // Use type assertion to access protected members
    type MutableAggregate = {
      state: TState | null;
      version: number;
    };
    const mutableAggregate = aggregate as unknown as MutableAggregate;
    mutableAggregate.state = snapshot.state;
    mutableAggregate.version = snapshot.version;

    // Apply events after snapshot
    events
      .filter(e => e.version > snapshot.version)
      .forEach(event => aggregate.applyEvent(event, false));

    return aggregate;
  }

  // Create snapshot of current state
  createSnapshot(): ISnapshot<TState, TAggregateId> {
    if (!this.state) {
      throw new Error('Cannot create snapshot of aggregate without state');
    }

    return {
      aggregateId: this.id,
      version: BrandedTypes.eventVersion(this.version),
      state: this.state,
      timestamp: BrandedTypes.timestamp(),
    };
  }

  // Generic command execution with type inference
  protected execute<TCommand extends ICommand>(
    command: TCommand,
    handler: (payload: TCommand['payload']) => TEvent | TEvent[]
  ): void {
    const events = handler(command.payload);
    const eventArray = Array.isArray(events) ? events : [events];

    eventArray.forEach(event => this.applyEvent(event, true));
  }

  // Pattern matching for events
  protected matchEvent<TResult>(
    event: TEvent,
    patterns: EventPattern<TEvent, TResult>
  ): TResult {
    const handler = patterns[event.type as TEvent['type']];
    if (!handler) {
      throw new Error(`No handler for event type: ${event.type}`);
    }
    return handler(event as Parameters<typeof handler>[0]);
  }
}

// Type helper to infer state type from aggregate
export type InferAggregateState<T> = T extends Aggregate<infer S, IEvent, AggregateId> ? S : never;

// Type helper to infer event type from aggregate
export type InferAggregateEvent<T> = T extends Aggregate<unknown, infer E extends IEvent, AggregateId> ? E : never;

// Type helper to infer aggregate ID type
export type InferAggregateId<T> = T extends Aggregate<unknown, IEvent, infer I extends AggregateId> ? I : never;

// Re-export command handler interface
export type { ICommandHandler as CommandHandler } from '../interfaces';

// Factory for creating typed aggregates
export class AggregateFactory<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId = AggregateId
> implements IAggregateFactory<Aggregate<TState, TEvent, TAggregateId>, TAggregateId> {
  constructor(
    private readonly AggregateClass: IAggregateConstructor<TState, TEvent, TAggregateId, Aggregate<TState, TEvent, TAggregateId>>,
    private readonly eventStore: Pick<IEventStore<TEvent>, 'getEvents'>
  ) { }

  async load(id: TAggregateId): Promise<Aggregate<TState, TEvent, TAggregateId>> {
    const events = await this.eventStore.getEvents(id);
    return this.AggregateClass.fromEvents(id, events);
  }

  create(id: TAggregateId): Aggregate<TState, TEvent, TAggregateId> {
    return new this.AggregateClass(id);
  }
}

// Repository pattern for aggregates with generics
export abstract class AggregateRepository<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId,
  TAggregate extends Aggregate<TState, TEvent, TAggregateId>
> implements IAggregateRepository<TAggregate, TAggregateId> {
  constructor(
    protected readonly eventStore: Pick<IEventStore<TEvent>, 'append' | 'appendBatch' | 'getEvents'>
  ) { }

  abstract createAggregate(id: TAggregateId): TAggregate;

  async get(id: TAggregateId): Promise<TAggregate | null> {
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      return null;
    }

    const aggregate = this.createAggregate(id);
    // Use proper method access pattern
    for (const event of events) {
      aggregate.applyEvent(event, false);
    }
    return aggregate;
  }

  async save(aggregate: TAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventStore.appendBatch([...events]);
      aggregate.markEventsAsCommitted();
    }
  }

  async exists(id: TAggregateId): Promise<boolean> {
    const events = await this.eventStore.getEvents(id);
    return events.length > 0;
  }
}