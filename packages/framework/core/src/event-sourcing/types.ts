// Universal event sourcing types for CQRS framework
import type { AggregateId, EventId, EventVersion, CorrelationId, CausationId, Timestamp } from '../types/branded';
import type { Event, Command, Snapshot } from './interfaces';
import { ErrorCodes, type Result } from '../types/errors';

// Base event implementation
export interface BaseEvent extends Event {
  readonly id: EventId;
  readonly aggregateId: AggregateId;
  readonly version: EventVersion;
  readonly timestamp: Timestamp;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
}

// Base command implementation
export interface BaseCommand extends Command {
  readonly aggregateId: AggregateId;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
}

// Event reducer function type
export type EventReducer<TState, TEvent extends Event> = (
  state: TState | null,
  event: TEvent
) => TState;

// Command result for tracking command execution
export interface CommandResult<TEvent extends Event> {
  success: boolean;
  events?: TEvent[];
  error?: Error;
  metadata?: Record<string, unknown>;
}

// Event pattern matching utility types
export type EventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (event: Extract<TEvent, { type: K }>) => TResult;
};

// Pattern matching function for events
export const matchEvent = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult => {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
};

// Event folding for state reconstruction
export const foldEvents = <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: (state: TState | null, event: TEvent) => TState | null,
  initialState: TState | null = null
): TState | null => {
  return events.reduce(reducer, initialState);
};

// Event categorization
export type EventCategory = 
  | 'DOMAIN'        // Business domain events
  | 'SYSTEM'        // System/infrastructure events
  | 'INTEGRATION'   // External system integration events
  | 'AUDIT';        // Audit/logging events

// Event metadata with categorization
export interface CategorizedEvent extends BaseEvent {
  readonly category: EventCategory;
  readonly source?: string;
  readonly tags?: readonly string[];
}

// Command execution context
export interface CommandContext {
  readonly userId?: string;
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly timestamp: Timestamp;
  readonly metadata?: Record<string, unknown>;
}

// Enhanced command with context
export interface ContextualCommand extends BaseCommand {
  readonly context: CommandContext;
}

// Event handler registration
export type EventHandlers<TEvent extends Event = Event> = {
  [K in TEvent['type']]?: Array<(event: Extract<TEvent, { type: K }>) => Promise<void> | void>;
};

// Aggregate factory function type
export type AggregateFactory<
  TAggregate,
  TAggregateId extends AggregateId = AggregateId
> = (id: TAggregateId) => TAggregate;

// Event store configuration
export interface EventStoreConfig {
  readonly batchSize?: number;
  readonly maxConcurrency?: number;
  readonly retryAttempts?: number;
  readonly enableOptimisticConcurrency?: boolean;
}

// Event versioning utilities
export const versionEvent = (version: number): EventVersion => {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Event version must be a positive integer');
  }
  return version as EventVersion;
};

export const nextVersion = (currentVersion: EventVersion): EventVersion => {
  return versionEvent(currentVersion + 1);
};

// Event ID generation utilities
export const generateEventId = (): EventId => {
  return crypto.randomUUID() as EventId;
};

// Event timestamp utilities
export const eventTimestamp = (date: Date = new Date()): Timestamp => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid event timestamp');
  }
  return date as Timestamp;
};

// Command result builders
export const commandSuccess = <TEvent extends Event>(
  events: TEvent[],
  metadata?: Record<string, unknown>
): CommandResult<TEvent> => ({
  success: true,
  events,
  metadata: metadata || {},
});

export const commandFailure = <TEvent extends Event>(
  error: Error,
  metadata?: Record<string, unknown>
): CommandResult<TEvent> => ({
  success: false,
  error,
  metadata: metadata || {},
});

// Event stream utilities
export type EventStream<TEvent extends Event = Event> = readonly TEvent[];

export const filterEventsByType = <TEvent extends Event, TType extends TEvent['type']>(
  events: EventStream<TEvent>,
  type: TType
): Array<Extract<TEvent, { type: TType }>> => {
  return events.filter((event): event is Extract<TEvent, { type: TType }> => 
    event.type === type
  );
};

export const filterEventsByAggregateId = <TEvent extends Event>(
  events: EventStream<TEvent>,
  aggregateId: AggregateId
): EventStream<TEvent> => {
  return events.filter(event => event.aggregateId === aggregateId);
};

export const sortEventsByTimestamp = <TEvent extends Event>(
  events: EventStream<TEvent>
): EventStream<TEvent> => {
  return [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export const sortEventsByVersion = <TEvent extends Event>(
  events: EventStream<TEvent>
): EventStream<TEvent> => {
  return [...events].sort((a, b) => a.version - b.version);
};

// Event store position tracking
export type EventPosition = number;

export const nextPosition = (currentPosition: EventPosition): EventPosition => {
  return currentPosition + 1;
};

// Snapshot utilities
export const createSnapshot = <TState, TAggregateId extends AggregateId>(
  aggregateId: TAggregateId,
  version: EventVersion,
  state: TState
): Snapshot<TState, TAggregateId> => ({
  aggregateId,
  version,
  state,
  timestamp: eventTimestamp(),
});

// Optimistic concurrency control
export class OptimisticConcurrencyError extends Error {
  constructor(
    public readonly aggregateId: AggregateId,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(`Optimistic concurrency conflict for aggregate ${aggregateId}. Expected version ${expectedVersion}, but actual version is ${actualVersion}.`);
    this.name = 'OptimisticConcurrencyError';
  }
}

// Event validation utilities
export const validateEvent = <TEvent extends Event>(event: TEvent): Result<TEvent> => {
  const errors: string[] = [];

  if (!event.id) errors.push('Event ID is required');
  if (!event.type) errors.push('Event type is required');
  if (!event.aggregateId) errors.push('Aggregate ID is required');
  if (!Number.isInteger(event.version) || event.version < 1) {
    errors.push('Event version must be a positive integer');
  }
  if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    errors.push('Event timestamp must be a valid Date');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        type: 'DOMAIN',
        category: 'VALIDATION',
        code: ErrorCodes.INVALID_FORMAT,
        message: `Event validation failed: ${errors.join(', ')}`,
        field: 'event',
        timestamp: new Date(),
      }
    };
  }

  return {
    success: true,
    value: event
  };
};

// Type utilities for framework extension
export type ExtractEventType<TEvent extends Event> = TEvent['type'];
export type ExtractEventData<TEvent extends Event> = TEvent['data'];
export type ExtractAggregateId<TEvent extends Event> = TEvent['aggregateId'];

// Event sourcing decorators and metadata
export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');
export const COMMAND_HANDLER_METADATA = Symbol('COMMAND_HANDLER_METADATA');
export const AGGREGATE_METADATA = Symbol('AGGREGATE_METADATA');

// Framework constants
export const DEFAULT_SNAPSHOT_FREQUENCY = 100;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_CONCURRENCY = 10;
export const DEFAULT_RETRY_ATTEMPTS = 3;