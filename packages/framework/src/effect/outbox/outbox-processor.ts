/**
 * Framework Effect: Outbox Processor
 *
 * Background processor for the transactional outbox pattern.
 */

import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Fiber from "effect/Fiber";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
import { pipe } from "effect/Function";
import type { IEvent } from "../core/types";
import { OutboxMessage, OutboxStore, OutboxStoreError } from "./outbox-store";
import type { MessagePublisher } from "./outbox-publisher";

/**
 * Processor configuration
 */
export interface OutboxProcessorConfig {
  readonly pollInterval?: number; // ms
  readonly batchSize?: number;
  readonly maxRetries?: number;
  readonly retryDelay?: number; // ms
  readonly deadLetterThreshold?: number;
  readonly cleanupInterval?: number; // ms
  readonly retentionPeriod?: number; // ms
}

/**
 * Processor state
 */
export type ProcessorState = "idle" | "processing" | "stopping" | "stopped";

/**
 * Processor metrics
 */
export interface ProcessorMetrics {
  readonly messagesProcessed: number;
  readonly messagesPublished: number;
  readonly messagesFailed: number;
  readonly messagesInDeadLetter: number;
  readonly lastProcessedAt?: Date;
  readonly processingTimeMs: number;
  readonly isRunning: boolean;
}

/**
 * Processor errors
 */
export class ProcessorError extends Error {
  readonly _tag = "ProcessorError";
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

/**
 * Outbox processor interface
 */
export interface OutboxProcessor {
  readonly start: () => Effect.Effect<void, OutboxStoreError, never>;
  readonly stop: () => Effect.Effect<void, OutboxStoreError, never>;
  readonly getMetrics: () => Effect.Effect<ProcessorMetrics, never, never>;
  readonly processOnce: () => Effect.Effect<number, OutboxStoreError, never>;
  readonly reprocessDeadLetters: () => Effect.Effect<
    number,
    OutboxStoreError,
    never
  >;
}

/**
 * Create outbox processor
 */
export const createOutboxProcessor = (
  store: OutboxStore,
  publisher: MessagePublisher,
  config: OutboxProcessorConfig = {},
): Effect.Effect<OutboxProcessor, never, never> =>
  Effect.gen(function* (_) {
    const pollInterval = config.pollInterval ?? 5000;
    const batchSize = config.batchSize ?? 100;
    const maxRetries = config.maxRetries ?? 3;
    const retryDelay = config.retryDelay ?? 1000;
    const deadLetterThreshold = config.deadLetterThreshold ?? 5;

    const stateRef = yield* _(Ref.make<ProcessorState>("idle"));
    const metricsRef = yield* _(Ref.make<ProcessorMetrics>({
      messagesProcessed: 0,
      messagesPublished: 0,
      messagesFailed: 0,
      messagesInDeadLetter: 0,
      processingTimeMs: 0,
      isRunning: false,
    }));

    const processingFiberRef = yield* _(
      Ref.make<Fiber.RuntimeFiber<void, never> | null>(null),
    );

    /**
     * Process a single message
     */
    const processMessage = (
      message: OutboxMessage,
    ): Effect.Effect<void, OutboxStoreError, never> =>
      Effect.gen(function* (_) {
        const event = message.eventData as IEvent;

        yield* _(pipe(
          publisher.publish(event, message.metadata),
          Effect.retry(Schedule.recurs(maxRetries)),
          Effect.flatMap(() => store.markAsPublished([message.id])),
          Effect.tap(() =>
            Ref.update(metricsRef, (m) => ({
              ...m,
              messagesPublished: m.messagesPublished + 1,
            }))
          ),
          Effect.catchAll((error) =>
            pipe(
              store.markAsFailed(
                message.id,
                error instanceof Error ? error.message : String(error),
              ),
              Effect.flatMap(() => {
                if ((message.attempts ?? 0) >= deadLetterThreshold) {
                  return Effect.succeed(undefined); // Dead letter handling is done in markAsFailed
                }
                return Effect.succeed(undefined);
              }),
              Effect.tap(() =>
                Ref.update(metricsRef, (m) => ({
                  ...m,
                  messagesFailed: m.messagesFailed + 1,
                }))
              ),
            )
          ),
        ));
      });

    /**
     * Process a batch of messages
     */
    const processBatch = (): Effect.Effect<number, OutboxStoreError, never> =>
      Effect.gen(function* (_) {
        const startTime = Date.now();
        const messages = yield* _(
          pipe(
            store.getNextBatch(batchSize),
            Effect.mapError((error) =>
              new OutboxStoreError("getNextBatch", error)
            ),
          ),
        );

        if (messages.length === 0) {
          return 0;
        }

        yield* _(Effect.forEach(messages, processMessage, {
          concurrency: 10,
          discard: true,
        }));

        yield* _(Ref.update(metricsRef, (m) => ({
          ...m,
          messagesProcessed: m.messagesProcessed + messages.length,
          lastProcessedAt: new Date(),
          processingTimeMs: m.processingTimeMs + (Date.now() - startTime),
        })));

        return messages.length;
      });

    /**
     * Main processing loop
     */
    const processLoop = (): Effect.Effect<void, never, never> =>
      pipe(
        processBatch(),
        Effect.flatMap((processed) =>
          processed === 0
            ? Effect.sleep(Duration.millis(pollInterval))
            : Effect.succeed(undefined)
        ),
        Effect.forever,
        Effect.catchAll((error) =>
          Effect.logError(`Processor error: ${error}`)
        ),
      );

    /**
     * Start processor
     */
    const start = (): Effect.Effect<void, OutboxStoreError, never> =>
      Effect.gen(function* (_) {
        const currentState = yield* _(Ref.get(stateRef));

        if (currentState === "processing") {
          return;
        }

        yield* _(Ref.set(stateRef, "processing"));
        yield* _(Ref.update(metricsRef, (m) => ({ ...m, isRunning: true })));

        const fiber = yield* _(Effect.fork(processLoop()));
        yield* _(Ref.set(processingFiberRef, fiber));
      });

    /**
     * Stop processor
     */
    const stop = (): Effect.Effect<void, OutboxStoreError, never> =>
      Effect.gen(function* (_) {
        yield* _(Ref.set(stateRef, "stopping"));

        const fiber = yield* _(Ref.get(processingFiberRef));
        if (fiber) {
          yield* _(Fiber.interrupt(fiber));
          yield* _(Ref.set(processingFiberRef, null));
        }

        yield* _(Ref.set(stateRef, "stopped"));
        yield* _(Ref.update(metricsRef, (m) => ({ ...m, isRunning: false })));
      });

    /**
     * Process once
     */
    const processOnce = (): Effect.Effect<number, OutboxStoreError, never> =>
      processBatch();

    /**
     * Reprocess dead letters
     */
    const reprocessDeadLetters = (): Effect.Effect<
      number,
      OutboxStoreError,
      never
    > =>
      Effect.gen(function* (_) {
        const messages = yield* _(
          pipe(
            store.getDeadLetters(batchSize),
            Effect.mapError((error) =>
              new OutboxStoreError("getDeadLetters", error)
            ),
          ),
        );

        // Reset dead letters to pending status
        for (const message of messages) {
          yield* _(
            pipe(
              store.markAsFailed(message.id, "Reprocessing dead letter"),
              Effect.mapError((error) =>
                new OutboxStoreError("markAsFailed", error)
              ),
            ),
          );
        }

        return messages.length;
      });

    /**
     * Get metrics
     */
    const getMetrics = (): Effect.Effect<ProcessorMetrics, never, never> =>
      Ref.get(metricsRef);

    return {
      start,
      stop,
      getMetrics,
      processOnce,
      reprocessDeadLetters,
    };
  });

/**
 * Create transactional outbox
 */
export interface TransactionalOutbox {
  readonly withTransaction: <R, E, A>(
    effect: (tx: {
      add: (events: IEvent[]) => Effect.Effect<void, never, never>;
    }) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, OutboxStoreError | E, R>;
  readonly processor: OutboxProcessor;
}

export const createTransactionalOutbox = (
  store: OutboxStore,
  publisher: MessagePublisher,
  config?: OutboxProcessorConfig,
): Effect.Effect<TransactionalOutbox, never, never> =>
  Effect.gen(function* (_) {
    const processor = yield* _(createOutboxProcessor(store, publisher, config));

    const withTransaction = <R, E, A>(
      effect: (tx: {
        add: (events: IEvent[]) => Effect.Effect<void, never, never>;
      }) => Effect.Effect<A, E, R>,
    ): Effect.Effect<A, OutboxStoreError | E, R> =>
      Effect.gen(function* (_) {
        const messages: OutboxMessage[] = [];

        const tx = {
          add: (events: IEvent[]) =>
            Effect.sync(() => {
              for (const event of events) {
                messages.push({
                  id: `outbox-${Date.now()}-${Math.random()}`,
                  eventType: event.type,
                  eventData: event,
                  aggregateId: event.aggregateId,
                  status: "pending",
                  createdAt: new Date(),
                  attempts: 0,
                  metadata: {}, // Add required metadata field
                });
              }
            }),
        };

        const result = yield* _(effect(tx));

        if (messages.length > 0) {
          yield* _(store.add(messages));
        }

        return result;
      });

    return {
      withTransaction,
      processor,
    };
  });

/**
 * Create outbox with automatic processing
 */
export const createAutoProcessingOutbox = (
  store: OutboxStore,
  publisher: MessagePublisher,
  config?: OutboxProcessorConfig,
): Effect.Effect<
  {
    readonly add: (
      events: IEvent[],
    ) => Effect.Effect<void, OutboxStoreError, never>;
    readonly start: () => Effect.Effect<void, OutboxStoreError, never>;
    readonly stop: () => Effect.Effect<void, OutboxStoreError, never>;
    readonly getMetrics: () => Effect.Effect<ProcessorMetrics, never, never>;
  },
  never,
  never
> =>
  Effect.gen(function* (_) {
    const processor = yield* _(createOutboxProcessor(store, publisher, config));

    const add = (
      events: IEvent[],
    ): Effect.Effect<void, OutboxStoreError, never> =>
      Effect.gen(function* (_) {
        const messages: OutboxMessage[] = events.map((event) => ({
          id: `outbox-${Date.now()}-${Math.random()}`,
          eventType: event.type,
          eventData: event,
          aggregateId: event.aggregateId,
          status: "pending" as const,
          createdAt: new Date(),
          attempts: 0,
          metadata: {}, // Add required metadata field
        }));

        yield* _(
          pipe(
            store.add(messages),
            Effect.mapError((error) => new OutboxStoreError("add", error)),
          ),
        );
      });

    return {
      add,
      start: processor.start,
      stop: processor.stop,
      getMetrics: processor.getMetrics,
    };
  });
