/**
 * Framework Effect: Stream Operators
 * 
 * Stream transformation and control operators for event processing.
 */

import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';
import * as Chunk from 'effect/Chunk';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Buffer events into chunks
 */
export const buffer = <A, E, R>(
  size: number,
  timeout?: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<Chunk.Chunk<A>, E, R> =>
  timeout
    ? Stream.groupedWithin(stream, size, Duration.millis(timeout))
    : Stream.grouped(stream, size);

/**
 * Throttle stream to limit throughput
 */
export const throttle = <A, E, R>(
  ratePerSecond: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> => {
  const delayMs = 1000 / ratePerSecond;
  
  return pipe(
    stream,
    Stream.metered(Duration.millis(delayMs))
  );
};

/**
 * Debounce stream to emit only after quiet period
 */
export const debounce = <A, E, R>(
  duration: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.debounce(stream, Duration.millis(duration));

/**
 * Window stream by time
 */
export const window = <A, E, R>(
  windowSize: number,
  slideInterval?: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<Chunk.Chunk<A>, E, R> =>
  Stream.groupedWithin(
    stream,
    Number.MAX_SAFE_INTEGER,
    Duration.millis(slideInterval ?? windowSize)
  );

/**
 * Sample stream at regular intervals
 */
export const sample = <A, E, R>(
  interval: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const latestValue = yield* Ref.make<Option.Option<A>>(Option.none());
      
      const sampled = Stream.repeatEffectOption(
        pipe(
          Effect.sleep(Duration.millis(interval)),
          Effect.flatMap(() => Ref.get(latestValue)),
          Effect.map((opt) =>
            Option.isSome(opt) ? Option.some(opt.value) : Option.none()
          )
        )
      );
      
      const updating = pipe(
        stream,
        Stream.tap((value) => Ref.set(latestValue, Option.some(value))),
        Stream.drain
      );
      
      return Stream.merge(sampled, updating);
    })
  );

/**
 * Distinct elements based on key
 */
export const distinct = <A, E, R, K>(
  keyExtractor: (a: A) => K
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const seen = yield* Ref.make(new Set<K>());
      
      return pipe(
        stream,
        Stream.filter((item) =>
          Effect.gen(function* () {
            const key = keyExtractor(item);
            const seenKeys = yield* Ref.get(seen);
            
            if (seenKeys.has(key)) {
              return false;
            }
            
            yield* Ref.update(seen, (set) => {
              const newSet = new Set(set);
              newSet.add(key);
              return newSet;
            });
            
            return true;
          })
        )
      );
    })
  );

/**
 * Scan (reduce) over stream
 */
export const scan = <A, E, R, B>(
  initial: B,
  f: (acc: B, value: A) => B
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<B, E, R> =>
  Stream.scan(stream, initial, f);

/**
 * Take until condition is met
 */
export const takeUntil = <A, E, R>(
  predicate: (a: A) => boolean
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.takeUntil(stream, predicate);

/**
 * Drop until condition is met
 */
export const dropUntil = <A, E, R>(
  predicate: (a: A) => boolean
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.dropUntil(stream, predicate);

/**
 * Split stream at delimiter
 */
export const split = <A, E, R>(
  delimiter: (a: A) => boolean
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<Chunk.Chunk<A>, E, R> =>
  Stream.split(stream, delimiter);

/**
 * Merge sorted streams
 */
export const mergeSorted = <A, E, R>(
  compare: (a1: A, a2: A) => number,
  ...streams: Stream.Stream<A, E, R>[]
): Stream.Stream<A, E, R> => {
  if (streams.length === 0) return Stream.empty;
  if (streams.length === 1) return streams[0];
  
  return streams.reduce((acc, stream) =>
    Stream.mergeWith(
      acc,
      stream,
      (selfDone, otherDone) => {
        if (selfDone && otherDone) return undefined;
        if (selfDone) return { pull: 'right' as const };
        if (otherDone) return { pull: 'left' as const };
        return { pull: 'both' as const };
      }
    )
  );
};

/**
 * Zip streams together
 */
export const zip = <A, E, R, B, E2, R2>(
  stream1: Stream.Stream<A, E, R>,
  stream2: Stream.Stream<B, E2, R2>
): Stream.Stream<[A, B], E | E2, R | R2> =>
  Stream.zip(stream1, stream2);

/**
 * Combine latest values from streams
 */
export const combineLatest = <A, E, R>(
  ...streams: Stream.Stream<A, E, R>[]
): Stream.Stream<A[], E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const latestValues = yield* Ref.make<(A | undefined)[]>(
        new Array(streams.length).fill(undefined)
      );
      
      const combined = streams.map((stream, index) =>
        pipe(
          stream,
          Stream.tap((value) =>
            Ref.update(latestValues, (values) => {
              const newValues = [...values];
              newValues[index] = value;
              return newValues;
            })
          ),
          Stream.mapEffect(() =>
            pipe(
              Ref.get(latestValues),
              Effect.map((values) =>
                values.every((v) => v !== undefined)
                  ? Option.some(values as A[])
                  : Option.none()
              )
            )
          ),
          Stream.someOrFail
        )
      );
      
      return combined.reduce((acc, stream) => Stream.merge(acc, stream));
    })
  );

/**
 * Retry failed stream items
 */
export const retryItems = <A, E, R>(
  maxAttempts: number,
  backoff?: (attempt: number) => number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  pipe(
    stream,
    Stream.mapEffect((item) =>
      Effect.retry(
        Effect.succeed(item),
        Schedule.exponential(Duration.millis(backoff?.(1) ?? 1000)).pipe(
          Schedule.compose(Schedule.recurs(maxAttempts - 1))
        )
      )
    )
  );

/**
 * Timeout stream items
 */
export const timeoutItems = <A, E, R>(
  duration: number,
  onTimeout: () => A
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  pipe(
    stream,
    Stream.mapEffect((item) =>
      pipe(
        Effect.succeed(item),
        Effect.timeout(Duration.millis(duration)),
        Effect.map((opt) => (Option.isSome(opt) ? opt.value : onTimeout()))
      )
    )
  );

/**
 * Batch stream items with custom logic
 */
export const batchWith = <A, E, R>(
  shouldBatch: (current: A[], next: A) => boolean,
  maxBatchSize: number
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A[], E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const batch = yield* Ref.make<A[]>([]);
      
      return pipe(
        stream,
        Stream.mapEffect((item) =>
          Effect.gen(function* () {
            const currentBatch = yield* Ref.get(batch);
            
            if (
              currentBatch.length === 0 ||
              (shouldBatch(currentBatch, item) && currentBatch.length < maxBatchSize)
            ) {
              yield* Ref.update(batch, (b) => [...b, item]);
              return Option.none<A[]>();
            }
            
            yield* Ref.set(batch, [item]);
            return Option.some(currentBatch);
          })
        ),
        Stream.someOrFail,
        Stream.concat(
          Stream.fromEffect(
            pipe(
              Ref.get(batch),
              Effect.map((b) => (b.length > 0 ? Option.some(b) : Option.none())),
              Effect.someOrFailSync(() => new Error('No final batch'))
            )
          )
        )
      );
    })
  );

/**
 * Rate limit stream with token bucket
 */
export const rateLimit = <A, E, R>(
  tokensPerSecond: number,
  burstSize: number = tokensPerSecond
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const tokens = yield* Ref.make(burstSize);
      const lastRefill = yield* Ref.make(Date.now());
      
      const refillTokens = Effect.gen(function* () {
        const now = Date.now();
        const last = yield* Ref.get(lastRefill);
        const elapsed = (now - last) / 1000;
        const newTokens = Math.min(
          burstSize,
          (yield* Ref.get(tokens)) + elapsed * tokensPerSecond
        );
        
        yield* Ref.set(tokens, newTokens);
        yield* Ref.set(lastRefill, now);
      });
      
      return pipe(
        stream,
        Stream.mapEffect((item) =>
          Effect.gen(function* () {
            yield* refillTokens;
            
            while ((yield* Ref.get(tokens)) < 1) {
              yield* Effect.sleep(Duration.millis(100));
              yield* refillTokens;
            }
            
            yield* Ref.update(tokens, (t) => t - 1);
            return item;
          })
        )
      );
    })
  );

/**
 * Advanced operators for event streams
 */

/**
 * Correlate events by ID
 */
export const correlate = <A extends { correlationId?: string }, E, R>(
  timeout: number = 60000
) => (
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A[], E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const correlations = yield* Ref.make(
        new Map<string, { items: A[]; timestamp: number }>()
      );
      
      // Cleanup old correlations
      const cleanup = Effect.gen(function* () {
        const now = Date.now();
        yield* Ref.update(correlations, (map) => {
          const newMap = new Map(map);
          for (const [id, data] of newMap) {
            if (now - data.timestamp > timeout) {
              newMap.delete(id);
            }
          }
          return newMap;
        });
      });
      
      yield* pipe(
        Effect.repeat(cleanup, Schedule.fixed(Duration.seconds(10))),
        Effect.forkDaemon
      );
      
      return pipe(
        stream,
        Stream.mapEffect((item) =>
          Effect.gen(function* () {
            if (!item.correlationId) {
              return Option.some([item]);
            }
            
            const updated = yield* Ref.updateAndGet(correlations, (map) => {
              const newMap = new Map(map);
              const existing = newMap.get(item.correlationId!) ?? {
                items: [],
                timestamp: Date.now(),
              };
              
              newMap.set(item.correlationId!, {
                items: [...existing.items, item],
                timestamp: Date.now(),
              });
              
              return newMap;
            });
            
            const correlated = updated.get(item.correlationId!);
            return correlated ? Option.some(correlated.items) : Option.none();
          })
        ),
        Stream.someOrFail
      );
    })
  );

// Import Schedule for retry operator
import * as Schedule from 'effect/Schedule';