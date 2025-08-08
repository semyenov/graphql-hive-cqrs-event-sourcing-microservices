/**
 * Core domain types - fundamental building blocks with no dependencies
 */

import type { AggregateId, EventVersion, Timestamp, CorrelationId, CausationId, UserId } from './branded';

// ============================================================================
// Core Event System
// ============================================================================

/**
 * Base event interface - the fundamental unit of state change
 */
export interface IEvent<
  TType extends string = string,
  TData = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  aggregateId: TAggregateId;
  type: TType;
  version: EventVersion;
  timestamp: Timestamp;
  data: TData;
}

/**
 * Event metadata for tracing and correlation
 */
export interface IEventMetadata<
  TCorrelationId extends CorrelationId = CorrelationId,
  TCausationId extends CausationId = CausationId,
  TUserId extends UserId = UserId
> {
  correlationId?: TCorrelationId;
  causationId?: TCausationId;
  userId?: TUserId;
  timestamp: Timestamp;
  schemaVersion?: number;
  source?: string;
  traceId?: string;
}

/**
 * Enhanced event with metadata
 */
export interface IEnhancedEvent<
  TEvent extends IEvent = IEvent,
  TMetadata extends IEventMetadata = IEventMetadata
> {
  event: TEvent;
  metadata: TMetadata;
}

// ============================================================================
// Core Command System
// ============================================================================

/**
 * Command interface - represents an intent to change state
 */
export interface ICommand<
  TType extends string = string,
  TPayload = unknown,
  TResult = unknown
> {
  type: TType;
  aggregateId: AggregateId;
  payload: TPayload;
  metadata?: IEventMetadata;
}

/**
 * Command result with success/failure indication
 */
export interface ICommandResult<TData = unknown, TError = Error> {
  success: boolean;
  data?: TData;
  error?: TError;
  metadata?: {
    executionTime: number;
    retryCount?: number;
  };
}

// ============================================================================
// Core Aggregate System
// ============================================================================

/**
 * Aggregate root interface - the consistency boundary
 */
export interface IAggregate<
  TState,
  TEvent extends IEvent = IEvent,
  TAggregateId extends AggregateId = AggregateId
> {
  id: TAggregateId;
  version: number;
  state: TState | null;
  uncommittedEvents: readonly TEvent[];
}

/**
 * Snapshot for performance optimization
 */
export interface ISnapshot<
  TState = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  aggregateId: TAggregateId;
  version: EventVersion;
  state: TState;
  timestamp: Timestamp;
  checksum?: string;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Core Type Helpers
// ============================================================================

/**
 * Event reducer for building state from events
 */
export type EventReducer<TEvent extends IEvent, TState> = (
  state: TState | undefined,
  event: TEvent
) => TState;

/**
 * Event handler type
 */
export type EventHandler<
  TEvent extends IEvent,
  TState = unknown,
  TResult = void
> = (event: TEvent, currentState: TState) => TResult | Promise<TResult>;

/**
 * Pattern matching for events
 */
export type EventPattern<TEvent extends IEvent, TResult> = {
  [K in TEvent['type']]: (event: Extract<TEvent, { type: K }>) => TResult;
};

/**
 * Partial pattern matching with default
 */
export type PartialEventPattern<TEvent extends IEvent, TResult> = Partial<
  EventPattern<TEvent, TResult>
> & {
  _default?: (event: TEvent) => TResult;
};

// ============================================================================
// Core Projection System
// ============================================================================

/**
 * Projection interface for read models
 */
export interface IProjection<TEvent extends IEvent, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: EventReducer<TEvent, TReadModel>;
  getCurrentState(): TReadModel;
  reset(): void;
  getLastProcessedVersion(): EventVersion;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract event data type
 */
export type ExtractEventData<TEvent extends IEvent> = TEvent['data'];

/**
 * Extract aggregate ID type
 */
export type ExtractAggregateId<TEvent extends IEvent> = TEvent['aggregateId'];

/**
 * Extract event type
 */
export type ExtractEventType<TEvent extends IEvent> = TEvent['type'];

/**
 * Make properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Non-nullable fields
 */
export type NonNullableFields<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};