/**
 * Framework Patterns: Enhanced Reducers
 * 
 * Advanced reducer patterns using ts-pattern for better type safety and readability.
 */

import { match, P } from 'ts-pattern';
import type { IEvent, EventReducer } from '../core/event';

/**
 * Create a reducer with exhaustive pattern matching
 */
export function exhaustiveReducer<TEvent extends IEvent, TState>(
  initialState: TState,
  patterns: {
    [K in TEvent['type']]: (
      state: TState,
      event: Extract<TEvent, { type: K }>
    ) => TState;
  }
): EventReducer<TEvent, TState> {
  return (state = initialState, event) => {
    // This ensures all event types are handled at compile time
    const eventType = event.type as TEvent['type'];
    const handler = patterns[eventType];
    
    if (!handler) {
      // This should never happen if patterns is exhaustive
      console.warn(`No handler for event type: ${eventType}`);
      return state;
    }
    
    return handler(state, event as any);
  };
}

/**
 * Create a reducer with partial matching and default fallback
 */
export function partialReducer<TEvent extends IEvent, TState>(
  initialState: TState,
  patterns: Partial<{
    [K in TEvent['type']]: (
      state: TState,
      event: Extract<TEvent, { type: K }>
    ) => TState;
  }>,
  defaultHandler?: (state: TState, event: TEvent) => TState
): EventReducer<TEvent, TState> {
  return (state = initialState, event) => {
    return match(event)
      .when(
        (e): e is TEvent => e.type in patterns,
        (e) => {
          const handler = patterns[e.type as TEvent['type']]!;
          return handler(state, e as any);
        }
      )
      .otherwise((e) => 
        defaultHandler ? defaultHandler(state, e) : state
      );
  };
}

/**
 * Combine multiple reducers into one
 */
export function combineReducers<TEvent extends IEvent, TState extends Record<string, any>>(
  reducers: {
    [K in keyof TState]: EventReducer<TEvent, TState[K]>;
  }
): EventReducer<TEvent, TState> {
  return (state, event) => {
    const nextState = {} as TState;
    let hasChanged = false;
    
    for (const key in reducers) {
      const reducer = reducers[key];
      const previousStateForKey = state ? state[key] : undefined;
      const nextStateForKey = reducer(previousStateForKey, event);
      
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    
    return hasChanged ? nextState : (state || nextState);
  };
}

/**
 * Create a reducer that handles event sequences
 */
export function sequenceReducer<TEvent extends IEvent, TState>(
  initialState: TState,
  sequences: Array<{
    pattern: TEvent['type'][];
    reducer: (state: TState, events: TEvent[]) => TState;
  }>
): (state: TState, events: TEvent[]) => TState {
  return (state = initialState, events) => {
    const types = events.map(e => e.type);
    
    const sequence = sequences.find(s => 
      JSON.stringify(s.pattern) === JSON.stringify(types)
    );
    
    if (sequence) {
      return sequence.reducer(state, events);
    }
    
    // Fall back to returning state unchanged
    return state;
  };
}

/**
 * Time-based reducer that considers event timestamps
 */
export function timeAwareReducer<TEvent extends IEvent, TState>(
  initialState: TState,
  patterns: {
    [K in TEvent['type']]: (
      state: TState,
      event: Extract<TEvent, { type: K }>,
      timeDelta: number
    ) => TState;
  }
): EventReducer<TEvent, TState> {
  let lastTimestamp: number | null = null;
  
  return (state = initialState, event) => {
    // Convert timestamp to number (it's a branded string)
    const currentTimestamp = Date.parse(String(event.timestamp));
    const timeDelta = lastTimestamp 
      ? currentTimestamp - lastTimestamp
      : 0;
    
    lastTimestamp = currentTimestamp;
    
    const handler = patterns[event.type as TEvent['type']];
    if (!handler) {
      return state;
    }
    
    return handler(state, event as any, timeDelta);
  };
}

/**
 * Conditional reducer based on state
 */
export function conditionalReducer<TEvent extends IEvent, TState>(
  initialState: TState,
  conditions: Array<{
    when: (state: TState) => boolean;
    reducer: EventReducer<TEvent, TState>;
  }>,
  fallback: EventReducer<TEvent, TState>
): EventReducer<TEvent, TState> {
  return (state = initialState, event) => {
    const condition = conditions.find(c => c.when(state));
    
    if (condition) {
      return condition.reducer(state, event);
    }
    
    return fallback(state, event);
  };
}

/**
 * Reducer with side effects
 */
export function effectfulReducer<TEvent extends IEvent, TState>(
  reducer: EventReducer<TEvent, TState>,
  effects: Partial<{
    [K in TEvent['type']]: (
      state: TState,
      event: Extract<TEvent, { type: K }>
    ) => void | Promise<void>;
  }>
): EventReducer<TEvent, TState> {
  return (state, event) => {
    const newState = reducer(state, event);
    
    const effect = effects[event.type as TEvent['type']];
    if (effect) {
      // Run effect asynchronously without blocking
      Promise.resolve(effect(newState, event as any)).catch(console.error);
    }
    
    return newState;
  };
}

/**
 * Memoized reducer for performance
 * Note: Only works with object states due to WeakMap constraints
 */
export function memoizedReducer<TEvent extends IEvent, TState extends object>(
  reducer: EventReducer<TEvent, TState>
): EventReducer<TEvent, TState> {
  const cache = new WeakMap<TEvent, Map<TState | undefined, TState>>();
  
  return (state, event) => {
    if (!cache.has(event)) {
      cache.set(event, new Map());
    }
    
    const eventCache = cache.get(event)!;
    
    // For undefined state, use a special key
    const stateKey = state ?? ({} as TState);
    
    if (eventCache.has(stateKey)) {
      return eventCache.get(stateKey)!;
    }
    
    const newState = reducer(state, event);
    eventCache.set(stateKey, newState);
    
    return newState;
  };
}