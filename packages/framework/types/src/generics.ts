// Universal generic types for CQRS/Event Sourcing framework
// Extracted from domain-specific implementations to be reusable across any domain

import type {
  AggregateId,
  EventVersion,
  Timestamp,
  CorrelationId,
  CausationId,
} from './branded';
import type { Result, BaseError } from './errors';

// ============================================================================
// Core Generic Event Interface
// ============================================================================

// Generic event interface with strong typing
export interface Event<
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

// Enhanced event with metadata
export interface EnhancedEvent<
  TEvent extends Event = Event,
  TMetadata extends EventMetadata = EventMetadata
> {
  event: TEvent;
  metadata: TMetadata;
}

// Event metadata with generics
export interface EventMetadata<
  TCorrelationId extends CorrelationId = CorrelationId,
  TCausationId extends CausationId = CausationId
> {
  correlationId?: TCorrelationId;
  causationId?: TCausationId;
  timestamp: Timestamp;
  schemaVersion?: number;
  source?: string;
  traceId?: string;
}

// ============================================================================
// Template Literal Types for Event Naming
// ============================================================================

// Convert string to PascalCase
type PascalCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

// Convert string to camelCase
type CamelCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S;

// Event name builder using template literals
export type EventName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAggregateType>}${PascalCase<TAction>}`;

// Command name builder
export type CommandName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAction>}${PascalCase<TAggregateType>}`;

// ============================================================================
// Event Categorization System
// ============================================================================

// Event categories for better organization
export type EventCategory = 'domain' | 'system' | 'integration' | 'audit';

// Categorized event interface
export interface CategorizedEvent<
  TType extends string = string,
  TData = unknown,
  TCategory extends EventCategory = EventCategory,
  TAggregateId extends AggregateId = AggregateId
> extends Event<TType, TData, TAggregateId> {
  readonly category: TCategory;
  readonly source?: string;
  readonly tags?: readonly string[];
}

// ============================================================================
// Advanced Type Guards with Generics
// ============================================================================

// Type guard generators using generics
export const createTypeGuard = <TType extends string>(eventType: TType) => {
  return <TEvent extends Event>(
    event: TEvent
  ): event is Extract<TEvent, { type: TType }> => {
    return event.type === eventType;
  };
};

// Generic category-based type guard
export const createCategoryGuard = <TCategory extends EventCategory>(category: TCategory) => {
  return <TEvent extends CategorizedEvent>(
    event: TEvent
  ): event is Extract<TEvent, { category: TCategory }> => {
    return 'category' in event && event.category === category;
  };
};

// ============================================================================
// Generic Event Factories with Type Inference
// ============================================================================

// Generic event factory
export const createEvent = <
  TType extends string,
  TData,
  TAggregateId extends AggregateId = AggregateId
>(
  type: TType,
  aggregateId: TAggregateId,
  version: EventVersion,
  data: TData,
  timestamp?: Timestamp
): Event<TType, TData, TAggregateId> => {
  return {
    aggregateId,
    type,
    version,
    timestamp: timestamp ?? new Date() as Timestamp,
    data,
  };
};

// Generic categorized event factory
export const createCategorizedEvent = <
  TType extends string,
  TData,
  TCategory extends EventCategory,
  TAggregateId extends AggregateId = AggregateId
>(
  type: TType,
  category: TCategory,
  aggregateId: TAggregateId,
  version: EventVersion,
  data: TData,
  options?: {
    timestamp?: Timestamp;
    source?: string;
    tags?: readonly string[];
  }
): CategorizedEvent<TType, TData, TCategory, TAggregateId> => {
  const base: CategorizedEvent<TType, TData, TCategory, TAggregateId> = {
    aggregateId,
    type,
    category,
    version,
    timestamp: options?.timestamp ?? new Date() as Timestamp,
    data,
  };
  
  if (options?.source !== undefined) {
    (base as any).source = options.source;
  }
  if (options?.tags !== undefined) {
    (base as any).tags = options.tags;
  }
  
  return base;
};

// ============================================================================
// Event Versioning and Migration
// ============================================================================

// Event schema version
export type EventSchemaVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Versioned event type
export interface VersionedEvent<
  TEvent extends Event = Event,
  TVersion extends EventSchemaVersion = 1
> extends Event<
  TEvent['type'], 
  TEvent['data'] & { schemaVersion: TVersion }, 
  TEvent['aggregateId']
> {
  readonly schemaVersion: TVersion;
}

// Event migration interface
export interface EventMigration<
  TFromVersion extends EventSchemaVersion,
  TToVersion extends EventSchemaVersion
> {
  fromVersion: TFromVersion;
  toVersion: TToVersion;
  migrate<TEvent extends VersionedEvent>(event: TEvent): VersionedEvent<TEvent, TToVersion>;
}

// Migration registry
export interface EventMigrationRegistry {
  register<TFromVersion extends EventSchemaVersion, TToVersion extends EventSchemaVersion>(
    migration: EventMigration<TFromVersion, TToVersion>
  ): void;
  
  migrate<TEvent extends VersionedEvent>(
    event: TEvent,
    targetVersion: EventSchemaVersion
  ): VersionedEvent<TEvent, EventSchemaVersion>;
}

// ============================================================================
// Advanced Type Helpers
// ============================================================================

// Event handler type with generics
export type EventHandler<
  TEvent extends Event,
  TState = unknown,
  TResult = void
> = (event: TEvent, currentState: TState) => TResult | Promise<TResult>;

// Event reducer for building state from events
export type EventReducer<
  TEvent extends Event,
  TState
> = (state: TState | undefined, event: TEvent) => TState;

// Async event reducer for IO-bound operations
export type AsyncEventReducer<
  TEvent extends Event,
  TState
> = (state: TState | undefined, event: TEvent) => Promise<TState>;

// ============================================================================
// Command System with Enhanced Types
// ============================================================================

// Generic command interface
export interface Command<
  TType extends string = string,
  TPayload = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  readonly type: TType;
  readonly aggregateId: TAggregateId;
  readonly payload: TPayload;
  readonly metadata?: {
    correlationId?: CorrelationId;
    causationId?: CausationId;
    userId?: string;
    timestamp?: Timestamp;
  };
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
export interface ContextualCommand<
  TType extends string = string,
  TPayload = unknown,
  TAggregateId extends AggregateId = AggregateId
> extends Command<TType, TPayload, TAggregateId> {
  readonly context: CommandContext;
}

// Command result with metadata  
export interface CommandResult<TEvent extends Event = Event> {
  success: boolean;
  events?: TEvent[];
  error?: Error;
  metadata?: Record<string, unknown>;
}

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

// ============================================================================
// Pattern Matching System
// ============================================================================

// Type helper for event pattern matching
export type EventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
};

// Partial pattern matching with default
export type PartialEventPattern<TEvent extends Event, TResult> = Partial<EventPattern<TEvent, TResult>> & {
  _default?: (event: TEvent) => TResult;
};

// Async pattern matching
export type AsyncEventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => Promise<TResult>;
};

// Conditional pattern matching
export type ConditionalPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]?: {
    condition: (event: Extract<TEvent, { type: K }>) => boolean;
    handler: (event: Extract<TEvent, { type: K }>) => TResult;
  };
};

// Pattern matching helper
export const matchEvent = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult => {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
};

// Partial pattern matching with default
export const matchEventPartial = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PartialEventPattern<TEvent, TResult>,
  defaultResult?: TResult
): TResult => {
  const handler = patterns[event.type as TEvent['type']] || patterns._default;
  if (handler) {
    return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
  }
  if (defaultResult !== undefined) {
    return defaultResult;
  }
  throw new Error(`No handler found for event type: ${event.type}`);
};

// Async pattern matching
export const matchEventAsync = async <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: AsyncEventPattern<TEvent, TResult>
): Promise<TResult> => {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
};

// ============================================================================
// Projection System with Type Safety
// ============================================================================

// Projection interface for read models
export interface Projection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: EventReducer<TEvent, TReadModel>;
  getCurrentState(): TReadModel;
  reset(): void;
  getLastProcessedVersion(): EventVersion;
  subscribe(handler: (state: TReadModel) => void): () => void;
}

// Materialized view projection
export interface MaterializedView<TEvent extends Event, TViewModel> extends Projection<TEvent, TViewModel> {
  query<TQuery extends Record<string, unknown>>(params: TQuery): TViewModel | TViewModel[];
  index: string[];
}

// Async projection for IO-bound operations
export interface AsyncProjection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: AsyncEventReducer<TEvent, TReadModel>;
  getCurrentState(): Promise<TReadModel>;
  reset(): Promise<void>;
  getLastProcessedVersion(): Promise<EventVersion>;
  subscribe(handler: (state: TReadModel) => Promise<void>): () => void;
}

// ============================================================================
// Snapshot System for Performance
// ============================================================================

// Generic snapshot interface
export interface Snapshot<TState = unknown, TAggregateId extends AggregateId = AggregateId> {
  aggregateId: TAggregateId;
  version: EventVersion;
  state: TState;
  timestamp: Timestamp;
  checksum?: string;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

// Snapshot strategy configuration
export type SnapshotStrategy = 
  | { type: 'frequency'; interval: number }
  | { type: 'count'; threshold: number }
  | { type: 'size'; maxBytes: number }
  | { type: 'time'; intervalMs: number }
  | { type: 'custom'; predicate: (eventCount: number, timeSinceLastSnapshot: number) => boolean };

// Snapshot utilities
export const createSnapshot = <TState, TAggregateId extends AggregateId>(
  aggregateId: TAggregateId,
  version: EventVersion,
  state: TState,
  metadata?: Record<string, unknown>
): Snapshot<TState, TAggregateId> => {
  const base: Snapshot<TState, TAggregateId> = {
    aggregateId,
    version,
    state,
    timestamp: new Date() as Timestamp,
  };
  
  if (metadata !== undefined) {
    (base as any).metadata = metadata;
  }
  
  return base;
};

// ============================================================================
// Event Stream Processing
// ============================================================================

// Event stream for reactive processing
export interface EventStream<TEvent extends Event> {
  subscribe(handler: EventHandler<TEvent>): () => void;
  pipe<TResult>(transform: (event: TEvent) => TResult): EventStream<Event<string, TResult>>;
  filter(predicate: (event: TEvent) => boolean): EventStream<TEvent>;
  take(count: number): EventStream<TEvent>;
  skip(count: number): EventStream<TEvent>;
  batch(size: number): EventStream<Event<string, TEvent[]>>;
  debounce(ms: number): EventStream<TEvent>;
  throttle(ms: number): EventStream<TEvent>;
}

// Event processor with backpressure
export interface EventProcessor<TEvent extends Event> {
  process(event: TEvent): Promise<void>;
  processBatch(events: TEvent[]): Promise<void>;
  pause(): void;
  resume(): void;
  getQueueSize(): number;
  setMaxQueueSize(size: number): void;
  getProcessingStats(): {
    processed: number;
    errors: number;
    averageProcessingTime: number;
  };
}

// ============================================================================
// Event Validation
// ============================================================================

// Event validation result
export interface EventValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Event validator
export type EventValidator<TEvent extends Event> = (event: TEvent) => EventValidationResult;

// Validation result as Result type
export type ValidationResult<TEvent extends Event> = Result<TEvent, BaseError>;

// ============================================================================
// Type Extraction Helpers
// ============================================================================

// Extract event data type
export type ExtractEventData<TEvent extends Event> = TEvent['data'];

// Extract aggregate ID type
export type ExtractAggregateId<TEvent extends Event> = TEvent['aggregateId'];

// Extract event type from event
export type ExtractEventType<TEvent extends Event> = TEvent['type'];

// Extract all event types from union
export type ExtractAllEventTypes<TEvent extends Event> = TEvent extends Event<infer TType> ? TType : never;

// Infer aggregate type from event
export type InferAggregateType<TEvent extends Event> = 
  TEvent extends Event<any, any, infer TAggregateId> ? TAggregateId : never;

// ============================================================================
// Event Sourcing Utilities
// ============================================================================

// Fold events synchronously
export const foldEvents = <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: EventReducer<TEvent, TState>,
  initialState?: TState
): TState | undefined => {
  return events.reduce((state, event) => reducer(state, event), initialState);
};

// Fold events asynchronously
export const foldEventsAsync = async <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: AsyncEventReducer<TEvent, TState>,
  initialState?: TState
): Promise<TState | undefined> => {
  let state = initialState;
  for (const event of events) {
    state = await reducer(state, event);
  }
  return state;
};

// Event stream utilities
export type EventStreamType<TEvent extends Event = Event> = readonly TEvent[];

export const filterEventsByType = <TEvent extends Event, TType extends TEvent['type']>(
  events: EventStreamType<TEvent>,
  type: TType
): Array<Extract<TEvent, { type: TType }>> => {
  return events.filter((event): event is Extract<TEvent, { type: TType }> => 
    event.type === type
  );
};

export const sortEventsByTimestamp = <TEvent extends Event>(
  events: EventStreamType<TEvent>
): EventStreamType<TEvent> => {
  return [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export const sortEventsByVersion = <TEvent extends Event>(
  events: EventStreamType<TEvent>
): EventStreamType<TEvent> => {
  return [...events].sort((a, b) => a.version - b.version);
};

// ============================================================================
// Framework Constants
// ============================================================================

export const DEFAULT_SNAPSHOT_FREQUENCY = 100;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_CONCURRENCY = 10;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_CACHE_TTL_MS = 300000; // 5 minutes