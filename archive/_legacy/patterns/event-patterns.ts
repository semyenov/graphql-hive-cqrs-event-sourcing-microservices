/**
 * Framework Patterns: Event Pattern Matching
 * 
 * Type-safe event handling with exhaustive pattern matching.
 */

import { match, P } from 'ts-pattern';
import type { IEvent, EventReducer } from '../core/event';

/**
 * Create an event reducer using pattern matching
 */
export function createPatternReducer<TEvent extends IEvent, TState>(
  patterns: {
    [K in TEvent['type']]: (
      state: TState | undefined,
      event: Extract<TEvent, { type: K }>
    ) => TState;
  }
): EventReducer<TEvent, TState> {
  return (state: TState | undefined, event: TEvent): TState => {
    return match(event)
      .when(
        (e): e is TEvent => e.type in patterns,
        (e) => patterns[e.type as TEvent['type']](state, e as any)
      )
      .otherwise(() => {
        if (state === undefined) {
          throw new Error(`No handler for event type: ${event.type} and no initial state`);
        }
        return state;
      });
  };
}

/**
 * Create an event handler using pattern matching
 */
export function createPatternHandler<TEvent extends IEvent>(
  patterns: Partial<{
    [K in TEvent['type']]: (event: Extract<TEvent, { type: K }>) => void | Promise<void>;
  }> & {
    _default?: (event: TEvent) => void | Promise<void>;
  }
) {
  return async (event: TEvent): Promise<void> => {
    await match(event)
      .when(
        (e): e is TEvent => e.type in patterns,
        async (e) => {
          const handler = patterns[e.type as TEvent['type']];
          if (handler) {
            await handler(e as any);
          }
        }
      )
      .otherwise(async (e) => {
        if (patterns._default) {
          await patterns._default(e);
        }
      });
  };
}

/**
 * Event pattern builder for fluent API
 */
export class EventPatternBuilder<TEvent extends IEvent, TState> {
  private patterns: Partial<{
    [K in TEvent['type']]: (
      state: TState | undefined,
      event: Extract<TEvent, { type: K }>
    ) => TState;
  }> = {};
  
  private defaultHandler?: (state: TState | undefined, event: TEvent) => TState;

  on<K extends TEvent['type']>(
    type: K,
    handler: (state: TState | undefined, event: Extract<TEvent, { type: K }>) => TState
  ): this {
    this.patterns[type] = handler as any;
    return this;
  }

  default(handler: (state: TState | undefined, event: TEvent) => TState): this {
    this.defaultHandler = handler;
    return this;
  }

  build(): EventReducer<TEvent, TState> {
    return (state: TState | undefined, event: TEvent): TState => {
      return match(event)
        .when(
          (e): e is TEvent => e.type in this.patterns,
          (e) => {
            const handler = this.patterns[e.type as TEvent['type']];
            return handler ? handler(state, e as any) : state!;
          }
        )
        .otherwise((e) => 
          this.defaultHandler ? this.defaultHandler(state, e) : state!
        );
    };
  }
}

/**
 * Create event pattern builder
 */
export function eventPattern<TEvent extends IEvent, TState>() {
  return new EventPatternBuilder<TEvent, TState>();
}

/**
 * Match event with specific patterns
 */
export function matchEvent<TEvent extends IEvent, TResult>(
  event: TEvent,
  patterns: {
    [K in TEvent['type']]?: (event: Extract<TEvent, { type: K }>) => TResult;
  } & {
    _?: (event: TEvent) => TResult;
  }
): TResult | undefined {
  return match(event)
    .when(
      (e): e is TEvent => e.type in patterns,
      (e) => {
        const handler = patterns[e.type as TEvent['type']];
        return handler ? handler(e as any) : undefined;
      }
    )
    .otherwise((e) => patterns._ ? patterns._(e) : undefined);
}

/**
 * Type guard patterns for events
 */
export function isEventType<TEvent extends IEvent, K extends TEvent['type']>(
  event: TEvent,
  type: K
): event is Extract<TEvent, { type: K }> {
  return event.type === type;
}

/**
 * Multi-event matcher
 */
export function matchEvents<TEvent extends IEvent, TResult>(
  events: TEvent[],
  patterns: {
    sequence?: (events: TEvent[]) => TResult;
    parallel?: (events: TEvent[]) => TResult;
    any?: (event: TEvent) => TResult;
  }
): TResult[] {
  if (patterns.sequence) {
    return [patterns.sequence(events)];
  }
  if (patterns.parallel) {
    return [patterns.parallel(events)];
  }
  if (patterns.any) {
    return events.map(patterns.any);
  }
  return [];
}