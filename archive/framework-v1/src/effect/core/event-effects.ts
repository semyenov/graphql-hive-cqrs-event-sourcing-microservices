/**
 * Framework Effect: Event Effects
 * 
 * Event processing with Effect-TS including streaming, 
 * projections, and event sourcing patterns.
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Queue from 'effect/Queue';
import * as Fiber from 'effect/Fiber';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';
import type { IEvent, IEventStore, EventHandler } from './types';
import type { AggregateId, AggregateVersion } from '../../core/branded/types';

/**
 * Event processing context
 */
export interface EventContext {
  readonly eventStore: IEventStore<any, any>;
  readonly projections: Map<string, any>;
}

/**
 * Event context tag for dependency injection
 */
export const EventContext = Context.GenericTag<EventContext>('EventContext');

/**
 * Event processing errors
 */
export class EventProcessingError extends Data.TaggedError('EventProcessingError')<{
  readonly event: IEvent;
  readonly cause: unknown;
}> {}

export class EventVersionConflict extends Data.TaggedError('EventVersionConflict')<{
  readonly aggregateId: AggregateId;
  readonly expectedversion: AggregateVersion;
  readonly actualversion: AggregateVersion;
}> {}

export class ProjectionError extends Data.TaggedError('ProjectionError')<{
  readonly projectionName: string;
  readonly event: IEvent;
  readonly cause: unknown;
}> {}

export type EventError = 
  | EventProcessingError 
  | EventVersionConflict 
  | ProjectionError;

/**
 * Effect-based event handler
 */
export interface EffectEventHandler<TEvent extends IEvent> {
  readonly canHandle: (event: IEvent) => boolean;
  readonly handle: (event: TEvent) => Effect.Effect<void, EventError, EventContext>;
}

/**
 * Create an effect-based event handler
 */
export function createEventHandler<TEvent extends IEvent>(
  config: {
    canHandle: (event: IEvent) => boolean;
    process: (event: TEvent) => Effect.Effect<void, EventError, EventContext>;
    onSuccess?: (event: TEvent) => Effect.Effect<void, never, never>;
    onError?: (error: EventError, event: TEvent) => Effect.Effect<void, never, never>;
  }
): EffectEventHandler<TEvent> {
  return {
    canHandle: config.canHandle,
    handle: (event: TEvent) =>
      pipe(
        config.process(event),
        Effect.tap(() => 
          config.onSuccess ? config.onSuccess(event) : Effect.succeed(undefined)
        ),
        Effect.tapError((error) =>
          config.onError ? config.onError(error as EventError, event) : Effect.succeed(undefined)
        ),
      ),
  };
}

/**
 * Event stream processing
 */
export function createEventStream<TEvent extends IEvent>(
  source: Stream.Stream<TEvent, never, never>
): Stream.Stream<TEvent, EventError, EventContext> {
  return pipe(
    source,
    Stream.tapError((error) =>
      Effect.logError(`Event stream error: ${error}`)
    )
  ) as Stream.Stream<TEvent, EventError, EventContext>;
}

/**
 * Event projection builder
 */
export class EventProjection<TEvent extends IEvent, TState> {
  constructor(
    private readonly name: string,
    private readonly initialState: TState,
    private readonly reducer: (state: TState, event: TEvent) => TState
  ) {}

  /**
   * Apply events to build projection state
   */
  apply(events: ReadonlyArray<TEvent>): Effect.Effect<TState, never, never> {
    return Effect.sync(() =>
      events.reduce(this.reducer, this.initialState)
    );
  }

  /**
   * Create a stream that maintains projection state
   */
  stream(
    events: Stream.Stream<TEvent, never, never>
  ): Stream.Stream<TState, never, never> {
    return pipe(
      events,
      Stream.scan(this.initialState, this.reducer)
    );
  }

  /**
   * Create a live projection that updates with new events
   */
  live(
    eventQueue: Queue.Queue<TEvent>
  ): Effect.Effect<Fiber.RuntimeFiber<void, never>, never, EventContext> {
    return pipe(
      Stream.fromQueue(eventQueue),
      this.stream,
      Stream.tap((state) =>
        Effect.flatMap(EventContext, (ctx) =>
          Effect.sync(() => {
            ctx.projections.set(this.name, state);
          })
        )
      ),
      Stream.runDrain,
      Effect.fork
    );
  }
}

/**
 * Create an event projection
 */
export function createProjection<TEvent extends IEvent, TState>(
  name: string,
  initialState: TState,
  reducer: (state: TState, event: TEvent) => TState
): EventProjection<TEvent, TState> {
  return new EventProjection(name, initialState, reducer);
}

/**
 * Event sourcing utilities
 */
export const EventSourcing = {
  /**
   * Replay events from a specific point
   */
  replay: <TEvent extends IEvent>(
    aggregateId: AggregateId,
    fromversion: AggregateVersion,
    handler: EffectEventHandler<TEvent>
  ): Effect.Effect<void, EventError, EventContext> =>
    pipe(
      EventContext,
      Effect.flatMap((ctx) =>
        Effect.tryPromise({
          try: () => ctx.eventStore.getEvents(aggregateId, fromversion),
          catch: (error) =>
            new EventProcessingError({
              event: {} as TEvent,
              cause: error,
            }),
        })
      ),
      Effect.flatMap((events) =>
        Effect.all(
          events
            .filter(handler.canHandle)
            .map((event) => handler.handle(event as TEvent)),
          { discard: true }
        )
      )
    ),

  /**
   * Create event snapshot
   */
  snapshot: <TEvent extends IEvent, TState>(
    aggregateId: AggregateId,
    projection: EventProjection<TEvent, TState>
  ): Effect.Effect<TState, EventError, EventContext> =>
    pipe(
      EventContext,
      Effect.flatMap((ctx) =>
        Effect.tryPromise({
          try: () => ctx.eventStore.getEvents(aggregateId),
          catch: (error) =>
            new EventProcessingError({
              event: {} as TEvent,
              cause: error,
            }),
        })
      ),
      Effect.flatMap((events) => projection.apply(events as TEvent[]))
    ),

  /**
   * Subscribe to events
   */
  subscribe: <TEvent extends IEvent>(
    filter?: (event: IEvent) => boolean
  ): Effect.Effect<Stream.Stream<TEvent, never, never>, never, EventContext> =>
    pipe(
      Queue.unbounded<TEvent>(),
      Effect.map((queue) =>
        Stream.fromQueue(queue).pipe(
          filter ? Stream.filter(filter) : (s) => s
        )
      )
    ),
};

/**
 * Event dispatcher - routes events to handlers
 */
export class EventDispatcher<TEvent extends IEvent> {
  private handlers: Array<EffectEventHandler<TEvent>> = [];

  register(handler: EffectEventHandler<TEvent>): this {
    this.handlers.push(handler);
    return this;
  }

  dispatch(event: TEvent): Effect.Effect<void, EventError, EventContext> {
    const matchingHandlers = this.handlers.filter((h) => h.canHandle(event));
    
    if (matchingHandlers.length === 0) {
      return Effect.logWarning(`No handlers for event type: ${event.type}`);
    }

    return Effect.all(
      matchingHandlers.map((handler) => handler.handle(event)),
      { discard: true, concurrency: 'unbounded' }
    );
  }

  /**
   * Create a stream processor for events
   */
  createProcessor(
    source: Stream.Stream<TEvent, never, never>
  ): Effect.Effect<Fiber.RuntimeFiber<void, EventError>, never, EventContext> {
    return pipe(
      source,
      Stream.mapEffect((event) => this.dispatch(event)),
      Stream.runDrain,
      Effect.fork
    );
  }
}

/**
 * Create an event dispatcher
 */
export function createEventDispatcher<TEvent extends IEvent>(): EventDispatcher<TEvent> {
  return new EventDispatcher();
}

/**
 * Event bus implementation with Effect
 */
export class EffectEventBus<TEvent extends IEvent> {
  private queue: Queue.Queue<TEvent> | null = null;
  private dispatcher = createEventDispatcher<TEvent>();
  private processor: Fiber.RuntimeFiber<void, EventError> | null = null;

  /**
   * Initialize the event bus
   */
  initialize(): Effect.Effect<void, never, EventContext> {
    return pipe(
      Queue.unbounded<TEvent>(),
      Effect.tap((q) =>
        Effect.sync(() => {
          this.queue = q;
        })
      ),
      Effect.flatMap((q) =>
        pipe(
          Stream.fromQueue(q),
          (stream) => this.dispatcher.createProcessor(stream),
          Effect.tap((fiber) =>
            Effect.sync(() => {
              this.processor = fiber;
            })
          )
        )
      ),
      Effect.map(() => undefined)
    );
  }

  /**
   * Publish an event
   */
  publish(event: TEvent): Effect.Effect<void, EventError, never> {
    if (!this.queue) {
      return Effect.fail(
        new EventProcessingError({
          event,
          cause: new Error('Event bus not initialized'),
        })
      );
    }

    return Queue.offer(this.queue, event);
  }

  /**
   * Subscribe to events
   */
  subscribe(handler: EffectEventHandler<TEvent>): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.dispatcher.register(handler);
    });
  }

  /**
   * Shutdown the event bus
   */
  shutdown(): Effect.Effect<void, never, never> {
    if (this.processor) {
      return Fiber.interrupt(this.processor);
    }
    return Effect.succeed(undefined);
  }
}

/**
 * Create an Effect-based event bus
 */
export function createEffectEventBus<TEvent extends IEvent>(): EffectEventBus<TEvent> {
  return new EffectEventBus();
}

/**
 * Event store service layer
 */
export const EventStoreServiceLive = Layer.succeed(
  EventContext,
  EventContext.of({
    eventStore: {} as IEventStore<any, any>, // Will be provided by actual implementation
    projections: new Map(),
  })
);

/**
 * Convert traditional event handler to Effect-based
 */
export function fromEventHandler<TEvent extends IEvent>(
  handler: EventHandler<TEvent>
): EffectEventHandler<TEvent> {
  return {
    canHandle: (_event) => true,
    handle: (event: TEvent) =>
      Effect.tryPromise({
        try: () => Promise.resolve(handler(event)),
        catch: (error) =>
          new EventProcessingError({
            event,
            cause: error,
          }),
      }),
  };
}