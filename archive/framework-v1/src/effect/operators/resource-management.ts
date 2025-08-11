/**
 * Framework Effect: Resource Management
 * 
 * Operators for managing resources with automatic cleanup and scoped execution.
 */

import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as Pool from 'effect/Pool';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import * as Ref from 'effect/Ref';
import * as Exit from 'effect/Exit';

/**
 * Resource configuration
 */
export interface ResourceConfig {
  readonly name: string;
  readonly maxAge?: number;
  readonly maxIdleTime?: number;
  readonly cleanupOnError?: boolean;
}

/**
 * Bracket pattern - acquire, use, and release resources
 */
export const bracketEffect = <R, E, A, R2, E2, B>(
  acquire: Effect.Effect<A, E, R>,
  use: (resource: A) => Effect.Effect<B, E2, R2>,
  release: (resource: A, exit: Exit.Exit<B, E2>) => Effect.Effect<void, never, R>
): Effect.Effect<B, E | E2, R | R2> =>
  Effect.acquireUseRelease(acquire, use, (resource, exit) => release(resource, exit));

/**
 * Using pattern - simplified bracket for resources
 */
export const using = <R, E, A, R2, E2, B>(
  acquire: Effect.Effect<A, E, R>,
  use: (resource: A) => Effect.Effect<B, E2, R2>
): Effect.Effect<B, E | E2, R | R2 | Scope.Scope> =>
  pipe(
    Effect.acquireRelease(
      acquire,
      (resource) => Effect.sync(() => console.log(`Releasing resource: ${resource}`))
    ),
    Effect.flatMap(use)
  );

/**
 * Database connection pooling
 */
export const createDbPool = (
  connectionString: string,
  poolSize: number = 10
): Effect.Effect<{
  readonly acquire: () => Effect.Effect<{ conn: string; id: number }, Error, never>;
  readonly release: (conn: { conn: string; id: number }) => Effect.Effect<void, never, never>;
}, never, never> =>
  Effect.gen(function* (_) {
    const connections = new Array(poolSize).fill(null).map((_, i) => ({
      conn: `${connectionString}-${i}`,
      id: i,
      inUse: false,
    }));
    
    const poolRef = yield* _(Ref.make(connections));
    
    const acquire = () =>
      Effect.gen(function* (_) {
        const pool = yield* _(Ref.get(poolRef));
        const available = pool.find((c) => !c.inUse);
        
        if (!available) {
          return yield* _(Effect.fail(new Error('No connections available')));
        }
        
        available.inUse = true;
        yield* _(Ref.set(poolRef, [...pool]));
        
        return { conn: available.conn, id: available.id };
      });
    
    const release = (conn: { conn: string; id: number }) =>
      Effect.gen(function* (_) {
        const pool = yield* _(Ref.get(poolRef));
        const connection = pool.find((c) => c.id === conn.id);
        
        if (connection) {
          connection.inUse = false;
          yield* _(Ref.set(poolRef, [...pool]));
        }
      });
    
    return { acquire, release };
  });

/**
 * Resource pool configuration
 */
export interface ResourcePoolConfig {
  readonly minSize: number;
  readonly maxSize: number;
  readonly timeToLive?: number;
  readonly idleTimeToLive?: number;
  readonly acquireTimeout?: number;
}

/**
 * Create a resource pool
 */
export const createResourcePool = <R, E, A>(
  create: Effect.Effect<A, E, R>,
  destroy: (resource: A) => Effect.Effect<void, never, R>,
  config: ResourcePoolConfig
): Effect.Effect<Pool.Pool<A, E>, never, R | Scope.Scope> =>
  Pool.makeWithTTL({
    acquire: create,
    min: config.minSize,
    max: config.maxSize,
    timeToLive: Duration.seconds(config.timeToLive ?? 60),
  });

/**
 * Finalizer management
 */
export const withFinalizer = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  finalizer: () => Effect.Effect<void, never, never>
): Effect.Effect<A, E, R | Scope.Scope> =>
  pipe(
    Effect.addFinalizer(() => finalizer()),
    Effect.flatMap(() => effect)
  );

/**
 * Resource lifecycle hooks
 */
export interface ResourceLifecycle<A> {
  readonly onAcquire?: (resource: A) => Effect.Effect<void, never, never>;
  readonly onRelease?: (resource: A) => Effect.Effect<void, never, never>;
  readonly onError?: (error: unknown) => Effect.Effect<void, never, never>;
}

export const withLifecycle = <R, E, A, R2, E2, B>(
  acquire: Effect.Effect<A, E, R>,
  use: (resource: A) => Effect.Effect<B, E2, R2>,
  lifecycle: ResourceLifecycle<A>
): Effect.Effect<B, E | E2, R | R2> =>
  Effect.acquireUseRelease(
    pipe(
      acquire,
      Effect.tap((resource) => lifecycle.onAcquire?.(resource) ?? Effect.unit)
    ),
    use,
    (resource, exit) => {
      if (Exit.isFailure(exit) && lifecycle.onError) {
        return pipe(
          lifecycle.onError(Exit.causeOption(exit)),
          Effect.flatMap(() => lifecycle.onRelease?.(resource) ?? Effect.unit)
        );
      }
      return lifecycle.onRelease?.(resource) ?? Effect.unit;
    }
  );

/**
 * Reference counting for shared resources
 */
export const createRefCountedResource = <A>(
  acquire: () => Effect.Effect<A, never, never>,
  release: (resource: A) => Effect.Effect<void, never, never>
): Effect.Effect<{
  readonly get: () => Effect.Effect<A, never, never>;
  readonly release: () => Effect.Effect<void, never, never>;
}, never, never> =>
  Effect.gen(function* (_) {
    const state = yield* _(Ref.make<{
      resource: A | null;
      count: number;
    }>({ resource: null, count: 0 }));
    
    const get = (): Effect.Effect<A, never, never> =>
      Effect.gen(function* (_) {
        const current = yield* _(Ref.get(state));
        
        if (current.resource === null) {
          const resource = yield* _(acquire());
          yield* _(Ref.set(state, { resource, count: 1 }));
          return resource;
        }
        
        yield* _(Ref.update(state, (s) => ({
          ...s,
          count: s.count + 1,
        })));
        
        return current.resource;
      });
    
    const releaseRef = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const current = yield* _(Ref.get(state));
        
        if (current.resource === null || current.count === 0) {
          return;
        }
        
        if (current.count === 1) {
          yield* _(release(current.resource));
          yield* _(Ref.set(state, { resource: null, count: 0 }));
        } else {
          yield* _(Ref.update(state, (s) => ({
            ...s,
            count: s.count - 1,
          })));
        }
      });
    
    return { get, release: releaseRef };
  });

/**
 * Lazy resource initialization
 */
export const createLazyResource = <A>(
  acquire: () => Effect.Effect<A, never, never>
): Effect.Effect<() => Effect.Effect<A, never, never>, never, never> =>
  Effect.gen(function* (_) {
    const resourceRef = yield* _(Ref.make<A | null>(null));
    
    return (): Effect.Effect<A, never, never> =>
      Effect.gen(function* (_) {
        const current = yield* _(Ref.get(resourceRef));
        
        if (current !== null) {
          return current;
        }
        
        const resource = yield* _(acquire());
        yield* _(Ref.set(resourceRef, resource));
        return resource;
      });
  });

/**
 * Resource cache with TTL
 */
export const createResourceCache = <K, V>(
  fetch: (key: K) => Effect.Effect<V, never, never>,
  ttl: number
): Effect.Effect<{
  readonly get: (key: K) => Effect.Effect<V, never, never>;
  readonly invalidate: (key: K) => Effect.Effect<void, never, never>;
  readonly clear: () => Effect.Effect<void, never, never>;
}, never, never> =>
  Effect.gen(function* (_) {
    const cache = yield* _(Ref.make(
      new Map<K, { value: V; expiry: number }>()
    ));
    
    const get = (key: K): Effect.Effect<V, never, never> =>
      Effect.gen(function* (_) {
        const now = Date.now();
        const current = yield* _(Ref.get(cache));
        const entry = current.get(key);
        
        if (entry && entry.expiry > now) {
          return entry.value;
        }
        
        const value = yield* _(fetch(key));
        yield* _(Ref.update(cache, (map) => {
          const newMap = new Map(map);
          newMap.set(key, { value, expiry: now + ttl });
          return newMap;
        }));
        
        return value;
      });
    
    const invalidate = (key: K) =>
      Ref.update(cache, (map) => {
        const newMap = new Map(map);
        newMap.delete(key);
        return newMap;
      });
    
    const clear = () =>
      Ref.set(cache, new Map());
    
    return { get, invalidate, clear };
  });