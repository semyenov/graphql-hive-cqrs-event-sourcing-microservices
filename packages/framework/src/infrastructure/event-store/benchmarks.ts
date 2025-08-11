/**
 * Event Store Performance Benchmarks
 * 
 * Comprehensive performance testing:
 * - Write throughput
 * - Read latency
 * - Concurrent operations
 * - Snapshot performance
 * - Projection speed
 * - Memory usage
 */

import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import * as Chunk from 'effect/Chunk';
import * as Ref from 'effect/Ref';
import { pipe } from 'effect/Function';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import type { IEvent, ISnapshot } from '../../effect/core/types';
import type { AggregateId } from '../../core/branded';
import { BrandedTypes } from '../../core/branded';

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly operations: number;
  readonly duration: number;
  readonly throughput: number;
  readonly latency: {
    readonly min: number;
    readonly max: number;
    readonly mean: number;
    readonly p50: number;
    readonly p95: number;
    readonly p99: number;
  };
  readonly memory: {
    readonly start: number;
    readonly end: number;
    readonly peak: number;
  };
  readonly errors: number;
}

/**
 * Benchmark suite
 */
export class EventStoreBenchmark {
  private results: BenchmarkResult[] = [];
  
  constructor(
    private readonly eventStore: {
      appendToStream: (
        streamId: AggregateId,
        events: IEvent[],
        expectedVersion?: number
      ) => Effect.Effect<void, never, never>;
      readFromStream: (
        streamId: AggregateId,
        fromVersion?: number
      ) => Effect.Effect<IEvent[], never, never>;
      readAllEvents: (
        fromPosition?: bigint,
        maxCount?: number
      ) => Effect.Effect<IEvent[], never, never>;
      saveSnapshot?: (
        snapshot: ISnapshot
      ) => Effect.Effect<void, never, never>;
      loadSnapshot?: (
        aggregateId: AggregateId
      ) => Effect.Effect<Option.Option<ISnapshot>, never, never>;
    }
  ) {}
  
  /**
   * Run all benchmarks
   */
  runAll(): Effect.Effect<BenchmarkResult[], never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      console.log('🏃 Running Event Store Benchmarks');
      console.log('=' .repeat(60));
      
      // Write benchmarks
      yield* _(self.benchmarkSingleEventWrites());
      yield* _(self.benchmarkBatchEventWrites());
      yield* _(self.benchmarkConcurrentWrites());
      
      // Read benchmarks
      yield* _(self.benchmarkStreamReads());
      yield* _(self.benchmarkAllEventsRead());
      yield* _(self.benchmarkEventFiltering());
      
      // Snapshot benchmarks
      if (self.eventStore.saveSnapshot && self.eventStore.loadSnapshot) {
        yield* _(self.benchmarkSnapshotSave());
        yield* _(self.benchmarkSnapshotLoad());
      }
      
      // Mixed workload
      yield* _(self.benchmarkMixedWorkload());
      
      // Print summary
      self.printSummary();
      
      return self.results;
    });
  }
  
  /**
   * Benchmark single event writes
   */
  private benchmarkSingleEventWrites(): Effect.Effect<void, never, never> {
    const self = this;
    return this.runBenchmark(
      'Single Event Writes',
      1000,
      () => Effect.gen(function* (_) {
        const event = self.createEvent();
        const streamId = BrandedTypes.aggregateId(randomUUID());
        yield* _(self.eventStore.appendToStream(streamId, [event]));
      })
    );
  }
  
  /**
   * Benchmark batch event writes
   */
  private benchmarkBatchEventWrites(): Effect.Effect<void, never, never> {
    const self = this;
    return this.runBenchmark(
      'Batch Event Writes (10 events)',
      100,
      () => Effect.gen(function* (_) {
        const events = Array.from({ length: 10 }, () => self.createEvent());
        const streamId = BrandedTypes.aggregateId(randomUUID());
        yield* _(self.eventStore.appendToStream(streamId, events));
      })
    );
  }
  
  /**
   * Benchmark concurrent writes
   */
  private benchmarkConcurrentWrites(): Effect.Effect<void, never, never> {
    const self = this;
    return this.runBenchmark(
      'Concurrent Writes (10 streams)',
      100,
      () => Effect.gen(function* (_) {
        const effects = Array.from({ length: 10 }, () => {
          const event = self.createEvent();
          const streamId = BrandedTypes.aggregateId(randomUUID());
          return self.eventStore.appendToStream(streamId, [event]);
        });
        
        yield* _(Effect.all(effects, { concurrency: 10 }));
      })
    );
  }
  
  /**
   * Benchmark stream reads
   */
  private benchmarkStreamReads(): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      // Prepare test data
      const streamId = BrandedTypes.aggregateId(randomUUID());
      const events = Array.from({ length: 100 }, () => self.createEvent());
      yield* _(self.eventStore.appendToStream(streamId, events));
      
      // Benchmark reads
      yield* _(self.runBenchmark(
        'Stream Reads (100 events)',
        100,
        () => self.eventStore.readFromStream(streamId)
      ));
    });
  }
  
  /**
   * Benchmark all events read
   */
  private benchmarkAllEventsRead(): Effect.Effect<void, never, never> {
    const self = this;
    return this.runBenchmark(
      'All Events Read (1000 limit)',
      10,
      () => self.eventStore.readAllEvents(0n, 1000)
    );
  }
  
  /**
   * Benchmark event filtering
   */
  private benchmarkEventFiltering(): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      // Prepare diverse event types
      const streamId = BrandedTypes.aggregateId(randomUUID());
      const events = Array.from({ length: 1000 }, (_, i) => 
        self.createEvent(`Event${i % 10}`)
      );
      yield* _(self.eventStore.appendToStream(streamId, events));
      
      // Benchmark filtering
      yield* _(self.runBenchmark(
        'Event Filtering',
        100,
        () => Effect.gen(function* (_) {
          const allEvents = yield* _(self.eventStore.readFromStream(streamId));
          const filtered = allEvents.filter(e => e.type === 'Event0');
          return filtered;
        })
      ));
    });
  }
  
  /**
   * Benchmark snapshot save
   */
  private benchmarkSnapshotSave(): Effect.Effect<void, never, never> {
    const self = this;
    if (!self.eventStore.saveSnapshot) {
      return Effect.unit;
    }
    
    return this.runBenchmark(
      'Snapshot Save',
      100,
      () => {
        const snapshot = self.createSnapshot();
        return self.eventStore.saveSnapshot!(snapshot);
      }
    );
  }
  
  /**
   * Benchmark snapshot load
   */
  private benchmarkSnapshotLoad(): Effect.Effect<void, never, never> {
    const self = this;
    if (!self.eventStore.loadSnapshot) {
      return Effect.unit;
    }
    
    return Effect.gen(function* (_) {
      // Prepare snapshot
      const aggregateId = BrandedTypes.aggregateId(randomUUID());
      const snapshot = self.createSnapshot(aggregateId);
      yield* _(self.eventStore.saveSnapshot!(snapshot));
      
      // Benchmark loads
      yield* _(self.runBenchmark(
        'Snapshot Load',
        100,
        () => self.eventStore.loadSnapshot!(aggregateId)
      ));
    });
  }
  
  /**
   * Benchmark mixed workload
   */
  private benchmarkMixedWorkload(): Effect.Effect<void, never, never> {
    const self = this;
    return this.runBenchmark(
      'Mixed Workload (70% read, 30% write)',
      1000,
      () => Effect.gen(function* (_) {
        const random = Math.random();
        
        if (random < 0.7) {
          // Read operation
          const streamId = BrandedTypes.aggregateId(randomUUID());
          yield* _(
            pipe(
              self.eventStore.readFromStream(streamId),
              Effect.catchAll(() => Effect.succeed([]))
            )
          );
        } else {
          // Write operation
          const event = self.createEvent();
          const streamId = BrandedTypes.aggregateId(randomUUID());
          yield* _(self.eventStore.appendToStream(streamId, [event]));
        }
      })
    );
  }
  
  /**
   * Run a benchmark
   */
  private runBenchmark(
    name: string,
    operations: number,
    operation: () => Effect.Effect<any, never, never>
  ): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      console.log(`\n📊 ${name}`);
      
      const latencies: number[] = [];
      const memoryStart = process.memoryUsage().heapUsed;
      let memoryPeak = memoryStart;
      let errors = 0;
      
      const startTime = performance.now();
      
      // Warmup
      for (let i = 0; i < Math.min(10, operations / 10); i++) {
        yield* _(operation());
      }
      
      // Actual benchmark
      for (let i = 0; i < operations; i++) {
        const opStart = performance.now();
        
        const result = yield* _(Effect.either(operation()));
        
        if (result._tag === 'Left') {
          errors++;
        }
        
        const opEnd = performance.now();
        latencies.push(opEnd - opStart);
        
        // Track memory
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          memoryPeak = Math.max(memoryPeak, currentMemory);
        }
        
        // Progress indicator
        if (i % (operations / 10) === 0) {
          process.stdout.write('.');
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const memoryEnd = process.memoryUsage().heapUsed;
      
      // Calculate statistics
      latencies.sort((a, b) => a - b);
      const stats = {
        min: latencies[0],
        max: latencies[latencies.length - 1],
        mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
      };
      
      const result: BenchmarkResult = {
        name,
        operations,
        duration,
        throughput: (operations / duration) * 1000,
        latency: stats,
        memory: {
          start: memoryStart,
          end: memoryEnd,
          peak: memoryPeak,
        },
        errors,
      };
      
        self.results.push(result);
      
      // Print results
      console.log('\n  Results:');
      console.log(`    Operations: ${operations}`);
      console.log(`    Duration: ${duration.toFixed(2)}ms`);
      console.log(`    Throughput: ${result.throughput.toFixed(2)} ops/sec`);
      console.log(`    Latency (ms):`);
      console.log(`      Min: ${stats.min.toFixed(2)}`);
      console.log(`      Mean: ${stats.mean.toFixed(2)}`);
      console.log(`      P50: ${stats.p50.toFixed(2)}`);
      console.log(`      P95: ${stats.p95.toFixed(2)}`);
      console.log(`      P99: ${stats.p99.toFixed(2)}`);
      console.log(`      Max: ${stats.max.toFixed(2)}`);
      console.log(`    Memory: ${self.formatBytes(memoryEnd - memoryStart)}`);
      if (errors > 0) {
        console.log(`    ❌ Errors: ${errors}`);
      }
    });
  }
  
  /**
   * Print summary
   */
  private printSummary(): void {
    console.log('\n' + '=' .repeat(60));
    console.log('📈 Benchmark Summary');
    console.log('=' .repeat(60));
    
    // Sort by throughput
    const sorted = [...this.results].sort((a, b) => b.throughput - a.throughput);
    
    console.log('\nTop Performers (by throughput):');
    sorted.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}: ${r.throughput.toFixed(2)} ops/sec`);
    });
    
    console.log('\nLowest Latency (P50):');
    const byLatency = [...this.results].sort((a, b) => a.latency.p50 - b.latency.p50);
    byLatency.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}: ${r.latency.p50.toFixed(2)}ms`);
    });
    
    // Calculate totals
    const totalOps = this.results.reduce((sum, r) => sum + r.operations, 0);
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors, 0);
    
    console.log('\nOverall Statistics:');
    console.log(`  Total Operations: ${totalOps}`);
    console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Average Throughput: ${(totalOps / totalTime * 1000).toFixed(2)} ops/sec`);
    if (totalErrors > 0) {
      console.log(`  Total Errors: ${totalErrors}`);
    }
  }
  
  // Helper methods
  
  private createEvent(type: string = 'TestEvent'): IEvent {
    return {
      type,
      aggregateId: BrandedTypes.aggregateId(randomUUID()),
      version: BrandedTypes.aggregateVersion(1),
      timestamp: BrandedTypes.timestamp(),
      data: {
        value: Math.random(),
        timestamp: Date.now(),
        payload: 'x'.repeat(100), // ~100 bytes payload
      },
      metadata: {
        correlationId: randomUUID(),
        userId: 'benchmark-user',
      },
    };
  }
  
  private createSnapshot(
    aggregateId?: AggregateId
  ): ISnapshot {
    return {
      aggregateId: aggregateId ?? BrandedTypes.aggregateId(randomUUID()),
      version: BrandedTypes.aggregateVersion(100),
      state: {
        state: 'active',
        counter: 100,
        items: Array.from({ length: 50 }, (_, i) => ({
          id: i,
          value: Math.random(),
        })),
      },
      timestamp: BrandedTypes.timestamp(),
    };
  }
  
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Stress test configuration
 */
export interface StressTestConfig {
  readonly duration: Duration.Duration;
  readonly concurrency: number;
  readonly targetThroughput?: number;
}

/**
 * Event store stress test
 */
export class EventStoreStressTest {
  constructor(
    private readonly eventStore: {
      appendToStream: (
        streamId: AggregateId,
        events: IEvent[],
        expectedVersion?: number
      ) => Effect.Effect<void, never, never>;
    },
    private readonly config: StressTestConfig
  ) {}
  
  /**
   * Run stress test
   */
  run(): Effect.Effect<{
    totalOperations: number;
    successRate: number;
    averageThroughput: number;
    peakThroughput: number;
  }, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      console.log('🔥 Starting Stress Test');
      console.log(`  Duration: ${Duration.toSeconds(self.config.duration)}s`);
      console.log(`  Concurrency: ${self.config.concurrency}`);
      
      const startTime = Date.now();
      const endTime = startTime + Duration.toMillis(self.config.duration);
      
      const stats = {
        operations: 0,
        successes: 0,
        failures: 0,
        throughputSamples: [] as number[],
      };
      
      // Run concurrent workers
      const workers = Array.from({ length: self.config.concurrency }, (_, i) =>
        self.runWorker(i, endTime, stats)
      );
      
      yield* _(Effect.all(workers, { concurrency: self.config.concurrency }));
      
      // Calculate results
      const totalTime = (Date.now() - startTime) / 1000;
      const results = {
        totalOperations: stats.operations,
        successRate: (stats.successes / stats.operations) * 100,
        averageThroughput: stats.operations / totalTime,
        peakThroughput: Math.max(...stats.throughputSamples),
      };
      
      console.log('\n📊 Stress Test Results:');
      console.log(`  Total Operations: ${results.totalOperations}`);
      console.log(`  Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log(`  Average Throughput: ${results.averageThroughput.toFixed(2)} ops/sec`);
      console.log(`  Peak Throughput: ${results.peakThroughput.toFixed(2)} ops/sec`);
      
      return results;
    });
  }
  
  private runWorker(
    workerId: number,
    endTime: number,
    stats: any
  ): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      let lastSample = Date.now();
      let operationsInSample = 0;
      
      while (Date.now() < endTime) {
        // Create and append event
        const event: IEvent = {
          type: `StressEvent-${workerId}`,
          aggregateId: BrandedTypes.aggregateId(randomUUID()),
          version: BrandedTypes.aggregateVersion(1),
          timestamp: BrandedTypes.timestamp(),
          data: { workerId, timestamp: Date.now() },
        };
        
        const result = yield* _(
          Effect.either(
            self.eventStore.appendToStream(event.aggregateId, [event])
          )
        );
        
        stats.operations++;
        operationsInSample++;
        
        if (result._tag === 'Right') {
          stats.successes++;
        } else {
          stats.failures++;
        }
        
        // Sample throughput every second
        const now = Date.now();
        if (now - lastSample >= 1000) {
          const throughput = (operationsInSample / (now - lastSample)) * 1000;
          stats.throughputSamples.push(throughput);
          lastSample = now;
          operationsInSample = 0;
        }
        
        // Rate limiting if target throughput specified
        if (self.config.targetThroughput) {
          const targetDelay = 1000 / (self.config.targetThroughput / self.config.concurrency);
          yield* _(Effect.sleep(Duration.millis(targetDelay)));
        }
      }
    });
  }
}

/**
 * Run benchmarks
 */
export const runBenchmarks = (
  eventStore: EventStoreBenchmark['eventStore']
): Effect.Effect<BenchmarkResult[], never, never> => {
  const benchmark = new EventStoreBenchmark(eventStore);
  return benchmark.runAll();
};

/**
 * Run stress test
 */
export const runStressTest = (
  eventStore: EventStoreStressTest['eventStore'],
  config?: Partial<StressTestConfig>
): Effect.Effect<{
  totalOperations: number;
  successRate: number;
  averageThroughput: number;
  peakThroughput: number;
}, never, never> => {
  const test = new EventStoreStressTest(eventStore, {
    duration: config?.duration ?? Duration.minutes(1),
    concurrency: config?.concurrency ?? 10,
    targetThroughput: config?.targetThroughput,
  });
  return test.run();
};