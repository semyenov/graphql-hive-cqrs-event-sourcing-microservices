import type {
  AggregateId,
  EventVersion,
  Timestamp,
  CorrelationId,
  CausationId,
  UserId,
} from '../../core/branded';

import { BrandedTypes } from '../../core/branded';

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
} from '../../types/generated/resolvers';

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
}

// Export IEvent as alias for compatibility with core types
export type IEvent<
  TType extends string = string,
  TData = unknown,
  TAggregateId extends AggregateId = AggregateId
> = Event<TType, TData, TAggregateId>;

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
type EventName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAggregateType>}${PascalCase<TAction>}`;

// Command name builder
type CommandName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAction>}${PascalCase<TAggregateType>}`;

// ============================================================================
// Event Type System with Categories
// ============================================================================

// Event type literals for type safety
export const EventTypes = {
  // Domain Events
  UserCreated: 'UserCreated',
  UserUpdated: 'UserUpdated',
  UserDeleted: 'UserDeleted',
  // System Events
  SystemStarted: 'SystemStarted',
  SystemStopped: 'SystemStopped',
  // Integration Events
  EmailSent: 'EmailSent',
  WebhookDelivered: 'WebhookDelivered',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// Event categories for better organization
export type EventCategory = 'domain' | 'system' | 'integration';

// Map event types to categories
export type EventTypeCategory<TType extends EventType> = 
  TType extends 'UserCreated' | 'UserUpdated' | 'UserDeleted' ? 'domain' :
  TType extends 'SystemStarted' | 'SystemStopped' ? 'system' :
  TType extends 'EmailSent' | 'WebhookDelivered' ? 'integration' :
  never;

// ============================================================================
// Specific Event Types with Enhanced Type Safety
// ============================================================================

// Domain Events
export type UserCreatedEvent = Event<
  typeof EventTypes.UserCreated,
  CreateUserInput
>;

export type UserUpdatedEvent = Event<
  typeof EventTypes.UserUpdated,
  Partial<UpdateUserInput>
>;

export type UserDeletedEvent = Event<
  typeof EventTypes.UserDeleted,
  Record<string, never>
>;

// System Events
export type SystemStartedEvent = Event<
  typeof EventTypes.SystemStarted,
  { startTime: Timestamp; version: string }
>;

export type SystemStoppedEvent = Event<
  typeof EventTypes.SystemStopped,
  { stopTime: Timestamp; reason?: string }
>;

// Integration Events
export type EmailSentEvent = Event<
  typeof EventTypes.EmailSent,
  { to: string; subject: string; sentAt: Timestamp }
>;

export type WebhookDeliveredEvent = Event<
  typeof EventTypes.WebhookDelivered,
  { url: string; status: number; responseTime: number }
>;

// Union types by category
export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;
export type SystemEvent = SystemStartedEvent | SystemStoppedEvent;
export type IntegrationEvent = EmailSentEvent | WebhookDeliveredEvent;
export type AllEvents = UserEvent | SystemEvent | IntegrationEvent;

// ============================================================================
// Advanced Type Guards with Generics
// ============================================================================

// Type guard generators using generics
export const createTypeGuard = <TType extends EventType>(eventType: TType) => {
  return (
    event: Event
  ): event is Extract<AllEvents, { type: TType }> => {
    return event.type === eventType;
  };
};

// Category-based type guards
export const isDomainEvent = (event: Event): event is UserEvent => {
  return event.type === 'UserCreated' || event.type === 'UserUpdated' || event.type === 'UserDeleted';
};

export const isSystemEvent = (event: Event): event is SystemEvent => {
  return event.type === 'SystemStarted' || event.type === 'SystemStopped';
};

export const isIntegrationEvent = (event: Event): event is IntegrationEvent => {
  return event.type === 'EmailSent' || event.type === 'WebhookDelivered';
};

// Pre-defined type guards
export const isUserCreatedEvent = createTypeGuard(EventTypes.UserCreated);
export const isUserUpdatedEvent = createTypeGuard(EventTypes.UserUpdated);
export const isUserDeletedEvent = createTypeGuard(EventTypes.UserDeleted);

// ============================================================================
// Event Factories with Type Inference
// ============================================================================

// Generic event factory
export const createEvent = <
  TType extends EventType,
  TData extends AllEvents['data']
>(
  type: TType,
  aggregateId: string,
  version: number,
  data: TData
): Extract<AllEvents, { type: TType }> => {
  return {
    aggregateId: BrandedTypes.aggregateId(aggregateId),
    type,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data,
  } as Extract<AllEvents, { type: TType }>;
};

// Type-safe event factories with inference
export const EventFactories = {
  createUserCreated: (
    aggregateId: string,
    data: CreateUserInput
  ): UserCreatedEvent => createEvent(EventTypes.UserCreated, aggregateId, 1, data),
  
  createUserUpdated: (
    aggregateId: string,
    version: number,
    data: Partial<UpdateUserInput>
  ): UserUpdatedEvent => createEvent(EventTypes.UserUpdated, aggregateId, version, data),
  
  createUserDeleted: (
    aggregateId: string,
    version: number
  ): UserDeletedEvent => createEvent(EventTypes.UserDeleted, aggregateId, version, {}),
} as const;

// ============================================================================
// Event Metadata with Enhanced Types
// ============================================================================

// Event metadata with generics
export interface EventMetadata<
  TCorrelationId extends CorrelationId = CorrelationId,
  TCausationId extends CausationId = CausationId,
  TUserId extends UserId = UserId
> {
  correlationId?: TCorrelationId;
  causationId?: TCausationId;
  userId?: TUserId;
  timestamp: Timestamp;
  // New metadata fields
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

// ============================================================================
// Event Versioning and Migration
// ============================================================================

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
// Advanced Type Helpers
// ============================================================================

// Aggregate state inference
export type InferAggregateState<TEvent extends Event> = 
  TEvent extends UserCreatedEvent ? User :
  TEvent extends UserUpdatedEvent ? Partial<User> :
  TEvent extends UserDeletedEvent ? { deleted: true } :
  never;

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

// ============================================================================
// Command System with Enhanced Types
// ============================================================================

// Command type that produces events
export interface Command<
  TType extends string = string,
  TPayload = unknown,
  TEvent extends Event = Event,
  TError = Error
> {
  type: TType;
  aggregateId: AggregateId;
  payload: TPayload;
  execute(): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
  validate?(): TError | null;
  authorize?(userId: UserId): boolean;
}

// Type-safe command factory
export type CommandFactory<
  TType extends string,
  TPayload,
  TEvent extends Event
> = (aggregateId: AggregateId, payload: TPayload) => Command<TType, TPayload, TEvent>;

// Command result with metadata
export interface CommandResult<TEvent extends Event = Event, TError = Error> {
  success: boolean;
  events?: TEvent[];
  error?: TError;
  metadata?: {
    executionTime: number;
    retryCount?: number;
  };
}

// ============================================================================
// Projection System with Type Safety
// ============================================================================

// Projection type for read models
export interface Projection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: EventReducer<TEvent, TReadModel>;
  getCurrentState(): TReadModel;
  // New methods
  reset(): void;
  getLastProcessedVersion(): EventVersion;
  subscribe(handler: (state: TReadModel) => void): () => void;
}

// Materialized view projection
export interface MaterializedView<TEvent extends Event, TViewModel> extends Projection<TEvent, TViewModel> {
  query<TQuery extends Record<string, unknown>>(params: TQuery): TViewModel | TViewModel[];
  index: string[];
}

// ============================================================================
// Snapshot System for Performance
// ============================================================================

// Snapshot interface for event sourcing optimization
export interface Snapshot<TState = unknown, TAggregateId extends AggregateId = AggregateId> {
  aggregateId: TAggregateId;
  version: EventVersion;
  state: TState;
  timestamp: Timestamp;
  // New fields
  checksum?: string;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

// Snapshot strategy
export type SnapshotStrategy = 
  | { type: 'frequency'; interval: number }
  | { type: 'count'; threshold: number }
  | { type: 'size'; maxBytes: number }
  | { type: 'time'; intervalMs: number };

// ============================================================================
// Event Sourcing Utilities
// ============================================================================

// Fold events with async support
export const foldEvents = <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: EventReducer<TEvent, TState>,
  initialState: TState
): TState => {
  return events.reduce((state, event) => reducer(state, event), initialState);
};

// Async fold for IO-bound reducers
export const foldEventsAsync = async <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: (state: TState, event: TEvent) => Promise<TState>,
  initialState: TState
): Promise<TState> => {
  let state = initialState;
  for (const event of events) {
    state = await reducer(state, event);
  }
  return state;
};

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

// ============================================================================
// Pattern Matching System
// ============================================================================

// Type helper for event pattern matching
export type EventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
};

// Partial pattern matching
export type PartialEventPattern<TEvent extends Event, TResult> = Partial<EventPattern<TEvent, TResult>> & {
  _default?: (event: TEvent) => TResult;
};

// Pattern matching helper
export const matchEvent = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult => {
  const handler = patterns[event.type as TEvent['type']];
  // Type-safe without 'any' - handler expects the exact event type
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
};

// Partial pattern matching with default
export const matchEventPartial = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PartialEventPattern<TEvent, TResult>,
  defaultResult: TResult
): TResult => {
  const handler = patterns[event.type as TEvent['type']] || patterns._default;
  return handler ? handler(event as Extract<TEvent, { type: TEvent['type'] }>) : defaultResult;
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
}

// Event processor with backpressure
export interface EventProcessor<TEvent extends Event> {
  process(event: TEvent): Promise<void>;
  pause(): void;
  resume(): void;
  getQueueSize(): number;
  setMaxQueueSize(size: number): void;
}

// ============================================================================
// Type-Safe Event Subscription
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
  handler: EventHandler<TEvent>;
  options?: SubscriptionOptions;
}

// Event bus interface
export interface EventBus<TEvent extends Event = AllEvents> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: EventHandler<TSpecificEvent>
  ): () => void;
  subscribeAll(handler: EventHandler<TEvent>): () => void;
}

// ============================================================================
// Aggregate Type Helpers
// ============================================================================

// Infer aggregate type from event
export type InferAggregateType<TEvent extends Event> = 
  TEvent extends Event<any, any, infer TAggregateId> ? TAggregateId : never;

// Aggregate event filter
export type AggregateEvents<TEvents extends Event, TAggregateId extends AggregateId> = 
  Extract<TEvents, { aggregateId: TAggregateId }>;

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
// Performance Optimization Types
// ============================================================================

// Event index for fast lookup
export type EventIndex<TEvent extends Event> = Map<TEvent['type'], TEvent[]>;

// Aggregate index
export type AggregateIndex<TEvent extends Event> = Map<AggregateId, TEvent[]>;

// Compound index
export type CompoundIndex<TEvent extends Event> = Map<`${AggregateId}:${EventVersion}`, TEvent>;

