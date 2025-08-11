/**
 * Framework Patterns: Enhanced Reducers
 * 
 * Pattern-based reducers with exhaustive matching and compile-time safety.
 * Replaces switch statements with ts-pattern for better type inference.
 */

import { match, P } from 'ts-pattern';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import type { IEvent } from '../effect/core/types';

/**
 * Base reducer type
 */
export type Reducer<S, E> = (state: S, event: E) => S;

/**
 * Async reducer type
 */
export type AsyncReducer<S, E> = (state: S, event: E) => Promise<S>;

/**
 * Effect reducer type
 */
export type EffectReducer<S, E, Err = never> = (
  state: S,
  event: E
) => Effect.Effect<S, Err, never>;

/**
 * Pattern-based reducer builder
 * 
 * @example
 * ```typescript
 * const reducer = createPatternReducer<UserState, UserEvent>(initialState)
 *   .on('USER_CREATED', (state, event) => ({
 *     ...state,
 *     users: [...state.users, event.data.user]
 *   }))
 *   .on('USER_UPDATED', (state, event) => ({
 *     ...state,
 *     users: state.users.map(u => 
 *       u.id === event.data.id ? { ...u, ...event.data } : u
 *     )
 *   }))
 *   .on('USER_DELETED', (state, event) => ({
 *     ...state,
 *     users: state.users.filter(u => u.id !== event.data.id)
 *   }))
 *   .build();
 * ```
 */
export class PatternReducerBuilder<S, E extends { type: string }> {
  private patterns: Array<{
    type: E['type'];
    reducer: (state: S, event: E) => S;
  }> = [];
  
  constructor(private initialState: S) {}
  
  on<T extends E['type']>(
    type: T,
    reducer: (state: S, event: Extract<E, { type: T }>) => S
  ): this {
    this.patterns.push({
      type,
      reducer: reducer as (state: S, event: E) => S,
    });
    return this;
  }
  
  onMultiple<T extends E['type']>(
    types: T[],
    reducer: (state: S, event: Extract<E, { type: T }>) => S
  ): this {
    types.forEach(type => {
      this.patterns.push({
        type,
        reducer: reducer as (state: S, event: E) => S,
      });
    });
    return this;
  }
  
  onPattern(
    predicate: (event: E) => boolean,
    reducer: (state: S, event: E) => S
  ): this {
    // Store pattern-based reducers separately
    const originalBuild = this.build.bind(this);
    this.build = () => {
      const baseReducer = originalBuild();
      return (state: S = this.initialState, event: E): S => {
        if (predicate(event)) {
          return reducer(state, event);
        }
        return baseReducer(state, event);
      };
    };
    return this;
  }
  
  withDefault(defaultReducer: (state: S, event: E) => S): this {
    const originalBuild = this.build.bind(this);
    this.build = () => {
      const baseReducer = originalBuild();
      return (state: S = this.initialState, event: E): S => {
        const pattern = this.patterns.find(p => p.type === event.type);
        if (pattern) {
          return pattern.reducer(state, event);
        }
        return defaultReducer(state, event);
      };
    };
    return this;
  }
  
  build(): Reducer<S, E> {
    return (state: S = this.initialState, event: E): S => {
      const pattern = this.patterns.find(p => p.type === event.type);
      if (pattern) {
        return pattern.reducer(state, event);
      }
      
      // No pattern matched, return unchanged state
      console.warn(`No reducer pattern for event type: ${event.type}`);
      return state;
    };
  }
  
  buildExhaustive(): Reducer<S, E> {
    return (state: S = this.initialState, event: E): S => {
      const pattern = this.patterns.find(p => p.type === event.type);
      if (!pattern) {
        throw new Error(
          `Exhaustive reducer missing handler for event type: ${event.type}`
        );
      }
      return pattern.reducer(state, event);
    };
  }
}

export function createPatternReducer<S, E extends { type: string }>(
  initialState: S
): PatternReducerBuilder<S, E> {
  return new PatternReducerBuilder(initialState);
}

/**
 * Async reducer builder
 */
export class AsyncReducerBuilder<S, E extends { type: string }> {
  private patterns: Array<{
    type: E['type'];
    reducer: (state: S, event: E) => Promise<S>;
  }> = [];
  
  constructor(private initialState: S) {}
  
  on<T extends E['type']>(
    type: T,
    reducer: (state: S, event: Extract<E, { type: T }>) => Promise<S>
  ): this {
    this.patterns.push({
      type,
      reducer: reducer as (state: S, event: E) => Promise<S>,
    });
    return this;
  }
  
  build(): AsyncReducer<S, E> {
    return async (state: S = this.initialState, event: E): Promise<S> => {
      const pattern = this.patterns.find(p => p.type === event.type);
      if (pattern) {
        return pattern.reducer(state, event);
      }
      return state;
    };
  }
}

export function createAsyncReducer<S, E extends { type: string }>(
  initialState: S
): AsyncReducerBuilder<S, E> {
  return new AsyncReducerBuilder(initialState);
}

/**
 * Effect-based reducer builder
 */
export class EffectReducerBuilder<S, E extends { type: string }, Err = never> {
  private patterns: Array<{
    type: E['type'];
    reducer: (state: S, event: E) => Effect.Effect<S, Err, never>;
  }> = [];
  
  constructor(private initialState: S) {}
  
  on<T extends E['type']>(
    type: T,
    reducer: (state: S, event: Extract<E, { type: T }>) => Effect.Effect<S, Err, never>
  ): this {
    this.patterns.push({
      type,
      reducer: reducer as (state: S, event: E) => Effect.Effect<S, Err, never>,
    });
    return this;
  }
  
  build(): EffectReducer<S, E, Err> {
    return (state: S = this.initialState, event: E): Effect.Effect<S, Err, never> => {
      const pattern = this.patterns.find(p => p.type === event.type);
      if (pattern) {
        return pattern.reducer(state, event);
      }
      return Effect.succeed(state);
    };
  }
}

export function createEffectReducer<S, E extends { type: string }, Err = never>(
  initialState: S
): EffectReducerBuilder<S, E, Err> {
  return new EffectReducerBuilder(initialState);
}

/**
 * Advanced reducer patterns
 */
export const ReducerPatterns = {
  /**
   * Combine multiple reducers
   */
  combine<S, E>(...reducers: Reducer<S, E>[]): Reducer<S, E> {
    return (state: S, event: E): S => {
      return reducers.reduce((acc, reducer) => reducer(acc, event), state);
    };
  },
  
  /**
   * Slice reducer for nested state
   */
  slice<S, K extends keyof S, E>(
    key: K,
    reducer: Reducer<S[K], E>
  ): Reducer<S, E> {
    return (state: S, event: E): S => ({
      ...state,
      [key]: reducer(state[key], event),
    });
  },
  
  /**
   * Conditional reducer
   */
  when<S, E>(
    predicate: (event: E) => boolean,
    reducer: Reducer<S, E>
  ): Reducer<S, E> {
    return (state: S, event: E): S => {
      if (predicate(event)) {
        return reducer(state, event);
      }
      return state;
    };
  },
  
  /**
   * Reducer with middleware
   */
  withMiddleware<S, E>(
    reducer: Reducer<S, E>,
    middleware: {
      before?: (state: S, event: E) => void;
      after?: (state: S, event: E, newState: S) => void;
    }
  ): Reducer<S, E> {
    return (state: S, event: E): S => {
      middleware.before?.(state, event);
      const newState = reducer(state, event);
      middleware.after?.(state, event, newState);
      return newState;
    };
  },
  
  /**
   * Reducer with validation
   */
  withValidation<S, E>(
    reducer: Reducer<S, E>,
    validate: (state: S) => boolean | string
  ): Reducer<S, E> {
    return (state: S, event: E): S => {
      const newState = reducer(state, event);
      const validation = validate(newState);
      
      if (validation === true) {
        return newState;
      }
      
      if (validation === false) {
        throw new Error('State validation failed');
      }
      
      throw new Error(`State validation failed: ${validation}`);
    };
  },
};

/**
 * ts-pattern based reducer for maximum type safety
 */
export function createTsPatternReducer<S, E extends { type: string }>(
  initialState: S
) {
  return <R extends Record<E['type'], (state: S, event: Extract<E, { type: E['type'] }>) => S>>(
    patterns: R
  ): Reducer<S, E> => {
    return (state: S = initialState, event: E): S => {
      return match(event)
        .with(P.select(), (selected) => {
          const handler = patterns[selected.type as E['type']];
          if (handler) {
            return handler(state, selected as any);
          }
          return state;
        })
        .exhaustive();
    };
  };
}

/**
 * State machine reducer pattern
 */
export interface StateMachine<S extends string, E extends { type: string }> {
  states: S[];
  initialState: S;
  transitions: {
    [K in S]: {
      [T in E['type']]?: S;
    };
  };
}

export function createStateMachineReducer<
  S extends string,
  E extends { type: string },
  State extends { status: S }
>(
  machine: StateMachine<S, E>,
  stateReducer?: (state: State, event: E, nextStatus: S) => State
): Reducer<State, E> {
  return (state: State, event: E): State => {
    const currentStatus = state.status;
    const transitions = machine.transitions[currentStatus];
    
    if (!transitions) {
      return state;
    }
    
    const nextStatus = transitions[event.type];
    
    if (!nextStatus) {
      return state;
    }
    
    if (stateReducer) {
      return stateReducer(state, event, nextStatus);
    }
    
    return {
      ...state,
      status: nextStatus,
    };
  };
}

/**
 * Event sourcing reducer with snapshots
 */
export class EventSourcingReducer<S, E extends IEvent> {
  constructor(
    private reducer: Reducer<S, E>,
    private initialState: S,
    private snapshotFrequency: number = 10
  ) {}
  
  reduce(events: E[], fromSnapshot?: { state: S; version: number }): S {
    let state = fromSnapshot?.state ?? this.initialState;
    const startIndex = fromSnapshot?.version ?? 0;
    
    const eventsToApply = events.slice(startIndex);
    
    return eventsToApply.reduce((acc, event) => {
      return this.reducer(acc, event);
    }, state);
  }
  
  shouldSnapshot(version: number): boolean {
    return version % this.snapshotFrequency === 0;
  }
}