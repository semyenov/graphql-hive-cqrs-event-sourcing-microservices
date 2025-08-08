// Pattern matching system for events
import type { Event } from './events';

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

// Async pattern matching
export type AsyncEventPattern<TEvent extends Event, TResult> = {
  [K in TEvent['type']]: (
    event: Extract<TEvent, { type: K }>
  ) => Promise<TResult>;
};

// Partial async pattern matching
export type PartialAsyncEventPattern<TEvent extends Event, TResult> = Partial<AsyncEventPattern<TEvent, TResult>> & {
  _default?: (event: TEvent) => Promise<TResult>;
};

// Conditional pattern with guards
export type ConditionalPattern<TEvent extends Event, TResult> = {
  when: (event: TEvent) => boolean;
  then: (event: TEvent) => TResult;
};

// Priority pattern for ordered matching
export type PriorityPattern<TEvent extends Event, TResult> = {
  priority: number;
  pattern: ConditionalPattern<TEvent, TResult>;
};

// ============================================================================
// Pattern Matching Helpers
// ============================================================================

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

// Async pattern matching
export const matchEventAsync = async <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: AsyncEventPattern<TEvent, TResult>
): Promise<TResult> => {
  const handler = patterns[event.type as TEvent['type']];
  return handler(event as Extract<TEvent, { type: TEvent['type'] }>);
};

// Partial async pattern matching with default
export const matchEventPartialAsync = async <TEvent extends Event, TResult>(
  event: TEvent,
  patterns: PartialAsyncEventPattern<TEvent, TResult>,
  defaultResult: TResult
): Promise<TResult> => {
  const handler = patterns[event.type as TEvent['type']] || patterns._default;
  return handler ? await handler(event as Extract<TEvent, { type: TEvent['type'] }>) : defaultResult;
};

// ============================================================================
// Pattern Builder
// ============================================================================

export class EventPatternBuilder<TEvent extends Event, TResult> {
  private patterns: PartialEventPattern<TEvent, TResult> = {};
  
  on<TType extends TEvent['type']>(
    type: TType,
    handler: (event: Extract<TEvent, { type: TType }>) => TResult
  ): this {
    this.patterns[type] = handler as any;
    return this;
  }
  
  default(handler: (event: TEvent) => TResult): this {
    this.patterns._default = handler;
    return this;
  }
  
  build(): PartialEventPattern<TEvent, TResult> {
    return this.patterns;
  }
  
  match(event: TEvent, defaultResult: TResult): TResult {
    return matchEventPartial(event, this.patterns, defaultResult);
  }
}

// ============================================================================
// Conditional Pattern Matching
// ============================================================================

export class ConditionalPatternMatcher<TEvent extends Event, TResult> {
  private patterns: ConditionalPattern<TEvent, TResult>[] = [];
  
  when(predicate: (event: TEvent) => boolean): {
    then: (handler: (event: TEvent) => TResult) => ConditionalPatternMatcher<TEvent, TResult>;
  } {
    return {
      then: (handler: (event: TEvent) => TResult) => {
        this.patterns.push({ when: predicate, then: handler });
        return this;
      },
    };
  }
  
  match(event: TEvent, defaultResult: TResult): TResult {
    for (const pattern of this.patterns) {
      if (pattern.when(event)) {
        return pattern.then(event);
      }
    }
    return defaultResult;
  }
  
  matchAll(event: TEvent): TResult[] {
    return this.patterns
      .filter(pattern => pattern.when(event))
      .map(pattern => pattern.then(event));
  }
}

// ============================================================================
// Priority Pattern Matching
// ============================================================================

export class PriorityPatternMatcher<TEvent extends Event, TResult> {
  private patterns: PriorityPattern<TEvent, TResult>[] = [];
  
  add(
    priority: number,
    predicate: (event: TEvent) => boolean,
    handler: (event: TEvent) => TResult
  ): this {
    this.patterns.push({
      priority,
      pattern: { when: predicate, then: handler },
    });
    // Sort by priority (higher priority first)
    this.patterns.sort((a, b) => b.priority - a.priority);
    return this;
  }
  
  match(event: TEvent, defaultResult: TResult): TResult {
    for (const { pattern } of this.patterns) {
      if (pattern.when(event)) {
        return pattern.then(event);
      }
    }
    return defaultResult;
  }
  
  matchWithPriority(event: TEvent): { result: TResult; priority: number } | null {
    for (const { priority, pattern } of this.patterns) {
      if (pattern.when(event)) {
        return { result: pattern.then(event), priority };
      }
    }
    return null;
  }
}

// ============================================================================
// Pattern Composition
// ============================================================================

export const composePatterns = <TEvent extends Event, TResult>(
  ...matchers: Array<(event: TEvent) => TResult | undefined>
): (event: TEvent) => TResult | undefined => {
  return (event: TEvent) => {
    for (const matcher of matchers) {
      const result = matcher(event);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };
};

// Create a pattern from a type guard
export const fromTypeGuard = <TEvent extends Event, TSpecific extends TEvent, TResult>(
  guard: (event: TEvent) => event is TSpecific,
  handler: (event: TSpecific) => TResult
): (event: TEvent) => TResult | undefined => {
  return (event: TEvent) => {
    if (guard(event)) {
      return handler(event);
    }
    return undefined;
  };
};

// ============================================================================
// Utility Functions
// ============================================================================

// Create a pattern that matches multiple event types
export const matchMultipleTypes = <TEvent extends Event, TResult>(
  types: TEvent['type'][],
  handler: (event: TEvent) => TResult
): ConditionalPattern<TEvent, TResult> => ({
  when: (event) => types.includes(event.type),
  then: handler,
});

// Create a pattern that matches events by aggregate ID
export const matchByAggregateId = <TEvent extends Event, TResult>(
  aggregateId: string,
  handler: (event: TEvent) => TResult
): ConditionalPattern<TEvent, TResult> => ({
  when: (event) => String(event.aggregateId) === aggregateId,
  then: handler,
});

// Create a pattern that matches events within a version range
export const matchByVersionRange = <TEvent extends Event, TResult>(
  minVersion: number,
  maxVersion: number,
  handler: (event: TEvent) => TResult
): ConditionalPattern<TEvent, TResult> => ({
  when: (event) => {
    const version = typeof event.version === 'number' ? event.version : (event.version as unknown as number);
    return version >= minVersion && version <= maxVersion;
  },
  then: handler,
});