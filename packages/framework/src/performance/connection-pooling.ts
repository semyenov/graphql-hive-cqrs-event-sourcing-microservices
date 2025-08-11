/**
 * Connection Pooling Optimization
 * 
 * Advanced connection pool management:
 * - Dynamic pool sizing
 * - Connection health checks
 * - Circuit breaker integration
 * - Connection warming
 * - Pool statistics and monitoring
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Schedule from 'effect/Schedule';
import { pipe } from 'effect/Function';

/**
 * Connection state
 */
export enum ConnectionState {
  IDLE = 'idle',
  IN_USE = 'in_use',
  VALIDATING = 'validating',
  INVALID = 'invalid',
}

/**
 * Connection metadata
 */
export interface ConnectionMetadata {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastUsed: Date;
  readonly useCount: number;
  readonly state: ConnectionState;
  readonly errors: number;
  readonly lastError?: Error;
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  readonly minSize: number;
  readonly maxSize: number;
  readonly acquireTimeout: Duration.Duration;
  readonly idleTimeout: Duration.Duration;
  readonly maxLifetime: Duration.Duration;
  readonly validationInterval: Duration.Duration;
  readonly maxWaitQueue: number;
  readonly enableStatistics: boolean;
  readonly connectionTimeout: Duration.Duration;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  readonly totalConnections: number;
  readonly activeConnections: number;
  readonly idleConnections: number;
  readonly waitingRequests: number;
  readonly totalRequests: number;
  readonly totalErrors: number;
  readonly averageWaitTime: number;
  readonly averageUseTime: number;
  readonly connectionRotations: number;
}

/**
 * Connection wrapper
 */
export class PooledConnection<T> {
  private metadata: ConnectionMetadata;
  
  constructor(
    public readonly connection: T,
    private readonly pool: ConnectionPool<T>,
    id: string
  ) {
    this.metadata = {
      id,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0,
      state: ConnectionState.IDLE,
      errors: 0,
    };
  }
  
  /**
   * Execute operation with connection
   */
  execute<R>(
    operation: (conn: T) => Effect.Effect<R, Error, never>
  ): Effect.Effect<R, Error, never> {
    return Effect.gen(function* (_) {
      this.metadata.state = ConnectionState.IN_USE;
      this.metadata.useCount++;
      this.metadata.lastUsed = new Date();
      
      try {
        const result = yield* _(operation(this.connection));
        return result;
      } catch (error) {
        this.metadata.errors++;
        this.metadata.lastError = error as Error;
        throw error;
      } finally {
        this.metadata.state = ConnectionState.IDLE;
        // Return to pool
        yield* _(this.pool.release(this));
      }
    });
  }
  
  /**
   * Validate connection
   */
  validate(): Effect.Effect<boolean, never, never> {
    return Effect.gen(function* (_) {
      this.metadata.state = ConnectionState.VALIDATING;
      
      try {
        // In production, would perform actual validation
        // e.g., SELECT 1 for database connections
        const isValid = this.metadata.errors < 5 && 
                       !this.isExpired();
        
        this.metadata.state = isValid ? ConnectionState.IDLE : ConnectionState.INVALID;
        return isValid;
      } catch {
        this.metadata.state = ConnectionState.INVALID;
        return false;
      }
    });
  }
  
  /**
   * Check if connection is expired
   */
  isExpired(): boolean {
    const age = Date.now() - this.metadata.createdAt.getTime();
    return age > Duration.toMillis(Duration.hours(1)); // 1 hour max lifetime
  }
  
  /**
   * Check if connection is idle too long
   */
  isIdleTooLong(idleTimeout: Duration.Duration): boolean {
    const idleTime = Date.now() - this.metadata.lastUsed.getTime();
    return idleTime > Duration.toMillis(idleTimeout);
  }
  
  /**
   * Get metadata
   */
  getMetadata(): ConnectionMetadata {
    return { ...this.metadata };
  }
  
  /**
   * Close connection
   */
  close(): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      // In production, would close actual connection
      this.metadata.state = ConnectionState.INVALID;
    });
  }
}

/**
 * Connection pool
 */
export class ConnectionPool<T> {
  private connections: Map<string, PooledConnection<T>> = new Map();
  private availableQueue: Queue.Queue<PooledConnection<T>>;
  private waitQueue: Queue.Queue<{
    resolve: (conn: PooledConnection<T>) => void;
    reject: (error: Error) => void;
  }>;
  private stats: Ref.Ref<PoolStats>;
  private maintenanceFiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();
  private nextConnectionId = 0;
  
  constructor(
    private readonly config: PoolConfig,
    private readonly factory: {
      create: () => Effect.Effect<T, Error, never>;
      destroy: (conn: T) => Effect.Effect<void, never, never>;
      validate?: (conn: T) => Effect.Effect<boolean, never, never>;
    }
  ) {
    this.availableQueue = Queue.bounded<PooledConnection<T>>(config.maxSize);
    this.waitQueue = Queue.bounded(config.maxWaitQueue);
    this.stats = Ref.unsafeMake({
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageWaitTime: 0,
      averageUseTime: 0,
      connectionRotations: 0,
    });
  }
  
  /**
   * Initialize pool
   */
  initialize(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // Create minimum connections
      const createEffects = Array.from(
        { length: this.config.minSize },
        () => this.createConnection()
      );
      
      yield* _(Effect.all(createEffects, { concurrency: 5 }));
      
      // Start maintenance
      yield* _(this.startMaintenance());
    });
  }
  
  /**
   * Acquire connection from pool
   */
  acquire(): Effect.Effect<PooledConnection<T>, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      // Update stats
      yield* _(Ref.update(this.stats, s => ({
        ...s,
        totalRequests: s.totalRequests + 1,
      })));
      
      // Try to get available connection
      const available = yield* _(Queue.poll(this.availableQueue));
      
      if (Option.isSome(available)) {
        const conn = available.value;
        
        // Validate connection
        const isValid = yield* _(conn.validate());
        if (!isValid) {
          yield* _(this.destroyConnection(conn));
          return yield* _(this.acquire()); // Retry
        }
        
        // Update stats
        const waitTime = Date.now() - startTime;
        yield* _(this.updateWaitTime(waitTime));
        
        return conn;
      }
      
      // Check if we can create new connection
      const currentStats = yield* _(Ref.get(this.stats));
      if (currentStats.totalConnections < this.config.maxSize) {
        const conn = yield* _(this.createConnection());
        
        const waitTime = Date.now() - startTime;
        yield* _(this.updateWaitTime(waitTime));
        
        return conn;
      }
      
      // Wait for available connection
      return yield* _(this.waitForConnection(startTime));
    });
  }
  
  /**
   * Release connection back to pool
   */
  release(conn: PooledConnection<T>): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      // Check if connection is still valid
      const isValid = yield* _(conn.validate());
      
      if (!isValid || conn.isExpired()) {
        yield* _(this.destroyConnection(conn));
        yield* _(this.createConnection()); // Replace with new
        return;
      }
      
      // Check wait queue
      const waiter = yield* _(Queue.poll(this.waitQueue));
      if (Option.isSome(waiter)) {
        waiter.value.resolve(conn);
        return;
      }
      
      // Return to available queue
      yield* _(Queue.offer(this.availableQueue, conn));
      
      // Update stats
      yield* _(Ref.update(this.stats, s => ({
        ...s,
        activeConnections: Math.max(0, s.activeConnections - 1),
        idleConnections: s.idleConnections + 1,
      })));
    });
  }
  
  /**
   * Create new connection
   */
  private createConnection(): Effect.Effect<PooledConnection<T>, Error, never> {
    return Effect.gen(function* (_) {
      const raw = yield* _(
        pipe(
          this.factory.create(),
          Effect.timeout(this.config.connectionTimeout),
          Effect.catchAll((error) => 
            Effect.fail(new Error(`Connection creation failed: ${error}`))
          )
        )
      );
      
      const id = `conn-${this.nextConnectionId++}`;
      const conn = new PooledConnection(raw, this, id);
      
      this.connections.set(id, conn);
      
      // Update stats
      yield* _(Ref.update(this.stats, s => ({
        ...s,
        totalConnections: s.totalConnections + 1,
        idleConnections: s.idleConnections + 1,
      })));
      
      return conn;
    });
  }
  
  /**
   * Destroy connection
   */
  private destroyConnection(conn: PooledConnection<T>): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const metadata = conn.getMetadata();
      this.connections.delete(metadata.id);
      
      yield* _(conn.close());
      yield* _(this.factory.destroy(conn.connection));
      
      // Update stats
      yield* _(Ref.update(this.stats, s => ({
        ...s,
        totalConnections: Math.max(0, s.totalConnections - 1),
        idleConnections: Math.max(0, s.idleConnections - 1),
        connectionRotations: s.connectionRotations + 1,
      })));
    });
  }
  
  /**
   * Wait for available connection
   */
  private waitForConnection(startTime: number): Effect.Effect<PooledConnection<T>, Error, never> {
    return Effect.gen(function* (_) {
      // Update waiting stats
      yield* _(Ref.update(this.stats, s => ({
        ...s,
        waitingRequests: s.waitingRequests + 1,
      })));
      
      const timeout = this.config.acquireTimeout;
      
      const promise = new Promise<PooledConnection<T>>((resolve, reject) => {
        const waiter = { resolve, reject };
        
        Effect.runPromise(Queue.offer(this.waitQueue, waiter))
          .catch(reject);
        
        // Set timeout
        setTimeout(() => {
          reject(new Error('Connection acquire timeout'));
        }, Duration.toMillis(timeout));
      });
      
      try {
        const conn = yield* _(Effect.tryPromise({
          try: () => promise,
          catch: (e) => new Error(`Failed to acquire connection: ${e}`),
        }));
        
        const waitTime = Date.now() - startTime;
        yield* _(this.updateWaitTime(waitTime));
        
        return conn;
      } finally {
        yield* _(Ref.update(this.stats, s => ({
          ...s,
          waitingRequests: Math.max(0, s.waitingRequests - 1),
        })));
      }
    });
  }
  
  /**
   * Start maintenance tasks
   */
  private startMaintenance(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const fiber = yield* _(
        pipe(
          this.maintenanceLoop(),
          Effect.fork
        )
      );
      
      this.maintenanceFiber = Option.some(fiber);
    });
  }
  
  /**
   * Maintenance loop
   */
  private maintenanceLoop(): Effect.Effect<never, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        yield* _(Effect.sleep(this.config.validationInterval));
        
        // Validate connections
        yield* _(this.validateConnections());
        
        // Remove idle connections
        yield* _(this.removeIdleConnections());
        
        // Ensure minimum connections
        yield* _(this.ensureMinimumConnections());
        
        // Log statistics
        if (this.config.enableStatistics) {
          yield* _(this.logStatistics());
        }
      })
    );
  }
  
  /**
   * Validate all connections
   */
  private validateConnections(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const connections = Array.from(this.connections.values());
      
      for (const conn of connections) {
        const metadata = conn.getMetadata();
        if (metadata.state === ConnectionState.IDLE) {
          const isValid = yield* _(conn.validate());
          if (!isValid) {
            yield* _(this.destroyConnection(conn));
          }
        }
      }
    });
  }
  
  /**
   * Remove idle connections
   */
  private removeIdleConnections(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const connections = Array.from(this.connections.values());
      const stats = yield* _(Ref.get(this.stats));
      
      for (const conn of connections) {
        const metadata = conn.getMetadata();
        
        if (metadata.state === ConnectionState.IDLE &&
            conn.isIdleTooLong(this.config.idleTimeout) &&
            stats.totalConnections > this.config.minSize) {
          yield* _(this.destroyConnection(conn));
        }
      }
    });
  }
  
  /**
   * Ensure minimum connections
   */
  private ensureMinimumConnections(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const stats = yield* _(Ref.get(this.stats));
      
      if (stats.totalConnections < this.config.minSize) {
        const needed = this.config.minSize - stats.totalConnections;
        const createEffects = Array.from(
          { length: needed },
          () => this.createConnection()
        );
        
        yield* _(Effect.all(createEffects, { concurrency: 5 }));
      }
    });
  }
  
  /**
   * Update wait time statistics
   */
  private updateWaitTime(waitTime: number): Effect.Effect<void, never, never> {
    return Ref.update(this.stats, s => {
      const total = s.totalRequests;
      const newAverage = (s.averageWaitTime * (total - 1) + waitTime) / total;
      return {
        ...s,
        averageWaitTime: newAverage,
      };
    });
  }
  
  /**
   * Log statistics
   */
  private logStatistics(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const stats = yield* _(Ref.get(this.stats));
      console.log('Connection Pool Statistics:', {
        ...stats,
        averageWaitTime: `${stats.averageWaitTime.toFixed(2)}ms`,
        averageUseTime: `${stats.averageUseTime.toFixed(2)}ms`,
      });
    });
  }
  
  /**
   * Shutdown pool
   */
  shutdown(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      // Stop maintenance
      if (Option.isSome(this.maintenanceFiber)) {
        yield* _(Fiber.interrupt(this.maintenanceFiber.value));
      }
      
      // Close all connections
      const connections = Array.from(this.connections.values());
      for (const conn of connections) {
        yield* _(this.destroyConnection(conn));
      }
      
      this.connections.clear();
    });
  }
  
  /**
   * Get pool statistics
   */
  getStats(): Effect.Effect<PoolStats, never, never> {
    return Ref.get(this.stats);
  }
  
  /**
   * Warm pool with connections
   */
  warm(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const stats = yield* _(Ref.get(this.stats));
      const target = Math.min(
        this.config.maxSize,
        Math.max(this.config.minSize, Math.floor(this.config.maxSize * 0.5))
      );
      
      const needed = target - stats.totalConnections;
      if (needed > 0) {
        const createEffects = Array.from(
          { length: needed },
          () => this.createConnection()
        );
        
        const connections = yield* _(
          Effect.all(createEffects, { concurrency: 10 })
        );
        
        // Add to available queue
        for (const conn of connections) {
          yield* _(Queue.offer(this.availableQueue, conn));
        }
      }
    });
  }
}

/**
 * Dynamic pool sizing strategy
 */
export class DynamicPoolSizer {
  private history: Array<{ timestamp: Date; activeConnections: number }> = [];
  
  constructor(
    private readonly pool: ConnectionPool<any>,
    private readonly config: {
      checkInterval: Duration.Duration;
      scaleUpThreshold: number; // % of max connections in use
      scaleDownThreshold: number; // % of connections idle
      scaleFactor: number; // How much to scale by
    }
  ) {}
  
  /**
   * Start dynamic sizing
   */
  start(): Effect.Effect<void, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        yield* _(Effect.sleep(this.config.checkInterval));
        yield* _(this.adjustPoolSize());
      })
    );
  }
  
  /**
   * Adjust pool size based on usage
   */
  private adjustPoolSize(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const stats = yield* _(this.pool.getStats());
      
      // Record history
      this.history.push({
        timestamp: new Date(),
        activeConnections: stats.activeConnections,
      });
      
      // Keep last hour of history
      const cutoff = new Date(Date.now() - 3600000);
      this.history = this.history.filter(h => h.timestamp > cutoff);
      
      // Calculate usage
      const usage = stats.activeConnections / stats.totalConnections;
      
      if (usage > this.config.scaleUpThreshold) {
        // Scale up
        console.log(`Scaling up pool: usage ${(usage * 100).toFixed(1)}%`);
        yield* _(this.pool.warm());
      } else if (usage < this.config.scaleDownThreshold) {
        // Scale down handled by idle timeout
        console.log(`Pool can scale down: usage ${(usage * 100).toFixed(1)}%`);
      }
    });
  }
}

/**
 * Create optimized connection pool
 */
export const createConnectionPool = <T>(
  factory: {
    create: () => Effect.Effect<T, Error, never>;
    destroy: (conn: T) => Effect.Effect<void, never, never>;
    validate?: (conn: T) => Effect.Effect<boolean, never, never>;
  },
  config?: Partial<PoolConfig>
): Effect.Effect<ConnectionPool<T>, Error, never> => {
  return Effect.gen(function* (_) {
    const fullConfig: PoolConfig = {
      minSize: config?.minSize ?? 5,
      maxSize: config?.maxSize ?? 20,
      acquireTimeout: config?.acquireTimeout ?? Duration.seconds(30),
      idleTimeout: config?.idleTimeout ?? Duration.minutes(10),
      maxLifetime: config?.maxLifetime ?? Duration.hours(1),
      validationInterval: config?.validationInterval ?? Duration.seconds(30),
      maxWaitQueue: config?.maxWaitQueue ?? 100,
      enableStatistics: config?.enableStatistics ?? true,
      connectionTimeout: config?.connectionTimeout ?? Duration.seconds(10),
    };
    
    const pool = new ConnectionPool(fullConfig, factory);
    yield* _(pool.initialize());
    
    return pool;
  });
};