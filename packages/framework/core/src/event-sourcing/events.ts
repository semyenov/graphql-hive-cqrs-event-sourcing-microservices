// Core event interfaces and base types for Event Sourcing
import type { AggregateId, EventVersion, Timestamp, CorrelationId, CausationId } from '../types/branded';
import { BrandedTypes } from '../types/branded';

// ============================================================================
// Core Event Interface with Enhanced Generics
// ============================================================================

// Generic event interface with strong typing
export interface Event<
  TType extends string = string,
  TData = unknown,
  TAggregateId extends AggregateId = AggregateId
> {
  aggregateId: TAggregateId;
  type: TType;
  version: EventVersion;
  timestamp: Timestamp;
  data: TData;
  id: string; // Required field for framework compatibility
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

// Enhanced event with metadata
export interface EnhancedEvent<
  TEvent extends Event = Event,
  TMetadata extends EventMetadata = EventMetadata
> {
  event: TEvent;
  metadata: TMetadata;
}

// Event categories for better organization
export type EventCategory = 'domain' | 'system' | 'integration' | 'audit' | 'notification';

// Categorized event
export interface CategorizedEvent<TEvent extends Event = Event> extends Event {
  category: EventCategory;
}

// Event schema version
export type EventSchemaVersion = 1 | 2 | 3 | 4 | 5;

// Versioned event type
export interface VersionedEvent<
  TEvent extends Event = Event,
  TVersion extends EventSchemaVersion = 1
> extends Event {
  schemaVersion: TVersion;
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

// ============================================================================
// Event Factory Functions
// ============================================================================

// Generic event factory
export const createEvent = <
  TType extends string,
  TData,
  TAggregateId extends AggregateId = AggregateId
>(
  type: TType,
  aggregateId: string | TAggregateId,
  version: number,
  data: TData,
  id?: string
): Event<TType, TData, TAggregateId> => {
  const aggregateIdBranded = typeof aggregateId === 'string' 
    ? BrandedTypes.aggregateId(aggregateId) as TAggregateId
    : aggregateId;
  
  return {
    id: id || crypto.randomUUID(),
    aggregateId: aggregateIdBranded,
    type,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data,
  };
};

// Create categorized event
export const createCategorizedEvent = <
  TType extends string,
  TData,
  TAggregateId extends AggregateId = AggregateId
>(
  type: TType,
  aggregateId: string | TAggregateId,
  version: number,
  data: TData,
  category: EventCategory,
  id?: string
): CategorizedEvent<Event<TType, TData, TAggregateId>> => {
  const event = createEvent(type, aggregateId, version, data, id);
  return {
    ...event,
    category,
  } as CategorizedEvent<Event<TType, TData, TAggregateId>>;
};

// ============================================================================
// Event Type Guards
// ============================================================================

// Type guard generator using generics
export const createTypeGuard = <TType extends string>(eventType: TType) => {
  return <TEvent extends Event>(
    event: TEvent
  ): event is Extract<TEvent, { type: TType }> => {
    return event.type === eventType;
  };
};

// Category-based type guard
export const createCategoryGuard = <TCategory extends EventCategory>(category: TCategory) => {
  return (event: Event): event is CategorizedEvent => {
    return 'category' in event && (event as CategorizedEvent).category === category;
  };
};

// ============================================================================
// Event Handlers and Reducers
// ============================================================================

// Event handler type with generics
export type EventHandler<
  TEvent extends Event,
  TState = unknown,
  TResult = void
> = (event: TEvent, currentState: TState) => TResult | Promise<TResult>;

// Event reducer for building state from events
export type EventReducer<
  TState,
  TEvent extends Event
> = (state: TState | null, event: TEvent) => TState;

// Async event reducer
export type AsyncEventReducer<
  TState,
  TEvent extends Event
> = (state: TState | undefined, event: TEvent) => Promise<TState>;

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

// ============================================================================
// Type Extraction Helpers
// ============================================================================

// Type helper to extract event data type
export type ExtractEventData<TEvent extends Event> = TEvent['data'];

// Type helper to extract aggregate ID type
export type ExtractAggregateId<TEvent extends Event> = TEvent['aggregateId'];

// Extract event type from event
export type ExtractEventType<TEvent extends Event> = TEvent['type'];

// Extract all event types from union
export type ExtractAllEventTypes<TEvent extends Event> = TEvent extends Event<infer TType> ? TType : never;

// Infer aggregate type from event
export type InferAggregateType<TEvent extends Event> = 
  TEvent extends Event<any, any, infer TAggregateId> ? TAggregateId : never;

// Aggregate event filter
export type AggregateEvents<TEvents extends Event, TAggregateId extends AggregateId> = 
  Extract<TEvents, { aggregateId: TAggregateId }>;

// ============================================================================
// Event Utilities
// ============================================================================

// Fold events with reducer
export const foldEvents = <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: EventReducer<TState, TEvent>,
  initialState: TState
): TState => {
  return events.reduce((state, event) => reducer(state, event), initialState);
};

// Async fold for IO-bound reducers
export const foldEventsAsync = async <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: AsyncEventReducer<TState, TEvent>,
  initialState: TState
): Promise<TState> => {
  let state = initialState;
  for (const event of events) {
    state = await reducer(state, event);
  }
  return state;
};

// Filter events by type
export const filterEventsByType = <TEvent extends Event, TType extends string>(
  events: TEvent[],
  type: TType
): Extract<TEvent, { type: TType }>[] => {
  return events.filter((event): event is Extract<TEvent, { type: TType }> => event.type === type);
};

// Sort events by timestamp
export const sortEventsByTimestamp = <TEvent extends Event>(
  events: TEvent[],
  order: 'asc' | 'desc' = 'asc'
): TEvent[] => {
  return [...events].sort((a, b) => {
    const diff = a.timestamp.getTime() - b.timestamp.getTime();
    return order === 'asc' ? diff : -diff;
  });
};

// Sort events by version
export const sortEventsByVersion = <TEvent extends Event>(
  events: TEvent[],
  order: 'asc' | 'desc' = 'asc'
): TEvent[] => {
  return [...events].sort((a, b) => {
    const aVersion = typeof a.version === 'number' ? a.version : (a.version as unknown as number);
    const bVersion = typeof b.version === 'number' ? b.version : (b.version as unknown as number);
    const diff = aVersion - bVersion;
    return order === 'asc' ? diff : -diff;
  });
};

// ============================================================================
// Performance Optimization Types
// ============================================================================

// Event index for fast lookup
export type EventIndex<TEvent extends Event> = Map<TEvent['type'], TEvent[]>;

// Aggregate index
export type AggregateIndex<TEvent extends Event> = Map<AggregateId, TEvent[]>;

// Compound index
export type CompoundIndex<TEvent extends Event> = Map<`${AggregateId}:${EventVersion}`, TEvent>;