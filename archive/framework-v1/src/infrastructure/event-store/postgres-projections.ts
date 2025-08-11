/**
 * PostgreSQL Event Stream Projections
 * 
 * Real-time projections with PostgreSQL:
 * - Continuous event processing
 * - Checkpointing and resumability
 * - Parallel projection processing
 * - Projection versioning
 * - Error handling and recovery
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import { pipe } from 'effect/Function';
import type { IEvent } from '../../core/types';

/**
 * Projection state
 */
export interface ProjectionState {
  readonly name: string;
  readonly position: bigint;
  readonly lastUpdated: Date;
  readonly isRunning: boolean;
  readonly errorCount: number;
  readonly lastError?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Projection handler
 */
export interface ProjectionHandler<T = unknown> {
  readonly name: string;
  readonly initialState: T;
  readonly handlers: Record<string, (state: T, event: IEvent) => Effect.Effect<T, never, never>>;
  readonly saveInterval?: Duration.Duration;
  readonly batchSize?: number;
}

/**
 * Projection result
 */
export interface ProjectionResult<T> {
  readonly state: T;
  readonly position: bigint;
  readonly eventsProcessed: number;
}

/**
 * PostgreSQL projection store
 */
export class PostgresProjectionStore {
  constructor(
    private readonly pool: any // pg.Pool in real implementation
  ) {}
  
  /**
   * Load projection state
   */
  loadState(name: string): Effect.Effect<Option.Option<ProjectionState>, Error, never> {
    return Effect.tryPromise({
      try: async () => {
        const query = `
          SELECT * FROM projections WHERE projection_name = $1
        `;
        const result = await this.pool.query(query, [name]);
        
        if (result.rows.length === 0) {
          return Option.none();
        }
        
        const row = result.rows[0];
        return Option.some({
          name: row.projection_name,
          position: BigInt(row.last_position),
          lastUpdated: row.last_updated,
          isRunning: row.is_running,
          errorCount: row.error_count,
          lastError: row.last_error,
          metadata: row.state,
        });
      },
      catch: (e) => new Error(`Failed to load projection state: ${e}`),
    });
  }
  
  /**
   * Save projection state
   */
  saveState(
    name: string,
    position: bigint,
    state: unknown,
    error?: string
  ): Effect.Effect<void, Error, never> {
    return Effect.tryPromise({
      try: async () => {
        const query = `
          INSERT INTO projections (
            projection_name, last_position, last_updated, 
            state, is_running, error_count, last_error, last_error_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (projection_name) DO UPDATE SET
            last_position = EXCLUDED.last_position,
            last_updated = EXCLUDED.last_updated,
            state = EXCLUDED.state,
            is_running = EXCLUDED.is_running,
            error_count = CASE 
              WHEN $7 IS NOT NULL THEN projections.error_count + 1
              ELSE projections.error_count
            END,
            last_error = COALESCE($7, projections.last_error),
            last_error_at = CASE
              WHEN $7 IS NOT NULL THEN $8
              ELSE projections.last_error_at
            END
        `;
        
        await this.pool.query(query, [
          name,
          position.toString(),
          new Date(),
          JSON.stringify(state),
          true,
          0,
          error ?? null,
          error ? new Date() : null,
        ]);
      },
      catch: (e) => new Error(`Failed to save projection state: ${e}`),
    });
  }
  
  /**
   * Mark projection as stopped
   */
  markStopped(name: string): Effect.Effect<void, Error, never> {
    return Effect.tryPromise({
      try: async () => {
        const query = `
          UPDATE projections 
          SET is_running = false, last_updated = $2
          WHERE projection_name = $1
        `;
        await this.pool.query(query, [name, new Date()]);
      },
      catch: (e) => new Error(`Failed to mark projection as stopped: ${e}`),
    });
  }
  
  /**
   * Reset projection
   */
  resetProjection(name: string): Effect.Effect<void, Error, never> {
    return Effect.tryPromise({
      try: async () => {
        const query = `
          UPDATE projections 
          SET last_position = 0, state = null, error_count = 0,
              last_error = null, last_error_at = null, last_updated = $2
          WHERE projection_name = $1
        `;
        await this.pool.query(query, [name, new Date()]);
      },
      catch: (e) => new Error(`Failed to reset projection: ${e}`),
    });
  }
}

/**
 * Projection processor
 */
export class ProjectionProcessor<T> {
  private fiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();
  private currentState: Ref.Ref<T>;
  private currentPosition: Ref.Ref<bigint>;
  private isRunning: Ref.Ref<boolean>;
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    lastProcessedAt: new Date(),
  };
  
  constructor(
    private readonly handler: ProjectionHandler<T>,
    private readonly eventStore: {
      readAllEvents: (
        fromPosition?: bigint,
        maxCount?: number
      ) => Effect.Effect<IEvent[], never, never>;
      subscribe: (
        handler: (event: IEvent) => Effect.Effect<void, never, never>,
        options?: { fromPosition?: bigint }
      ) => Effect.Effect<() => Effect.Effect<void, never, never>, never, never>;
    },
    private readonly store: PostgresProjectionStore
  ) {
    this.currentState = Ref.unsafeMake(handler.initialState);
    this.currentPosition = Ref.unsafeMake(0n);
    this.isRunning = Ref.unsafeMake(false);
  }
  
  /**
   * Start projection processing
   */
  start(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const running = yield* _(Ref.get(this.isRunning));
      if (running) {
        return;
      }
      
      yield* _(Ref.set(this.isRunning, true));
      
      // Load last position
      const savedState = yield* _(this.store.loadState(this.handler.name));
      const startPosition = Option.match(savedState, {
        onNone: () => 0n,
        onSome: (state) => state.position,
      });
      
      yield* _(Ref.set(this.currentPosition, startPosition));
      
      // Start processing fiber
      const processFiber = yield* _(
        pipe(
          this.processEvents(),
          Effect.repeat(
            Schedule.spaced(Duration.seconds(1))
          ),
          Effect.fork
        )
      );
      
      this.fiber = Option.some(processFiber);
    });
  }
  
  /**
   * Stop projection processing
   */
  stop(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      yield* _(Ref.set(this.isRunning, false));
      
      if (Option.isSome(this.fiber)) {
        yield* _(Fiber.interrupt(this.fiber.value));
        this.fiber = Option.none();
      }
      
      yield* _(this.store.markStopped(this.handler.name));
    });
  }
  
  /**
   * Process events
   */
  private processEvents(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const running = yield* _(Ref.get(this.isRunning));
      if (!running) return;
      
      const position = yield* _(Ref.get(this.currentPosition));
      const batchSize = this.handler.batchSize ?? 100;
      
      // Read next batch of events
      const events = yield* _(
        this.eventStore.readAllEvents(position, batchSize)
      );
      
      if (events.length === 0) {
        return;
      }
      
      // Process each event
      let state = yield* _(Ref.get(this.currentState));
      let newPosition = position;
      let processed = 0;
      
      for (const event of events) {
        const handler = this.handler.handlers[event.type];
        if (handler) {
          const result = yield* _(
            pipe(
              handler(state, event),
              Effect.either
            )
          );
          
          if (result._tag === 'Right') {
            state = result.right;
            processed++;
          } else {
            this.metrics.errors++;
            // Log error but continue processing
            console.error(`Projection error for event ${event.id}:`, result.left);
          }
        }
        
        // Update position even if no handler (to skip event)
        newPosition = BigInt(event.metadata?.globalPosition ?? newPosition + 1n);
      }
      
      // Update state and position
      yield* _(Ref.set(this.currentState, state));
      yield* _(Ref.set(this.currentPosition, newPosition));
      
      // Save checkpoint
      yield* _(this.saveCheckpoint(state, newPosition));
      
      // Update metrics
      this.metrics.eventsProcessed += processed;
      this.metrics.lastProcessedAt = new Date();
    });
  }
  
  /**
   * Save checkpoint
   */
  private saveCheckpoint(
    state: T,
    position: bigint
  ): Effect.Effect<void, never, never> {
    return pipe(
      this.store.saveState(
        this.handler.name,
        position,
        state
      ),
      Effect.catchAll(() => Effect.unit)
    );
  }
  
  /**
   * Get current state
   */
  getState(): Effect.Effect<T, never, never> {
    return Ref.get(this.currentState);
  }
  
  /**
   * Get metrics
   */
  getMetrics(): Effect.Effect<{
    eventsProcessed: number;
    errors: number;
    lastProcessedAt: Date;
    position: bigint;
  }, never, never> {
    return Effect.gen(function* (_) {
      const position = yield* _(Ref.get(this.currentPosition));
      
      return {
        ...this.metrics,
        position,
      };
    });
  }
  
  /**
   * Reset projection
   */
  reset(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      yield* _(this.stop());
      yield* _(Ref.set(this.currentState, this.handler.initialState));
      yield* _(Ref.set(this.currentPosition, 0n));
      yield* _(this.store.resetProjection(this.handler.name));
      this.metrics = {
        eventsProcessed: 0,
        errors: 0,
        lastProcessedAt: new Date(),
      };
    });
  }
}

/**
 * Parallel projection processor
 * Processes multiple projections concurrently
 */
export class ParallelProjectionProcessor {
  private processors = new Map<string, ProjectionProcessor<any>>();
  
  constructor(
    private readonly eventStore: {
      readAllEvents: (
        fromPosition?: bigint,
        maxCount?: number
      ) => Effect.Effect<IEvent[], never, never>;
      subscribe: (
        handler: (event: IEvent) => Effect.Effect<void, never, never>,
        options?: { fromPosition?: bigint }
      ) => Effect.Effect<() => Effect.Effect<void, never, never>, never, never>;
    },
    private readonly store: PostgresProjectionStore
  ) {}
  
  /**
   * Register projection
   */
  register<T>(handler: ProjectionHandler<T>): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const processor = new ProjectionProcessor(
        handler,
        this.eventStore,
        this.store
      );
      this.processors.set(handler.name, processor);
    });
  }
  
  /**
   * Start all projections
   */
  startAll(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      for (const processor of this.processors.values()) {
        yield* _(processor.start());
      }
    });
  }
  
  /**
   * Stop all projections
   */
  stopAll(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      for (const processor of this.processors.values()) {
        yield* _(processor.stop());
      }
    });
  }
  
  /**
   * Get projection state
   */
  getProjectionState<T>(name: string): Effect.Effect<Option.Option<T>, never, never> {
    return Effect.gen(function* (_) {
      const processor = this.processors.get(name);
      if (!processor) {
        return Option.none();
      }
      
      const state = yield* _(processor.getState());
      return Option.some(state);
    });
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): Effect.Effect<Map<string, any>, never, never> {
    return Effect.gen(function* (_) {
      const metrics = new Map();
      
      for (const [name, processor] of this.processors) {
        const m = yield* _(processor.getMetrics());
        metrics.set(name, m);
      }
      
      return metrics;
    });
  }
}

/**
 * Common projections
 */
export const CommonProjections = {
  /**
   * Event count by type projection
   */
  eventTypeCount: (): ProjectionHandler<Map<string, number>> => ({
    name: 'event_type_count',
    initialState: new Map(),
    handlers: {
      '*': (state, event) => Effect.sync(() => {
        const count = state.get(event.type) ?? 0;
        state.set(event.type, count + 1);
        return state;
      }),
    },
  }),
  
  /**
   * Stream activity projection
   */
  streamActivity: (): ProjectionHandler<Map<string, {
    eventCount: number;
    lastEventAt: Date;
    eventTypes: Set<string>;
  }>> => ({
    name: 'stream_activity',
    initialState: new Map(),
    handlers: {
      '*': (state, event) => Effect.sync(() => {
        const activity = state.get(event.aggregateId) ?? {
          eventCount: 0,
          lastEventAt: new Date(),
          eventTypes: new Set<string>(),
        };
        
        activity.eventCount++;
        activity.lastEventAt = new Date(event.timestamp);
        activity.eventTypes.add(event.type);
        
        state.set(event.aggregateId, activity);
        return state;
      }),
    },
  }),
  
  /**
   * Error tracking projection
   */
  errorTracking: (): ProjectionHandler<{
    errors: Array<{
      eventId: string;
      eventType: string;
      error: string;
      timestamp: Date;
    }>;
    errorCount: number;
  }> => ({
    name: 'error_tracking',
    initialState: { errors: [], errorCount: 0 },
    handlers: {
      'ErrorOccurred': (state, event) => Effect.sync(() => {
        state.errors.push({
          eventId: event.id,
          eventType: event.type,
          error: event.data.error,
          timestamp: new Date(event.timestamp),
        });
        state.errorCount++;
        
        // Keep only last 100 errors
        if (state.errors.length > 100) {
          state.errors = state.errors.slice(-100);
        }
        
        return state;
      }),
    },
  }),
};

/**
 * Create projection processor
 */
export const createProjectionProcessor = <T>(
  handler: ProjectionHandler<T>,
  eventStore: {
    readAllEvents: (
      fromPosition?: bigint,
      maxCount?: number
    ) => Effect.Effect<IEvent[], never, never>;
    subscribe: (
      handler: (event: IEvent) => Effect.Effect<void, never, never>,
      options?: { fromPosition?: bigint }
    ) => Effect.Effect<() => Effect.Effect<void, never, never>, never, never>;
  },
  pool: any
): ProjectionProcessor<T> => {
  const store = new PostgresProjectionStore(pool);
  return new ProjectionProcessor(handler, eventStore, store);
};

/**
 * Create parallel processor
 */
export const createParallelProcessor = (
  eventStore: {
    readAllEvents: (
      fromPosition?: bigint,
      maxCount?: number
    ) => Effect.Effect<IEvent[], never, never>;
    subscribe: (
      handler: (event: IEvent) => Effect.Effect<void, never, never>,
      options?: { fromPosition?: bigint }
    ) => Effect.Effect<() => Effect.Effect<void, never, never>, never, never>;
  },
  pool: any
): ParallelProjectionProcessor => {
  const store = new PostgresProjectionStore(pool);
  return new ParallelProjectionProcessor(eventStore, store);
};