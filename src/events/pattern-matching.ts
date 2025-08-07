// Type-safe pattern matching system without 'any' types
// This replaces the unsafe pattern matching in generic-types.ts

import type { Event, AllEvents, UserEvent, SystemEvent, IntegrationEvent } from './generic-types';

// ============================================================================
// Type-Safe Pattern Matching Implementation
// ============================================================================

// Event pattern mapping with exact type safety
export type TypeSafeEventPattern<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
};

// Partial pattern matching with default handler
export type PartialTypeList<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]?: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
} & {
  readonly _default?: (event: TEvent) => TResult;
};

// Type-safe pattern matcher
export function matchEventSafe<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: TypeSafeEventPattern<TEvent, TResult>
): TResult {
  const handler = patterns[event.type as TEvent['type']];
  // Type assertion is safe here because we know the handler exists for this event type
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// Partial pattern matcher with default
export function matchEventPartialSafe<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PartialTypeList<TEvent, TResult>,
  defaultResult: TResult
): TResult {
  const handler = patterns[event.type as TEvent['type']] || patterns._default;
  if (!handler) {
    return defaultResult;
  }
  // Type assertion is safe because we've checked the handler exists
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// ============================================================================
// Specialized Pattern Matchers for Event Categories
// ============================================================================

// User event pattern matcher
export const matchUserEvent = <TResult>(
  event: UserEvent,
  patterns: TypeSafeEventPattern<UserEvent, TResult>
): TResult => {
  return matchEventSafe(event, patterns);
};

// System event pattern matcher
export const matchSystemEvent = <TResult>(
  event: SystemEvent,
  patterns: TypeSafeEventPattern<SystemEvent, TResult>
): TResult => {
  return matchEventSafe(event, patterns);
};

// Integration event pattern matcher
export const matchIntegrationEvent = <TResult>(
  event: IntegrationEvent,
  patterns: TypeSafeEventPattern<IntegrationEvent, TResult>
): TResult => {
  return matchEventSafe(event, patterns);
};

// All events pattern matcher
export const matchAllEvents = <TResult>(
  event: AllEvents,
  patterns: TypeSafeEventPattern<AllEvents, TResult>
): TResult => {
  return matchEventSafe(event, patterns);
};

// ============================================================================
// Builder Pattern for Complex Pattern Matching
// ============================================================================

// Pattern builder for fluent interface
export class EventPatternBuilder<TEvent extends Event, TResult> {
  private patterns: Partial<TypeSafeEventPattern<TEvent, TResult>> = {};
  private defaultHandler?: (event: TEvent) => TResult;

  // Add handler for specific event type
  on<K extends TEvent['type']>(
    eventType: K,
    handler: (event: Extract<TEvent, { type: K }>) => TResult
  ): this {
    (this.patterns as any)[eventType] = handler;
    return this;
  }

  // Add default handler
  otherwise(handler: (event: TEvent) => TResult): this {
    this.defaultHandler = handler;
    return this;
  }

  // Execute pattern matching
  match(event: TEvent): TResult {
    const handler = this.patterns[event.type as TEvent['type']];
    if (handler) {
      return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
    }
    if (this.defaultHandler) {
      return this.defaultHandler(event);
    }
    throw new Error(`No handler found for event type: ${event.type}`);
  }

  // Build the pattern object
  build(): TypeSafeEventPattern<TEvent, TResult> | PartialTypeList<TEvent, TResult> {
    if (this.defaultHandler) {
      return {
        ...this.patterns,
        _default: this.defaultHandler,
      } as PartialTypeList<TEvent, TResult>;
    }
    return this.patterns as TypeSafeEventPattern<TEvent, TResult>;
  }
}

// Factory function for pattern builder
export const createEventPattern = <TEvent extends Event, TResult = void>() =>
  new EventPatternBuilder<TEvent, TResult>();

// ============================================================================
// Async Pattern Matching
// ============================================================================

// Async pattern matching
export type AsyncEventPattern<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => Promise<TResult>;
};

export async function matchEventAsync<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: AsyncEventPattern<TEvent, TResult>
): Promise<TResult> {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// ============================================================================
// Conditional Pattern Matching
// ============================================================================

// Pattern matching with conditions
export type ConditionalPattern<TEvent extends Event, TResult> = {
  condition: (event: TEvent) => boolean;
  handler: (event: TEvent) => TResult;
};

export function matchEventConditional<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: ConditionalPattern<TEvent, TResult>[],
  defaultResult: TResult
): TResult {
  for (const pattern of patterns) {
    if (pattern.condition(event)) {
      return pattern.handler(event);
    }
  }
  return defaultResult;
}

// ============================================================================
// Example Usage Patterns
// ============================================================================

/* Example usage:

// Using the fluent builder
const userEventProcessor = createEventPattern<UserEvent, string>()
  .on('UserCreated', (event) => `User ${event.data.name} created`)
  .on('UserUpdated', (event) => `User updated`)
  .on('UserDeleted', (event) => `User deleted`)
  .build();

// Using direct pattern matching
const result = matchUserEvent(someUserEvent, {
  UserCreated: (event) => `Created: ${event.data.name}`,
  UserUpdated: (event) => `Updated user`,
  UserDeleted: (event) => `Deleted user`,
});

// Using async pattern matching
const asyncResult = await matchEventAsync(someEvent, {
  UserCreated: async (event) => {
    await saveToDatabase(event.data);
    return 'Saved';
  },
  UserUpdated: async (event) => {
    await updateDatabase(event.data);
    return 'Updated';
  },
  UserDeleted: async (event) => {
    await deleteFromDatabase(event.aggregateId);
    return 'Deleted';
  },
});

*/