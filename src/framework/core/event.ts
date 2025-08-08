/**
 * Framework Core: Event Types and Interfaces
 * 
 * This module defines the core event sourcing abstractions that are
 * domain-agnostic and can be used by any domain module.
 */

import type { AggregateId, EventVersion, Timestamp, CorrelationId, CausationId, UserId } from './branded/types';

/**
 * Base event interface - the fundamental unit of state change
 * @template TType - Event type discriminator
 * @template TData - Event payload type
 * @template TAggregateId - Aggregate ID type (branded)
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
 */
export interface IEventMetadata<
  TCorrelationId extends CorrelationId = CorrelationId,
  TCausationId extends CausationId = CausationId,
  TUserId extends UserId = UserId
> {
  readonly correlationId?: TCorrelationId;
  readonly causationId?: TCausationId;
  readonly userId?: TUserId;
  readonly timestamp: Timestamp;
  readonly schemaVersion?: number;
  readonly source?: string;
  readonly traceId?: string;
}

/**
 * Enhanced event with metadata for cross-service communication
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
 */
export type EventReducer<TEvent extends IEvent, TState> = (
  state: TState | undefined,
  event: TEvent
) => TState;

/**
 * Event handler for side effects and projections
 */
export type EventHandler<TEvent extends IEvent> = (
  event: TEvent
) => void | Promise<void>;

/**
 * Event pattern matching for type-safe event handling
 */
export type EventPattern<TEvent extends IEvent, TResult> = {
  readonly [K in TEvent['type']]: (event: Extract<TEvent, { type: K }>) => TResult;
};

/**
 * Partial pattern matching with optional default handler
 */
export type PartialEventPattern<TEvent extends IEvent, TResult> = Partial<
  EventPattern<TEvent, TResult>
> & {
  readonly _default?: (event: TEvent) => TResult;
};

/**
 * Event store interface for persistence
 */
export interface IEventStore<TEvent extends IEvent = IEvent> {
  append(event: TEvent): Promise<void>;
  appendBatch(events: readonly TEvent[]): Promise<void>;
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
 * Event bus for publishing and subscribing to domain events
 */
export interface IEventBus<TEvent extends IEvent = IEvent> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: readonly TEvent[]): Promise<void>;
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: EventHandler<TSpecificEvent>
  ): () => void;
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