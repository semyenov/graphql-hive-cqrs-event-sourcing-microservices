/**
 * Framework Effect: Event Stream Processing
 * 
 * High-performance event stream processing with backpressure control.
 */

import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';
import * as Chunk from 'effect/Chunk';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import type { IEvent, IEventStore } from '../core/types';

/**
 * Event stream configuration
 */
export interface EventStreamConfig {
  readonly source: IEventStore;
  readonly fromPosition?: number;
  readonly toPosition?: number;
  readonly batchSize?: number;
  readonly backpressure?: boolean;
  readonly maxBufferSize?: number;
  readonly pollInterval?: number;
}

/**
 * Stream position tracking
 */
export interface StreamPosition {
  readonly global: number;
  readonly stream?: string;
  readonly partition?: number;
  readonly offset?: number;
}

/**
 * Create an event stream from an event store
 */
export const createEventStream = <E extends IEvent>(
  config: EventStreamConfig
): Stream.Stream<E, Error, never> => {
  const batchSize = config.batchSize ?? 100;
  const fromPosition = config.fromPosition ?? 0;
  const pollInterval = config.pollInterval ?? 1000;

  return Stream.unfoldEffect(fromPosition, (position) =>
    pipe(
      Effect.tryPromise({
        try: () => config.source.getEvents(position, batchSize),
        catch: (error) => new Error(`Failed to read events: ${error}`),
      }),
      Effect.map((events) => {
        if (events.length === 0) {
          // No more events, wait and retry
          return Option.none();
        }
        
        const chunk = Chunk.fromIterable(events as E[]);
        const nextPosition = position + events.length;
        
        if (config.toPosition && nextPosition >= config.toPosition) {
          // Reached end position
          const limitedChunk = Chunk.take(
            chunk,
            config.toPosition - position
          );
          return Option.some([limitedChunk, config.toPosition] as const);
        }
        
        return Option.some([chunk, nextPosition] as const);
      }),
      Effect.flatMap((option) =>
        Option.isNone(option)
          ? pipe(
              Effect.sleep(Duration.millis(pollInterval)),
              Effect.map(() => Option.none())
            )
          : Effect.succeed(option)
      )
    )
  ).pipe(Stream.flattenChunks);
};

/**
 * Create a live event stream with backpressure
 */
export const createLiveEventStream = <E extends IEvent>(
  subscribe: (handler: (event: E) => void) => () => void,
  config?: {
    bufferSize?: number;
    strategy?: 'dropping' | 'sliding' | 'suspend';
  }
): Effect.Effect<Stream.Stream<E, never, never>, never, never> =>
  Effect.gen(function* () {
    const bufferSize = config?.bufferSize ?? 1000;
    const strategy = config?.strategy ?? 'suspend';
    
    // Create appropriate queue based on strategy
    const queue = yield* (
      strategy === 'dropping'
        ? Queue.dropping<E>(bufferSize)
        : strategy === 'sliding'
        ? Queue.sliding<E>(bufferSize)
        : Queue.bounded<E>(bufferSize)
    );
    
    // Subscribe to events
    const unsubscribe = subscribe((event) => {
      Effect.runPromise(Queue.offer(queue, event)).catch((error) => {
        console.error('Failed to enqueue event:', error);
      });
    });
    
    // Create stream from queue
    const stream = Stream.fromQueue(queue);
    
    // Add finalizer to unsubscribe
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        unsubscribe();
        Queue.shutdown(queue);
      })
    );
    
    return stream;
  });

/**
 * Event stream with position tracking
 */
export const createTrackedEventStream = <E extends IEvent>(
  config: EventStreamConfig
): Effect.Effect<{
  readonly stream: Stream.Stream<E, Error, never>;
  readonly position: () => Effect.Effect<StreamPosition, never, never>;
  readonly checkpoint: () => Effect.Effect<void, Error, never>;
}, never, never> =>
  Effect.gen(function* () {
    const currentPosition = yield* Ref.make<StreamPosition>({
      global: config.fromPosition ?? 0,
    });
    
    const checkpointPosition = yield* Ref.make<StreamPosition>({
      global: config.fromPosition ?? 0,
    });
    
    const stream = pipe(
      createEventStream<E>(config),
      Stream.tap((event) =>
        Ref.update(currentPosition, (pos) => ({
          ...pos,
          global: pos.global + 1,
        }))
      )
    );
    
    const position = () => Ref.get(currentPosition);
    
    const checkpoint = () =>
      Effect.gen(function* () {
        const pos = yield* Ref.get(currentPosition);
        yield* Ref.set(checkpointPosition, pos);
        
        // Persist checkpoint if event store supports it
        if ('savePosition' in config.source) {
          yield* Effect.tryPromise({
            try: () => (config.source as any).savePosition(pos.global),
            catch: (error) => new Error(`Failed to save position: ${error}`),
          });
        }
      });
    
    return { stream, position, checkpoint };
  });

/**
 * Partitioned event stream for parallel processing
 */
export const createPartitionedStream = <E extends IEvent>(
  config: EventStreamConfig & {
    partitions: number;
    partitionKey: (event: E) => string;
  }
): Stream.Stream<readonly [number, Stream.Stream<E, Error, never>], never, never> => {
  const baseStream = createEventStream<E>(config);
  
  // Create partition streams
  return Stream.fromIterable(
    Array.from({ length: config.partitions }, (_, i) => i)
  ).pipe(
    Stream.map((partition) => {
      const partitionStream = pipe(
        baseStream,
        Stream.filter((event) => {
          const key = config.partitionKey(event);
          const hash = key.split('').reduce((acc, char) => {
            return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
          }, 0);
          return Math.abs(hash) % config.partitions === partition;
        })
      );
      
      return [partition, partitionStream] as const;
    })
  );
};

/**
 * Catchup subscription - read historical then switch to live
 */
export const createCatchupStream = <E extends IEvent>(
  config: {
    eventStore: IEventStore;
    fromPosition: number;
    subscribe: (handler: (event: E) => void) => () => void;
    onCaughtUp?: () => void;
  }
): Stream.Stream<E, Error, never> => {
  return Stream.unwrap(
    Effect.gen(function* () {
      // First, read historical events
      const currentPosition = yield* Ref.make(config.fromPosition);
      
      const historicalStream = Stream.repeatEffectOption(
        Effect.gen(function* () {
          const position = yield* Ref.get(currentPosition);
          const events = yield* Effect.tryPromise({
            try: () => config.eventStore.getEvents(position, 100),
            catch: (error) => new Error(`Failed to read events: ${error}`),
          });
          
          if (events.length === 0) {
            // Caught up with historical events
            config.onCaughtUp?.();
            return Option.none();
          }
          
          yield* Ref.update(currentPosition, (p) => p + events.length);
          return Option.some(Chunk.fromIterable(events as E[]));
        })
      ).pipe(Stream.flattenChunks);
      
      // Then switch to live stream
      const liveStream = yield* createLiveEventStream(
        config.subscribe,
        { bufferSize: 1000, strategy: 'suspend' }
      );
      
      // Concatenate historical and live streams
      return Stream.concat(historicalStream, liveStream);
    })
  );
};

/**
 * Event stream replay with speed control
 */
export const createReplayStream = <E extends IEvent>(
  events: readonly E[],
  config?: {
    speed?: number; // 1 = normal, 2 = 2x speed, 0.5 = half speed
    startDelay?: number;
  }
): Stream.Stream<E, never, never> => {
  const speed = config?.speed ?? 1;
  const startDelay = config?.startDelay ?? 0;
  
  if (events.length === 0) {
    return Stream.empty;
  }
  
  // Calculate delays between events based on timestamps
  const delays: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    
    if ('timestamp' in prev && 'timestamp' in curr) {
      const prevTime = new Date(prev.timestamp as any).getTime();
      const currTime = new Date(curr.timestamp as any).getTime();
      const delay = Math.max(0, (currTime - prevTime) / speed);
      delays.push(delay);
    } else {
      delays.push(0);
    }
  }
  
  return pipe(
    Stream.fromIterable(events),
    Stream.zipWithIndex,
    Stream.mapEffect(([event, index]) => {
      const delay = index === 0 ? startDelay : delays[index - 1] ?? 0;
      return pipe(
        Effect.sleep(Duration.millis(delay)),
        Effect.map(() => event)
      );
    })
  );
};

/**
 * Advanced stream patterns
 */

/**
 * Stream deduplication
 */
export const deduplicate = <E extends IEvent>(
  stream: Stream.Stream<E, Error, never>,
  keyExtractor: (event: E) => string,
  windowSize?: number
): Stream.Stream<E, Error, never> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const seen = yield* Ref.make(new Set<string>());
      const maxSize = windowSize ?? 10000;
      
      return pipe(
        stream,
        Stream.filter((event) =>
          Effect.gen(function* () {
            const key = keyExtractor(event);
            const seenKeys = yield* Ref.get(seen);
            
            if (seenKeys.has(key)) {
              return false;
            }
            
            yield* Ref.update(seen, (set) => {
              const newSet = new Set(set);
              newSet.add(key);
              
              // Limit size of deduplication window
              if (newSet.size > maxSize) {
                const firstKey = newSet.values().next().value;
                newSet.delete(firstKey);
              }
              
              return newSet;
            });
            
            return true;
          })
        )
      );
    })
  );

/**
 * Stream metrics collection
 */
export interface StreamMetrics {
  readonly eventsProcessed: number;
  readonly bytesProcessed: number;
  readonly processingRate: number;
  readonly errors: number;
  readonly lastEventTime: Date | null;
}

export const withMetrics = <E extends IEvent>(
  stream: Stream.Stream<E, Error, never>
): Effect.Effect<{
  readonly stream: Stream.Stream<E, Error, never>;
  readonly metrics: () => Effect.Effect<StreamMetrics, never, never>;
}, never, never> =>
  Effect.gen(function* () {
    const metrics = yield* Ref.make<StreamMetrics>({
      eventsProcessed: 0,
      bytesProcessed: 0,
      processingRate: 0,
      errors: 0,
      lastEventTime: null,
    });
    
    const startTime = Date.now();
    
    const instrumentedStream = pipe(
      stream,
      Stream.tap((event) =>
        Ref.update(metrics, (m) => ({
          ...m,
          eventsProcessed: m.eventsProcessed + 1,
          bytesProcessed: m.bytesProcessed + JSON.stringify(event).length,
          processingRate: (m.eventsProcessed + 1) / ((Date.now() - startTime) / 1000),
          lastEventTime: new Date(),
        }))
      ),
      Stream.catchAll((error) =>
        pipe(
          Ref.update(metrics, (m) => ({
            ...m,
            errors: m.errors + 1,
          })),
          Effect.flatMap(() => Stream.fail(error))
        )
      )
    );
    
    return {
      stream: instrumentedStream,
      metrics: () => Ref.get(metrics),
    };
  });

/**
 * Stream splitting for fan-out
 */
export const fanOut = <E extends IEvent, K extends string>(
  stream: Stream.Stream<E, Error, never>,
  routes: Record<K, (event: E) => boolean>
): Record<K, Stream.Stream<E, Error, never>> => {
  const result: Partial<Record<K, Stream.Stream<E, Error, never>>> = {};
  
  for (const [key, predicate] of Object.entries(routes) as Array<[K, (event: E) => boolean]>) {
    result[key] = pipe(stream, Stream.filter(predicate));
  }
  
  return result as Record<K, Stream.Stream<E, Error, never>>;
};

/**
 * Stream merging for fan-in
 */
export const fanIn = <E extends IEvent>(
  streams: readonly Stream.Stream<E, Error, never>[]
): Stream.Stream<E, Error, never> =>
  streams.reduce(
    (acc, stream) => Stream.merge(acc, stream),
    Stream.empty as Stream.Stream<E, Error, never>
  );