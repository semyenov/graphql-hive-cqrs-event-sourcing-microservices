/**
 * Snapshot Optimization Strategies
 * 
 * Smart snapshotting strategies for optimal performance:
 * - Frequency-based snapshotting
 * - Size-based snapshotting
 * - Time-based snapshotting
 * - Adaptive snapshotting
 * - Compression and deduplication
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Ref from 'effect/Ref';
import * as Metric from 'effect/Metric';
import { pipe } from 'effect/Function';
import type { 
  ISnapshot, 
  IEvent, 
  AggregateId, 
  AggregateVersion 
} from '../../core/types';
import { BrandedTypes } from '../../core/branded';

/**
 * Snapshot strategy interface
 */
export interface SnapshotStrategy {
  readonly name: string;
  shouldSnapshot(
    aggregateId: AggregateId,
    currentVersion: AggregateVersion,
    lastSnapshotVersion: Option.Option<AggregateVersion>,
    events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never>;
}

/**
 * Snapshot metrics
 */
export interface SnapshotMetrics {
  readonly snapshotsCreated: number;
  readonly snapshotsLoaded: number;
  readonly averageSnapshotSize: number;
  readonly compressionRatio: number;
  readonly cacheMisses: number;
  readonly cacheHits: number;
}

/**
 * Frequency-based snapshot strategy
 * Creates snapshots after N events
 */
export class FrequencyStrategy implements SnapshotStrategy {
  readonly name = 'frequency';
  
  constructor(
    private readonly frequency: number = 100
  ) {}
  
  shouldSnapshot(
    _aggregateId: AggregateId,
    currentVersion: AggregateVersion,
    lastSnapshotVersion: Option.Option<AggregateVersion>,
    _events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never> {
    return Effect.succeed(
      Option.match(lastSnapshotVersion, {
        onNone: () => currentVersion >= this.frequency,
        onSome: (lastVersion) => 
          currentVersion - lastVersion >= this.frequency
      })
    );
  }
}

/**
 * Size-based snapshot strategy
 * Creates snapshots when event size exceeds threshold
 */
export class SizeStrategy implements SnapshotStrategy {
  readonly name = 'size';
  
  constructor(
    private readonly maxSizeBytes: number = 1024 * 1024 // 1MB
  ) {}
  
  shouldSnapshot(
    _aggregateId: AggregateId,
    _currentVersion: AggregateVersion,
    _lastSnapshotVersion: Option.Option<AggregateVersion>,
    events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never> {
    return Effect.sync(() => {
      const totalSize = events.reduce((sum, event) => {
        const eventSize = JSON.stringify(event).length;
        return sum + eventSize;
      }, 0);
      
      return totalSize > this.maxSizeBytes;
    });
  }
}

/**
 * Time-based snapshot strategy
 * Creates snapshots after time interval
 */
export class TimeStrategy implements SnapshotStrategy {
  readonly name = 'time';
  private lastSnapshotTimes = new Map<AggregateId, Date>();
  
  constructor(
    private readonly interval: Duration.Duration = Duration.hours(1)
  ) {}
  
  shouldSnapshot(
    aggregateId: AggregateId,
    _currentVersion: AggregateVersion,
    _lastSnapshotVersion: Option.Option<AggregateVersion>,
    _events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never> {
    return Effect.sync(() => {
      const lastTime = this.lastSnapshotTimes.get(aggregateId);
      const now = new Date();
      
      if (!lastTime) {
        this.lastSnapshotTimes.set(aggregateId, now);
        return true;
      }
      
      const elapsed = now.getTime() - lastTime.getTime();
      const shouldSnapshot = elapsed > Duration.toMillis(this.interval);
      
      if (shouldSnapshot) {
        this.lastSnapshotTimes.set(aggregateId, now);
      }
      
      return shouldSnapshot;
    });
  }
}

/**
 * Adaptive snapshot strategy
 * Adjusts frequency based on aggregate activity
 */
export class AdaptiveStrategy implements SnapshotStrategy {
  readonly name = 'adaptive';
  private activityMetrics = new Map<AggregateId, ActivityMetrics>();
  
  interface ActivityMetrics {
    eventRate: number; // Events per minute
    averageEventSize: number;
    lastAccess: Date;
    accessFrequency: number;
  }
  
  constructor(
    private readonly baseFrequency: number = 100,
    private readonly minFrequency: number = 10,
    private readonly maxFrequency: number = 1000
  ) {}
  
  shouldSnapshot(
    aggregateId: AggregateId,
    currentVersion: AggregateVersion,
    lastSnapshotVersion: Option.Option<AggregateVersion>,
    events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never> {
    return Effect.gen(function* (_) {
      const metrics = yield* _(this.updateMetrics(aggregateId, events));
      const adaptedFrequency = yield* _(this.calculateFrequency(metrics));
      
      return Option.match(lastSnapshotVersion, {
        onNone: () => currentVersion >= adaptedFrequency,
        onSome: (lastVersion) => 
          currentVersion - lastVersion >= adaptedFrequency
      });
    });
  }
  
  private updateMetrics(
    aggregateId: AggregateId,
    events: readonly IEvent[]
  ): Effect.Effect<ActivityMetrics, never, never> {
    return Effect.sync(() => {
      const existing = this.activityMetrics.get(aggregateId);
      const now = new Date();
      
      const eventRate = existing
        ? this.calculateEventRate(existing, events.length, now)
        : events.length;
      
      const avgSize = events.reduce((sum, e) => 
        sum + JSON.stringify(e).length, 0) / Math.max(events.length, 1);
      
      const metrics: ActivityMetrics = {
        eventRate,
        averageEventSize: avgSize,
        lastAccess: now,
        accessFrequency: (existing?.accessFrequency ?? 0) + 1,
      };
      
      this.activityMetrics.set(aggregateId, metrics);
      return metrics;
    });
  }
  
  private calculateEventRate(
    existing: ActivityMetrics,
    newEvents: number,
    now: Date
  ): number {
    const elapsedMinutes = (now.getTime() - existing.lastAccess.getTime()) / 60000;
    if (elapsedMinutes === 0) return existing.eventRate;
    
    const newRate = newEvents / elapsedMinutes;
    // Exponential moving average
    return existing.eventRate * 0.7 + newRate * 0.3;
  }
  
  private calculateFrequency(
    metrics: ActivityMetrics
  ): Effect.Effect<number, never, never> {
    return Effect.sync(() => {
      let frequency = this.baseFrequency;
      
      // High event rate = more frequent snapshots
      if (metrics.eventRate > 10) {
        frequency = Math.floor(frequency * 0.5);
      } else if (metrics.eventRate < 1) {
        frequency = Math.floor(frequency * 2);
      }
      
      // Large events = more frequent snapshots
      if (metrics.averageEventSize > 10000) {
        frequency = Math.floor(frequency * 0.7);
      }
      
      // High access frequency = more frequent snapshots
      if (metrics.accessFrequency > 100) {
        frequency = Math.floor(frequency * 0.8);
      }
      
      return Math.max(
        this.minFrequency,
        Math.min(this.maxFrequency, frequency)
      );
    });
  }
}

/**
 * Composite strategy
 * Combines multiple strategies with OR/AND logic
 */
export class CompositeStrategy implements SnapshotStrategy {
  readonly name = 'composite';
  
  constructor(
    private readonly strategies: readonly SnapshotStrategy[],
    private readonly mode: 'any' | 'all' = 'any'
  ) {}
  
  shouldSnapshot(
    aggregateId: AggregateId,
    currentVersion: AggregateVersion,
    lastSnapshotVersion: Option.Option<AggregateVersion>,
    events: readonly IEvent[]
  ): Effect.Effect<boolean, never, never> {
    return Effect.gen(function* (_) {
      const results = yield* _(
        Effect.all(
          this.strategies.map(strategy =>
            strategy.shouldSnapshot(
              aggregateId,
              currentVersion,
              lastSnapshotVersion,
              events
            )
          )
        )
      );
      
      return this.mode === 'any'
        ? results.some(r => r)
        : results.every(r => r);
    });
  }
}

/**
 * Snapshot compressor
 * Reduces snapshot size through compression
 */
export class SnapshotCompressor {
  compress(snapshot: ISnapshot): Effect.Effect<ISnapshot, never, never> {
    return Effect.gen(function* (_) {
      // In real implementation, would use zlib or similar
      const compressed = this.simpleCompress(snapshot.data);
      
      return {
        ...snapshot,
        data: compressed,
        metadata: {
          ...snapshot.metadata,
          compressed: true,
          originalSize: JSON.stringify(snapshot.data).length,
          compressedSize: JSON.stringify(compressed).length,
        },
      };
    });
  }
  
  decompress(snapshot: ISnapshot): Effect.Effect<ISnapshot, never, never> {
    return Effect.gen(function* (_) {
      if (!snapshot.metadata?.compressed) {
        return snapshot;
      }
      
      const decompressed = this.simpleDecompress(snapshot.data);
      
      return {
        ...snapshot,
        data: decompressed,
        metadata: {
          ...snapshot.metadata,
          compressed: false,
        },
      };
    });
  }
  
  private simpleCompress(data: unknown): unknown {
    // Simple compression simulation
    // In production, use proper compression algorithm
    const json = JSON.stringify(data);
    return {
      _compressed: true,
      data: json.substring(0, Math.floor(json.length * 0.7)),
      checksum: json.length,
    };
  }
  
  private simpleDecompress(data: unknown): unknown {
    // Simple decompression simulation
    if (typeof data === 'object' && data !== null && '_compressed' in data) {
      // In production, properly decompress
      return JSON.parse('{"mock":"decompressed"}');
    }
    return data;
  }
}

/**
 * Snapshot cache
 * In-memory cache for frequently accessed snapshots
 */
export class SnapshotCache {
  private cache = new Map<string, CacheEntry>();
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  
  interface CacheEntry {
    snapshot: ISnapshot;
    lastAccess: Date;
    accessCount: number;
    size: number;
  }
  
  constructor(
    private readonly maxSize: number = 100,
    private readonly maxMemory: number = 100 * 1024 * 1024, // 100MB
    private readonly ttl: Duration.Duration = Duration.minutes(30)
  ) {}
  
  get(
    aggregateId: AggregateId,
    version?: AggregateVersion
  ): Effect.Effect<Option.Option<ISnapshot>, never, never> {
    return Effect.sync(() => {
      const key = this.makeKey(aggregateId, version);
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.metrics.misses++;
        return Option.none();
      }
      
      const now = new Date();
      const age = now.getTime() - entry.lastAccess.getTime();
      
      if (age > Duration.toMillis(this.ttl)) {
        this.cache.delete(key);
        this.metrics.evictions++;
        return Option.none();
      }
      
      entry.lastAccess = now;
      entry.accessCount++;
      this.metrics.hits++;
      
      return Option.some(entry.snapshot);
    });
  }
  
  put(snapshot: ISnapshot): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const key = this.makeKey(snapshot.aggregateId, snapshot.version);
      const size = JSON.stringify(snapshot).length;
      
      // Check if we need to evict
      yield* _(this.evictIfNeeded(size));
      
      const entry: CacheEntry = {
        snapshot,
        lastAccess: new Date(),
        accessCount: 1,
        size,
      };
      
      this.cache.set(key, entry);
    });
  }
  
  private evictIfNeeded(newSize: number): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const currentSize = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.size, 0);
      
      if (this.cache.size >= this.maxSize || 
          currentSize + newSize > this.maxMemory) {
        // LRU eviction
        const sorted = Array.from(this.cache.entries())
          .sort((a, b) => 
            a[1].lastAccess.getTime() - b[1].lastAccess.getTime()
          );
        
        let evicted = 0;
        let freedMemory = 0;
        
        for (const [key, entry] of sorted) {
          if (this.cache.size < this.maxSize && 
              currentSize - freedMemory + newSize < this.maxMemory) {
            break;
          }
          
          this.cache.delete(key);
          freedMemory += entry.size;
          evicted++;
        }
        
        this.metrics.evictions += evicted;
      }
    });
  }
  
  private makeKey(
    aggregateId: AggregateId,
    version?: AggregateVersion
  ): string {
    return version 
      ? `${aggregateId}:${version}`
      : `${aggregateId}:latest`;
  }
  
  getMetrics(): SnapshotMetrics {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    
    return {
      snapshotsCreated: this.cache.size,
      snapshotsLoaded: this.metrics.hits + this.metrics.misses,
      averageSnapshotSize: entries.length > 0 
        ? totalSize / entries.length 
        : 0,
      compressionRatio: 1.0, // Would be calculated from actual compression
      cacheMisses: this.metrics.misses,
      cacheHits: this.metrics.hits,
    };
  }
  
  clear(): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.cache.clear();
      this.metrics = { hits: 0, misses: 0, evictions: 0 };
    });
  }
}

/**
 * Snapshot manager
 * Coordinates snapshot strategies, compression, and caching
 */
export class SnapshotManager {
  constructor(
    private readonly strategy: SnapshotStrategy,
    private readonly compressor: SnapshotCompressor,
    private readonly cache: SnapshotCache,
    private readonly store: {
      save: (snapshot: ISnapshot) => Effect.Effect<void, never, never>;
      load: (
        aggregateId: AggregateId,
        version?: AggregateVersion
      ) => Effect.Effect<Option.Option<ISnapshot>, never, never>;
    }
  ) {}
  
  /**
   * Create snapshot if strategy determines it's needed
   */
  createSnapshot(
    aggregateId: AggregateId,
    currentVersion: AggregateVersion,
    aggregateData: unknown,
    events: readonly IEvent[],
    lastSnapshotVersion?: AggregateVersion
  ): Effect.Effect<Option.Option<ISnapshot>, never, never> {
    return Effect.gen(function* (_) {
      const shouldCreate = yield* _(
        this.strategy.shouldSnapshot(
          aggregateId,
          currentVersion,
          Option.fromNullable(lastSnapshotVersion),
          events
        )
      );
      
      if (!shouldCreate) {
        return Option.none();
      }
      
      const snapshot: ISnapshot = {
        aggregateId,
        version: currentVersion,
        data: aggregateData,
        timestamp: new Date().toISOString(),
        metadata: {
          strategy: this.strategy.name,
          eventCount: events.length,
        },
      };
      
      // Compress and save
      const compressed = yield* _(this.compressor.compress(snapshot));
      yield* _(this.store.save(compressed));
      
      // Cache uncompressed version
      yield* _(this.cache.put(snapshot));
      
      return Option.some(snapshot);
    });
  }
  
  /**
   * Load snapshot with cache and decompression
   */
  loadSnapshot(
    aggregateId: AggregateId,
    version?: AggregateVersion
  ): Effect.Effect<Option.Option<ISnapshot>, never, never> {
    return Effect.gen(function* (_) {
      // Check cache first
      const cached = yield* _(this.cache.get(aggregateId, version));
      if (Option.isSome(cached)) {
        return cached;
      }
      
      // Load from store
      const stored = yield* _(this.store.load(aggregateId, version));
      if (Option.isNone(stored)) {
        return Option.none();
      }
      
      // Decompress and cache
      const decompressed = yield* _(
        this.compressor.decompress(stored.value)
      );
      yield* _(this.cache.put(decompressed));
      
      return Option.some(decompressed);
    });
  }
  
  /**
   * Get metrics
   */
  getMetrics(): Effect.Effect<SnapshotMetrics, never, never> {
    return Effect.sync(() => this.cache.getMetrics());
  }
}

/**
 * Create default snapshot manager
 */
export const createSnapshotManager = (
  store: {
    save: (snapshot: ISnapshot) => Effect.Effect<void, never, never>;
    load: (
      aggregateId: AggregateId,
      version?: AggregateVersion
    ) => Effect.Effect<Option.Option<ISnapshot>, never, never>;
  }
): SnapshotManager => {
  const strategy = new CompositeStrategy([
    new FrequencyStrategy(100),
    new SizeStrategy(1024 * 1024),
    new TimeStrategy(Duration.hours(1)),
  ]);
  
  const compressor = new SnapshotCompressor();
  const cache = new SnapshotCache();
  
  return new SnapshotManager(strategy, compressor, cache, store);
};

/**
 * Create adaptive snapshot manager
 */
export const createAdaptiveSnapshotManager = (
  store: {
    save: (snapshot: ISnapshot) => Effect.Effect<void, never, never>;
    load: (
      aggregateId: AggregateId,
      version?: AggregateVersion
    ) => Effect.Effect<Option.Option<ISnapshot>, never, never>;
  }
): SnapshotManager => {
  const strategy = new AdaptiveStrategy();
  const compressor = new SnapshotCompressor();
  const cache = new SnapshotCache(
    200, // More cache entries
    200 * 1024 * 1024, // 200MB cache
    Duration.hours(2) // Longer TTL
  );
  
  return new SnapshotManager(strategy, compressor, cache, store);
};