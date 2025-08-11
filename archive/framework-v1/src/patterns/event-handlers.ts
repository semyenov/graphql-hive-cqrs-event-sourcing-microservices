/**
 * Framework Patterns: Event Handler Patterns
 * 
 * Pattern-based event routing and handling with compile-time safety.
 * Supports complex event flows, correlation, and temporal patterns.
 */

import { match, P } from 'ts-pattern';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import { pipe } from 'effect/Function';
import type { IEvent, EventHandler } from '../effect/core/types';

/**
 * Event router with pattern matching
 * 
 * @example
 * ```typescript
 * const router = createEventRouter<UserEvent>()
 *   .route('USER_CREATED', handleUserCreated)
 *   .route('USER_UPDATED', handleUserUpdated)
 *   .route('USER_DELETED', handleUserDeleted)
 *   .routePattern(
 *     (event) => event.type.startsWith('USER_'),
 *     handleUserEvent
 *   )
 *   .build();
 * ```
 */
export class EventRouter<E extends IEvent> {
  private routes: Array<{
    predicate: (event: E) => boolean;
    handler: EventHandler<E>;
    priority?: number;
  }> = [];
  
  route<T extends E['type']>(
    type: T,
    handler: EventHandler<Extract<E, { type: T }>>
  ): this {
    this.routes.push({
      predicate: (event) => event.type === type,
      handler: handler as EventHandler<E>,
      priority: 0,
    });
    return this;
  }
  
  routeMultiple<T extends E['type']>(
    types: T[],
    handler: EventHandler<Extract<E, { type: T }>>
  ): this {
    this.routes.push({
      predicate: (event) => types.includes(event.type as T),
      handler: handler as EventHandler<E>,
      priority: 0,
    });
    return this;
  }
  
  routePattern(
    predicate: (event: E) => boolean,
    handler: EventHandler<E>,
    priority: number = 0
  ): this {
    this.routes.push({ predicate, handler, priority });
    return this;
  }
  
  build(): EventHandler<E> {
    // Sort routes by priority (higher priority first)
    const sortedRoutes = [...this.routes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    return async (event: E): Promise<void> => {
      const matchingRoutes = sortedRoutes.filter(route => route.predicate(event));
      
      // Execute all matching handlers
      await Promise.all(matchingRoutes.map(route => route.handler(event)));
    };
  }
  
  buildExclusive(): EventHandler<E> {
    // Only execute the first matching handler
    const sortedRoutes = [...this.routes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    return async (event: E): Promise<void> => {
      const matchingRoute = sortedRoutes.find(route => route.predicate(event));
      
      if (matchingRoute) {
        await matchingRoute.handler(event);
      }
    };
  }
}

export function createEventRouter<E extends IEvent>(): EventRouter<E> {
  return new EventRouter<E>();
}

/**
 * Effect-based event handler builder
 */
export class EffectEventHandler<E extends IEvent, R, Err> {
  private handlers: Array<{
    predicate: (event: E) => boolean;
    effect: (event: E) => Effect.Effect<void, Err, R>;
  }> = [];
  
  handle<T extends E['type']>(
    type: T,
    effect: (event: Extract<E, { type: T }>) => Effect.Effect<void, Err, R>
  ): this {
    this.handlers.push({
      predicate: (event) => event.type === type,
      effect: effect as (event: E) => Effect.Effect<void, Err, R>,
    });
    return this;
  }
  
  handlePattern(
    predicate: (event: E) => boolean,
    effect: (event: E) => Effect.Effect<void, Err, R>
  ): this {
    this.handlers.push({ predicate, effect });
    return this;
  }
  
  build(): (event: E) => Effect.Effect<void, Err, R> {
    return (event: E) => {
      const handlers = this.handlers.filter(h => h.predicate(event));
      
      if (handlers.length === 0) {
        return Effect.succeed(undefined);
      }
      
      // Execute all matching handlers in parallel
      return pipe(
        Effect.all(handlers.map(h => h.effect(event))),
        Effect.map(() => undefined)
      );
    };
  }
  
  buildSequential(): (event: E) => Effect.Effect<void, Err, R> {
    return (event: E) => {
      const handlers = this.handlers.filter(h => h.predicate(event));
      
      if (handlers.length === 0) {
        return Effect.succeed(undefined);
      }
      
      // Execute handlers sequentially
      return handlers.reduce(
        (acc, handler) => pipe(acc, Effect.flatMap(() => handler.effect(event))),
        Effect.succeed(undefined) as Effect.Effect<void, Err, R>
      );
    };
  }
}

export function createEffectEventHandler<E extends IEvent, R = never, Err = never>(): EffectEventHandler<E, R, Err> {
  return new EffectEventHandler<E, R, Err>();
}

/**
 * Event saga pattern for complex workflows
 */
export class EventSaga<E extends IEvent> {
  private steps: Array<{
    name: string;
    predicate: (event: E) => boolean;
    handler: (event: E, context: any) => Promise<void>;
    compensate?: (event: E, context: any) => Promise<void>;
  }> = [];
  
  step(
    name: string,
    predicate: (event: E) => boolean,
    handler: (event: E, context: any) => Promise<void>,
    compensate?: (event: E, context: any) => Promise<void>
  ): this {
    this.steps.push({ name, predicate, handler, compensate });
    return this;
  }
  
  async execute(event: E, context: any = {}): Promise<void> {
    const executedSteps: typeof this.steps = [];
    
    try {
      for (const step of this.steps) {
        if (step.predicate(event)) {
          await step.handler(event, context);
          executedSteps.push(step);
        }
      }
    } catch (error) {
      // Compensate in reverse order
      for (const step of executedSteps.reverse()) {
        if (step.compensate) {
          try {
            await step.compensate(event, context);
          } catch (compensateError) {
            console.error(`Failed to compensate step ${step.name}:`, compensateError);
          }
        }
      }
      throw error;
    }
  }
}

export function createEventSaga<E extends IEvent>(): EventSaga<E> {
  return new EventSaga<E>();
}

/**
 * Event stream processor with patterns
 */
export class EventStreamProcessor<E extends IEvent> {
  private processors: Array<{
    name: string;
    stream: (events: Stream.Stream<E, never, never>) => Stream.Stream<any, never, never>;
  }> = [];
  
  process(
    name: string,
    processor: (events: Stream.Stream<E, never, never>) => Stream.Stream<any, never, never>
  ): this {
    this.processors.push({ name, stream: processor });
    return this;
  }
  
  filter<T extends E['type']>(
    type: T
  ): (events: Stream.Stream<E, never, never>) => Stream.Stream<Extract<E, { type: T }>, never, never> {
    return (events) => Stream.filter(events, (event): event is Extract<E, { type: T }> => event.type === type);
  }
  
  map<R>(
    mapper: (event: E) => R
  ): (events: Stream.Stream<E, never, never>) => Stream.Stream<R, never, never> {
    return (events) => Stream.map(events, mapper);
  }
  
  batch(
    size: number,
    duration?: number
  ): (events: Stream.Stream<E, never, never>) => Stream.Stream<E[], never, never> {
    return (events) => Stream.groupedWithin(events, size, Duration.millis(duration ?? 1000));
  }
  
  build(): (events: Stream.Stream<E, never, never>) => Stream.Stream<any, never, never> {
    return (events) => {
      return this.processors.reduce(
        (stream, processor) => processor.stream(stream),
        events as Stream.Stream<any, never, never>
      );
    };
  }
}

export function createEventStreamProcessor<E extends IEvent>(): EventStreamProcessor<E> {
  return new EventStreamProcessor<E>();
}

/**
 * Complex event processing patterns
 */
export const ComplexEventPatterns = {
  /**
   * Correlation pattern - group events by correlation ID
   */
  createCorrelationProcessor<E extends IEvent & { correlationId?: string }>() {
    return Effect.gen(function* (_) {
      const correlations = yield* _(Ref.make(new Map<string, E[]>()));
      
      return {
        process: (event: E) =>
          Effect.gen(function* (_) {
            if (event.correlationId) {
              yield* _(
                Ref.update(correlations, (map) => {
                  const events = map.get(event.correlationId!) || [];
                  events.push(event);
                  map.set(event.correlationId!, events);
                  return new Map(map);
                })
              );
            }
          }),
        
        getCorrelated: (correlationId: string) =>
          pipe(
            Ref.get(correlations),
            Effect.map((map) => map.get(correlationId) || [])
          ),
        
        clearCorrelated: (correlationId: string) =>
          Ref.update(correlations, (map) => {
            map.delete(correlationId);
            return new Map(map);
          }),
      };
    });
  },
  
  /**
   * Window pattern - process events within time windows
   */
  createWindowProcessor<E extends IEvent & { timestamp: number }>(
    windowSize: number,
    slideInterval?: number
  ) {
    return {
      process: (events: E[]): E[][] => {
        const windows: E[][] = [];
        const slide = slideInterval ?? windowSize;
        
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        if (events.length === 0) return windows;
        
        const startTime = events[0].timestamp;
        const endTime = events[events.length - 1].timestamp;
        
        for (let windowStart = startTime; windowStart <= endTime; windowStart += slide) {
          const windowEnd = windowStart + windowSize;
          const windowEvents = events.filter(
            (e) => e.timestamp >= windowStart && e.timestamp < windowEnd
          );
          
          if (windowEvents.length > 0) {
            windows.push(windowEvents);
          }
        }
        
        return windows;
      },
    };
  },
  
  /**
   * Join pattern - join events from different streams
   */
  createJoinProcessor<E1 extends IEvent, E2 extends IEvent, K>(
    keyExtractor1: (event: E1) => K,
    keyExtractor2: (event: E2) => K,
    joinWindow: number
  ) {
    return {
      join: (events1: E1[], events2: E2[]): Array<[E1, E2]> => {
        const joined: Array<[E1, E2]> = [];
        
        for (const e1 of events1) {
          const key1 = keyExtractor1(e1);
          
          for (const e2 of events2) {
            const key2 = keyExtractor2(e2);
            
            if (key1 === key2) {
              // Check if events are within join window
              const timeDiff = Math.abs(
                (e1 as any).timestamp - (e2 as any).timestamp
              );
              
              if (timeDiff <= joinWindow) {
                joined.push([e1, e2]);
              }
            }
          }
        }
        
        return joined;
      },
    };
  },
};

import * as Duration from 'effect/Duration';