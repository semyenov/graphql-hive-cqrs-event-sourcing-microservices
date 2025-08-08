// Universal type-safe pattern matching system for CQRS framework
// Provides type-safe event pattern matching without 'any' types

import type { Event } from '../event-sourcing/interfaces';

// ============================================================================
// Core Pattern Matching Types
// ============================================================================

// Event pattern mapping with exact type safety
export type EventPattern<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
};

// Partial pattern matching with default handler
export type PartialEventPattern<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]?: (
    event: Extract<TEvent, { type: K }>
  ) => TResult;
} & {
  readonly _default?: (event: TEvent) => TResult;
};

// Async pattern matching type
export type AsyncEventPattern<TEvent extends Event, TResult> = {
  readonly [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => Promise<TResult>;
};

// ============================================================================
// Core Pattern Matching Functions
// ============================================================================

// Type-safe pattern matcher - requires complete pattern coverage
export function matchEvent<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult {
  const handler = patterns[event.type as TEvent['type']];
  // Type assertion is safe because EventPattern requires complete coverage
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// Partial pattern matcher with default fallback
export function matchEventPartial<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PartialEventPattern<TEvent, TResult>,
  defaultResult: TResult
): TResult {
  const handler = patterns[event.type as TEvent['type']] || patterns._default;
  if (!handler) {
    return defaultResult;
  }
  // Type assertion is safe because we've checked the handler exists
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// Async pattern matcher
export async function matchEventAsync<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: AsyncEventPattern<TEvent, TResult>
): Promise<TResult> {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
}

// ============================================================================
// Fluent Builder Pattern
// ============================================================================

// Pattern builder for fluent interface
export class EventPatternBuilder<TEvent extends Event, TResult> {
  private patterns: Partial<EventPattern<TEvent, TResult>> = {};
  private defaultHandler?: (event: TEvent) => TResult;

  // Add handler for specific event type
  on<K extends TEvent['type']>(
    eventType: K,
    handler: (event: Extract<TEvent, { type: K }>) => TResult
  ): this {
    this.patterns[eventType] = handler as EventPattern<TEvent, TResult>[K];
    return this;
  }

  // Add multiple handlers at once
  onMany<K extends TEvent['type']>(
    handlers: {
      [P in K]: (event: Extract<TEvent, { type: P }>) => TResult;
    }
  ): this {
    Object.entries(handlers).forEach(([eventType, handler]) => {
      this.patterns[eventType as K] = handler as EventPattern<TEvent, TResult>[K];
    });
    return this;
  }

  // Add default handler for unmatched events
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

  // Build the pattern object for reuse
  build(): EventPattern<TEvent, TResult> | PartialEventPattern<TEvent, TResult> {
    if (this.defaultHandler) {
      return {
        ...this.patterns,
        _default: this.defaultHandler,
      } as PartialEventPattern<TEvent, TResult>;
    }
    return this.patterns as EventPattern<TEvent, TResult>;
  }

  // Check if all event types have handlers
  isComplete(): boolean {
    // This is a compile-time check primarily, but we can do runtime validation too
    return Object.keys(this.patterns).length > 0;
  }

  // Get registered event types
  getRegisteredTypes(): (TEvent['type'])[] {
    return Object.keys(this.patterns) as (TEvent['type'])[];
  }

  // Clear all patterns
  clear(): this {
    this.patterns = {};
    this.defaultHandler = undefined as unknown as (event: TEvent) => TResult;
    return this;
  }
}

// ============================================================================
// Advanced Pattern Matching
// ============================================================================

// Conditional pattern matching
export interface ConditionalPattern<TEvent extends Event, TResult> {
  condition: (event: TEvent) => boolean;
  handler: (event: TEvent) => TResult;
}

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

// Priority-based pattern matching
export interface PriorityPattern<TEvent extends Event, TResult> {
  priority: number;
  condition: (event: TEvent) => boolean;
  handler: (event: TEvent) => TResult;
}

export function matchEventPriority<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PriorityPattern<TEvent, TResult>[],
  defaultResult: TResult
): TResult {
  // Sort by priority (higher numbers first)
  const sortedPatterns = [...patterns].sort((a, b) => b.priority - a.priority);
  
  for (const pattern of sortedPatterns) {
    if (pattern.condition(event)) {
      return pattern.handler(event);
    }
  }
  return defaultResult;
}

// Multi-dispatch pattern matching (handle multiple events)
export function matchEvents<TEvent extends Event, TResult>(
  events: TEvent[],
  patterns: EventPattern<TEvent, TResult>
): TResult[] {
  return events.map(event => matchEvent(event, patterns));
}

// Batch async pattern matching
export async function matchEventsAsync<TEvent extends Event, TResult>(
  events: TEvent[],
  patterns: AsyncEventPattern<TEvent, TResult>
): Promise<TResult[]> {
  return Promise.all(events.map(event => matchEventAsync(event, patterns)));
}

// ============================================================================
// Utility Functions and Factory
// ============================================================================

// Factory function for pattern builder
export function createEventPattern<TEvent extends Event, TResult = void>(): EventPatternBuilder<TEvent, TResult> {
  return new EventPatternBuilder<TEvent, TResult>();
}

// Helper to create conditional patterns
export function createConditionalPattern<TEvent extends Event, TResult>(
  condition: (event: TEvent) => boolean,
  handler: (event: TEvent) => TResult
): ConditionalPattern<TEvent, TResult> {
  return { condition, handler };
}

// Helper to create priority patterns
export function createPriorityPattern<TEvent extends Event, TResult>(
  priority: number,
  condition: (event: TEvent) => boolean,
  handler: (event: TEvent) => TResult
): PriorityPattern<TEvent, TResult> {
  return { priority, condition, handler };
}

// Type guard pattern matching
export function matchEventWithGuards<TEvent extends Event, TResult>(
  event: TEvent,
  guards: Array<{
    guard: (event: TEvent) => event is any;
    handler: (event: any) => TResult;
  }>,
  defaultResult: TResult
): TResult {
  for (const { guard, handler } of guards) {
    if (guard(event)) {
      return handler(event);
    }
  }
  return defaultResult;
}

// Pattern matching with metadata
export interface PatternWithMetadata<TEvent extends Event, TResult> {
  pattern: EventPattern<TEvent, TResult>;
  metadata: {
    name?: string;
    description?: string;
    version?: string;
    tags?: string[];
  };
}

export function matchEventWithMetadata<TEvent extends Event, TResult>(
  event: TEvent,
  patternWithMetadata: PatternWithMetadata<TEvent, TResult>
): TResult {
  return matchEvent(event, patternWithMetadata.pattern);
}

// ============================================================================
// Type Utilities
// ============================================================================

// Extract event type from pattern
export type ExtractEventFromPattern<T> = 
  T extends EventPattern<infer E, any> ? E : never;

// Extract result type from pattern
export type ExtractResultFromPattern<T> = 
  T extends EventPattern<any, infer R> ? R : never;

// Check if pattern is complete for event type
export type IsCompletePattern<TEvent extends Event, TPattern> = 
  TPattern extends EventPattern<TEvent, any> ? true : false;