import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  AggregateId,
  EventVersion,
  Timestamp,
  CorrelationId,
  CausationId,
  UserId,
} from '../types';

import { BrandedTypes } from '../types';

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

// Event type literals for type safety
export const EventTypes = {
  UserCreated: 'UserCreated',
  UserUpdated: 'UserUpdated',
  UserDeleted: 'UserDeleted',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// Specific event types using generics
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

// Union type for all user events
export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

// Type guard generators using generics
export const createTypeGuard = <TType extends EventType>(eventType: TType) => {
  return (
    event: Event
  ): event is Extract<UserEvent, { type: TType }> => {
    return event.type === eventType;
  };
};

// Pre-defined type guards
export const isUserCreatedEvent = createTypeGuard(EventTypes.UserCreated);
export const isUserUpdatedEvent = createTypeGuard(EventTypes.UserUpdated);
export const isUserDeletedEvent = createTypeGuard(EventTypes.UserDeleted);

// Generic event factory
export const createEvent = <
  TType extends EventType,
  TData extends UserEvent['data']
>(
  type: TType,
  aggregateId: string,
  version: number,
  data: TData
): Extract<UserEvent, { type: TType }> => {
  return {
    aggregateId: BrandedTypes.aggregateId(aggregateId),
    type,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data,
  } as Extract<UserEvent, { type: TType }>;
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
}

// Enhanced event with metadata
export interface EnhancedEvent<
  TEvent extends Event = Event,
  TMetadata extends EventMetadata = EventMetadata
> {
  event: TEvent;
  metadata: TMetadata;
}


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

// Command type that produces events
export interface Command<
  TType extends string = string,
  TPayload = unknown,
  TEvent extends Event = Event
> {
  type: TType;
  aggregateId: AggregateId;
  payload: TPayload;
  execute(): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
}

// Type-safe command factory
export type CommandFactory<
  TType extends string,
  TPayload,
  TEvent extends Event
> = (aggregateId: AggregateId, payload: TPayload) => Command<TType, TPayload, TEvent>;

// Projection type for read models
export interface Projection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: EventReducer<TEvent, TReadModel>;
  getCurrentState(): TReadModel;
}

// Snapshot interface for event sourcing optimization
export interface Snapshot<TState = unknown, TAggregateId extends AggregateId = AggregateId> {
  aggregateId: TAggregateId;
  version: EventVersion;
  state: TState;
  timestamp: Timestamp;
}

// Event sourcing utilities
export const foldEvents = <TEvent extends Event, TState>(
  events: TEvent[],
  reducer: EventReducer<TEvent, TState>,
  initialState: TState
): TState => {
  return events.reduce((state, event) => reducer(state, event), initialState);
};

// Type helper to extract event data type
export type ExtractEventData<TEvent extends Event> = TEvent['data'];

// Type helper to extract aggregate ID type
export type ExtractAggregateId<TEvent extends Event> = TEvent['aggregateId'];

// Type helper for event pattern matching
export type EventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
};

// Pattern matching helper
export const matchEvent = <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult => {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as any);
};