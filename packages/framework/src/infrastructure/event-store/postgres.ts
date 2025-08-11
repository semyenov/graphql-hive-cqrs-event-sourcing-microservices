/**
 * PostgreSQL Event Store Implementation
 * 
 * Persistent event store with support for:
 * - Event streams
 * - Snapshots
 * - Projections
 * - Event versioning
 * - Optimistic concurrency control
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from '@effect/schema/Schema';
import * as Layer from 'effect/Layer';
import * as Config from 'effect/Config';
import { pipe } from 'effect/Function';
import type { 
  IEvent, 
  IEventStore, 
  ISnapshot,
  AggregateId,
  EventId,
  AggregateVersion,
} from '../../core/types';
import { BrandedTypes } from '../../core/branded';

/**
 * PostgreSQL configuration
 */
export interface PostgresConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly poolSize?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
}

/**
 * Event store error types
 */
export class EventStoreError extends Error {
  readonly _tag = 'EventStoreError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export class ConcurrencyError extends EventStoreError {
  readonly _tag = 'ConcurrencyError';
  constructor(
    readonly aggregateId: AggregateId,
    readonly expectedVersion: AggregateVersion,
    readonly actualVersion: AggregateVersion
  ) {
    super(
      `Concurrency conflict for aggregate ${aggregateId}: expected version ${expectedVersion}, actual ${actualVersion}`
    );
  }
}

/**
 * Event record schema
 */
const EventRecord = Schema.struct({
  id: Schema.string,
  stream_id: Schema.string,
  stream_version: Schema.number,
  event_type: Schema.string,
  event_data: Schema.unknown,
  event_metadata: Schema.optional(Schema.unknown),
  created_at: Schema.Date,
  correlation_id: Schema.optional(Schema.string),
  causation_id: Schema.optional(Schema.string),
});

type EventRecord = Schema.Schema.Type<typeof EventRecord>;

/**
 * Snapshot record schema
 */
const SnapshotRecord = Schema.struct({
  aggregate_id: Schema.string,
  aggregate_version: Schema.number,
  snapshot_data: Schema.unknown,
  created_at: Schema.Date,
});

type SnapshotRecord = Schema.Schema.Type<typeof SnapshotRecord>;

/**
 * PostgreSQL Event Store
 */
export class PostgresEventStore implements IEventStore {
  constructor(
    private readonly pool: any, // Would be pg.Pool in real implementation
    private readonly config: PostgresConfig
  ) {}

  /**
   * Append events to stream
   */
  appendToStream(
    streamId: AggregateId,
    events: IEvent[],
    expectedVersion?: AggregateVersion
  ): Effect.Effect<void, EventStoreError, never> {
    return Effect.gen(function* (_) {
      // Begin transaction
      const client = yield* _(this.getClient());
      
      try {
        yield* _(Effect.tryPromise({
          try: () => client.query('BEGIN'),
          catch: (e) => new EventStoreError('Failed to begin transaction', e),
        }));

        // Check expected version if provided
        if (expectedVersion !== undefined) {
          const currentVersion = yield* _(this.getCurrentVersion(client, streamId));
          
          if (currentVersion !== expectedVersion) {
            throw new ConcurrencyError(streamId, expectedVersion, currentVersion);
          }
        }

        // Insert events
        let version = expectedVersion ?? BrandedTypes.aggregateVersion(0);
        
        for (const event of events) {
          version = BrandedTypes.aggregateVersion(version + 1);
          
          const query = `
            INSERT INTO events (
              id, stream_id, stream_version, event_type,
              event_data, event_metadata, created_at,
              correlation_id, causation_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;
          
          const values = [
            event.id,
            streamId,
            version,
            event.type,
            JSON.stringify(event.data),
            event.metadata ? JSON.stringify(event.metadata) : null,
            new Date(event.timestamp),
            event.metadata?.correlationId ?? null,
            event.metadata?.causationId ?? null,
          ];
          
          yield* _(Effect.tryPromise({
            try: () => client.query(query, values),
            catch: (e) => new EventStoreError('Failed to insert event', e),
          }));
        }

        // Update stream version
        yield* _(this.updateStreamVersion(client, streamId, version));

        // Commit transaction
        yield* _(Effect.tryPromise({
          try: () => client.query('COMMIT'),
          catch: (e) => new EventStoreError('Failed to commit transaction', e),
        }));
      } catch (error) {
        // Rollback on error
        yield* _(Effect.tryPromise({
          try: () => client.query('ROLLBACK'),
          catch: () => undefined, // Ignore rollback errors
        }));
        
        throw error;
      } finally {
        client.release();
      }
    });
  }

  /**
   * Read events from stream
   */
  readFromStream(
    streamId: AggregateId,
    fromVersion?: AggregateVersion,
    toVersion?: AggregateVersion
  ): Effect.Effect<IEvent[], EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = `
        SELECT * FROM events
        WHERE stream_id = $1
        ${fromVersion ? 'AND stream_version >= $2' : ''}
        ${toVersion ? 'AND stream_version <= $3' : ''}
        ORDER BY stream_version ASC
      `;
      
      const values = [
        streamId,
        ...(fromVersion ? [fromVersion] : []),
        ...(toVersion ? [toVersion] : []),
      ];
      
      const result = yield* _(Effect.tryPromise({
        try: () => this.pool.query(query, values),
        catch: (e) => new EventStoreError('Failed to read events', e),
      }));
      
      return result.rows.map(this.mapRecordToEvent);
    });
  }

  /**
   * Read all events (for projections)
   */
  readAllEvents(
    fromPosition?: bigint,
    maxCount?: number
  ): Effect.Effect<IEvent[], EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = `
        SELECT * FROM events
        ${fromPosition ? 'WHERE global_position > $1' : ''}
        ORDER BY global_position ASC
        ${maxCount ? `LIMIT ${maxCount}` : ''}
      `;
      
      const values = fromPosition ? [fromPosition.toString()] : [];
      
      const result = yield* _(Effect.tryPromise({
        try: () => this.pool.query(query, values),
        catch: (e) => new EventStoreError('Failed to read all events', e),
      }));
      
      return result.rows.map(this.mapRecordToEvent);
    });
  }

  /**
   * Save snapshot
   */
  saveSnapshot(snapshot: ISnapshot): Effect.Effect<void, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = `
        INSERT INTO snapshots (
          aggregate_id, aggregate_version, snapshot_data, created_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (aggregate_id) DO UPDATE SET
          aggregate_version = EXCLUDED.aggregate_version,
          snapshot_data = EXCLUDED.snapshot_data,
          created_at = EXCLUDED.created_at
      `;
      
      const values = [
        snapshot.aggregateId,
        snapshot.version,
        JSON.stringify(snapshot.data),
        new Date(),
      ];
      
      yield* _(Effect.tryPromise({
        try: () => this.pool.query(query, values),
        catch: (e) => new EventStoreError('Failed to save snapshot', e),
      }));
    });
  }

  /**
   * Load snapshot
   */
  loadSnapshot(
    aggregateId: AggregateId
  ): Effect.Effect<Option.Option<ISnapshot>, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = `
        SELECT * FROM snapshots
        WHERE aggregate_id = $1
        ORDER BY aggregate_version DESC
        LIMIT 1
      `;
      
      const result = yield* _(Effect.tryPromise({
        try: () => this.pool.query(query, [aggregateId]),
        catch: (e) => new EventStoreError('Failed to load snapshot', e),
      }));
      
      if (result.rows.length === 0) {
        return Option.none();
      }
      
      const row = result.rows[0];
      return Option.some({
        aggregateId: row.aggregate_id,
        version: row.aggregate_version,
        data: row.snapshot_data,
        timestamp: row.created_at.toISOString(),
      });
    });
  }

  /**
   * Subscribe to events (using LISTEN/NOTIFY)
   */
  subscribe(
    handler: (event: IEvent) => Effect.Effect<void, never, never>,
    options?: { fromPosition?: bigint; streamId?: AggregateId }
  ): Effect.Effect<() => Effect.Effect<void, never, never>, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const client = yield* _(this.getClient());
      const channel = options?.streamId 
        ? `events_stream_${options.streamId}`
        : 'events_all';
      
      // Set up notification listener
      client.on('notification', (msg: any) => {
        if (msg.channel === channel) {
          const event = JSON.parse(msg.payload);
          Effect.runPromise(handler(this.mapRecordToEvent(event)));
        }
      });
      
      // Subscribe to channel
      yield* _(Effect.tryPromise({
        try: () => client.query(`LISTEN ${channel}`),
        catch: (e) => new EventStoreError('Failed to subscribe', e),
      }));
      
      // Return unsubscribe function
      return () => Effect.gen(function* (_) {
        yield* _(Effect.tryPromise({
          try: () => client.query(`UNLISTEN ${channel}`),
          catch: () => undefined,
        }));
        client.release();
      });
    });
  }

  /**
   * Get event count for stream
   */
  getEventCount(streamId: AggregateId): Effect.Effect<number, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = 'SELECT COUNT(*) FROM events WHERE stream_id = $1';
      
      const result = yield* _(Effect.tryPromise({
        try: () => this.pool.query(query, [streamId]),
        catch: (e) => new EventStoreError('Failed to get event count', e),
      }));
      
      return parseInt(result.rows[0].count, 10);
    });
  }

  /**
   * Delete stream (for testing/cleanup)
   */
  deleteStream(streamId: AggregateId): Effect.Effect<void, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const client = yield* _(this.getClient());
      
      try {
        yield* _(Effect.tryPromise({
          try: () => client.query('BEGIN'),
          catch: (e) => new EventStoreError('Failed to begin transaction', e),
        }));

        // Delete events
        yield* _(Effect.tryPromise({
          try: () => client.query('DELETE FROM events WHERE stream_id = $1', [streamId]),
          catch: (e) => new EventStoreError('Failed to delete events', e),
        }));

        // Delete snapshots
        yield* _(Effect.tryPromise({
          try: () => client.query('DELETE FROM snapshots WHERE aggregate_id = $1', [streamId]),
          catch: (e) => new EventStoreError('Failed to delete snapshots', e),
        }));

        // Delete stream metadata
        yield* _(Effect.tryPromise({
          try: () => client.query('DELETE FROM streams WHERE stream_id = $1', [streamId]),
          catch: (e) => new EventStoreError('Failed to delete stream metadata', e),
        }));

        yield* _(Effect.tryPromise({
          try: () => client.query('COMMIT'),
          catch: (e) => new EventStoreError('Failed to commit transaction', e),
        }));
      } catch (error) {
        yield* _(Effect.tryPromise({
          try: () => client.query('ROLLBACK'),
          catch: () => undefined,
        }));
        throw error;
      } finally {
        client.release();
      }
    });
  }

  // Private helper methods
  
  private getClient(): Effect.Effect<any, EventStoreError, never> {
    return Effect.tryPromise({
      try: () => this.pool.connect(),
      catch: (e) => new EventStoreError('Failed to get database connection', e),
    });
  }

  private getCurrentVersion(
    client: any,
    streamId: AggregateId
  ): Effect.Effect<AggregateVersion, EventStoreError, never> {
    return Effect.gen(function* (_) {
      const query = 'SELECT version FROM streams WHERE stream_id = $1';
      
      const result = yield* _(Effect.tryPromise({
        try: () => client.query(query, [streamId]),
        catch: (e) => new EventStoreError('Failed to get stream version', e),
      }));
      
      if (result.rows.length === 0) {
        return BrandedTypes.aggregateVersion(0);
      }
      
      return BrandedTypes.aggregateVersion(result.rows[0].version);
    });
  }

  private updateStreamVersion(
    client: any,
    streamId: AggregateId,
    version: AggregateVersion
  ): Effect.Effect<void, EventStoreError, never> {
    return Effect.tryPromise({
      try: () => client.query(
        `INSERT INTO streams (stream_id, version, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (stream_id) DO UPDATE SET
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at`,
        [streamId, version, new Date()]
      ),
      catch: (e) => new EventStoreError('Failed to update stream version', e),
    });
  }

  private mapRecordToEvent(record: any): IEvent {
    return {
      id: record.id,
      type: record.event_type,
      aggregateId: record.stream_id,
      aggregateVersion: BrandedTypes.aggregateVersion(record.stream_version),
      timestamp: record.created_at.toISOString(),
      data: record.event_data,
      metadata: record.event_metadata,
    };
  }
}

/**
 * Create PostgreSQL Event Store Layer
 */
export const PostgresEventStoreLive = Layer.effect(
  Tag.EventStore,
  Effect.gen(function* (_) {
    const config = yield* _(Config.config(PostgresConfig));
    
    // In real implementation, would use pg library
    const Pool = yield* _(Effect.tryPromise({
      try: async () => {
        const pg = await import('pg');
        return new pg.Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          max: config.poolSize ?? 10,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
          connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
        });
      },
      catch: (e) => new EventStoreError('Failed to create connection pool', e),
    }));
    
    return new PostgresEventStore(Pool, config);
  })
);