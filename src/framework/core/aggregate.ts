/**
 * Framework Core: Aggregate Root
 * 
 * The aggregate is the consistency boundary in Domain-Driven Design.
 * It ensures business invariants and generates events from commands.
 */

import type { AggregateId, EventVersion, Timestamp } from './branded/types';
import type { IEvent, EventReducer, EventPattern } from './event';
import type { ICommand } from './command';
import { BrandedTypes } from './branded/factories';
import { matchEvent } from './event-utils';

/**
 * Snapshot for performance optimization
 */
export interface ISnapshot<
  TState = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  readonly aggregateId: TAggregateId;
  readonly version: EventVersion;
  readonly state: TState;
  readonly timestamp: Timestamp;
  readonly checksum?: string;
}

/**
 * Aggregate root interface - the consistency boundary
 */
export interface IAggregate<
  TState,
  TEvent extends IEvent = IEvent,
  TAggregateId extends AggregateId = AggregateId
> {
  readonly id: TAggregateId;
  readonly version: number;
  readonly state: TState | null;
  readonly uncommittedEvents: ReadonlyArray<TEvent>;
}

/**
 * Aggregate behavior interface with mutation methods
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
 * Generic aggregate base class with full type inference
 */
export abstract class Aggregate<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId = AggregateId
> implements IAggregateBehavior<TState, TEvent, TAggregateId> {
  
  protected _state: TState | null = null;
  protected _version = 0;
  protected _uncommittedEvents: TEvent[] = [];

  constructor(
    public readonly id: TAggregateId,
    protected readonly reducer: EventReducer<TEvent, TState>,
    protected readonly initialState: TState
  ) {}

  get state(): TState | null {
    return this._state;
  }

  get version(): number {
    return this._version;
  }

  get uncommittedEvents(): ReadonlyArray<TEvent> {
    return [...this._uncommittedEvents];
  }

  /**
   * Apply an event to update aggregate state
   */
  applyEvent(event: TEvent, isNew = false): void {
    if (event.aggregateId !== this.id) {
      throw new Error(`Event aggregate ID mismatch: ${event.aggregateId} !== ${this.id}`);
    }

    this._state = this.reducer(this._state ?? this.initialState, event);
    this._version = event.version;

    if (isNew) {
      this._uncommittedEvents.push(event);
    }
  }

  /**
   * Mark all uncommitted events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Load aggregate from event history
   */
  loadFromHistory(events: TEvent[]): void {
    events.forEach(event => this.applyEvent(event, false));
  }

  /**
   * Load aggregate from snapshot
   */
  loadFromSnapshot(snapshot: ISnapshot<TState, TAggregateId>): void {
    if (snapshot.aggregateId !== this.id) {
      throw new Error(`Snapshot aggregate ID mismatch`);
    }
    this._state = snapshot.state;
    this._version = snapshot.version;
  }

  /**
   * Create snapshot of current state
   */
  createSnapshot(): ISnapshot<TState, TAggregateId> {
    if (!this._state) {
      throw new Error('Cannot create snapshot without state');
    }

    return {
      aggregateId: this.id,
      version: BrandedTypes.eventVersion(this._version),
      state: this._state,
      timestamp: BrandedTypes.timestamp(),
    };
  }

  /**
   * Static factory to create aggregate from events
   */
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

  /**
   * Static factory to create aggregate from snapshot
   */
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
    aggregate.loadFromSnapshot(snapshot);
    
    // Apply events after snapshot
    events
      .filter(e => e.version > snapshot.version)
      .forEach(event => aggregate.applyEvent(event, false));
    
    return aggregate;
  }

  /**
   * Execute command and generate events
   */
  protected execute<TCommand extends ICommand>(
    command: TCommand,
    handler: (payload: TCommand['payload']) => TEvent | TEvent[]
  ): void {
    const events = handler(command.payload);
    const eventArray = Array.isArray(events) ? events : [events];
    eventArray.forEach(event => this.applyEvent(event, true));
  }

  /**
   * Pattern matching for events
   */
  protected matchEvent<TResult>(
    event: TEvent,
    patterns: EventPattern<TEvent, TResult>
  ): TResult {
    return matchEvent(event, patterns);
  }
}

/**
 * Type helpers for aggregate inference
 */
export type InferAggregateState<T> = 
  T extends Aggregate<infer S, IEvent, AggregateId> ? S : never;

export type InferAggregateEvent<T> = 
  T extends Aggregate<unknown, infer E extends IEvent, AggregateId> ? E : never;

export type InferAggregateId<T> = 
  T extends Aggregate<unknown, IEvent, infer I extends AggregateId> ? I : never;