/**
 * Performance Regression Detection System
 * 
 * Automated performance regression detection for CQRS/Event Sourcing systems:
 * - Baseline performance measurement and storage
 * - Statistical regression analysis
 * - Performance benchmarking with historical comparison
 * - Automatic performance degradation alerts
 * - Performance profiling and bottleneck detection
 * - Memory leak detection
 * - Integration with CI/CD pipelines
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Performance metric
 */
export interface PerformanceMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly timestamp: Date;
  readonly tags?: Record<string, string>;
}

/**
 * Performance baseline
 */
export interface PerformanceBaseline {
  readonly id: string;
  readonly version: string;
  readonly commit: string;
  readonly branch: string;
  readonly timestamp: Date;
  readonly environment: EnvironmentInfo;
  readonly metrics: PerformanceMetric[];
  readonly benchmarks: BenchmarkResult[];
}

/**
 * Environment information
 */
export interface EnvironmentInfo {
  readonly os: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCores: number;
  readonly memoryTotal: number;
  readonly nodeVersion: string;
  readonly bunVersion?: string;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  readonly name: string;
  readonly description: string;
  readonly warmupIterations: number;
  readonly iterations: number;
  readonly timeout: Duration.Duration;
  readonly setup?: () => Effect.Effect<void, Error, never>;
  readonly teardown?: () => Effect.Effect<void, Error, never>;
  readonly benchmark: () => Effect.Effect<void, Error, never>;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly iterations: number;
  readonly times: number[]; // Individual iteration times in ms
  readonly stats: BenchmarkStatistics;
  readonly memory?: MemoryUsage;
  readonly status: 'passed' | 'failed' | 'degraded';
  readonly regression?: RegressionAnalysis;
}

/**
 * Benchmark statistics
 */
export interface BenchmarkStatistics {
  readonly mean: number;
  readonly median: number;
  readonly stdDev: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly opsPerSec: number;
}

/**
 * Memory usage
 */
export interface MemoryUsage {
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly rss: number;
  readonly leakDetected: boolean;
  readonly leakRate?: number; // MB per iteration
}

/**
 * Regression analysis
 */
export interface RegressionAnalysis {
  readonly detected: boolean;
  readonly severity: 'minor' | 'moderate' | 'severe';
  readonly percentChange: number;
  readonly absoluteChange: number;
  readonly confidence: number;
  readonly pValue: number;
  readonly message: string;
}

/**
 * Performance comparison
 */
export interface PerformanceComparison {
  readonly baseline: PerformanceBaseline;
  readonly current: PerformanceBaseline;
  readonly regressions: RegressionResult[];
  readonly improvements: ImprovementResult[];
  readonly unchanged: string[];
  readonly summary: ComparisonSummary;
}

/**
 * Regression result
 */
export interface RegressionResult {
  readonly benchmark: string;
  readonly baseline: BenchmarkStatistics;
  readonly current: BenchmarkStatistics;
  readonly regression: RegressionAnalysis;
}

/**
 * Improvement result
 */
export interface ImprovementResult {
  readonly benchmark: string;
  readonly baseline: BenchmarkStatistics;
  readonly current: BenchmarkStatistics;
  readonly improvement: {
    percentChange: number;
    absoluteChange: number;
  };
}

/**
 * Comparison summary
 */
export interface ComparisonSummary {
  readonly totalBenchmarks: number;
  readonly regressions: number;
  readonly improvements: number;
  readonly unchanged: number;
  readonly overallStatus: 'passed' | 'failed' | 'degraded';
  readonly recommendation: string;
}

/**
 * Statistics calculator
 */
export class StatisticsCalculator {
  /**
   * Calculate statistics from measurements
   */
  static calculate(measurements: number[]): BenchmarkStatistics {
    if (measurements.length === 0) {
      throw new Error('No measurements to calculate statistics');
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
    const median = n % 2 === 0 
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
      : sorted[Math.floor(n / 2)];

    const variance = sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[n - 1],
      p50: this.percentile(sorted, 50),
      p75: this.percentile(sorted, 75),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      opsPerSec: 1000 / mean, // Operations per second
    };
  }

  /**
   * Calculate percentile
   */
  private static percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Perform t-test
   */
  static tTest(sample1: number[], sample2: number[]): { tStatistic: number; pValue: number } {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    const stats1 = this.calculate(sample1);
    const stats2 = this.calculate(sample2);
    
    const pooledVariance = ((n1 - 1) * Math.pow(stats1.stdDev, 2) + 
                            (n2 - 1) * Math.pow(stats2.stdDev, 2)) / 
                           (n1 + n2 - 2);
    
    const standardError = Math.sqrt(pooledVariance * (1/n1 + 1/n2));
    const tStatistic = (stats1.mean - stats2.mean) / standardError;
    
    // Simplified p-value calculation (would use proper distribution in production)
    const degreesOfFreedom = n1 + n2 - 2;
    const pValue = this.approximatePValue(Math.abs(tStatistic), degreesOfFreedom);
    
    return { tStatistic, pValue };
  }

  /**
   * Approximate p-value (simplified)
   */
  private static approximatePValue(tStatistic: number, df: number): number {
    // Simplified approximation for p-value
    // In production, would use proper t-distribution
    if (tStatistic < 1.96) return 0.5;
    if (tStatistic < 2.58) return 0.05;
    if (tStatistic < 3.29) return 0.01;
    return 0.001;
  }

  /**
   * Calculate coefficient of variation
   */
  static coefficientOfVariation(stats: BenchmarkStatistics): number {
    return (stats.stdDev / stats.mean) * 100;
  }
}

/**
 * Benchmark runner
 */
export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  constructor(
    private readonly config: {
      detectMemoryLeaks: boolean;
      maxAcceptableCV: number; // Maximum coefficient of variation
      regressionThreshold: number; // Percentage threshold for regression
    }
  ) {}

  /**
   * Run benchmark
   */
  runBenchmark(config: BenchmarkConfig): Effect.Effect<BenchmarkResult, Error, never> {
    return Effect.gen(function* (_) {
      console.log(`⏱️ Running benchmark: ${config.name}`);
      
      // Setup
      if (config.setup) {
        yield* _(config.setup());
      }

      try {
        // Warmup iterations
        console.log(`  Warmup: ${config.warmupIterations} iterations`);
        for (let i = 0; i < config.warmupIterations; i++) {
          yield* _(
            pipe(
              config.benchmark(),
              Effect.timeout(config.timeout),
              Effect.catchAll(() => Effect.void)
            )
          );
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Measurement iterations
        console.log(`  Measuring: ${config.iterations} iterations`);
        const times: number[] = [];
        const memorySnapshots: MemoryUsage[] = [];
        const startMemory = process.memoryUsage();

        for (let i = 0; i < config.iterations; i++) {
          const startTime = performance.now();
          
          yield* _(
            pipe(
              config.benchmark(),
              Effect.timeout(config.timeout)
            )
          );
          
          const duration = performance.now() - startTime;
          times.push(duration);

          // Collect memory usage
          if (this.config.detectMemoryLeaks && i % 10 === 0) {
            const memUsage = process.memoryUsage();
            memorySnapshots.push({
              heapUsed: memUsage.heapUsed,
              heapTotal: memUsage.heapTotal,
              external: memUsage.external,
              rss: memUsage.rss,
              leakDetected: false,
            });
          }
        }

        // Calculate statistics
        const stats = StatisticsCalculator.calculate(times);
        const cv = StatisticsCalculator.coefficientOfVariation(stats);

        // Check for high variance
        if (cv > this.config.maxAcceptableCV) {
          console.warn(`  ⚠️ High variance detected (CV: ${cv.toFixed(2)}%)`);
        }

        // Memory leak detection
        let memory: MemoryUsage | undefined;
        if (this.config.detectMemoryLeaks && memorySnapshots.length > 0) {
          const endMemory = process.memoryUsage();
          const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
          const leakRate = memoryGrowth / config.iterations / 1024 / 1024; // MB per iteration
          
          memory = {
            heapUsed: endMemory.heapUsed,
            heapTotal: endMemory.heapTotal,
            external: endMemory.external,
            rss: endMemory.rss,
            leakDetected: leakRate > 0.1, // Leak if > 0.1MB per iteration
            leakRate: leakRate > 0 ? leakRate : undefined,
          };

          if (memory.leakDetected) {
            console.warn(`  ⚠️ Possible memory leak detected (${leakRate.toFixed(3)} MB/iteration)`);
          }
        }

        console.log(`  Mean: ${stats.mean.toFixed(2)}ms, Median: ${stats.median.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms, P99: ${stats.p99.toFixed(2)}ms`);
        console.log(`  Throughput: ${stats.opsPerSec.toFixed(1)} ops/sec`);

        const result: BenchmarkResult = {
          name: config.name,
          iterations: config.iterations,
          times,
          stats,
          memory,
          status: 'passed',
        };

        this.results.push(result);
        return result;

      } finally {
        // Teardown
        if (config.teardown) {
          yield* _(config.teardown());
        }
      }
    });
  }

  /**
   * Run multiple benchmarks
   */
  runBenchmarks(configs: BenchmarkConfig[]): Effect.Effect<BenchmarkResult[], Error, never> {
    return Effect.gen(function* (_) {
      const results: BenchmarkResult[] = [];
      
      for (const config of configs) {
        const result = yield* _(this.runBenchmark(config));
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Get results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }
}

/**
 * Regression detector
 */
export class RegressionDetector {
  constructor(
    private readonly config: {
      regressionThreshold: number; // Percentage threshold
      confidenceLevel: number; // Statistical confidence level (0-1)
      minSampleSize: number; // Minimum iterations for comparison
    }
  ) {}

  /**
   * Detect regression between baseline and current
   */
  detectRegression(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): RegressionAnalysis {
    // Check sample size
    if (baseline.times.length < this.config.minSampleSize || 
        current.times.length < this.config.minSampleSize) {
      return {
        detected: false,
        severity: 'minor',
        percentChange: 0,
        absoluteChange: 0,
        confidence: 0,
        pValue: 1,
        message: 'Insufficient sample size for regression detection',
      };
    }

    // Calculate percentage change
    const percentChange = ((current.stats.mean - baseline.stats.mean) / baseline.stats.mean) * 100;
    const absoluteChange = current.stats.mean - baseline.stats.mean;

    // Perform statistical test
    const { tStatistic, pValue } = StatisticsCalculator.tTest(baseline.times, current.times);
    const confidence = 1 - pValue;

    // Determine if regression is significant
    const isSignificant = pValue < (1 - this.config.confidenceLevel);
    const exceedsThreshold = percentChange > this.config.regressionThreshold;
    const detected = isSignificant && exceedsThreshold;

    // Determine severity
    let severity: 'minor' | 'moderate' | 'severe';
    if (percentChange < 10) {
      severity = 'minor';
    } else if (percentChange < 25) {
      severity = 'moderate';
    } else {
      severity = 'severe';
    }

    // Generate message
    let message: string;
    if (detected) {
      message = `Performance regression detected: ${percentChange.toFixed(1)}% slower (${absoluteChange.toFixed(2)}ms increase)`;
    } else if (percentChange > 0) {
      message = `Minor performance degradation: ${percentChange.toFixed(1)}% slower (not statistically significant)`;
    } else {
      message = `No regression detected`;
    }

    return {
      detected,
      severity,
      percentChange,
      absoluteChange,
      confidence,
      pValue,
      message,
    };
  }

  /**
   * Compare baselines
   */
  compareBaselines(
    baseline: PerformanceBaseline,
    current: PerformanceBaseline
  ): PerformanceComparison {
    const regressions: RegressionResult[] = [];
    const improvements: ImprovementResult[] = [];
    const unchanged: string[] = [];

    // Compare each benchmark
    for (const currentBenchmark of current.benchmarks) {
      const baselineBenchmark = baseline.benchmarks.find(b => b.name === currentBenchmark.name);
      
      if (!baselineBenchmark) {
        console.warn(`Benchmark '${currentBenchmark.name}' not found in baseline`);
        continue;
      }

      const regression = this.detectRegression(baselineBenchmark, currentBenchmark);
      
      if (regression.detected) {
        regressions.push({
          benchmark: currentBenchmark.name,
          baseline: baselineBenchmark.stats,
          current: currentBenchmark.stats,
          regression,
        });
      } else if (regression.percentChange < -this.config.regressionThreshold) {
        improvements.push({
          benchmark: currentBenchmark.name,
          baseline: baselineBenchmark.stats,
          current: currentBenchmark.stats,
          improvement: {
            percentChange: Math.abs(regression.percentChange),
            absoluteChange: Math.abs(regression.absoluteChange),
          },
        });
      } else {
        unchanged.push(currentBenchmark.name);
      }
    }

    // Generate summary
    const totalBenchmarks = current.benchmarks.length;
    const overallStatus = regressions.length > 0 ? 'failed' :
                          regressions.length > totalBenchmarks * 0.1 ? 'degraded' : 'passed';
    
    let recommendation: string;
    if (regressions.length === 0) {
      recommendation = 'No performance regressions detected. Safe to merge.';
    } else if (regressions.some(r => r.regression.severity === 'severe')) {
      recommendation = 'Severe performance regressions detected. Investigation required before merge.';
    } else if (regressions.length <= 2 && regressions.every(r => r.regression.severity === 'minor')) {
      recommendation = 'Minor regressions detected. Consider reviewing but may proceed with caution.';
    } else {
      recommendation = 'Multiple performance regressions detected. Review and optimize before merge.';
    }

    return {
      baseline,
      current,
      regressions,
      improvements,
      unchanged,
      summary: {
        totalBenchmarks,
        regressions: regressions.length,
        improvements: improvements.length,
        unchanged: unchanged.length,
        overallStatus,
        recommendation,
      },
    };
  }
}

/**
 * Performance baseline manager
 */
export class BaselineManager {
  private baselines: Map<string, PerformanceBaseline> = new Map();

  /**
   * Save baseline
   */
  saveBaseline(baseline: PerformanceBaseline): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const key = `${baseline.branch}-${baseline.version}`;
      this.baselines.set(key, baseline);
      
      // In production, would persist to database or file system
      console.log(`📊 Baseline saved: ${key}`);
    });
  }

  /**
   * Load baseline
   */
  loadBaseline(branch: string, version: string): Effect.Effect<Option.Option<PerformanceBaseline>, Error, never> {
    return Effect.sync(() => {
      const key = `${branch}-${version}`;
      const baseline = this.baselines.get(key);
      return baseline ? Option.some(baseline) : Option.none();
    });
  }

  /**
   * Get latest baseline for branch
   */
  getLatestBaseline(branch: string): Effect.Effect<Option.Option<PerformanceBaseline>, Error, never> {
    return Effect.sync(() => {
      const branchBaselines = Array.from(this.baselines.entries())
        .filter(([key]) => key.startsWith(`${branch}-`))
        .map(([, baseline]) => baseline)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return branchBaselines.length > 0 ? Option.some(branchBaselines[0]) : Option.none();
    });
  }

  /**
   * Clean old baselines
   */
  cleanOldBaselines(keepCount: number): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const baselinesByBranch = new Map<string, PerformanceBaseline[]>();
      
      // Group by branch
      for (const [key, baseline] of this.baselines.entries()) {
        const branch = baseline.branch;
        const existing = baselinesByBranch.get(branch) || [];
        existing.push(baseline);
        baselinesByBranch.set(branch, existing);
      }
      
      // Keep only recent baselines per branch
      for (const [branch, branchBaselines] of baselinesByBranch.entries()) {
        const sorted = branchBaselines.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const toKeep = sorted.slice(0, keepCount);
        const toRemove = sorted.slice(keepCount);
        
        for (const baseline of toRemove) {
          const key = `${baseline.branch}-${baseline.version}`;
          this.baselines.delete(key);
        }
      }
    });
  }
}

/**
 * CQRS-specific benchmarks
 */
export class CQRSBenchmarks {
  /**
   * Command processing benchmark
   */
  static commandProcessing(
    commandHandler: (cmd: any) => Effect.Effect<void, Error, never>
  ): BenchmarkConfig {
    return {
      name: 'Command Processing',
      description: 'Measure command handling performance',
      warmupIterations: 100,
      iterations: 1000,
      timeout: Duration.seconds(1),
      benchmark: () => Effect.gen(function* (_) {
        const command = {
          id: Math.random().toString(36),
          type: 'CreateUser',
          aggregateId: Math.random().toString(36),
          payload: { name: 'Test User', email: 'test@example.com' },
          timestamp: new Date(),
        };
        
        yield* _(commandHandler(command));
      }),
    };
  }

  /**
   * Event sourcing benchmark
   */
  static eventSourcing(
    eventStore: {
      append: (events: any[]) => Effect.Effect<void, Error, never>;
      readStream: (aggregateId: string) => Effect.Effect<any[], Error, never>;
    }
  ): BenchmarkConfig {
    return {
      name: 'Event Sourcing',
      description: 'Measure event store performance',
      warmupIterations: 50,
      iterations: 500,
      timeout: Duration.seconds(2),
      setup: () => Effect.sync(() => {
        // Clear event store if needed
      }),
      benchmark: () => Effect.gen(function* (_) {
        const aggregateId = Math.random().toString(36);
        const events = Array.from({ length: 10 }, (_, i) => ({
          id: Math.random().toString(36),
          type: 'UserUpdated',
          aggregateId,
          version: i + 1,
          data: { field: `value${i}` },
          timestamp: new Date(),
        }));
        
        // Write events
        yield* _(eventStore.append(events));
        
        // Read events
        const readEvents = yield* _(eventStore.readStream(aggregateId));
        
        if (readEvents.length !== events.length) {
          throw new Error('Event count mismatch');
        }
      }),
    };
  }

  /**
   * Query performance benchmark
   */
  static queryPerformance(
    queryHandler: (query: any) => Effect.Effect<any, Error, never>
  ): BenchmarkConfig {
    return {
      name: 'Query Performance',
      description: 'Measure query execution performance',
      warmupIterations: 200,
      iterations: 2000,
      timeout: Duration.millis(500),
      benchmark: () => Effect.gen(function* (_) {
        const query = {
          id: Math.random().toString(36),
          type: 'GetUserById',
          payload: { userId: Math.random().toString(36) },
          timestamp: new Date(),
        };
        
        const result = yield* _(queryHandler(query));
        
        if (!result) {
          throw new Error('Query returned no result');
        }
      }),
    };
  }

  /**
   * Projection update benchmark
   */
  static projectionUpdate(
    projection: {
      handleEvent: (event: any) => Effect.Effect<void, Error, never>;
      query: (params: any) => Effect.Effect<any, Error, never>;
    }
  ): BenchmarkConfig {
    return {
      name: 'Projection Update',
      description: 'Measure projection update performance',
      warmupIterations: 100,
      iterations: 1000,
      timeout: Duration.seconds(1),
      benchmark: () => Effect.gen(function* (_) {
        const event = {
          id: Math.random().toString(36),
          type: 'UserCreated',
          aggregateId: Math.random().toString(36),
          version: 1,
          data: {
            name: 'Test User',
            email: 'test@example.com',
            createdAt: new Date(),
          },
          timestamp: new Date(),
        };
        
        // Update projection
        yield* _(projection.handleEvent(event));
        
        // Query projection
        const result = yield* _(projection.query({ aggregateId: event.aggregateId }));
        
        if (!result) {
          throw new Error('Projection not updated');
        }
      }),
    };
  }
}

/**
 * Performance regression service
 */
export class PerformanceRegressionService {
  constructor(
    private readonly benchmarkRunner: BenchmarkRunner,
    private readonly regressionDetector: RegressionDetector,
    private readonly baselineManager: BaselineManager
  ) {}

  /**
   * Run performance regression tests
   */
  runRegressionTests(
    benchmarks: BenchmarkConfig[],
    options: {
      branch: string;
      version: string;
      commit: string;
      compareWithBaseline?: boolean;
    }
  ): Effect.Effect<PerformanceComparison | PerformanceBaseline, Error, never> {
    return Effect.gen(function* (_) {
      console.log('🚀 Running performance regression tests...\n');
      
      // Run benchmarks
      const results = yield* _(this.benchmarkRunner.runBenchmarks(benchmarks));
      
      // Create current baseline
      const current: PerformanceBaseline = {
        id: `${options.branch}-${options.version}-${Date.now()}`,
        version: options.version,
        commit: options.commit,
        branch: options.branch,
        timestamp: new Date(),
        environment: this.getEnvironmentInfo(),
        metrics: this.extractMetrics(results),
        benchmarks: results,
      };
      
      // Compare with baseline if requested
      if (options.compareWithBaseline) {
        const baselineOption = yield* _(this.baselineManager.getLatestBaseline(options.branch));
        
        if (Option.isSome(baselineOption)) {
          const baseline = baselineOption.value;
          const comparison = this.regressionDetector.compareBaselines(baseline, current);
          
          // Display comparison results
          this.displayComparison(comparison);
          
          // Save current baseline if no severe regressions
          if (comparison.summary.overallStatus !== 'failed') {
            yield* _(this.baselineManager.saveBaseline(current));
          }
          
          return comparison;
        } else {
          console.log('ℹ️ No baseline found for comparison. Saving current results as baseline.\n');
          yield* _(this.baselineManager.saveBaseline(current));
          return current;
        }
      } else {
        // Just save baseline
        yield* _(this.baselineManager.saveBaseline(current));
        return current;
      }
    });
  }

  /**
   * Get environment info
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    const os = process.platform;
    const arch = process.arch;
    const cpuModel = require('os').cpus()[0]?.model || 'Unknown';
    const cpuCores = require('os').cpus().length;
    const memoryTotal = require('os').totalmem();
    const nodeVersion = process.version;
    const bunVersion = process.versions.bun;

    return {
      os,
      arch,
      cpuModel,
      cpuCores,
      memoryTotal,
      nodeVersion,
      bunVersion,
    };
  }

  /**
   * Extract metrics from results
   */
  private extractMetrics(results: BenchmarkResult[]): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];
    
    for (const result of results) {
      metrics.push({
        name: `${result.name}.mean`,
        value: result.stats.mean,
        unit: 'ms',
        timestamp: new Date(),
      });
      
      metrics.push({
        name: `${result.name}.p95`,
        value: result.stats.p95,
        unit: 'ms',
        timestamp: new Date(),
      });
      
      metrics.push({
        name: `${result.name}.throughput`,
        value: result.stats.opsPerSec,
        unit: 'ops/sec',
        timestamp: new Date(),
      });
      
      if (result.memory) {
        metrics.push({
          name: `${result.name}.memory`,
          value: result.memory.heapUsed / 1024 / 1024,
          unit: 'MB',
          timestamp: new Date(),
        });
      }
    }
    
    return metrics;
  }

  /**
   * Display comparison results
   */
  private displayComparison(comparison: PerformanceComparison): void {
    console.log('\n📊 Performance Comparison Results\n');
    console.log('─'.repeat(80));
    
    // Display regressions
    if (comparison.regressions.length > 0) {
      console.log('\n❌ Regressions Detected:\n');
      for (const reg of comparison.regressions) {
        console.log(`  ${reg.benchmark}:`);
        console.log(`    Baseline: ${reg.baseline.mean.toFixed(2)}ms`);
        console.log(`    Current:  ${reg.current.mean.toFixed(2)}ms`);
        console.log(`    Change:   ${reg.regression.percentChange > 0 ? '+' : ''}${reg.regression.percentChange.toFixed(1)}%`);
        console.log(`    Severity: ${reg.regression.severity}`);
        console.log(`    P-value:  ${reg.regression.pValue.toFixed(4)}`);
      }
    }
    
    // Display improvements
    if (comparison.improvements.length > 0) {
      console.log('\n✅ Improvements:\n');
      for (const imp of comparison.improvements) {
        console.log(`  ${imp.benchmark}:`);
        console.log(`    Improved by ${imp.improvement.percentChange.toFixed(1)}%`);
      }
    }
    
    // Display summary
    console.log('\n📈 Summary:\n');
    console.log(`  Total Benchmarks: ${comparison.summary.totalBenchmarks}`);
    console.log(`  Regressions:      ${comparison.summary.regressions}`);
    console.log(`  Improvements:     ${comparison.summary.improvements}`);
    console.log(`  Unchanged:        ${comparison.summary.unchanged}`);
    console.log(`  Status:           ${comparison.summary.overallStatus.toUpperCase()}`);
    console.log(`\n  ${comparison.summary.recommendation}`);
    console.log('\n' + '─'.repeat(80));
  }
}

/**
 * Create performance regression service
 */
export const createPerformanceRegressionService = (config?: {
  detectMemoryLeaks?: boolean;
  maxAcceptableCV?: number;
  regressionThreshold?: number;
  confidenceLevel?: number;
  minSampleSize?: number;
}): PerformanceRegressionService => {
  const benchmarkRunner = new BenchmarkRunner({
    detectMemoryLeaks: config?.detectMemoryLeaks ?? true,
    maxAcceptableCV: config?.maxAcceptableCV ?? 10, // 10% coefficient of variation
    regressionThreshold: config?.regressionThreshold ?? 5, // 5% threshold
  });

  const regressionDetector = new RegressionDetector({
    regressionThreshold: config?.regressionThreshold ?? 5,
    confidenceLevel: config?.confidenceLevel ?? 0.95,
    minSampleSize: config?.minSampleSize ?? 30,
  });

  const baselineManager = new BaselineManager();

  return new PerformanceRegressionService(
    benchmarkRunner,
    regressionDetector,
    baselineManager
  );
};