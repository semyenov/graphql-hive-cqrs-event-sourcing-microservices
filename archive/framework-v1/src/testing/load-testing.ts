/**
 * Load Testing Harness
 * 
 * Comprehensive load testing framework for CQRS/Event Sourcing systems:
 * - Realistic workload generation with multiple patterns
 * - Concurrent user simulation
 * - Command/Query/Event load scenarios
 * - Performance metrics collection
 * - Stress testing and spike testing
 * - Capacity planning and bottleneck identification
 * - Integration with monitoring systems
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Ref from 'effect/Ref';
import * as Queue from 'effect/Queue';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Chunk from 'effect/Chunk';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import type { ICommand, IQuery, IEvent } from '../effect/core/types';

/**
 * Load test scenario
 */
export interface LoadTestScenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly duration: Duration.Duration;
  readonly rampUp: RampUpStrategy;
  readonly workload: WorkloadPattern;
  readonly users: UserSimulation;
  readonly targets: LoadTarget[];
  readonly assertions: PerformanceAssertion[];
  readonly hooks?: LoadTestHooks;
}

/**
 * Ramp-up strategy
 */
export interface RampUpStrategy {
  readonly type: 'immediate' | 'linear' | 'stepped' | 'exponential';
  readonly duration: Duration.Duration;
  readonly startUsers: number;
  readonly targetUsers: number;
  readonly steps?: number; // For stepped ramp-up
}

/**
 * Workload pattern
 */
export interface WorkloadPattern {
  readonly type: 'constant' | 'spike' | 'wave' | 'random' | 'realistic';
  readonly baseRate: number; // Operations per second
  readonly variance?: number; // Percentage variance
  readonly spikes?: SpikeConfig[];
  readonly distribution?: 'uniform' | 'normal' | 'poisson' | 'exponential';
}

/**
 * Spike configuration
 */
export interface SpikeConfig {
  readonly at: Duration.Duration; // When to spike
  readonly multiplier: number; // How much to increase load
  readonly duration: Duration.Duration; // How long to sustain spike
}

/**
 * User simulation
 */
export interface UserSimulation {
  readonly behavior: UserBehavior;
  readonly thinkTime: Duration.Duration;
  readonly sessionDuration?: Duration.Duration;
  readonly actions: UserAction[];
}

/**
 * User behavior patterns
 */
export enum UserBehavior {
  READER = 'reader', // Mostly queries
  WRITER = 'writer', // Mostly commands
  MIXED = 'mixed', // Balanced mix
  POWER_USER = 'power_user', // Heavy usage
  CASUAL = 'casual', // Light usage
  BATCH = 'batch', // Batch operations
}

/**
 * User action
 */
export interface UserAction {
  readonly type: 'command' | 'query' | 'sequence';
  readonly weight: number; // Relative probability
  readonly operation: () => Effect.Effect<OperationResult, Error, never>;
  readonly validation?: (result: OperationResult) => boolean;
}

/**
 * Load target
 */
export interface LoadTarget {
  readonly name: string;
  readonly endpoint: string;
  readonly protocol: 'http' | 'grpc' | 'websocket' | 'graphql';
  readonly authentication?: AuthConfig;
  readonly timeout: Duration.Duration;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  readonly type: 'bearer' | 'basic' | 'apikey' | 'oauth';
  readonly credentials: () => Effect.Effect<string, Error, never>;
}

/**
 * Performance assertion
 */
export interface PerformanceAssertion {
  readonly name: string;
  readonly metric: MetricType;
  readonly condition: AssertionCondition;
  readonly threshold: number;
  readonly percentile?: number; // For percentile assertions
  readonly window?: Duration.Duration; // Time window for evaluation
}

/**
 * Metric types
 */
export enum MetricType {
  RESPONSE_TIME = 'response_time',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  SUCCESS_RATE = 'success_rate',
  CONCURRENT_USERS = 'concurrent_users',
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  QUEUE_SIZE = 'queue_size',
}

/**
 * Assertion conditions
 */
export enum AssertionCondition {
  LESS_THAN = 'less_than',
  GREATER_THAN = 'greater_than',
  EQUALS = 'equals',
  BETWEEN = 'between',
  PERCENTILE = 'percentile',
}

/**
 * Load test hooks
 */
export interface LoadTestHooks {
  readonly beforeTest?: () => Effect.Effect<void, Error, never>;
  readonly afterTest?: () => Effect.Effect<void, Error, never>;
  readonly beforeUser?: () => Effect.Effect<void, Error, never>;
  readonly afterUser?: () => Effect.Effect<void, Error, never>;
  readonly onError?: (error: Error) => Effect.Effect<void, Error, never>;
}

/**
 * Operation result
 */
export interface OperationResult {
  readonly success: boolean;
  readonly duration: Duration.Duration;
  readonly timestamp: Date;
  readonly operation: string;
  readonly error?: Error;
  readonly metadata?: Record<string, any>;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  readonly scenario: LoadTestScenario;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: Duration.Duration;
  readonly metrics: LoadTestMetrics;
  readonly assertions: AssertionResult[];
  readonly errors: LoadTestError[];
  readonly summary: LoadTestSummary;
}

/**
 * Load test metrics
 */
export interface LoadTestMetrics {
  readonly totalOperations: number;
  readonly successfulOperations: number;
  readonly failedOperations: number;
  readonly averageResponseTime: number;
  readonly minResponseTime: number;
  readonly maxResponseTime: number;
  readonly percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  readonly throughput: {
    average: number;
    peak: number;
    current: number;
  };
  readonly concurrentUsers: {
    average: number;
    peak: number;
    current: number;
  };
  readonly errorRate: number;
  readonly operations: Map<string, OperationMetrics>;
}

/**
 * Operation-specific metrics
 */
export interface OperationMetrics {
  readonly count: number;
  readonly success: number;
  readonly failure: number;
  readonly averageDuration: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  readonly percentiles: {
    p50: number;
    p90: number;
    p99: number;
  };
}

/**
 * Assertion result
 */
export interface AssertionResult {
  readonly assertion: PerformanceAssertion;
  readonly passed: boolean;
  readonly actualValue: number;
  readonly expectedValue: number;
  readonly message: string;
}

/**
 * Load test error
 */
export interface LoadTestError {
  readonly timestamp: Date;
  readonly operation: string;
  readonly error: Error;
  readonly userId?: string;
  readonly attempt: number;
}

/**
 * Load test summary
 */
export interface LoadTestSummary {
  readonly status: 'passed' | 'failed' | 'degraded';
  readonly totalUsers: number;
  readonly peakConcurrentUsers: number;
  readonly requestsPerSecond: number;
  readonly bytesTransferred: number;
  readonly recommendations: string[];
}

/**
 * Virtual user
 */
export class VirtualUser {
  private operations = 0;
  private errors = 0;
  private totalDuration = 0;

  constructor(
    private readonly id: string,
    private readonly simulation: UserSimulation,
    private readonly targets: LoadTarget[],
    private readonly metricsCollector: MetricsCollector
  ) {}

  /**
   * Run user simulation
   */
  run(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        // Execute beforeUser hook if provided
        const sessionDuration = this.simulation.sessionDuration || Duration.minutes(5);
        const endTime = startTime + Duration.toMillis(sessionDuration);
        
        while (Date.now() < endTime) {
          // Select action based on weights
          const action = this.selectAction();
          
          // Execute action
          const operationStart = Date.now();
          try {
            const result = yield* _(action.operation());
            const operationDuration = Date.now() - operationStart;
            
            this.operations++;
            this.totalDuration += operationDuration;
            
            // Record metrics
            yield* _(this.metricsCollector.recordOperation({
              ...result,
              duration: Duration.millis(operationDuration),
            }));
            
            // Validate result if validator provided
            if (action.validation && !action.validation(result)) {
              this.errors++;
              yield* _(this.metricsCollector.recordError({
                timestamp: new Date(),
                operation: action.type,
                error: new Error('Validation failed'),
                userId: this.id,
                attempt: 1,
              }));
            }
          } catch (error) {
            this.errors++;
            yield* _(this.metricsCollector.recordError({
              timestamp: new Date(),
              operation: action.type,
              error: error as Error,
              userId: this.id,
              attempt: 1,
            }));
          }
          
          // Think time
          yield* _(Effect.sleep(this.simulation.thinkTime));
        }
      } finally {
        // Report user statistics
        yield* _(this.metricsCollector.recordUserCompletion({
          userId: this.id,
          operations: this.operations,
          errors: this.errors,
          averageDuration: this.operations > 0 ? this.totalDuration / this.operations : 0,
        }));
      }
    });
  }

  /**
   * Select action based on weights
   */
  private selectAction(): UserAction {
    const totalWeight = this.simulation.actions.reduce((sum, a) => sum + a.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const action of this.simulation.actions) {
      cumulativeWeight += action.weight;
      if (random <= cumulativeWeight) {
        return action;
      }
    }
    
    return this.simulation.actions[0]; // Fallback
  }
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private operations: OperationResult[] = [];
  private errors: LoadTestError[] = [];
  private userStats: Map<string, any> = new Map();
  private startTime = Date.now();

  /**
   * Record operation
   */
  recordOperation(result: OperationResult): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.operations.push(result);
      
      // Keep only recent operations to avoid memory issues
      if (this.operations.length > 10000) {
        this.operations = this.operations.slice(-5000);
      }
    });
  }

  /**
   * Record error
   */
  recordError(error: LoadTestError): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.errors.push(error);
      
      // Keep only recent errors
      if (this.errors.length > 1000) {
        this.errors = this.errors.slice(-500);
      }
    });
  }

  /**
   * Record user completion
   */
  recordUserCompletion(stats: any): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.userStats.set(stats.userId, stats);
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): LoadTestMetrics {
    const successful = this.operations.filter(op => op.success);
    const failed = this.operations.filter(op => !op.success);
    
    const durations = successful.map(op => Duration.toMillis(op.duration));
    durations.sort((a, b) => a - b);
    
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const throughput = this.operations.length / Math.max(elapsedSeconds, 1);
    
    // Calculate operation-specific metrics
    const operationMetrics = new Map<string, OperationMetrics>();
    const operationGroups = this.groupBy(this.operations, op => op.operation);
    
    for (const [operation, ops] of operationGroups.entries()) {
      const opDurations = ops.map(op => Duration.toMillis(op.duration));
      opDurations.sort((a, b) => a - b);
      
      operationMetrics.set(operation, {
        count: ops.length,
        success: ops.filter(op => op.success).length,
        failure: ops.filter(op => !op.success).length,
        averageDuration: this.average(opDurations),
        minDuration: Math.min(...opDurations),
        maxDuration: Math.max(...opDurations),
        percentiles: {
          p50: this.percentile(opDurations, 50),
          p90: this.percentile(opDurations, 90),
          p99: this.percentile(opDurations, 99),
        },
      });
    }
    
    return {
      totalOperations: this.operations.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageResponseTime: this.average(durations),
      minResponseTime: Math.min(...durations, Infinity),
      maxResponseTime: Math.max(...durations, 0),
      percentiles: {
        p50: this.percentile(durations, 50),
        p75: this.percentile(durations, 75),
        p90: this.percentile(durations, 90),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99),
      },
      throughput: {
        average: throughput,
        peak: this.calculatePeakThroughput(),
        current: this.calculateCurrentThroughput(),
      },
      concurrentUsers: {
        average: this.userStats.size,
        peak: this.userStats.size, // Would track over time
        current: this.userStats.size,
      },
      errorRate: failed.length / Math.max(this.operations.length, 1) * 100,
      operations: operationMetrics,
    };
  }

  /**
   * Get errors
   */
  getErrors(): LoadTestError[] {
    return [...this.errors];
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Group by function
   */
  private groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    }
    return groups;
  }

  /**
   * Calculate peak throughput
   */
  private calculatePeakThroughput(): number {
    // Group operations by second
    const operationsBySecond = new Map<number, number>();
    
    for (const op of this.operations) {
      const second = Math.floor(op.timestamp.getTime() / 1000);
      operationsBySecond.set(second, (operationsBySecond.get(second) || 0) + 1);
    }
    
    return Math.max(...operationsBySecond.values(), 0);
  }

  /**
   * Calculate current throughput (last 10 seconds)
   */
  private calculateCurrentThroughput(): number {
    const now = Date.now();
    const tenSecondsAgo = now - 10000;
    
    const recentOps = this.operations.filter(op => 
      op.timestamp.getTime() > tenSecondsAgo
    );
    
    return recentOps.length / 10;
  }
}

/**
 * Load test runner
 */
export class LoadTestRunner {
  private activeUsers: Map<string, Fiber.RuntimeFiber<void, Error>> = new Map();
  private metricsCollector = new MetricsCollector();

  constructor(
    private readonly config: {
      maxConcurrentUsers: number;
      monitoringInterval: Duration.Duration;
      timeout: Duration.Duration;
    }
  ) {}

  /**
   * Run load test scenario
   */
  runScenario(scenario: LoadTestScenario): Effect.Effect<LoadTestResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = new Date();
      
      try {
        // Execute before test hook
        if (scenario.hooks?.beforeTest) {
          yield* _(scenario.hooks.beforeTest());
        }
        
        // Start monitoring
        const monitoringFiber = yield* _(
          pipe(
            this.monitorMetrics(scenario),
            Effect.fork
          )
        );
        
        // Ramp up users
        yield* _(this.rampUpUsers(scenario));
        
        // Run test for specified duration
        yield* _(Effect.sleep(scenario.duration));
        
        // Stop all users
        yield* _(this.stopAllUsers());
        
        // Stop monitoring
        yield* _(Fiber.interrupt(monitoringFiber));
        
        // Execute after test hook
        if (scenario.hooks?.afterTest) {
          yield* _(scenario.hooks.afterTest());
        }
        
        // Collect final metrics
        const endTime = new Date();
        const metrics = this.metricsCollector.getMetrics();
        const errors = this.metricsCollector.getErrors();
        
        // Evaluate assertions
        const assertions = this.evaluateAssertions(scenario.assertions, metrics);
        
        // Generate summary
        const summary = this.generateSummary(scenario, metrics, assertions);
        
        return {
          scenario,
          startTime,
          endTime,
          duration: Duration.millis(endTime.getTime() - startTime.getTime()),
          metrics,
          assertions,
          errors,
          summary,
        };
        
      } catch (error) {
        // Handle test failure
        if (scenario.hooks?.onError) {
          yield* _(scenario.hooks.onError(error as Error));
        }
        
        // Stop all users on error
        yield* _(this.stopAllUsers());
        
        throw error;
      }
    });
  }

  /**
   * Ramp up users
   */
  private rampUpUsers(scenario: LoadTestScenario): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const strategy = scenario.rampUp;
      
      switch (strategy.type) {
        case 'immediate':
          yield* _(this.startUsers(strategy.targetUsers, scenario));
          break;
        
        case 'linear':
          yield* _(this.linearRampUp(strategy, scenario));
          break;
        
        case 'stepped':
          yield* _(this.steppedRampUp(strategy, scenario));
          break;
        
        case 'exponential':
          yield* _(this.exponentialRampUp(strategy, scenario));
          break;
      }
    });
  }

  /**
   * Linear ramp-up
   */
  private linearRampUp(strategy: RampUpStrategy, scenario: LoadTestScenario): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const steps = 10; // Number of steps for linear ramp-up
      const usersPerStep = Math.floor((strategy.targetUsers - strategy.startUsers) / steps);
      const stepDuration = Duration.toMillis(strategy.duration) / steps;
      
      // Start initial users
      yield* _(this.startUsers(strategy.startUsers, scenario));
      
      // Gradually add more users
      for (let i = 1; i <= steps; i++) {
        yield* _(Effect.sleep(Duration.millis(stepDuration)));
        yield* _(this.startUsers(usersPerStep, scenario));
      }
    });
  }

  /**
   * Stepped ramp-up
   */
  private steppedRampUp(strategy: RampUpStrategy, scenario: LoadTestScenario): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const steps = strategy.steps || 5;
      const usersPerStep = Math.floor((strategy.targetUsers - strategy.startUsers) / steps);
      const stepDuration = Duration.toMillis(strategy.duration) / steps;
      
      let currentUsers = strategy.startUsers;
      
      for (let i = 0; i < steps; i++) {
        yield* _(this.startUsers(usersPerStep, scenario));
        currentUsers += usersPerStep;
        
        if (i < steps - 1) {
          yield* _(Effect.sleep(Duration.millis(stepDuration)));
        }
      }
    });
  }

  /**
   * Exponential ramp-up
   */
  private exponentialRampUp(strategy: RampUpStrategy, scenario: LoadTestScenario): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const steps = 10;
      const stepDuration = Duration.toMillis(strategy.duration) / steps;
      
      let currentUsers = strategy.startUsers;
      yield* _(this.startUsers(currentUsers, scenario));
      
      for (let i = 1; i <= steps; i++) {
        const targetForStep = strategy.startUsers + 
          (strategy.targetUsers - strategy.startUsers) * 
          Math.pow(i / steps, 2); // Exponential curve
        
        const usersToAdd = Math.floor(targetForStep - currentUsers);
        if (usersToAdd > 0) {
          yield* _(this.startUsers(usersToAdd, scenario));
          currentUsers += usersToAdd;
        }
        
        if (i < steps) {
          yield* _(Effect.sleep(Duration.millis(stepDuration)));
        }
      }
    });
  }

  /**
   * Start users
   */
  private startUsers(count: number, scenario: LoadTestScenario): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      for (let i = 0; i < count; i++) {
        const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const user = new VirtualUser(
          userId,
          scenario.users,
          scenario.targets,
          this.metricsCollector
        );
        
        const fiber = yield* _(
          pipe(
            user.run(),
            Effect.fork
          )
        );
        
        this.activeUsers.set(userId, fiber);
        
        // Avoid thundering herd
        yield* _(Effect.sleep(Duration.millis(10)));
      }
    });
  }

  /**
   * Stop all users
   */
  private stopAllUsers(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const fibers = Array.from(this.activeUsers.values());
      
      for (const fiber of fibers) {
        yield* _(Fiber.interrupt(fiber));
      }
      
      this.activeUsers.clear();
    });
  }

  /**
   * Monitor metrics
   */
  private monitorMetrics(scenario: LoadTestScenario): Effect.Effect<never, Error, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        const metrics = this.metricsCollector.getMetrics();
        
        // Log current metrics
        console.log(`📊 Load Test Metrics:`);
        console.log(`  Active Users: ${this.activeUsers.size}`);
        console.log(`  Throughput: ${metrics.throughput.current.toFixed(1)} ops/sec`);
        console.log(`  Avg Response: ${metrics.averageResponseTime.toFixed(0)}ms`);
        console.log(`  Error Rate: ${metrics.errorRate.toFixed(1)}%`);
        
        yield* _(Effect.sleep(this.config.monitoringInterval));
      })
    );
  }

  /**
   * Evaluate assertions
   */
  private evaluateAssertions(
    assertions: PerformanceAssertion[],
    metrics: LoadTestMetrics
  ): AssertionResult[] {
    const results: AssertionResult[] = [];
    
    for (const assertion of assertions) {
      const actualValue = this.getMetricValue(assertion.metric, metrics, assertion.percentile);
      const passed = this.evaluateCondition(
        actualValue,
        assertion.threshold,
        assertion.condition
      );
      
      results.push({
        assertion,
        passed,
        actualValue,
        expectedValue: assertion.threshold,
        message: `${assertion.name}: ${actualValue.toFixed(2)} ${assertion.condition} ${assertion.threshold}`,
      });
    }
    
    return results;
  }

  /**
   * Get metric value
   */
  private getMetricValue(
    metric: MetricType,
    metrics: LoadTestMetrics,
    percentile?: number
  ): number {
    switch (metric) {
      case MetricType.RESPONSE_TIME:
        if (percentile) {
          return metrics.percentiles[`p${percentile}` as keyof typeof metrics.percentiles] || 0;
        }
        return metrics.averageResponseTime;
      
      case MetricType.THROUGHPUT:
        return metrics.throughput.average;
      
      case MetricType.ERROR_RATE:
        return metrics.errorRate;
      
      case MetricType.SUCCESS_RATE:
        return 100 - metrics.errorRate;
      
      case MetricType.CONCURRENT_USERS:
        return metrics.concurrentUsers.peak;
      
      default:
        return 0;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    actual: number,
    expected: number,
    condition: AssertionCondition
  ): boolean {
    switch (condition) {
      case AssertionCondition.LESS_THAN:
        return actual < expected;
      
      case AssertionCondition.GREATER_THAN:
        return actual > expected;
      
      case AssertionCondition.EQUALS:
        return Math.abs(actual - expected) < 0.01;
      
      default:
        return false;
    }
  }

  /**
   * Generate summary
   */
  private generateSummary(
    scenario: LoadTestScenario,
    metrics: LoadTestMetrics,
    assertions: AssertionResult[]
  ): LoadTestSummary {
    const failedAssertions = assertions.filter(a => !a.passed);
    const recommendations: string[] = [];
    
    // Analyze results and provide recommendations
    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and consider scaling resources.');
    }
    
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Response times are high. Consider optimizing queries or adding caching.');
    }
    
    if (metrics.percentiles.p99 > metrics.averageResponseTime * 5) {
      recommendations.push('High variance in response times. Investigate outliers and bottlenecks.');
    }
    
    const status = failedAssertions.length === 0 ? 'passed' :
                   failedAssertions.length <= assertions.length * 0.2 ? 'degraded' : 'failed';
    
    return {
      status,
      totalUsers: scenario.rampUp.targetUsers,
      peakConcurrentUsers: metrics.concurrentUsers.peak,
      requestsPerSecond: metrics.throughput.average,
      bytesTransferred: 0, // Would calculate from actual responses
      recommendations,
    };
  }
}

/**
 * CQRS-specific load test scenarios
 */
export class CQRSLoadTestScenarios {
  /**
   * Create command processing load test
   */
  static commandProcessing(
    commandGenerator: () => ICommand,
    commandHandler: (cmd: ICommand) => Effect.Effect<any, Error, never>
  ): LoadTestScenario {
    return {
      id: 'command-processing-load',
      name: 'Command Processing Load Test',
      description: 'Test command processing under heavy load',
      duration: Duration.minutes(10),
      rampUp: {
        type: 'linear',
        duration: Duration.minutes(2),
        startUsers: 10,
        targetUsers: 100,
      },
      workload: {
        type: 'constant',
        baseRate: 100, // 100 commands/sec
        variance: 20,
        distribution: 'normal',
      },
      users: {
        behavior: UserBehavior.WRITER,
        thinkTime: Duration.millis(500),
        sessionDuration: Duration.minutes(5),
        actions: [
          {
            type: 'command',
            weight: 1,
            operation: () => Effect.gen(function* (_) {
              const command = commandGenerator();
              const start = Date.now();
              
              try {
                yield* _(commandHandler(command));
                return {
                  success: true,
                  duration: Duration.millis(Date.now() - start),
                  timestamp: new Date(),
                  operation: `command:${command.type}`,
                };
              } catch (error) {
                return {
                  success: false,
                  duration: Duration.millis(Date.now() - start),
                  timestamp: new Date(),
                  operation: `command:${command.type}`,
                  error: error as Error,
                };
              }
            }),
            validation: (result) => result.success && Duration.toMillis(result.duration) < 1000,
          },
        ],
      },
      targets: [
        {
          name: 'command-api',
          endpoint: 'http://localhost:3000/commands',
          protocol: 'http',
          timeout: Duration.seconds(30),
        },
      ],
      assertions: [
        {
          name: 'Average response time < 500ms',
          metric: MetricType.RESPONSE_TIME,
          condition: AssertionCondition.LESS_THAN,
          threshold: 500,
        },
        {
          name: 'P99 response time < 2000ms',
          metric: MetricType.RESPONSE_TIME,
          condition: AssertionCondition.LESS_THAN,
          threshold: 2000,
          percentile: 99,
        },
        {
          name: 'Error rate < 1%',
          metric: MetricType.ERROR_RATE,
          condition: AssertionCondition.LESS_THAN,
          threshold: 1,
        },
        {
          name: 'Throughput > 80 ops/sec',
          metric: MetricType.THROUGHPUT,
          condition: AssertionCondition.GREATER_THAN,
          threshold: 80,
        },
      ],
    };
  }

  /**
   * Create query load test
   */
  static queryPerformance(
    queryGenerator: () => IQuery,
    queryHandler: (query: IQuery) => Effect.Effect<any, Error, never>
  ): LoadTestScenario {
    return {
      id: 'query-performance-load',
      name: 'Query Performance Load Test',
      description: 'Test query performance under read-heavy load',
      duration: Duration.minutes(15),
      rampUp: {
        type: 'stepped',
        duration: Duration.minutes(3),
        startUsers: 20,
        targetUsers: 200,
        steps: 5,
      },
      workload: {
        type: 'realistic',
        baseRate: 200,
        variance: 50,
        distribution: 'poisson',
        spikes: [
          {
            at: Duration.minutes(5),
            multiplier: 3,
            duration: Duration.seconds(30),
          },
          {
            at: Duration.minutes(10),
            multiplier: 2,
            duration: Duration.minutes(1),
          },
        ],
      },
      users: {
        behavior: UserBehavior.READER,
        thinkTime: Duration.millis(200),
        sessionDuration: Duration.minutes(10),
        actions: [
          {
            type: 'query',
            weight: 1,
            operation: () => Effect.gen(function* (_) {
              const query = queryGenerator();
              const start = Date.now();
              
              try {
                const result = yield* _(queryHandler(query));
                return {
                  success: true,
                  duration: Duration.millis(Date.now() - start),
                  timestamp: new Date(),
                  operation: `query:${query.type}`,
                  metadata: { resultCount: Array.isArray(result) ? result.length : 1 },
                };
              } catch (error) {
                return {
                  success: false,
                  duration: Duration.millis(Date.now() - start),
                  timestamp: new Date(),
                  operation: `query:${query.type}`,
                  error: error as Error,
                };
              }
            }),
            validation: (result) => result.success && Duration.toMillis(result.duration) < 200,
          },
        ],
      },
      targets: [
        {
          name: 'query-api',
          endpoint: 'http://localhost:3000/queries',
          protocol: 'graphql',
          timeout: Duration.seconds(10),
        },
      ],
      assertions: [
        {
          name: 'Average response time < 100ms',
          metric: MetricType.RESPONSE_TIME,
          condition: AssertionCondition.LESS_THAN,
          threshold: 100,
        },
        {
          name: 'P95 response time < 500ms',
          metric: MetricType.RESPONSE_TIME,
          condition: AssertionCondition.LESS_THAN,
          threshold: 500,
          percentile: 95,
        },
        {
          name: 'Success rate > 99.9%',
          metric: MetricType.SUCCESS_RATE,
          condition: AssertionCondition.GREATER_THAN,
          threshold: 99.9,
        },
      ],
    };
  }

  /**
   * Create mixed workload test
   */
  static mixedWorkload(): LoadTestScenario {
    return {
      id: 'mixed-workload',
      name: 'Mixed Workload Test',
      description: 'Realistic mixed read/write workload',
      duration: Duration.minutes(30),
      rampUp: {
        type: 'exponential',
        duration: Duration.minutes(5),
        startUsers: 5,
        targetUsers: 150,
      },
      workload: {
        type: 'realistic',
        baseRate: 150,
        variance: 30,
        distribution: 'normal',
      },
      users: {
        behavior: UserBehavior.MIXED,
        thinkTime: Duration.seconds(1),
        sessionDuration: Duration.minutes(15),
        actions: [
          {
            type: 'query',
            weight: 7, // 70% reads
            operation: () => Effect.succeed({
              success: true,
              duration: Duration.millis(50 + Math.random() * 100),
              timestamp: new Date(),
              operation: 'query:mixed',
            }),
          },
          {
            type: 'command',
            weight: 3, // 30% writes
            operation: () => Effect.succeed({
              success: Math.random() > 0.02, // 2% error rate
              duration: Duration.millis(100 + Math.random() * 400),
              timestamp: new Date(),
              operation: 'command:mixed',
            }),
          },
        ],
      },
      targets: [
        {
          name: 'api',
          endpoint: 'http://localhost:3000',
          protocol: 'http',
          timeout: Duration.seconds(30),
        },
      ],
      assertions: [
        {
          name: 'Overall response time < 300ms',
          metric: MetricType.RESPONSE_TIME,
          condition: AssertionCondition.LESS_THAN,
          threshold: 300,
        },
        {
          name: 'Error rate < 3%',
          metric: MetricType.ERROR_RATE,
          condition: AssertionCondition.LESS_THAN,
          threshold: 3,
        },
      ],
    };
  }
}

/**
 * Create load test runner
 */
export const createLoadTestRunner = (config?: {
  maxConcurrentUsers?: number;
  monitoringInterval?: Duration.Duration;
  timeout?: Duration.Duration;
}): LoadTestRunner => {
  const fullConfig = {
    maxConcurrentUsers: config?.maxConcurrentUsers ?? 1000,
    monitoringInterval: config?.monitoringInterval ?? Duration.seconds(10),
    timeout: config?.timeout ?? Duration.hours(1),
  };

  return new LoadTestRunner(fullConfig);
};