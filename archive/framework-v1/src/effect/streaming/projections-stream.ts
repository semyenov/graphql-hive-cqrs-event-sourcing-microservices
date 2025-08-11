/**
 * Framework Effect: Streaming Projections
 * 
 * Build projections from event streams with real-time updates.
 */

import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as STM from 'effect/STM';
import * as Option from 'effect/Option';
import * as HashMap from 'effect/HashMap';
import { pipe } from 'effect/Function';
import type { IEvent, IProjection } from '../core/types';

/**
 * Streaming projection configuration
 */
export interface StreamingProjectionConfig<S, E extends IEvent> {
  readonly name: string;
  readonly initialState: S;
  readonly handlers: Partial<Record<E['type'], (state: S, event: E) => S>>;
  readonly snapshotInterval?: number;
  readonly persistState?: (state: S) => Effect.Effect<void, Error, never>;
  readonly loadState?: () => Effect.Effect<S | null, Error, never>;
}

/**
 * Projection state with metadata
 */
export interface ProjectionState<S> {
  readonly state: S;
  readonly version: number;
  readonly lastEventId?: string;
  readonly lastUpdated: Date;
  readonly eventsProcessed: number;
}

/**
 * Create a streaming projection
 */
export const createStreamingProjection = <S, E extends IEvent>(
  config: StreamingProjectionConfig<S, E>
): Effect.Effect<{
  readonly process: (stream: Stream.Stream<E, Error, never>) => Stream.Stream<ProjectionState<S>, Error, never>;
  readonly getState: () => Effect.Effect<ProjectionState<S>, never, never>;
  readonly reset: () => Effect.Effect<void, never, never>;
}, Error, never> =>
  Effect.gen(function* () {
    // Load initial state if persisted
    const loadedState = config.loadState
      ? yield* pipe(
          config.loadState(),
          Effect.orElseSucceed(() => null)
        )
      : null;
    
    const stateRef = yield* Ref.make<ProjectionState<S>>({
      state: loadedState ?? config.initialState,
      version: 0,
      lastUpdated: new Date(),
      eventsProcessed: 0,
    });
    
    const process = (stream: Stream.Stream<E, Error, never>) =>
      pipe(
        stream,
        Stream.mapEffect((event) =>
          Effect.gen(function* () {
            const handler = config.handlers[event.type];
            
            if (!handler) {
              // No handler for this event type, skip
              return yield* Ref.get(stateRef);
            }
            
            const updated = yield* Ref.updateAndGet(stateRef, (current) => {
              const newState = handler(current.state, event);
              return {
                state: newState,
                version: current.version + 1,
                lastEventId: (event as any).eventId ?? (event as any).id,
                lastUpdated: new Date(),
                eventsProcessed: current.eventsProcessed + 1,
              };
            });
            
            // Persist snapshot if interval reached
            if (
              config.snapshotInterval &&
              config.persistState &&
              updated.eventsProcessed % config.snapshotInterval === 0
            ) {
              yield* pipe(
                config.persistState(updated.state),
                Effect.catchAll((error) =>
                  Effect.sync(() =>
                    console.error(`Failed to persist projection state: ${error}`)
                  )
                )
              );
            }
            
            return updated;
          })
        )
      );
    
    const getState = () => Ref.get(stateRef);
    
    const reset = () =>
      Ref.set(stateRef, {
        state: config.initialState,
        version: 0,
        lastUpdated: new Date(),
        eventsProcessed: 0,
      });
    
    return { process, getState, reset };
  });

/**
 * Multi-stream projection that combines events from multiple streams
 */
export const createMultiStreamProjection = <S, E extends IEvent>(
  config: StreamingProjectionConfig<S, E> & {
    streams: Record<string, Stream.Stream<E, Error, never>>;
  }
): Stream.Stream<ProjectionState<S>, Error, never> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const projection = yield* createStreamingProjection(config);
      
      // Merge all streams
      const mergedStream = Object.values(config.streams).reduce(
        (acc, stream) => Stream.merge(acc, stream),
        Stream.empty as Stream.Stream<E, Error, never>
      );
      
      return projection.process(mergedStream);
    })
  );

/**
 * Keyed projection for entity-based projections
 */
export interface KeyedProjection<K, S, E extends IEvent> {
  readonly get: (key: K) => Effect.Effect<Option.Option<S>, never, never>;
  readonly getAll: () => Effect.Effect<HashMap.HashMap<K, S>, never, never>;
  readonly process: (stream: Stream.Stream<E, Error, never>) => Stream.Stream<void, Error, never>;
  readonly delete: (key: K) => Effect.Effect<void, never, never>;
  readonly clear: () => Effect.Effect<void, never, never>;
}

export const createKeyedProjection = <K, S, E extends IEvent>(
  config: {
    name: string;
    keyExtractor: (event: E) => K;
    initialState: (key: K) => S;
    handlers: Partial<Record<E['type'], (state: S | undefined, event: E) => S | null>>;
  }
): Effect.Effect<KeyedProjection<K, S, E>, never, never> =>
  Effect.gen(function* () {
    const stateMap = yield* Ref.make(HashMap.empty<K, S>());
    
    const get = (key: K) =>
      pipe(
        Ref.get(stateMap),
        Effect.map((map) => HashMap.get(map, key))
      );
    
    const getAll = () => Ref.get(stateMap);
    
    const process = (stream: Stream.Stream<E, Error, never>) =>
      pipe(
        stream,
        Stream.mapEffect((event) =>
          Effect.gen(function* () {
            const key = config.keyExtractor(event);
            const handler = config.handlers[event.type];
            
            if (!handler) {
              return;
            }
            
            yield* Ref.update(stateMap, (map) => {
              const currentState = HashMap.get(map, key);
              const newState = handler(
                Option.isSome(currentState) ? currentState.value : undefined,
                event
              );
              
              if (newState === null) {
                // Remove the entry
                return HashMap.remove(map, key);
              }
              
              return HashMap.set(map, key, newState);
            });
          })
        )
      );
    
    const deleteKey = (key: K) =>
      Ref.update(stateMap, (map) => HashMap.remove(map, key));
    
    const clear = () => Ref.set(stateMap, HashMap.empty<K, S>());
    
    return {
      get,
      getAll,
      process,
      delete: deleteKey,
      clear,
    };
  });

/**
 * Transactional projection with STM
 */
export const createTransactionalProjection = <S, E extends IEvent>(
  config: StreamingProjectionConfig<S, E>
): Effect.Effect<{
  readonly process: (stream: Stream.Stream<E, Error, never>) => Stream.Stream<S, Error, never>;
  readonly getState: STM.STM<S, never, never>;
  readonly update: (f: (state: S) => S) => STM.STM<void, never, never>;
}, never, never> =>
  Effect.gen(function* () {
    const stateRef = yield* STM.TRef.make(config.initialState);
    
    const process = (stream: Stream.Stream<E, Error, never>) =>
      pipe(
        stream,
        Stream.mapEffect((event) =>
          STM.gen(function* () {
            const handler = config.handlers[event.type];
            
            if (!handler) {
              return yield* STM.TRef.get(stateRef);
            }
            
            const currentState = yield* STM.TRef.get(stateRef);
            const newState = handler(currentState, event);
            yield* STM.TRef.set(stateRef, newState);
            
            return newState;
          }).pipe(STM.commit)
        )
      );
    
    const getState = STM.TRef.get(stateRef);
    
    const update = (f: (state: S) => S) =>
      STM.TRef.update(stateRef, f);
    
    return { process, getState, update };
  });

/**
 * Windowed projection for time-based aggregations
 */
export const createWindowedProjection = <S, E extends IEvent>(
  config: StreamingProjectionConfig<S, E> & {
    windowSize: number; // in milliseconds
    slideInterval?: number; // in milliseconds, defaults to windowSize
  }
): Stream.Stream<ProjectionState<S>, Error, never> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const windows = yield* Ref.make<
        Array<{
          startTime: number;
          endTime: number;
          state: ProjectionState<S>;
        }>
      >([]);
      
      const projection = yield* createStreamingProjection(config);
      
      return (stream: Stream.Stream<E, Error, never>) =>
        pipe(
          stream,
          Stream.groupedWithin(
            Number.MAX_SAFE_INTEGER,
            Duration.millis(config.slideInterval ?? config.windowSize)
          ),
          Stream.mapEffect((chunk) =>
            Effect.gen(function* () {
              const now = Date.now();
              const windowStart = now - config.windowSize;
              
              // Process events in the current window
              const windowStream = Stream.fromIterable(chunk);
              const states = yield* Stream.runCollect(
                projection.process(windowStream)
              );
              
              if (states.length === 0) {
                return yield* projection.getState();
              }
              
              const latestState = states[states.length - 1];
              
              // Update windows
              yield* Ref.update(windows, (wins) => {
                const newWindow = {
                  startTime: windowStart,
                  endTime: now,
                  state: latestState,
                };
                
                // Remove old windows and add new one
                const filtered = wins.filter((w) => w.endTime > windowStart);
                return [...filtered, newWindow];
              });
              
              return latestState;
            })
          )
        );
    })
  );

/**
 * Projection composition - combine multiple projections
 */
export const composeProjections = <S1, S2, E extends IEvent>(
  projection1: StreamingProjectionConfig<S1, E>,
  projection2: StreamingProjectionConfig<S2, E>
): StreamingProjectionConfig<{ p1: S1; p2: S2 }, E> => ({
  name: `${projection1.name}_${projection2.name}`,
  initialState: {
    p1: projection1.initialState,
    p2: projection2.initialState,
  },
  handlers: Object.keys({ ...projection1.handlers, ...projection2.handlers }).reduce(
    (acc, eventType) => {
      const handler1 = projection1.handlers[eventType as E['type']];
      const handler2 = projection2.handlers[eventType as E['type']];
      
      acc[eventType as E['type']] = (state, event) => ({
        p1: handler1 ? handler1(state.p1, event) : state.p1,
        p2: handler2 ? handler2(state.p2, event) : state.p2,
      });
      
      return acc;
    },
    {} as Partial<Record<E['type'], (state: { p1: S1; p2: S2 }, event: E) => { p1: S1; p2: S2 }>>
  ),
});

/**
 * Materialized view from projection
 */
export interface MaterializedView<S> {
  readonly query: () => Effect.Effect<S, never, never>;
  readonly refresh: () => Effect.Effect<void, Error, never>;
  readonly subscribe: (callback: (state: S) => void) => () => void;
}

export const createMaterializedView = <S, E extends IEvent>(
  projection: StreamingProjectionConfig<S, E>,
  eventStream: Stream.Stream<E, Error, never>
): Effect.Effect<MaterializedView<S>, Error, never> =>
  Effect.gen(function* () {
    const proj = yield* createStreamingProjection(projection);
    const subscribers = yield* Ref.make<Set<(state: S) => void>>(new Set());
    
    // Start processing in background
    yield* pipe(
      proj.process(eventStream),
      Stream.tap((state) =>
        Effect.gen(function* () {
          const subs = yield* Ref.get(subscribers);
          for (const callback of subs) {
            callback(state.state);
          }
        })
      ),
      Stream.runDrain,
      Effect.forkDaemon
    );
    
    const query = () =>
      pipe(
        proj.getState(),
        Effect.map((state) => state.state)
      );
    
    const refresh = () =>
      Effect.sync(() => {
        // In a real implementation, this would trigger a re-read from event store
        console.log('Refreshing materialized view...');
      });
    
    const subscribe = (callback: (state: S) => void) => {
      Effect.runSync(
        Ref.update(subscribers, (set) => {
          const newSet = new Set(set);
          newSet.add(callback);
          return newSet;
        })
      );
      
      return () => {
        Effect.runSync(
          Ref.update(subscribers, (set) => {
            const newSet = new Set(set);
            newSet.delete(callback);
            return newSet;
          })
        );
      };
    };
    
    return { query, refresh, subscribe };
  });

// Import Duration for the windowed projection
import * as Duration from 'effect/Duration';