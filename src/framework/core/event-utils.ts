/**
 * Framework Core: Event Utilities
 * 
 * Reusable utilities for type-safe event handling across domains.
 */

import type { IEvent, EventPattern, PartialEventPattern } from './event';
import type { Timestamp } from './branded/types';

/**
 * Type guard generator for events
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Create a type guard for a specific event type
 */
export function createEventTypeGuard<
  TEvent extends IEvent,
  TType extends TEvent['type']
>(
  eventType: TType
): TypeGuard<Extract<TEvent, { type: TType }>> {
  return (event: unknown): event is Extract<TEvent, { type: TType }> => {
    return (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === eventType
    );
  };
}

/**
 * Type-safe event matcher with exhaustive checking
 */
export function matchEvent<
  TEvent extends IEvent,
  TResult
>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult {
  const handler = patterns[event.type as TEvent['type']];
  if (!handler) {
    throw new Error(`No handler for event type: ${event.type}`);
  }
  // Type assertion is safe here because of the discriminated union
  return handler(event as Extract<TEvent, { type: typeof event.type }>);
}

/**
 * Partial event matcher with default handler
 */
export function matchEventPartial<
  TEvent extends IEvent,
  TResult
>(
  event: TEvent,
  patterns: PartialEventPattern<TEvent, TResult>,
  defaultHandler: (event: TEvent) => TResult
): TResult {
  const handler = patterns[event.type as TEvent['type']];
  if (handler) {
    // Type assertion is safe here because of the discriminated union
    return handler(event as Extract<TEvent, { type: typeof event.type }>);
  }
  return patterns._default?.(event) ?? defaultHandler(event);
}

/**
 * Create an event matcher for a specific event union type
 */
export function createEventMatcher<TEvent extends IEvent>() {
  return {
    match<TResult>(
      event: TEvent,
      patterns: EventPattern<TEvent, TResult>
    ): TResult {
      return matchEvent(event, patterns);
    },
    
    matchPartial<TResult>(
      event: TEvent,
      patterns: PartialEventPattern<TEvent, TResult>,
      defaultHandler: (event: TEvent) => TResult
    ): TResult {
      return matchEventPartial(event, patterns, defaultHandler);
    },
    
    createTypeGuard<TType extends TEvent['type']>(
      eventType: TType
    ): TypeGuard<Extract<TEvent, { type: TType }>> {
      return createEventTypeGuard<TEvent, TType>(eventType);
    }
  };
}

/**
 * Extract event types from a union
 */
export type ExtractEventType<
  TEvent extends IEvent,
  TType extends TEvent['type']
> = Extract<TEvent, { type: TType }>;

/**
 * Map event types to their data payloads
 */
export type EventDataMap<TEvent extends IEvent> = {
  [K in TEvent['type']]: Extract<TEvent, { type: K }>['data'];
};

/**
 * Create a typed event factory
 */
export function createEventFactory<
  TEvent extends IEvent,
  TType extends TEvent['type']
>(
  type: TType,
  createData: (
    params: ExtractEventType<TEvent, TType>['data']
  ) => ExtractEventType<TEvent, TType>['data']
): (
  aggregateId: ExtractEventType<TEvent, TType>['aggregateId'],
  version: ExtractEventType<TEvent, TType>['version'],
  data: Parameters<typeof createData>[0]
) => ExtractEventType<TEvent, TType> {
  return (aggregateId, version, data) => ({
    type,
    aggregateId,
    version,
    timestamp: new Date() as Timestamp,
    data: createData(data),
  } as ExtractEventType<TEvent, TType>);
}

/**
 * Event reducer with type safety
 */
export type TypedEventReducer<
  TEvent extends IEvent,
  TState
> = (state: TState | undefined, event: TEvent) => TState;

/**
 * Create a typed event reducer
 */
export function createEventReducer<
  TEvent extends IEvent,
  TState
>(
  initialState: TState,
  patterns: EventPattern<TEvent, TState>
): TypedEventReducer<TEvent, TState> {
  return (_state = initialState, event) => {
    return matchEvent(event, patterns);
  };
}

/**
 * Batch event processor
 */
export function processEvents<
  TEvent extends IEvent,
  TState
>(
  events: TEvent[],
  reducer: TypedEventReducer<TEvent, TState>,
  initialState: TState
): TState {
  return events.reduce(
    (state, event) => reducer(state, event),
    initialState
  );
}

/**
 * Filter events by type
 */
export function filterEventsByType<
  TEvent extends IEvent,
  TType extends TEvent['type']
>(
  events: TEvent[],
  type: TType
): Array<ExtractEventType<TEvent, TType>> {
  return events.filter(
    (event): event is ExtractEventType<TEvent, TType> => event.type === type
  );
}

/**
 * Group events by aggregate ID
 */
export function groupEventsByAggregate<TEvent extends IEvent>(
  events: TEvent[]
): Map<string, TEvent[]> {
  const grouped = new Map<string, TEvent[]>();
  
  for (const event of events) {
    const key = String(event.aggregateId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }
  
  return grouped;
}

/**
 * Sort events by version
 */
export function sortEventsByVersion<TEvent extends IEvent>(
  events: TEvent[]
): TEvent[] {
  return [...events].sort((a, b) => Number(a.version) - Number(b.version));
}

/**
 * Validate event sequence
 */
export function validateEventSequence<TEvent extends IEvent>(
  events: TEvent[]
): { valid: boolean; gaps: number[]; duplicates: number[] } {
  const sorted = sortEventsByVersion(events);
  const gaps: number[] = [];
  const duplicates: number[] = [];
  const seen = new Set<number>();
  
  for (let i = 0; i < sorted.length; i++) {
    const version = Number(sorted[i]?.version);
    
    if (seen.has(version)) {
      duplicates.push(version);
    }
    seen.add(version);
    
    if (i > 0) {
      const prevVersion = Number(sorted[i - 1]?.version);
      if (version !== prevVersion + 1) {
        for (let v = prevVersion + 1; v < version; v++) {
          gaps.push(v);
        }
      }
    }
  }
  
  return {
    valid: gaps.length === 0 && duplicates.length === 0,
    gaps,
    duplicates,
  };
}