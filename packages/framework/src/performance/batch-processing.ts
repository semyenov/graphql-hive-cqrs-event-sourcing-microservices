/**
 * Batch Processing Optimizations
 * 
 * High-performance batch processing strategies:
 * - Smart batching with adaptive sizing
 * - Pipeline processing
 * - Bulk operations
 * - Parallel batch execution
 * - Batch compression and deduplication
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Chunk from 'effect/Chunk';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import type { IEvent, ICommand } from '../effect/core/types';
import type { AggregateId } from '../core/branded';

/**
 * Batch configuration
 */
export interface BatchConfig {
  readonly maxSize: number;
  readonly maxWait: Duration.Duration;
  readonly maxMemory: number;
  readonly enableCompression: boolean;
  readonly enableDeduplication: boolean;
  readonly parallelism: number;
}

/**
 * Batch statistics
 */
export interface BatchStats {
  readonly totalBatches: number;
  readonly totalItems: number;
  readonly averageBatchSize: number;
  readonly compressionRatio: number;
  readonly deduplicationRatio: number;
  readonly processingTime: number;
  readonly throughput: number;
}

/**
 * Batch item
 */
export interface BatchItem<T> {
  readonly id: string;
  readonly data: T;
  readonly size: number;
  readonly timestamp: Date;
  readonly priority?: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Batch result
 */
export interface BatchResult<T, R> {
  readonly batchId: string;
  readonly items: BatchItem<T>[];
  readonly results: R[];
  readonly errors: Array<{ item: BatchItem<T>; error: Error }>;
  readonly stats: BatchStats;
}

/**
 * Smart batch accumulator
 */
export class BatchAccumulator<T> {
  private buffer: BatchItem<T>[] = [];
  private currentSize = 0;
  private startTime: Date | null = null;
  private stats: BatchStats = {
    totalBatches: 0,
    totalItems: 0,
    averageBatchSize: 0,
    compressionRatio: 1,
    deduplicationRatio: 1,
    processingTime: 0,
    throughput: 0,
  };
  
  constructor(
    private readonly config: BatchConfig,
    private readonly processor: (items: BatchItem<T>[]) => Effect.Effect<any[], never, never>
  ) {}
  
  /**
   * Add item to batch
   */
  add(item: BatchItem<T>): Effect.Effect<boolean, never, never> {
    return Effect.gen(function* (_) {
      if (!this.startTime) {
        this.startTime = new Date();
      }
      
      const itemSize = this.estimateSize(item);
      
      // Check if adding item would exceed limits
      if (this.shouldFlush(itemSize)) {
        yield* _(this.flush());
      }
      
      this.buffer.push(item);
      this.currentSize += itemSize;
      
      // Check if batch is full
      if (this.isFull()) {
        yield* _(this.flush());
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Flush current batch
   */
  flush(): Effect.Effect<BatchResult<T, any>, never, never> {
    return Effect.gen(function* (_) {
      if (this.buffer.length === 0) {
        return this.emptyResult();
      }
      
      const processingStart = Date.now();
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Apply optimizations
      let items = [...this.buffer];
      
      if (this.config.enableDeduplication) {
        const originalCount = items.length;
        items = this.deduplicate(items);
        this.stats.deduplicationRatio = originalCount / items.length;
      }
      
      if (this.config.enableCompression) {
        items = this.compress(items);
      }
      
      // Process batch
      const results = yield* _(this.processor(items));
      
      // Update statistics
      const processingTime = Date.now() - processingStart;
      this.updateStats(items.length, processingTime);
      
      // Clear buffer
      this.buffer = [];
      this.currentSize = 0;
      this.startTime = null;
      
      return {
        batchId,
        items,
        results,
        errors: [],
        stats: { ...this.stats },
      };
    });
  }
  
  /**
   * Check if should flush
   */
  private shouldFlush(additionalSize: number): boolean {
    if (this.buffer.length >= this.config.maxSize) {
      return true;
    }
    
    if (this.currentSize + additionalSize > this.config.maxMemory) {
      return true;
    }
    
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime.getTime();
      if (elapsed > Duration.toMillis(this.config.maxWait)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if batch is full
   */
  private isFull(): boolean {
    return this.buffer.length >= this.config.maxSize ||
           this.currentSize >= this.config.maxMemory;
  }
  
  /**
   * Deduplicate items
   */
  private deduplicate(items: BatchItem<T>[]): BatchItem<T>[] {
    const seen = new Set<string>();
    const unique: BatchItem<T>[] = [];
    
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    
    return unique;
  }
  
  /**
   * Compress items (simulated)
   */
  private compress(items: BatchItem<T>[]): BatchItem<T>[] {
    // In production, would use actual compression
    // For now, just mark as compressed
    return items.map(item => ({
      ...item,
      metadata: {
        ...item.metadata,
        compressed: true,
      },
    }));
  }
  
  /**
   * Estimate item size
   */
  private estimateSize(item: BatchItem<T>): number {
    return item.size || JSON.stringify(item.data).length;
  }
  
  /**
   * Update statistics
   */
  private updateStats(itemCount: number, processingTime: number): void {
    this.stats.totalBatches++;
    this.stats.totalItems += itemCount;
    this.stats.averageBatchSize = this.stats.totalItems / this.stats.totalBatches;
    this.stats.processingTime = processingTime;
    this.stats.throughput = itemCount / (processingTime / 1000);
  }
  
  /**
   * Create empty result
   */
  private emptyResult(): BatchResult<T, any> {
    return {
      batchId: `empty-${Date.now()}`,
      items: [],
      results: [],
      errors: [],
      stats: this.stats,
    };
  }
  
  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
  
  /**
   * Get statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }
}

/**
 * Pipeline batch processor
 */
export class PipelineBatchProcessor<T> {
  private stages: Array<{
    name: string;
    processor: (chunk: Chunk.Chunk<T>) => Effect.Effect<Chunk.Chunk<T>, never, never>;
    parallelism: number;
  }> = [];
  
  /**
   * Add processing stage
   */
  addStage(
    name: string,
    processor: (chunk: Chunk.Chunk<T>) => Effect.Effect<Chunk.Chunk<T>, never, never>,
    parallelism: number = 1
  ): this {
    this.stages.push({ name, processor, parallelism });
    return this;
  }
  
  /**
   * Process stream through pipeline
   */
  process(
    input: Stream.Stream<T, never, never>
  ): Stream.Stream<T, never, never> {
    let stream = input;
    
    for (const stage of this.stages) {
      stream = pipe(
        stream,
        Stream.chunked,
        Stream.mapConcurrent(stage.parallelism, stage.processor),
        Stream.flattenChunks
      );
    }
    
    return stream;
  }
  
  /**
   * Process batch through pipeline
   */
  processBatch(items: T[]): Effect.Effect<T[], never, never> {
    return Effect.gen(function* (_) {
      let chunk = Chunk.fromIterable(items);
      
      for (const stage of this.stages) {
        const startTime = Date.now();
        chunk = yield* _(stage.processor(chunk));
        console.log(`Stage ${stage.name} completed in ${Date.now() - startTime}ms`);
      }
      
      return Chunk.toArray(chunk);
    });
  }
}

/**
 * Bulk operation executor
 */
export class BulkOperationExecutor {
  private operationQueue: Queue.Queue<{
    operation: string;
    items: any[];
    callback: (results: any[]) => void;
  }>;
  private processingFiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();
  
  constructor(
    private readonly config: {
      batchSize: number;
      flushInterval: Duration.Duration;
      maxConcurrency: number;
    }
  ) {
    this.operationQueue = Queue.unbounded();
  }
  
  /**
   * Start bulk executor
   */
  start(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const fiber = yield* _(
        pipe(
          this.processLoop(),
          Effect.fork
        )
      );
      this.processingFiber = Option.some(fiber);
    });
  }
  
  /**
   * Stop bulk executor
   */
  stop(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      if (Option.isSome(this.processingFiber)) {
        yield* _(Fiber.interrupt(this.processingFiber.value));
      }
    });
  }
  
  /**
   * Execute bulk operation
   */
  execute<T, R>(
    operation: string,
    items: T[],
    executor: (batch: T[]) => Effect.Effect<R[], never, never>
  ): Effect.Effect<R[], never, never> {
    return Effect.gen(function* (_) {
      const results: R[] = [];
      
      // Split into batches
      const batches = this.splitIntoBatches(items, this.config.batchSize);
      
      // Execute batches in parallel
      const effects = batches.map(batch =>
        pipe(
          executor(batch),
          Effect.map(batchResults => {
            results.push(...batchResults);
          })
        )
      );
      
      yield* _(Effect.all(effects, { 
        concurrency: this.config.maxConcurrency 
      }));
      
      return results;
    });
  }
  
  /**
   * Process loop
   */
  private processLoop(): Effect.Effect<never, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        // Collect operations for batching
        const operations = new Map<string, any[]>();
        const callbacks = new Map<string, Array<(results: any[]) => void>>();
        
        const deadline = Date.now() + Duration.toMillis(this.config.flushInterval);
        
        while (Date.now() < deadline) {
          const item = yield* _(
            pipe(
              Queue.poll(this.operationQueue),
              Effect.timeout(Duration.millis(100))
            )
          );
          
          if (Option.isSome(item)) {
            const { operation, items, callback } = item.value;
            
            if (!operations.has(operation)) {
              operations.set(operation, []);
              callbacks.set(operation, []);
            }
            
            operations.get(operation)!.push(...items);
            callbacks.get(operation)!.push(callback);
            
            // Check if batch is full
            if (operations.get(operation)!.length >= this.config.batchSize) {
              yield* _(this.flushOperation(
                operation,
                operations.get(operation)!,
                callbacks.get(operation)!
              ));
              operations.delete(operation);
              callbacks.delete(operation);
            }
          }
        }
        
        // Flush remaining operations
        for (const [operation, items] of operations) {
          if (items.length > 0) {
            yield* _(this.flushOperation(
              operation,
              items,
              callbacks.get(operation)!
            ));
          }
        }
      })
    );
  }
  
  /**
   * Flush operation
   */
  private flushOperation(
    operation: string,
    items: any[],
    callbacks: Array<(results: any[]) => void>
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      console.log(`Flushing ${operation}: ${items.length} items`);
      
      // Execute operation (simulated)
      const results = items.map(item => ({ ...item, processed: true }));
      
      // Call callbacks
      for (const callback of callbacks) {
        callback(results);
      }
    });
  }
  
  /**
   * Split into batches
   */
  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
}

/**
 * Adaptive batch sizing
 */
export class AdaptiveBatchSizer {
  private history: Array<{
    size: number;
    latency: number;
    throughput: number;
    timestamp: Date;
  }> = [];
  
  private currentSize: number;
  private minSize: number;
  private maxSize: number;
  
  constructor(
    initialSize: number = 100,
    minSize: number = 10,
    maxSize: number = 1000
  ) {
    this.currentSize = initialSize;
    this.minSize = minSize;
    this.maxSize = maxSize;
  }
  
  /**
   * Record batch performance
   */
  recordPerformance(
    size: number,
    latency: number,
    itemsProcessed: number
  ): void {
    const throughput = itemsProcessed / (latency / 1000);
    
    this.history.push({
      size,
      latency,
      throughput,
      timestamp: new Date(),
    });
    
    // Keep last 100 samples
    if (this.history.length > 100) {
      this.history.shift();
    }
    
    // Adjust batch size
    this.adjustSize();
  }
  
  /**
   * Get optimal batch size
   */
  getOptimalSize(): number {
    return this.currentSize;
  }
  
  /**
   * Adjust batch size based on performance
   */
  private adjustSize(): void {
    if (this.history.length < 10) return;
    
    // Calculate average throughput for different sizes
    const sizePerformance = new Map<number, { throughput: number; count: number }>();
    
    for (const entry of this.history) {
      const size = Math.floor(entry.size / 10) * 10; // Round to nearest 10
      const perf = sizePerformance.get(size) ?? { throughput: 0, count: 0 };
      
      sizePerformance.set(size, {
        throughput: perf.throughput + entry.throughput,
        count: perf.count + 1,
      });
    }
    
    // Find best performing size
    let bestSize = this.currentSize;
    let bestThroughput = 0;
    
    for (const [size, perf] of sizePerformance) {
      const avgThroughput = perf.throughput / perf.count;
      if (avgThroughput > bestThroughput) {
        bestThroughput = avgThroughput;
        bestSize = size;
      }
    }
    
    // Apply adjustment with damping
    const adjustment = (bestSize - this.currentSize) * 0.3;
    this.currentSize = Math.round(
      Math.max(this.minSize, Math.min(this.maxSize, this.currentSize + adjustment))
    );
  }
  
  /**
   * Get performance statistics
   */
  getStats(): {
    currentSize: number;
    averageLatency: number;
    averageThroughput: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.history.length === 0) {
      return {
        currentSize: this.currentSize,
        averageLatency: 0,
        averageThroughput: 0,
        trend: 'stable',
      };
    }
    
    const recent = this.history.slice(-10);
    const avgLatency = recent.reduce((sum, e) => sum + e.latency, 0) / recent.length;
    const avgThroughput = recent.reduce((sum, e) => sum + e.throughput, 0) / recent.length;
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recent.length >= 2) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, e) => sum + e.throughput, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, e) => sum + e.throughput, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.1) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
    }
    
    return {
      currentSize: this.currentSize,
      averageLatency: avgLatency,
      averageThroughput: avgThroughput,
      trend,
    };
  }
}

/**
 * Batch event processor
 */
export class BatchEventProcessor {
  private accumulator: BatchAccumulator<IEvent>;
  private adaptiveSizer: AdaptiveBatchSizer;
  
  constructor(
    private readonly eventStore: {
      appendBatch: (events: IEvent[]) => Effect.Effect<void, never, never>;
    },
    config?: Partial<BatchConfig>
  ) {
    this.adaptiveSizer = new AdaptiveBatchSizer();
    
    const fullConfig: BatchConfig = {
      maxSize: config?.maxSize ?? this.adaptiveSizer.getOptimalSize(),
      maxWait: config?.maxWait ?? Duration.millis(100),
      maxMemory: config?.maxMemory ?? 10 * 1024 * 1024, // 10MB
      enableCompression: config?.enableCompression ?? true,
      enableDeduplication: config?.enableDeduplication ?? true,
      parallelism: config?.parallelism ?? 4,
    };
    
    this.accumulator = new BatchAccumulator(
      fullConfig,
      (items) => this.processBatch(items.map(i => i.data as IEvent))
    );
  }
  
  /**
   * Add event to batch
   */
  addEvent(event: IEvent): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const item: BatchItem<IEvent> = {
        id: event.aggregateId + '-' + event.version,
        data: event,
        size: JSON.stringify(event).length,
        timestamp: new Date(),
      };
      
      yield* _(this.accumulator.add(item));
    });
  }
  
  /**
   * Process batch of events
   */
  private processBatch(events: IEvent[]): Effect.Effect<void[], never, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      // Group by aggregate for optimal storage
      const grouped = this.groupByAggregate(events);
      
      // Store in parallel
      const effects = Array.from(grouped.values()).map(group =>
        this.eventStore.appendBatch(group)
      );
      
      yield* _(Effect.all(effects, { concurrency: 4 }));
      
      // Record performance
      const latency = Date.now() - startTime;
      this.adaptiveSizer.recordPerformance(events.length, latency, events.length);
      
      // Update batch size
      const newSize = this.adaptiveSizer.getOptimalSize();
      // In production, would update accumulator config
      
      return events.map(() => undefined);
    });
  }
  
  /**
   * Group events by aggregate
   */
  private groupByAggregate(events: IEvent[]): Map<AggregateId, IEvent[]> {
    const grouped = new Map<AggregateId, IEvent[]>();
    
    for (const event of events) {
      const group = grouped.get(event.aggregateId) ?? [];
      group.push(event);
      grouped.set(event.aggregateId, group);
    }
    
    return grouped;
  }
  
  /**
   * Flush pending events
   */
  flush(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      yield* _(this.accumulator.flush());
    });
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    batchStats: BatchStats;
    sizerStats: ReturnType<AdaptiveBatchSizer['getStats']>;
  } {
    return {
      batchStats: this.accumulator.getStats(),
      sizerStats: this.adaptiveSizer.getStats(),
    };
  }
}

/**
 * Create batch processor
 */
export const createBatchProcessor = (
  eventStore: {
    appendBatch: (events: IEvent[]) => Effect.Effect<void, never, never>;
  },
  config?: Partial<BatchConfig>
): BatchEventProcessor => {
  return new BatchEventProcessor(eventStore, config);
};