// Universal Aggregate base class for CQRS/Event Sourcing framework
import type {
  Event,
  Snapshot,
  Command,
  IAggregate,
  IAggregateInternal,
  IAggregateConstructor,
  IEventStore,
  IAggregateRepository,
  IAggregateFactory,
} from '../event-sourcing/interfaces';
import type { 
  EventPattern,
  EventReducer,
  BaseEvent,
  BaseCommand,
  CommandResult,
} from '../event-sourcing/types';
import { BrandedTypes, type AggregateId, type EventVersion, type Timestamp } from '../types/branded';

// Generic aggregate base class with full type inference
export abstract class Aggregate<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId = AggregateId
> implements IAggregate<TState, TEvent, TAggregateId>, IAggregateInternal<TState, TEvent> {
  protected state: TState | null = null;
  protected version = 0;
  protected uncommittedEvents: TEvent[] = [];

  constructor(
    protected readonly id: TAggregateId,
    protected readonly reducer?: EventReducer<TState, TEvent>,
    protected readonly initialState?: TState
  ) {}

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

    // Apply event using reducer if provided, otherwise delegate to subclass
    if (this.reducer && this.initialState !== undefined) {
      this.state = this.reducer(this.state ?? this.initialState, event);
    } else {
      // Allow subclasses to handle event application
      this.handleEvent(event);
    }
    
    this.version = event.version;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  // Abstract method for subclasses to implement event handling
  protected abstract handleEvent(event: TEvent): void;

  // Load aggregate from events
  static async fromEvents<
    TState,
    TEvent extends Event,
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
    TEvent extends Event,
    TAggregateId extends AggregateId,
    TAggregate extends Aggregate<TState, TEvent, TAggregateId>
  >(
    this: new (id: TAggregateId) => TAggregate,
    snapshot: Snapshot<TState, TAggregateId>,
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
  createSnapshot(): Snapshot<TState, TAggregateId> {
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
  protected execute<TCommand extends Command>(
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

  // Helper method to create events with proper metadata
  protected createEvent<TEventType extends TEvent['type']>(
    type: TEventType,
    data: Extract<TEvent, { type: TEventType }>['data'],
    metadata?: Record<string, unknown>
  ): Extract<TEvent, { type: TEventType }> {
    const event = {
      id: crypto.randomUUID(),
      type,
      aggregateId: this.id,
      version: this.version + 1,
      timestamp: BrandedTypes.timestamp(),
      data,
      metadata,
    } as unknown as Extract<TEvent, { type: TEventType }>;

    return event;
  }
}

// Type helpers for inferring aggregate types
export type InferAggregateState<T> = T extends Aggregate<infer S, Event, AggregateId> ? S : never;
export type InferAggregateEvent<T> = T extends Aggregate<unknown, infer E extends Event, AggregateId> ? E : never;
export type InferAggregateId<T> = T extends Aggregate<unknown, Event, infer I extends AggregateId> ? I : never;

// Factory for creating typed aggregates
export class AggregateFactory<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId = AggregateId,
  TAggregate extends Aggregate<TState, TEvent, TAggregateId> = Aggregate<TState, TEvent, TAggregateId>
> implements IAggregateFactory<TAggregate, TAggregateId> {
  constructor(
    private readonly AggregateClass: IAggregateConstructor<TState, TEvent, TAggregateId, TAggregate>,
    private readonly eventStore: Pick<IEventStore<TEvent>, 'getEvents'>
  ) {}

  async load(id: TAggregateId): Promise<TAggregate> {
    const events = await this.eventStore.getEvents(id);
    return this.AggregateClass.fromEvents(id, events);
  }

  create(id: TAggregateId): TAggregate {
    return new this.AggregateClass(id);
  }
}

// Repository pattern for aggregates with generics
export abstract class AggregateRepository<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId,
  TAggregate extends Aggregate<TState, TEvent, TAggregateId>
> implements IAggregateRepository<TAggregate, TAggregateId> {
  constructor(
    protected readonly eventStore: Pick<IEventStore<TEvent>, 'append' | 'appendBatch' | 'getEvents'>
  ) {}

  abstract createAggregate(id: TAggregateId): TAggregate;

  async get(id: TAggregateId): Promise<TAggregate | null> {
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      return null;
    }

    const aggregate = this.createAggregate(id);
    // Apply events through the public interface
    for (const event of events) {
      (aggregate as IAggregateInternal<TState, TEvent>).applyEvent(event, false);
    }
    return aggregate;
  }

  async save(aggregate: TAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventStore.appendBatch(events as TEvent[]);
      aggregate.markEventsAsCommitted();
    }
  }

  async exists(id: TAggregateId): Promise<boolean> {
    const events = await this.eventStore.getEvents(id);
    return events.length > 0;
  }
}

// Aggregate root marker class
export abstract class AggregateRoot<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId = AggregateId
> extends Aggregate<TState, TEvent, TAggregateId> {
  // Additional methods specific to aggregate roots can be added here
}

// Command handler base class
export abstract class CommandHandler<TCommand extends Command, TEvent extends Event> {
  abstract handle(command: TCommand): Promise<CommandResult<TEvent>>;
  
  protected success(events: TEvent[], metadata?: Record<string, unknown>): CommandResult<TEvent> {
    return {
      success: true,
      events,
      metadata: metadata || {},
    };
  }

  protected failure(error: Error, metadata?: Record<string, unknown>): CommandResult<TEvent> {
    return {
      success: false,
      error,
      metadata: metadata || {},
    };
  }
}