/**
 * Framework Core: Event Types and Interfaces
 * 
 * This module defines the core event sourcing abstractions that are
 * domain-agnostic and can be used by any domain module.
 */

import type { AggregateId, EventVersion, Timestamp, CorrelationId, CausationId } from './branded/types';
import { BrandedTypes } from './branded/factories';

/**
 * Base event interface - the fundamental unit of state change
 * @template TType - Event type discriminator (e.g., 'UserCreated', 'OrderPlaced')
 * @template TData - Event payload type containing the actual event data
 * @template TAggregateId - Aggregate ID type (branded) to ensure type safety
 * 
 * @example
 * ```typescript
 * interface UserCreatedEvent extends IEvent<'UserCreated', { name: string, email: string }> {
 *   // Additional user-specific event properties
 * }
 * ```
 */
export interface IEvent<
  TType extends string = string,
  TData = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  readonly aggregateId: TAggregateId;
  readonly type: TType;
  readonly version: EventVersion;
  readonly timestamp: Timestamp;
  readonly data: TData;
}

/**
 * Event metadata for distributed tracing and audit
 * Provides context for event processing across microservices
 */
export interface IEventMetadata<
  TCorrelationId extends CorrelationId = CorrelationId,
  TCausationId extends CausationId = CausationId
> {
  readonly correlationId?: TCorrelationId;
  readonly causationId?: TCausationId;
  readonly timestamp: Timestamp;
  readonly schemaVersion?: number;
  readonly source?: string;
  readonly traceId?: string;
  readonly environment?: string; // Added to track environment context
  readonly tags?: string[]; // Added for flexible categorization
}

/**
 * Enhanced event with metadata for cross-service communication
 * Combines domain event with its operational context
 */
export interface IEnhancedEvent<
  TEvent extends IEvent = IEvent,
  TMetadata extends IEventMetadata = IEventMetadata
> {
  readonly event: TEvent;
  readonly metadata: TMetadata;
}

/**
 * Event reducer for building state from events
 * @template TEvent - The event type being processed
 * @template TState - The state type being built
 */
export type EventReducer<TEvent extends IEvent, TState> = (
  state: TState | undefined,
  event: TEvent
) => TState;

/**
 * Event handler for side effects and projections
 * @template TEvent - The event type being handled
 */
export type EventHandler<TEvent extends IEvent> = (
  event: TEvent
) => void | Promise<void>;

/**
 * Event pattern matching for type-safe event handling
 * Ensures exhaustive matching of event types at compile time
 */
export type EventPattern<TEvent extends IEvent, TResult> = {
  readonly [K in TEvent['type']]: (event: Extract<TEvent, { type: K }>) => TResult;
};

/**
 * Partial pattern matching with optional default handler
 * Allows handling specific event types while providing a fallback
 */
export type PartialEventPattern<TEvent extends IEvent, TResult> = Partial<
  EventPattern<TEvent, TResult>
> & {
  readonly _default?: (event: TEvent) => TResult;
};

/**
 * Event store interface for persistence
 * Provides methods for storing and retrieving events
 * @template TEvent - The event type being stored
 */
export interface IEventStore<TEvent extends IEvent = IEvent> {
  /**
   * Append a single event to the store
   * @throws {EventValidationError} If event validation fails
   * @throws {EventStorageError} If storage operation fails
   */
  append(event: TEvent): Promise<void>;
  
  /**
   * Append multiple events atomically
   * @throws {EventValidationError} If any event validation fails
   * @throws {EventStorageError} If batch storage operation fails
   */
  appendBatch(events: readonly TEvent[]): Promise<void>;
  
  /**
   * Retrieve events for a specific aggregate
   * @param fromVersion - Optional version to start from
   * @throws {EventRetrievalError} If retrieval operation fails
   */
  getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<TEvent, { aggregateId: TAggregateId }>>>;

  /**
   * Retrieve all events from the store
   * @param fromPosition - Optional position to start from
   * @throws {EventRetrievalError} If retrieval operation fails
   */
  getAllEvents(fromPosition?: number): Promise<TEvent[]>;

  /**
   * Retrieve events of a specific type
   * @throws {EventRetrievalError} If retrieval operation fails
   */
  getEventsByType<TType extends TEvent['type']>(
    type: TType
  ): Promise<Array<Extract<TEvent, { type: TType }>>>;

  /**
   * Subscribe to new events
   * @returns Unsubscribe function
   */
  subscribe(callback: EventHandler<TEvent>): () => void;

  /**
   * Validate event before storage
   * @throws {EventValidationError} If validation fails
   */
  validate?(event: TEvent): Promise<void>;

  /**
   * Get the last event version for an aggregate
   */
  getLastVersion?<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId
  ): Promise<number>;
}

/**
 * Event bus for publishing and subscribing to domain events
 * Implements the publish-subscribe pattern for event distribution
 */
export interface IEventBus<TEvent extends IEvent = IEvent> {
  /**
   * Publish a single event
   * @throws {EventPublishError} If publishing fails
   */
  publish(event: TEvent, options?: { retryAttempts?: number }): Promise<void>;

  /**
   * Publish multiple events
   * @throws {EventPublishError} If batch publishing fails
   */
  publishBatch(events: readonly TEvent[], options?: { retryAttempts?: number }): Promise<void>;

  /**
   * Subscribe to specific event type
   * @returns Unsubscribe function
   */
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: EventHandler<TSpecificEvent>
  ): () => void;

  /**
   * Subscribe to all events
   * @returns Unsubscribe function
   */
  subscribeAll(handler: EventHandler<TEvent>): () => void;
}

/**
 * Event versioning for schema evolution
 */
export interface IVersionedEvent<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly schemaVersion: number;
}

/**
 * Event migration for handling schema changes
 */
export interface IEventMigration<
  TFromEvent extends IEvent,
  TToEvent extends IEvent
> {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(event: TFromEvent): TToEvent;
}

/**
 * Error types for event sourcing operations
 */
export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

export class EventStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventStorageError';
  }
}

export class EventPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventPublishError';
  }
}

export class EventRetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventRetrievalError';
  }
}

/**
 * Type helpers for event manipulation
 */
export type ExtractEventData<TEvent extends IEvent> = TEvent['data'];
export type ExtractEventType<TEvent extends IEvent> = TEvent['type'];
export type ExtractAggregateId<TEvent extends IEvent> = TEvent['aggregateId'];

/**
 * Utility to create type-safe event factories
 */
export type EventFactory<TEvent extends IEvent> = (
  aggregateId: TEvent['aggregateId'],
  version: EventVersion,
  data: TEvent['data']
) => TEvent;

/**
 * Define an event factory for a fixed type that auto-fills timestamp
 * 
 * @example
 * const userCreated = defineEventFactory<UserCreatedEvent>('UserCreated');
 * const event = userCreated(aggregateId, 1, { name: 'John Doe' });
 */
export function defineEventFactory<TEvent extends IEvent, TType extends TEvent['type']>(
  type: TType
): EventFactory<TEvent> {
  return (aggregateId, version, data) => ({
    type,
    aggregateId,
    version,
    timestamp: BrandedTypes.timestamp(),
    data,
  } as unknown as TEvent);
}

/**
 * Timestamp generator strategy
 */
export interface ITimestampStrategy {
  generateTimestamp(): Timestamp;
}

export function matchEvent<TEvent extends IEvent, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult {
  const handler = (patterns as any)[event.type];
  if (!handler) {
    throw new Error(`No handler for event type: ${String(event.type)}`);
  }
  return handler(event);
}

export function matchEventPartial<TEvent extends IEvent, TResult>(
  event: TEvent,
  patterns: PartialEventPattern<TEvent, TResult>
): TResult {
  const handler = (patterns as any)[event.type] as ((e: TEvent) => TResult) | undefined;
  if (handler) {
    return handler(event);
  }
  if (patterns._default) {
    return patterns._default(event);
  }
  throw new Error(`No handler for event type: ${String(event.type)} and no _default provided`);
}

export function defineEventPattern<TEvent extends IEvent, TResult>(
  pattern: EventPattern<TEvent, TResult>
): EventPattern<TEvent, TResult> {
  return pattern;
}

export function definePartialEventPattern<TEvent extends IEvent, TResult>(
  pattern: PartialEventPattern<TEvent, TResult>
): PartialEventPattern<TEvent, TResult> {
  return pattern;
}

export function createReducerFromEventPattern<
  TEvent extends IEvent,
  TState
>(pattern: {
  readonly [K in TEvent['type']]: (
    state: TState | undefined,
    event: Extract<TEvent, { type: K }>
  ) => TState;
}): EventReducer<TEvent, TState> {
  return (state, event) => {
    const handler = (pattern as any)[event.type] as (s: TState | undefined, e: TEvent) => TState;
    if (!handler) {
      throw new Error(`No reducer for event type: ${String(event.type)}`);
    }
    return handler(state, event);
  };
}

/**
 * Subscribe an event store to a pattern of handlers.
 * Returns an array with a single unsubscribe function.
 */
export function subscribeEventStorePattern<TEvent extends IEvent>(
  store: IEventStore<TEvent>,
  pattern: EventPattern<TEvent, void | Promise<void>>
): Array<() => void> {
  const unsubscribe = store.subscribe(async (event) => {
    const handler = (pattern as any)[event.type] as ((e: TEvent) => void | Promise<void>) | undefined;
    if (handler) {
      await handler(event);
    }
  });
  return [unsubscribe];
}