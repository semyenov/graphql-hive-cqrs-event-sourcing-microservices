/**
 * Framework Patterns: Advanced Matchers
 * 
 * Type-safe pattern matching utilities with exhaustive checking.
 * Built on ts-pattern for compile-time safety.
 */

import { match, P } from 'ts-pattern';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';

/**
 * Base discriminated union type
 */
export type Discriminated<T extends string = string> = {
  readonly type: T;
};

/**
 * Create an exhaustive matcher for discriminated unions
 * 
 * @example
 * ```typescript
 * const matcher = createExhaustiveMatcher<UserEvent>()
 *   .when('USER_CREATED', (event) => handleCreated(event))
 *   .when('USER_UPDATED', (event) => handleUpdated(event))
 *   .when('USER_DELETED', (event) => handleDeleted(event))
 *   .exhaustive();
 * ```
 */
export class ExhaustiveMatcher<T extends Discriminated, R = void> {
  private patterns: Partial<Record<T['type'], (value: T) => R>> = {};
  
  when<K extends T['type']>(
    type: K,
    handler: (value: Extract<T, { type: K }>) => R
  ): this {
    this.patterns[type] = handler as (value: T) => R;
    return this;
  }
  
  exhaustive(): (value: T) => R {
    return (value: T) => {
      const handler = this.patterns[value.type];
      if (!handler) {
        throw new Error(`No handler for type: ${value.type}`);
      }
      return handler(value);
    };
  }
  
  withDefault(defaultHandler: (value: T) => R): (value: T) => R {
    return (value: T) => {
      const handler = this.patterns[value.type];
      return handler ? handler(value) : defaultHandler(value);
    };
  }
}

export function createExhaustiveMatcher<T extends Discriminated, R = void>(): ExhaustiveMatcher<T, R> {
  return new ExhaustiveMatcher<T, R>();
}

/**
 * Event matcher with async support
 */
export class EventMatcher<T extends Discriminated> {
  private patterns: Array<{
    predicate: (event: T) => boolean;
    handler: (event: T) => Promise<void> | void;
  }> = [];
  
  on<K extends T['type']>(
    type: K,
    handler: (event: Extract<T, { type: K }>) => Promise<void> | void
  ): this {
    this.patterns.push({
      predicate: (event) => event.type === type,
      handler: handler as (event: T) => Promise<void> | void,
    });
    return this;
  }
  
  onPattern(
    pattern: (event: T) => boolean,
    handler: (event: T) => Promise<void> | void
  ): this {
    this.patterns.push({ predicate: pattern, handler });
    return this;
  }
  
  async match(event: T): Promise<void> {
    for (const { predicate, handler } of this.patterns) {
      if (predicate(event)) {
        await handler(event);
        return;
      }
    }
  }
  
  async matchAll(event: T): Promise<void> {
    const promises = this.patterns
      .filter(({ predicate }) => predicate(event))
      .map(({ handler }) => handler(event));
    await Promise.all(promises);
  }
}

export function createEventMatcher<T extends Discriminated>(): EventMatcher<T> {
  return new EventMatcher<T>();
}

/**
 * Pattern matching with Effect
 */
export class EffectMatcher<T extends Discriminated, E, R> {
  private patterns: Array<{
    predicate: (value: T) => boolean;
    handler: (value: T) => Effect.Effect<R, E, never>;
  }> = [];
  
  when<K extends T['type']>(
    type: K,
    handler: (value: Extract<T, { type: K }>) => Effect.Effect<R, E, never>
  ): this {
    this.patterns.push({
      predicate: (value) => value.type === type,
      handler: handler as (value: T) => Effect.Effect<R, E, never>,
    });
    return this;
  }
  
  match(value: T): Effect.Effect<R, E | Error, never> {
    const pattern = this.patterns.find(({ predicate }) => predicate(value));
    if (!pattern) {
      return Effect.fail(new Error(`No pattern matches type: ${value.type}`) as E | Error);
    }
    return pattern.handler(value);
  }
  
  matchOption(value: T): Effect.Effect<Option.Option<R>, E, never> {
    const pattern = this.patterns.find(({ predicate }) => predicate(value));
    if (!pattern) {
      return Effect.succeed(Option.none());
    }
    return pipe(
      pattern.handler(value),
      Effect.map(Option.some)
    );
  }
}

export function createEffectMatcher<T extends Discriminated, E = never, R = void>(): EffectMatcher<T, E, R> {
  return new EffectMatcher<T, E, R>();
}

/**
 * Advanced pattern matching utilities
 */
export const PatternUtils = {
  /**
   * Match multiple types at once
   */
  matchMultiple<T extends Discriminated, R>(
    types: T['type'][],
    handler: (value: T) => R
  ): (value: T) => R | undefined {
    return (value: T) => {
      if (types.includes(value.type)) {
        return handler(value);
      }
      return undefined;
    };
  },
  
  /**
   * Conditional matching
   */
  matchWhen<T extends Discriminated, R>(
    predicate: (value: T) => boolean,
    handler: (value: T) => R,
    fallback?: (value: T) => R
  ): (value: T) => R | undefined {
    return (value: T) => {
      if (predicate(value)) {
        return handler(value);
      }
      return fallback?.(value);
    };
  },
  
  /**
   * Sequential matching
   */
  matchSequence<T extends Discriminated, R>(
    ...matchers: Array<(value: T) => R | undefined>
  ): (value: T) => R | undefined {
    return (value: T) => {
      for (const matcher of matchers) {
        const result = matcher(value);
        if (result !== undefined) {
          return result;
        }
      }
      return undefined;
    };
  },
  
  /**
   * Parallel matching
   */
  async matchParallel<T extends Discriminated, R>(
    value: T,
    ...matchers: Array<(value: T) => Promise<R> | R>
  ): Promise<R[]> {
    return Promise.all(matchers.map(matcher => matcher(value)));
  },
};

/**
 * Pattern matching for complex scenarios
 */
export const AdvancedPatterns = {
  /**
   * Match with state accumulation
   */
  createStatefulMatcher<T extends Discriminated, S, R>(
    initialState: S
  ) {
    return {
      patterns: [] as Array<{
        predicate: (value: T, state: S) => boolean;
        handler: (value: T, state: S) => [R, S];
      }>,
      
      when(
        predicate: (value: T, state: S) => boolean,
        handler: (value: T, state: S) => [R, S]
      ) {
        this.patterns.push({ predicate, handler });
        return this;
      },
      
      match(value: T): [R, S] | undefined {
        let state = initialState;
        for (const { predicate, handler } of this.patterns) {
          if (predicate(value, state)) {
            const [result, newState] = handler(value, state);
            state = newState;
            return [result, state];
          }
        }
        return undefined;
      },
    };
  },
  
  /**
   * Temporal pattern matching
   */
  createTemporalMatcher<T extends Discriminated & { timestamp: number }>() {
    return {
      within(duration: number, handler: (events: T[]) => void) {
        return (events: T[]) => {
          const now = Date.now();
          const recent = events.filter(e => now - e.timestamp <= duration);
          if (recent.length > 0) {
            handler(recent);
          }
        };
      },
      
      sequence(
        ...types: T['type'][]
      ): (events: T[]) => boolean {
        return (events: T[]) => {
          if (events.length < types.length) return false;
          
          let typeIndex = 0;
          for (const event of events) {
            if (event.type === types[typeIndex]) {
              typeIndex++;
              if (typeIndex === types.length) return true;
            }
          }
          return false;
        };
      },
    };
  },
  
  /**
   * Correlation pattern matching
   */
  createCorrelationMatcher<T extends Discriminated & { correlationId?: string }>() {
    const correlations = new Map<string, T[]>();
    
    return {
      add(event: T) {
        if (event.correlationId) {
          const events = correlations.get(event.correlationId) || [];
          events.push(event);
          correlations.set(event.correlationId, events);
        }
      },
      
      matchCorrelated(
        correlationId: string,
        pattern: (events: T[]) => boolean
      ): boolean {
        const events = correlations.get(correlationId) || [];
        return pattern(events);
      },
      
      clear(correlationId: string) {
        correlations.delete(correlationId);
      },
    };
  },
};

/**
 * Type-safe pattern matching with ts-pattern integration
 */
export function matchEvent<T extends Discriminated, R>(
  event: T,
  patterns: {
    [K in T['type']]?: (event: Extract<T, { type: K }>) => R;
  } & {
    _?: (event: T) => R;
  }
): R {
  return match(event)
    .with(
      P.select(),
      (selected) => {
        const handler = patterns[selected.type as T['type']];
        if (handler) {
          return handler(selected as any);
        }
        if (patterns._) {
          return patterns._(selected);
        }
        throw new Error(`No handler for event type: ${selected.type}`);
      }
    )
    .exhaustive();
}

/**
 * Option pattern matching
 */
export function matchOption<T, R>(
  option: Option.Option<T>,
  patterns: {
    some: (value: T) => R;
    none: () => R;
  }
): R {
  return Option.match(option, patterns);
}

/**
 * Either pattern matching
 */
export function matchEither<E, A, R>(
  either: Either.Either<A, E>,
  patterns: {
    right: (value: A) => R;
    left: (error: E) => R;
  }
): R {
  return Either.match(either, patterns);
}