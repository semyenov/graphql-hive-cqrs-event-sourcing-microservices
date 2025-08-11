/**
 * Chaos Engineering System
 * 
 * Resilience testing through controlled failure injection:
 * - Network partitions and latency injection
 * - Service failure simulation
 * - Resource exhaustion testing
 * - Database failure scenarios
 * - Message loss and duplication
 * - Clock skew and time-based failures
 * - Circuit breaker and retry testing
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Ref from 'effect/Ref';
import * as Queue from 'effect/Queue';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Schedule from 'effect/Schedule';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Chaos experiment types
 */
export enum ChaosType {
  NETWORK_PARTITION = 'network_partition',
  LATENCY_INJECTION = 'latency_injection',
  SERVICE_FAILURE = 'service_failure',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  DATABASE_FAILURE = 'database_failure',
  MESSAGE_LOSS = 'message_loss',
  MESSAGE_DUPLICATION = 'message_duplication',
  CLOCK_SKEW = 'clock_skew',
  DISK_FULL = 'disk_full',
  CPU_STRESS = 'cpu_stress',
  MEMORY_PRESSURE = 'memory_pressure',
}

/**
 * Chaos experiment configuration
 */
export interface ChaosExperiment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ChaosType;
  readonly target: ChaosTarget;
  readonly parameters: ChaosParameters;
  readonly duration: Duration.Duration;
  readonly schedule?: Schedule.Schedule<never, any, any>;
  readonly preconditions: ChaosPrecondition[];
  readonly steadyStateHypothesis: SteadyStateHypothesis;
  readonly rollbackStrategy: RollbackStrategy;
}

/**
 * Chaos target specification
 */
export interface ChaosTarget {
  readonly type: 'service' | 'database' | 'network' | 'host' | 'process';
  readonly selector: Record<string, string | string[]>;
  readonly percentage?: number; // Percentage of targets to affect
}

/**
 * Chaos parameters
 */
export type ChaosParameters = 
  | NetworkPartitionParams
  | LatencyInjectionParams
  | ServiceFailureParams
  | ResourceExhaustionParams
  | DatabaseFailureParams
  | MessageChaosParams
  | ClockSkewParams;

/**
 * Network partition parameters
 */
export interface NetworkPartitionParams {
  readonly direction: 'inbound' | 'outbound' | 'both';
  readonly ports?: number[];
  readonly hosts?: string[];
}

/**
 * Latency injection parameters
 */
export interface LatencyInjectionParams {
  readonly delay: Duration.Duration;
  readonly jitter?: Duration.Duration;
  readonly distribution: 'constant' | 'uniform' | 'normal' | 'exponential';
}

/**
 * Service failure parameters
 */
export interface ServiceFailureParams {
  readonly failureMode: 'crash' | 'hang' | 'slow_response' | 'error_response';
  readonly errorRate?: number; // Percentage of requests to fail
  readonly errorCodes?: number[];
}

/**
 * Resource exhaustion parameters
 */
export interface ResourceExhaustionParams {
  readonly resource: 'cpu' | 'memory' | 'disk' | 'network';
  readonly intensity: number; // 0-100 percentage
  readonly pattern: 'constant' | 'spike' | 'oscillating';
}

/**
 * Database failure parameters
 */
export interface DatabaseFailureParams {
  readonly failureType: 'connection_loss' | 'slow_query' | 'lock_contention' | 'corruption';
  readonly affectedTables?: string[];
  readonly queryTypes?: string[];
}

/**
 * Message chaos parameters
 */
export interface MessageChaosParams {
  readonly lossRate?: number; // Percentage of messages to lose
  readonly duplicationRate?: number; // Percentage of messages to duplicate
  readonly delayRange?: [Duration.Duration, Duration.Duration];
  readonly corruptionRate?: number; // Percentage of messages to corrupt
}

/**
 * Clock skew parameters
 */
export interface ClockSkewParams {
  readonly skew: Duration.Duration;
  readonly drift?: Duration.Duration; // Clock drift rate
}

/**
 * Preconditions for chaos experiments
 */
export interface ChaosPrecondition {
  readonly name: string;
  readonly check: () => Effect.Effect<boolean, Error, never>;
  readonly required: boolean;
}

/**
 * Steady state hypothesis
 */
export interface SteadyStateHypothesis {
  readonly name: string;
  readonly description: string;
  readonly probes: SteadyStateProbe[];
  readonly tolerance: number; // Percentage of probes that must pass
}

/**
 * Steady state probe
 */
export interface SteadyStateProbe {
  readonly name: string;
  readonly description: string;
  readonly check: () => Effect.Effect<ProbeResult, Error, never>;
  readonly frequency: Duration.Duration;
  readonly timeout: Duration.Duration;
}

/**
 * Probe result
 */
export interface ProbeResult {
  readonly success: boolean;
  readonly value?: number;
  readonly message?: string;
  readonly timestamp: Date;
}

/**
 * Rollback strategy
 */
export interface RollbackStrategy {
  readonly automatic: boolean;
  readonly triggers: Array<{
    condition: () => Effect.Effect<boolean, Error, never>;
    action: () => Effect.Effect<void, Error, never>;
  }>;
  readonly cleanup: () => Effect.Effect<void, Error, never>;
}

/**
 * Experiment result
 */
export interface ExperimentResult {
  readonly experiment: ChaosExperiment;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly status: 'completed' | 'failed' | 'aborted' | 'rolled_back';
  readonly preconditionResults: Array<{ name: string; passed: boolean; error?: string }>;
  readonly steadyStateResults: {
    before: ProbeResult[];
    during: ProbeResult[];
    after: ProbeResult[];
  };
  readonly failureInjected: boolean;
  readonly rollbackExecuted: boolean;
  readonly insights: string[];
  readonly artifacts: ExperimentArtifact[];
}

/**
 * Experiment artifact
 */
export interface ExperimentArtifact {
  readonly type: 'log' | 'metric' | 'trace' | 'screenshot';
  readonly name: string;
  readonly content: string | Buffer;
  readonly timestamp: Date;
}

/**
 * Chaos engineering service
 */
export class ChaosEngineeringService {
  private activeExperiments: Map<string, Fiber.RuntimeFiber<ExperimentResult, Error>> = new Map();
  private experimentHistory: ExperimentResult[] = [];

  constructor(
    private readonly config: {
      maxConcurrentExperiments: number;
      defaultTimeout: Duration.Duration;
      safetyChecks: boolean;
      dryRun: boolean;
    }
  ) {}

  /**
   * Execute chaos experiment
   */
  executeExperiment(experiment: ChaosExperiment): Effect.Effect<ExperimentResult, Error, never> {
    return Effect.gen(function* (_) {
      if (this.activeExperiments.size >= this.config.maxConcurrentExperiments) {
        return yield* _(Effect.fail(new Error('Too many concurrent experiments')));
      }

      const fiber = yield* _(
        pipe(
          this.runExperiment(experiment),
          Effect.fork
        )
      );

      this.activeExperiments.set(experiment.id, fiber);

      try {
        const result = yield* _(Fiber.join(fiber));
        this.experimentHistory.push(result);
        return result;
      } finally {
        this.activeExperiments.delete(experiment.id);
      }
    });
  }

  /**
   * Run experiment implementation
   */
  private runExperiment(experiment: ChaosExperiment): Effect.Effect<ExperimentResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = new Date();
      let status: ExperimentResult['status'] = 'completed';
      let failureInjected = false;
      let rollbackExecuted = false;
      const insights: string[] = [];
      const artifacts: ExperimentArtifact[] = [];

      try {
        // 1. Check preconditions
        console.log(`🧪 Starting chaos experiment: ${experiment.name}`);
        const preconditionResults = yield* _(this.checkPreconditions(experiment));
        
        const failedPreconditions = preconditionResults.filter(r => !r.passed);
        if (failedPreconditions.length > 0) {
          insights.push(`Preconditions failed: ${failedPreconditions.map(p => p.name).join(', ')}`);
          return {
            experiment,
            startTime,
            endTime: new Date(),
            status: 'failed',
            preconditionResults,
            steadyStateResults: { before: [], during: [], after: [] },
            failureInjected: false,
            rollbackExecuted: false,
            insights,
            artifacts,
          };
        }

        // 2. Establish steady state baseline
        console.log(`📊 Establishing steady state baseline...`);
        const baselineProbes = yield* _(this.runSteadyStateProbes(experiment.steadyStateHypothesis));
        
        if (!this.evaluateSteadyState(baselineProbes, experiment.steadyStateHypothesis)) {
          insights.push('System not in steady state before experiment');
          status = 'aborted';
          return {
            experiment,
            startTime,
            endTime: new Date(),
            status,
            preconditionResults,
            steadyStateResults: { before: baselineProbes, during: [], after: [] },
            failureInjected: false,
            rollbackExecuted: false,
            insights,
            artifacts,
          };
        }

        // 3. Inject failure
        console.log(`💥 Injecting failure: ${experiment.type}`);
        if (!this.config.dryRun) {
          yield* _(this.injectFailure(experiment));
          failureInjected = true;
        } else {
          console.log(`🔍 DRY RUN: Would inject ${experiment.type}`);
          insights.push('Experiment run in dry-run mode');
        }

        // 4. Monitor steady state during experiment
        console.log(`🔍 Monitoring system behavior...`);
        const duringProbes = yield* _(
          pipe(
            this.monitorSteadyStateDuring(experiment),
            Effect.timeout(experiment.duration),
            Effect.catchAll(() => Effect.succeed([]))
          )
        );

        // 5. Check for rollback triggers
        const shouldRollback = yield* _(this.checkRollbackTriggers(experiment.rollbackStrategy));
        if (shouldRollback) {
          console.log(`🔄 Rolling back experiment...`);
          yield* _(experiment.rollbackStrategy.cleanup());
          rollbackExecuted = true;
          status = 'rolled_back';
          insights.push('Experiment rolled back due to trigger conditions');
        }

        // 6. Stop failure injection
        if (failureInjected && !this.config.dryRun) {
          yield* _(this.stopFailureInjection(experiment));
        }

        // 7. Wait for system recovery
        console.log(`⏳ Waiting for system recovery...`);
        yield* _(Effect.sleep(Duration.seconds(30))); // Recovery period

        // 8. Verify steady state recovery
        console.log(`🔍 Verifying system recovery...`);
        const afterProbes = yield* _(this.runSteadyStateProbes(experiment.steadyStateHypothesis));
        
        const recovered = this.evaluateSteadyState(afterProbes, experiment.steadyStateHypothesis);
        if (!recovered) {
          insights.push('System did not return to steady state after experiment');
          status = 'failed';
        }

        // 9. Analyze results
        insights.push(...this.analyzeResults(baselineProbes, duringProbes, afterProbes));

        return {
          experiment,
          startTime,
          endTime: new Date(),
          status,
          preconditionResults,
          steadyStateResults: {
            before: baselineProbes,
            during: duringProbes,
            after: afterProbes,
          },
          failureInjected,
          rollbackExecuted,
          insights,
          artifacts,
        };

      } catch (error) {
        console.error(`❌ Experiment failed: ${error}`);
        
        // Emergency cleanup
        if (failureInjected) {
          try {
            yield* _(this.stopFailureInjection(experiment));
            yield* _(experiment.rollbackStrategy.cleanup());
            rollbackExecuted = true;
          } catch (cleanupError) {
            console.error(`❌ Cleanup failed: ${cleanupError}`);
          }
        }

        return {
          experiment,
          startTime,
          endTime: new Date(),
          status: 'failed',
          preconditionResults: [],
          steadyStateResults: { before: [], during: [], after: [] },
          failureInjected,
          rollbackExecuted,
          insights: [`Experiment failed: ${error}`, ...insights],
          artifacts,
        };
      }
    });
  }

  /**
   * Check preconditions
   */
  private checkPreconditions(experiment: ChaosExperiment): Effect.Effect<Array<{ name: string; passed: boolean; error?: string }>, Error, never> {
    return Effect.gen(function* (_) {
      const results = [];

      for (const precondition of experiment.preconditions) {
        try {
          const passed = yield* _(
            pipe(
              precondition.check(),
              Effect.timeout(Duration.seconds(30))
            )
          );
          results.push({ name: precondition.name, passed });
        } catch (error) {
          results.push({ 
            name: precondition.name, 
            passed: false, 
            error: String(error)
          });
        }
      }

      return results;
    });
  }

  /**
   * Run steady state probes
   */
  private runSteadyStateProbes(hypothesis: SteadyStateHypothesis): Effect.Effect<ProbeResult[], Error, never> {
    return Effect.gen(function* (_) {
      const results = [];

      for (const probe of hypothesis.probes) {
        try {
          const result = yield* _(
            pipe(
              probe.check(),
              Effect.timeout(probe.timeout)
            )
          );
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            message: String(error),
            timestamp: new Date(),
          });
        }
      }

      return results;
    });
  }

  /**
   * Monitor steady state during experiment
   */
  private monitorSteadyStateDuring(experiment: ChaosExperiment): Effect.Effect<ProbeResult[], Error, never> {
    return Effect.gen(function* (_) {
      const results: ProbeResult[] = [];
      const probes = experiment.steadyStateHypothesis.probes;
      const monitoringDuration = experiment.duration;
      
      // Create monitoring stream
      const monitoringStream = pipe(
        Stream.fromSchedule(Schedule.spaced(Duration.seconds(10))), // Check every 10 seconds
        Stream.take(Math.ceil(Duration.toMillis(monitoringDuration) / 10000)),
        Stream.mapEffect(() => this.runSteadyStateProbes(experiment.steadyStateHypothesis)),
        Stream.tap(probeResults => Effect.sync(() => results.push(...probeResults)))
      );

      yield* _(Stream.runDrain(monitoringStream));
      return results;
    });
  }

  /**
   * Inject failure based on experiment type
   */
  private injectFailure(experiment: ChaosExperiment): Effect.Effect<void, Error, never> {
    switch (experiment.type) {
      case ChaosType.NETWORK_PARTITION:
        return this.injectNetworkPartition(experiment.target, experiment.parameters as NetworkPartitionParams);
      
      case ChaosType.LATENCY_INJECTION:
        return this.injectLatency(experiment.target, experiment.parameters as LatencyInjectionParams);
      
      case ChaosType.SERVICE_FAILURE:
        return this.injectServiceFailure(experiment.target, experiment.parameters as ServiceFailureParams);
      
      case ChaosType.RESOURCE_EXHAUSTION:
        return this.injectResourceExhaustion(experiment.target, experiment.parameters as ResourceExhaustionParams);
      
      case ChaosType.DATABASE_FAILURE:
        return this.injectDatabaseFailure(experiment.target, experiment.parameters as DatabaseFailureParams);
      
      case ChaosType.MESSAGE_LOSS:
      case ChaosType.MESSAGE_DUPLICATION:
        return this.injectMessageChaos(experiment.target, experiment.parameters as MessageChaosParams);
      
      case ChaosType.CLOCK_SKEW:
        return this.injectClockSkew(experiment.target, experiment.parameters as ClockSkewParams);
      
      default:
        return Effect.fail(new Error(`Unsupported chaos type: ${experiment.type}`));
    }
  }

  /**
   * Stop failure injection
   */
  private stopFailureInjection(experiment: ChaosExperiment): Effect.Effect<void, Error, never> {
    // Implementation would depend on the specific failure type
    return Effect.gen(function* (_) {
      console.log(`🛑 Stopping failure injection for: ${experiment.type}`);
      
      switch (experiment.type) {
        case ChaosType.NETWORK_PARTITION:
          yield* _(this.restoreNetworkConnectivity(experiment.target));
          break;
        
        case ChaosType.LATENCY_INJECTION:
          yield* _(this.removeLatencyInjection(experiment.target));
          break;
        
        case ChaosType.SERVICE_FAILURE:
          yield* _(this.restoreService(experiment.target));
          break;
        
        case ChaosType.RESOURCE_EXHAUSTION:
          yield* _(this.stopResourceExhaustion(experiment.target));
          break;
        
        default:
          // Generic cleanup
          break;
      }
    });
  }

  /**
   * Network partition injection
   */
  private injectNetworkPartition(target: ChaosTarget, params: NetworkPartitionParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`🌐 Injecting network partition: ${params.direction}`);
      // In production, would use iptables, tc, or similar tools
      // For now, simulate with logging
    });
  }

  /**
   * Latency injection
   */
  private injectLatency(target: ChaosTarget, params: LatencyInjectionParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`⏱️ Injecting latency: ${Duration.toMillis(params.delay)}ms`);
      // In production, would use tc (traffic control) or proxy injection
    });
  }

  /**
   * Service failure injection
   */
  private injectServiceFailure(target: ChaosTarget, params: ServiceFailureParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`💀 Injecting service failure: ${params.failureMode}`);
      // In production, would kill processes, inject errors, etc.
    });
  }

  /**
   * Resource exhaustion injection
   */
  private injectResourceExhaustion(target: ChaosTarget, params: ResourceExhaustionParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`📈 Injecting resource exhaustion: ${params.resource} at ${params.intensity}%`);
      // In production, would use stress-ng, memory hogs, etc.
    });
  }

  /**
   * Database failure injection
   */
  private injectDatabaseFailure(target: ChaosTarget, params: DatabaseFailureParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`🗃️ Injecting database failure: ${params.failureType}`);
      // In production, would manipulate database connections, inject slow queries, etc.
    });
  }

  /**
   * Message chaos injection
   */
  private injectMessageChaos(target: ChaosTarget, params: MessageChaosParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`📨 Injecting message chaos: loss=${params.lossRate}%, dup=${params.duplicationRate}%`);
      // In production, would intercept message queues, inject chaos
    });
  }

  /**
   * Clock skew injection
   */
  private injectClockSkew(target: ChaosTarget, params: ClockSkewParams): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`🕐 Injecting clock skew: ${Duration.toMillis(params.skew)}ms`);
      // In production, would manipulate system clocks
    });
  }

  /**
   * Restore network connectivity
   */
  private restoreNetworkConnectivity(target: ChaosTarget): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`🌐 Restoring network connectivity`);
    });
  }

  /**
   * Remove latency injection
   */
  private removeLatencyInjection(target: ChaosTarget): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`⏱️ Removing latency injection`);
    });
  }

  /**
   * Restore service
   */
  private restoreService(target: ChaosTarget): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`💚 Restoring service`);
    });
  }

  /**
   * Stop resource exhaustion
   */
  private stopResourceExhaustion(target: ChaosTarget): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log(`📉 Stopping resource exhaustion`);
    });
  }

  /**
   * Check rollback triggers
   */
  private checkRollbackTriggers(strategy: RollbackStrategy): Effect.Effect<boolean, Error, never> {
    return Effect.gen(function* (_) {
      if (!strategy.automatic) {
        return false;
      }

      for (const trigger of strategy.triggers) {
        const shouldTrigger = yield* _(
          pipe(
            trigger.condition(),
            Effect.timeout(Duration.seconds(5)),
            Effect.catchAll(() => Effect.succeed(false))
          )
        );

        if (shouldTrigger) {
          yield* _(trigger.action());
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Evaluate steady state
   */
  private evaluateSteadyState(probes: ProbeResult[], hypothesis: SteadyStateHypothesis): boolean {
    const successfulProbes = probes.filter(p => p.success).length;
    const successRate = probes.length > 0 ? (successfulProbes / probes.length) * 100 : 0;
    return successRate >= hypothesis.tolerance;
  }

  /**
   * Analyze results
   */
  private analyzeResults(before: ProbeResult[], during: ProbeResult[], after: ProbeResult[]): string[] {
    const insights: string[] = [];

    // Compare success rates
    const beforeSuccess = before.filter(p => p.success).length / Math.max(before.length, 1) * 100;
    const duringSuccess = during.filter(p => p.success).length / Math.max(during.length, 1) * 100;
    const afterSuccess = after.filter(p => p.success).length / Math.max(after.length, 1) * 100;

    insights.push(`Success rates: Before=${beforeSuccess.toFixed(1)}%, During=${duringSuccess.toFixed(1)}%, After=${afterSuccess.toFixed(1)}%`);

    if (duringSuccess < beforeSuccess * 0.8) {
      insights.push('System showed significant degradation during experiment');
    }

    if (afterSuccess < beforeSuccess * 0.9) {
      insights.push('System did not fully recover to baseline performance');
    }

    if (duringSuccess > beforeSuccess * 0.95) {
      insights.push('System showed high resilience to the injected failure');
    }

    return insights;
  }

  /**
   * Get experiment history
   */
  getExperimentHistory(): ExperimentResult[] {
    return [...this.experimentHistory];
  }

  /**
   * Get active experiments
   */
  getActiveExperiments(): string[] {
    return Array.from(this.activeExperiments.keys());
  }

  /**
   * Abort experiment
   */
  abortExperiment(experimentId: string): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const fiber = this.activeExperiments.get(experimentId);
      if (fiber) {
        yield* _(Fiber.interrupt(fiber));
        this.activeExperiments.delete(experimentId);
      }
    });
  }
}

/**
 * CQRS-specific chaos experiments
 */
export class CQRSChaosExperiments {
  /**
   * Command handler failure experiment
   */
  static commandHandlerFailure(): ChaosExperiment {
    return {
      id: 'command-handler-failure',
      name: 'Command Handler Failure',
      description: 'Simulate command handler failures to test retry and error handling',
      type: ChaosType.SERVICE_FAILURE,
      target: {
        type: 'service',
        selector: { component: 'command-handler' },
        percentage: 50,
      },
      parameters: {
        failureMode: 'error_response',
        errorRate: 30,
        errorCodes: [500, 503],
      } as ServiceFailureParams,
      duration: Duration.minutes(5),
      preconditions: [
        {
          name: 'System is healthy',
          check: () => Effect.succeed(true), // Would check actual health
          required: true,
        },
      ],
      steadyStateHypothesis: {
        name: 'Commands are processed successfully',
        description: 'At least 90% of commands should be processed successfully',
        tolerance: 90,
        probes: [
          {
            name: 'Command success rate',
            description: 'Measure command processing success rate',
            check: () => Effect.succeed({
              success: true,
              value: 95,
              timestamp: new Date(),
            }),
            frequency: Duration.seconds(30),
            timeout: Duration.seconds(10),
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        triggers: [
          {
            condition: () => Effect.succeed(false), // Would check if success rate < 50%
            action: () => Effect.sync(() => console.log('Emergency rollback triggered')),
          },
        ],
        cleanup: () => Effect.sync(() => console.log('Restoring command handlers')),
      },
    };
  }

  /**
   * Event store partition experiment
   */
  static eventStorePartition(): ChaosExperiment {
    return {
      id: 'event-store-partition',
      name: 'Event Store Network Partition',
      description: 'Test system behavior when event store is partitioned',
      type: ChaosType.NETWORK_PARTITION,
      target: {
        type: 'database',
        selector: { service: 'event-store' },
      },
      parameters: {
        direction: 'both',
        ports: [5432, 27017],
      } as NetworkPartitionParams,
      duration: Duration.minutes(3),
      preconditions: [
        {
          name: 'Event store is accessible',
          check: () => Effect.succeed(true),
          required: true,
        },
      ],
      steadyStateHypothesis: {
        name: 'System maintains availability',
        description: 'System should gracefully handle event store unavailability',
        tolerance: 80,
        probes: [
          {
            name: 'API availability',
            description: 'API endpoints remain accessible',
            check: () => Effect.succeed({
              success: true,
              value: 100,
              timestamp: new Date(),
            }),
            frequency: Duration.seconds(15),
            timeout: Duration.seconds(5),
          },
        ],
      },
      rollbackStrategy: {
        automatic: false,
        triggers: [],
        cleanup: () => Effect.sync(() => console.log('Restoring event store connectivity')),
      },
    };
  }

  /**
   * Message queue latency experiment
   */
  static messageQueueLatency(): ChaosExperiment {
    return {
      id: 'message-queue-latency',
      name: 'Message Queue Latency Injection',
      description: 'Inject latency into message queue to test async processing',
      type: ChaosType.LATENCY_INJECTION,
      target: {
        type: 'service',
        selector: { component: 'message-queue' },
      },
      parameters: {
        delay: Duration.seconds(5),
        jitter: Duration.seconds(2),
        distribution: 'normal',
      } as LatencyInjectionParams,
      duration: Duration.minutes(10),
      preconditions: [
        {
          name: 'Message queue is operational',
          check: () => Effect.succeed(true),
          required: true,
        },
      ],
      steadyStateHypothesis: {
        name: 'Events are processed within acceptable timeframe',
        description: 'Events should be processed within 30 seconds despite latency',
        tolerance: 85,
        probes: [
          {
            name: 'Event processing latency',
            description: 'Measure event processing end-to-end latency',
            check: () => Effect.succeed({
              success: true,
              value: 25000, // 25 seconds
              timestamp: new Date(),
            }),
            frequency: Duration.seconds(30),
            timeout: Duration.seconds(10),
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        triggers: [
          {
            condition: () => Effect.succeed(false), // Would check if latency > 60s
            action: () => Effect.sync(() => console.log('Latency too high, rolling back')),
          },
        ],
        cleanup: () => Effect.sync(() => console.log('Removing latency injection')),
      },
    };
  }

  /**
   * Memory pressure experiment
   */
  static memoryPressure(): ChaosExperiment {
    return {
      id: 'memory-pressure',
      name: 'Memory Pressure Test',
      description: 'Test system behavior under memory pressure',
      type: ChaosType.MEMORY_PRESSURE,
      target: {
        type: 'host',
        selector: { role: 'application-server' },
      },
      parameters: {
        resource: 'memory',
        intensity: 85,
        pattern: 'constant',
      } as ResourceExhaustionParams,
      duration: Duration.minutes(7),
      preconditions: [
        {
          name: 'Memory usage is normal',
          check: () => Effect.succeed(true), // Would check current memory usage
          required: true,
        },
      ],
      steadyStateHypothesis: {
        name: 'System handles memory pressure gracefully',
        description: 'System should not crash or become unresponsive',
        tolerance: 95,
        probes: [
          {
            name: 'Application responsiveness',
            description: 'Check if application responds to requests',
            check: () => Effect.succeed({
              success: true,
              value: 1,
              timestamp: new Date(),
            }),
            frequency: Duration.seconds(20),
            timeout: Duration.seconds(5),
          },
        ],
      },
      rollbackStrategy: {
        automatic: true,
        triggers: [
          {
            condition: () => Effect.succeed(false), // Would check if memory > 95%
            action: () => Effect.sync(() => console.log('Memory critically low, rolling back')),
          },
        ],
        cleanup: () => Effect.sync(() => console.log('Releasing memory pressure')),
      },
    };
  }
}

/**
 * Create chaos engineering service
 */
export const createChaosEngineeringService = (config?: {
  maxConcurrentExperiments?: number;
  defaultTimeout?: Duration.Duration;
  safetyChecks?: boolean;
  dryRun?: boolean;
}): ChaosEngineeringService => {
  const fullConfig = {
    maxConcurrentExperiments: config?.maxConcurrentExperiments ?? 3,
    defaultTimeout: config?.defaultTimeout ?? Duration.minutes(30),
    safetyChecks: config?.safetyChecks ?? true,
    dryRun: config?.dryRun ?? true, // Default to dry run for safety
  };

  return new ChaosEngineeringService(fullConfig);
};