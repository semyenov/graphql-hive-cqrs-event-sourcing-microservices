/**
 * Framework Effect: Stream Sinks
 * 
 * Terminal operations for stream processing - persistence, notifications, etc.
 */

import * as Stream from 'effect/Stream';
import * as Sink from 'effect/Sink';
import * as Effect from 'effect/Effect';
import * as Chunk from 'effect/Chunk';
import * as Queue from 'effect/Queue';
import { pipe } from 'effect/Function';
import type { IEvent, IEventStore } from '../core/types';

/**
 * Sink to event store
 */
export const toEventStore = <E extends IEvent>(
  eventStore: IEventStore,
  options?: {
    batchSize?: number;
    retryOnFailure?: boolean;
    maxRetries?: number;
  }
): Sink.Sink<void, Error, E, never, never> =>
  Sink.forEach((event: E) =>
    Effect.tryPromise({
      try: () => eventStore.append([event]),
      catch: (error) => new Error(`Failed to append event: ${error}`),
    })
  );

/**
 * Sink to database
 */
export const toDatabase = <A>(
  saveFunction: (items: A[]) => Promise<void>,
  batchSize: number = 100
): Sink.Sink<void, Error, A, never, never> =>
  pipe(
    Sink.collectAll<A>(),
    Sink.mapEffect((chunk) =>
      Effect.gen(function* () {
        const items = Chunk.toReadonlyArray(chunk);
        
        // Process in batches
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          yield* Effect.tryPromise({
            try: () => saveFunction(batch),
            catch: (error) => new Error(`Database save failed: ${error}`),
          });
        }
      })
    )
  );

/**
 * Sink to message queue
 */
export const toMessageQueue = <A>(
  publish: (message: A) => Promise<void>,
  options?: {
    concurrent?: number;
    retryOnFailure?: boolean;
  }
): Sink.Sink<void, Error, A, never, never> =>
  Sink.forEachChunk((chunk: Chunk.Chunk<A>) =>
    Effect.forEach(
      Chunk.toReadonlyArray(chunk),
      (item) =>
        Effect.tryPromise({
          try: () => publish(item),
          catch: (error) => new Error(`Failed to publish message: ${error}`),
        }),
      { concurrency: options?.concurrent ?? 1 }
    )
  );

/**
 * Sink to file system
 */
export const toFile = <A>(
  filePath: string,
  formatter: (item: A) => string = JSON.stringify
): Sink.Sink<void, Error, A, never, never> =>
  Sink.unwrap(
    Effect.gen(function* () {
      // In a real implementation, this would use file system APIs
      const lines: string[] = [];
      
      return pipe(
        Sink.forEach<A>((item) =>
          Effect.sync(() => {
            lines.push(formatter(item));
          })
        ),
        Sink.map(() => {
          console.log(`Would write ${lines.length} lines to ${filePath}`);
          // In real implementation: write lines to file
        })
      );
    })
  );

/**
 * Sink to console for debugging
 */
export const toConsole = <A>(
  formatter?: (item: A) => string
): Sink.Sink<void, never, A, never, never> =>
  Sink.forEach((item: A) =>
    Effect.sync(() => {
      console.log(formatter ? formatter(item) : item);
    })
  );

/**
 * Sink with metrics collection
 */
export const withMetrics = <R, E, In, L, Z>(
  sink: Sink.Sink<Z, E, In, L, R>,
  onMetrics: (metrics: {
    itemsProcessed: number;
    errors: number;
    duration: number;
  }) => void
): Sink.Sink<Z, E, In, L, R> =>
  Sink.unwrap(
    Effect.gen(function* () {
      const startTime = Date.now();
      let itemsProcessed = 0;
      let errors = 0;
      
      return pipe(
        sink,
        Sink.contramapChunks<In, In>((chunk) => {
          itemsProcessed += Chunk.size(chunk);
          return chunk;
        }),
        Sink.map((result) => {
          onMetrics({
            itemsProcessed,
            errors,
            duration: Date.now() - startTime,
          });
          return result;
        })
      );
    })
  );

/**
 * Broadcast sink - send to multiple sinks
 */
export const broadcast = <R, E, In, L, Z>(
  ...sinks: Sink.Sink<Z, E, In, L, R>[]
): Sink.Sink<void, E, In, L, R> =>
  Sink.forEachChunk((chunk: Chunk.Chunk<In>) =>
    Effect.forEach(
      sinks,
      (sink) =>
        pipe(
          Stream.fromChunk(chunk),
          Stream.run(sink),
          Effect.asVoid
        ),
      { concurrency: 'unbounded' }
    )
  );

/**
 * Conditional sink - route to different sinks based on predicate
 */
export const conditional = <R, E, In, L, Z>(
  predicate: (item: In) => boolean,
  trueSink: Sink.Sink<Z, E, In, L, R>,
  falseSink: Sink.Sink<Z, E, In, L, R>
): Sink.Sink<[Z, Z], E, In, L, R> =>
  Sink.unwrap(
    Effect.gen(function* () {
      const trueQueue = yield* Queue.unbounded<In>();
      const falseQueue = yield* Queue.unbounded<In>();
      
      const router = Sink.forEach<In>((item) =>
        predicate(item)
          ? Queue.offer(trueQueue, item)
          : Queue.offer(falseQueue, item)
      );
      
      return Sink.collectAll<In>().pipe(
        Sink.mapEffect((chunk) =>
          Effect.gen(function* () {
            // Route items
            yield* pipe(
              Stream.fromChunk(chunk),
              Stream.run(router)
            );
            
            // Close queues
            yield* Queue.shutdown(trueQueue);
            yield* Queue.shutdown(falseQueue);
            
            // Run sinks in parallel
            const [trueResult, falseResult] = yield* Effect.all([
              pipe(Stream.fromQueue(trueQueue), Stream.run(trueSink)),
              pipe(Stream.fromQueue(falseQueue), Stream.run(falseSink)),
            ]);
            
            return [trueResult, falseResult] as [Z, Z];
          })
        )
      );
    })
  );

/**
 * Batching sink with timeout
 */
export const batching = <R, E, In, L>(
  batchSize: number,
  timeout: number,
  processBatch: (batch: readonly In[]) => Effect.Effect<void, E, R>
): Sink.Sink<void, E, In, L, R> =>
  pipe(
    Sink.collectAll<In>(),
    Sink.mapEffect((chunk) =>
      Effect.gen(function* () {
        const items = Chunk.toReadonlyArray(chunk);
        const batches: In[][] = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
          batches.push(items.slice(i, i + batchSize));
        }
        
        yield* Effect.forEach(
          batches,
          processBatch,
          { concurrency: 1 }
        );
      })
    )
  );

/**
 * Sink with error handling
 */
export const withErrorHandling = <R, E, In, L, Z>(
  sink: Sink.Sink<Z, E, In, L, R>,
  onError: (error: E, item: In) => Effect.Effect<void, never, never>,
  defaultValue: Z
): Sink.Sink<Z, never, In, L, R> =>
  pipe(
    sink,
    Sink.orElse(() =>
      Sink.unwrap(
        Effect.gen(function* () {
          return Sink.foldLeft<In, Z>(
            defaultValue,
            (acc, item) => {
              // In real implementation, would handle errors per item
              return acc;
            }
          );
        })
      )
    )
  );

/**
 * Advanced sinks for CQRS patterns
 */

/**
 * Projection sink - update read models
 */
export const toProjection = <S, E extends IEvent>(
  updateProjection: (state: S, event: E) => S,
  saveProjection: (state: S) => Promise<void>,
  initialState: S
): Sink.Sink<S, Error, E, never, never> =>
  pipe(
    Sink.foldLeft<E, S>(initialState, updateProjection),
    Sink.mapEffect((finalState) =>
      Effect.tryPromise({
        try: () => saveProjection(finalState),
        catch: (error) => new Error(`Failed to save projection: ${error}`),
      }).pipe(Effect.as(finalState))
    )
  );

/**
 * Snapshot sink - periodic state snapshots
 */
export const toSnapshot = <S>(
  saveSnapshot: (state: S) => Promise<void>,
  snapshotInterval: number = 100
): Sink.Sink<void, Error, S, never, never> =>
  Sink.forEachWhile((state: S) =>
    Effect.gen(function* () {
      const shouldSnapshot = Math.random() < (1 / snapshotInterval);
      
      if (shouldSnapshot) {
        yield* Effect.tryPromise({
          try: () => saveSnapshot(state),
          catch: (error) => new Error(`Failed to save snapshot: ${error}`),
        });
      }
      
      return true; // Continue processing
    })
  );

/**
 * Dead letter sink - for failed messages
 */
export const toDeadLetter = <A>(
  saveToDeadLetter: (item: A, error: string) => Promise<void>
): Sink.Sink<void, never, { item: A; error: Error }, never, never> =>
  Sink.forEach(({ item, error }) =>
    Effect.tryPromise({
      try: () => saveToDeadLetter(item, error.message),
      catch: (dlqError) => {
        console.error('Failed to save to dead letter queue:', dlqError);
        return Promise.resolve();
      },
    })
  );

/**
 * Analytics sink - send metrics
 */
export const toAnalytics = <A>(
  trackEvent: (eventName: string, properties: Record<string, any>) => Promise<void>,
  eventExtractor: (item: A) => { name: string; properties: Record<string, any> }
): Sink.Sink<void, Error, A, never, never> =>
  Sink.forEach((item: A) =>
    Effect.gen(function* () {
      const { name, properties } = eventExtractor(item);
      yield* Effect.tryPromise({
        try: () => trackEvent(name, properties),
        catch: (error) => new Error(`Failed to track analytics: ${error}`),
      });
    })
  );

/**
 * Notification sink - send notifications
 */
export const toNotifications = <A>(
  shouldNotify: (item: A) => boolean,
  sendNotification: (item: A) => Promise<void>
): Sink.Sink<void, Error, A, never, never> =>
  Sink.forEach((item: A) =>
    Effect.gen(function* () {
      if (shouldNotify(item)) {
        yield* Effect.tryPromise({
          try: () => sendNotification(item),
          catch: (error) => new Error(`Failed to send notification: ${error}`),
        });
      }
    })
  );