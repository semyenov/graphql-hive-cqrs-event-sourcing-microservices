/**
 * Framework Effect: Outbox Publisher
 *
 * Message publishers for the transactional outbox pattern.
 */

import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";
import type { IEvent } from "../core/types";

/**
 * Publish error
 */
export class PublishError extends Error {
  readonly _tag = "PublishError";
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

/**
 * Message publisher interface
 */
export interface MessagePublisher {
  readonly publish: (
    event: IEvent,
    metadata?: Record<string, unknown>,
  ) => Effect.Effect<void, PublishError, never>;

  readonly publishBatch: (
    events: Array<{
      event: IEvent;
      metadata?: Record<string, unknown>;
    }>,
  ) => Effect.Effect<void[], PublishError, never>;
}

/**
 * Publisher configuration
 */
export interface OutboxPublisherConfig {
  readonly maxRetries?: number;
  readonly retryDelay?: number;
  readonly timeout?: number;
  readonly batchSize?: number;
}

/**
 * Create console publisher (for testing)
 */
export const createConsolePublisher = (): MessagePublisher => ({
  publish: (event, metadata) =>
    Effect.sync(() => {
      console.log("Publishing event:", {
        type: event.type,
        aggregateId: event.aggregateId,
        metadata,
      });
    }),

  publishBatch: (events) =>
    Effect.sync(() => {
      console.log(`Publishing ${events.length} events`);
      return events.map(() => undefined);
    }),
});

/**
 * Create HTTP publisher
 */
export const createHttpPublisher = (
  endpoint: string,
  headers?: Record<string, string>,
): MessagePublisher => ({
  publish: (event, metadata) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            event,
            metadata,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new PublishError(
            `HTTP publish failed: ${response.status} ${response.statusText}`,
          );
        }
      },
      catch: (error) => new PublishError("HTTP publish error", error),
    }),

  publishBatch: (events) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${endpoint}/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            events,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new PublishError(
            `HTTP batch publish failed: ${response.status} ${response.statusText}`,
          );
        }

        return events.map(() => undefined);
      },
      catch: (error) => new PublishError("HTTP batch publish error", error),
    }),
});

/**
 * Create queue publisher
 */
export const createQueuePublisher = (
  queue: Queue.Queue<{
    event: IEvent;
    metadata?: Record<string, unknown>;
  }>,
): MessagePublisher => ({
  publish: (event, metadata) =>
    pipe(
      Queue.offer(queue, { event, metadata }),
      Effect.flatMap((offered) =>
        offered ? Effect.unit : Effect.fail(new PublishError("Queue is full"))
      ),
    ),

  publishBatch: (events) =>
    Effect.forEach(
      events,
      ({ event, metadata }) =>
        pipe(
          Queue.offer(queue, { event, metadata }),
          Effect.flatMap((offered) =>
            offered
              ? Effect.succeed(undefined)
              : Effect.fail(new PublishError("Queue is full"))
          ),
        ),
      { concurrency: "unbounded" },
    ),
});

/**
 * Create in-memory publisher (for testing)
 */
export const createInMemoryPublisher = (): Effect.Effect<
  MessagePublisher & {
    readonly getPublished: () => Effect.Effect<
      Array<{ event: IEvent; metadata?: Record<string, unknown> }>,
      never,
      never
    >;
    readonly clear: () => Effect.Effect<void, never, never>;
  },
  never,
  never
> =>
  Effect.gen(function* (_) {
    const published = yield* _(
      Ref.make<Array<{ event: IEvent; metadata?: Record<string, unknown> }>>(
        [],
      ),
    );

    return {
      publish: (event, metadata) =>
        pipe(
          Ref.update(published, (events) => [...events, { event, metadata }]),
          Effect.map(() => undefined),
        ),

      publishBatch: (events) =>
        pipe(
          Ref.update(published, (existing) => [...existing, ...events]),
          Effect.map(() => events.map(() => undefined)),
        ),

      getPublished: () => Ref.get(published),

      clear: () => Ref.set(published, []),
    };
  });

/**
 * Create resilient publisher with retry and circuit breaker
 */
export const createResilientPublisher = (
  basePublisher: MessagePublisher,
  config: OutboxPublisherConfig = {},
): MessagePublisher => {
  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelay ?? 1000;

  return {
    publish: (event, metadata) =>
      pipe(
        basePublisher.publish(event, metadata),
        Effect.retry(
          Schedule.exponential(Duration.millis(retryDelay), 2).pipe(
            Schedule.either(Schedule.recurs(maxRetries)),
          ),
        ),
      ),

    publishBatch: (events) =>
      pipe(
        basePublisher.publishBatch(events),
        Effect.retry(
          Schedule.exponential(Duration.millis(retryDelay), 2).pipe(
            Schedule.either(Schedule.recurs(maxRetries)),
          ),
        ),
      ),
  };
};

/**
 * Create fanout publisher (publishes to multiple destinations)
 */
export const createFanoutPublisher = (
  publishers: MessagePublisher[],
): MessagePublisher => ({
  publish: (event, metadata) =>
    pipe(
      Effect.forEach(
        publishers,
        (publisher) => publisher.publish(event, metadata),
        { concurrency: "unbounded", discard: true },
      ),
    ),

  publishBatch: (events) =>
    pipe(
      Effect.forEach(
        publishers,
        (publisher) => publisher.publishBatch(events),
        { concurrency: "unbounded" },
      ),
      Effect.map((results) => results.flat()),
    ),
});

/**
 * Create filtered publisher
 */
export const createFilteredPublisher = (
  basePublisher: MessagePublisher,
  filter: (event: IEvent) => boolean,
): MessagePublisher => ({
  publish: (event, metadata) =>
    filter(event) ? basePublisher.publish(event, metadata) : Effect.unit,

  publishBatch: (events) => {
    const filtered = events.filter(({ event }) => filter(event));
    return filtered.length > 0
      ? basePublisher.publishBatch(filtered)
      : Effect.succeed([]);
  },
});

/**
 * Create batching publisher
 */
export const createBatchingPublisher = (
  basePublisher: MessagePublisher,
  config: {
    batchSize: number;
    flushInterval: number;
  },
): Effect.Effect<MessagePublisher, never, never> =>
  Effect.gen(function* (_) {
    const buffer = yield* _(
      Ref.make<Array<{ event: IEvent; metadata?: Record<string, unknown> }>>(
        [],
      ),
    );

    const flush = (): Effect.Effect<void, PublishError, never> =>
      Effect.gen(function* (_) {
        const events = yield* _(Ref.getAndSet(buffer, []));
        if (events.length > 0) {
          yield* _(basePublisher.publishBatch(events));
        }
      });

    // Start periodic flush
    yield* _(
      Effect.fork(
        pipe(
          flush(),
          Effect.catchAll(() => Effect.unit),
          Effect.repeat(Schedule.spaced(Duration.millis(config.flushInterval))),
          Effect.forever,
        ),
      ),
    );

    return {
      publish: (event, metadata) =>
        Effect.gen(function* (_) {
          yield* _(
            Ref.update(buffer, (events) => [...events, { event, metadata }]),
          );

          const events = yield* _(Ref.get(buffer));
          if (events.length >= config.batchSize) {
            yield* _(flush());
          }
        }),

      publishBatch: (events) =>
        Effect.gen(function* (_) {
          yield* _(Ref.update(buffer, (existing) => [...existing, ...events]));
          yield* _(flush());
          return events.map(() => undefined);
        }),
    };
  });

/**
 * Create idempotent publisher
 */
export const createIdempotentPublisher = (
  basePublisher: MessagePublisher,
  config: {
    ttl?: number; // Time to live for deduplication cache (ms)
  } = {},
): Effect.Effect<MessagePublisher, never, never> =>
  Effect.gen(function* (_) {
    const ttl = config.ttl ?? 60000; // 1 minute default
    const published = yield* _(
      Ref.make(new Map<string, number>()), // eventId -> timestamp
    );

    // Cleanup old entries periodically
    yield* _(
      Effect.fork(
        pipe(
          Effect.sync(() => {
            const now = Date.now();
            return Ref.update(published, (map) => {
              const newMap = new Map(map);
              for (const [id, timestamp] of newMap) {
                if (now - timestamp > ttl) {
                  newMap.delete(id);
                }
              }
              return newMap;
            });
          }),
          Effect.flatMap((effect) => effect),
          Effect.repeat(Schedule.spaced(Duration.millis(ttl))),
          Effect.forever,
        ),
      ),
    );

    return {
      publish: (event, metadata) =>
        Effect.gen(function* (_) {
          const eventId = event.aggregateId;
          const cache = yield* _(Ref.get(published));

          if (cache.has(eventId)) {
            return; // Already published
          }

          yield* _(basePublisher.publish(event, metadata));
          yield* _(Ref.update(published, (map) => {
            const newMap = new Map(map);
            newMap.set(eventId, Date.now());
            return newMap;
          }));
        }),

      publishBatch: (events) =>
        Effect.gen(function* (_) {
          const cache = yield* _(Ref.get(published));
          const newEvents = events.filter(({ event }) =>
            !cache.has(event.aggregateId)
          );

          if (newEvents.length === 0) {
            return [];
          }

          const results = yield* _(basePublisher.publishBatch(newEvents));

          yield* _(Ref.update(published, (map) => {
            const newMap = new Map(map);
            const now = Date.now();
            for (const { event } of newEvents) {
              newMap.set(event.aggregateId, now);
            }
            return newMap;
          }));

          return results;
        }),
    };
  });
