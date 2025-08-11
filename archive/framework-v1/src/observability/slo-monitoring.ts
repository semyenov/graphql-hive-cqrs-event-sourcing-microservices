/**
 * SLO (Service Level Objectives) Monitoring
 * 
 * Comprehensive SLO monitoring for CQRS/Event Sourcing systems:
 * - SLI (Service Level Indicators) collection and measurement
 * - SLO definition and tracking
 * - Error budget calculation and alerting
 * - SLA compliance reporting
 * - Multi-window SLO evaluation
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Ref from 'effect/Ref';
import * as Queue from 'effect/Queue';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Service Level Indicator types
 */
export enum SLIType {
  AVAILABILITY = 'availability',
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  FRESHNESS = 'freshness',
  DURABILITY = 'durability',
  CORRECTNESS = 'correctness',
}

/**
 * SLI measurement
 */
export interface SLIMeasurement {
  readonly timestamp: Date;
  readonly value: number;
  readonly success: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * SLI definition
 */
export interface SLIDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: SLIType;
  readonly description: string;
  readonly query: string; // Prometheus query or similar
  readonly goodEventQuery?: string;
  readonly validEventQuery?: string;
  readonly thresholds: {
    readonly good: number;
    readonly warning: number;
    readonly critical: number;
  };
  readonly unit: string;
  readonly tags: string[];
}

/**
 * SLO definition
 */
export interface SLODefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly service: string;
  readonly category: string;
  readonly sli: SLIDefinition;
  readonly target: number; // Target percentage (e.g., 99.9)
  readonly timeWindow: Duration.Duration;
  readonly alertingWindows: Duration.Duration[];
  readonly owner: string;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
  readonly tags: string[];
}

/**
 * SLO status
 */
export interface SLOStatus {
  readonly slo: SLODefinition;
  readonly currentValue: number;
  readonly target: number;
  readonly errorBudget: {
    readonly total: number;
    readonly consumed: number;
    readonly remaining: number;
    readonly consumptionRate: number;
  };
  readonly compliance: 'compliant' | 'at_risk' | 'exhausted';
  readonly trend: 'improving' | 'stable' | 'degrading';
  readonly lastUpdate: Date;
  readonly measurements: SLIMeasurement[];
}

/**
 * Error budget policy
 */
export interface ErrorBudgetPolicy {
  readonly id: string;
  readonly name: string;
  readonly conditions: Array<{
    readonly budgetRemaining: number; // Percentage
    readonly action: 'alert' | 'throttle' | 'block_deployments' | 'escalate';
    readonly severity: 'info' | 'warning' | 'critical';
  }>;
}

/**
 * SLI collector
 */
export class SLICollector {
  private measurements = new Map<string, SLIMeasurement[]>();

  constructor(
    private readonly maxMeasurementsPerSLI: number = 10000
  ) {}

  /**
   * Record SLI measurement
   */
  recordMeasurement(sliId: string, measurement: SLIMeasurement): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const measurements = this.measurements.get(sliId) || [];
      measurements.push(measurement);

      // Keep only recent measurements
      if (measurements.length > this.maxMeasurementsPerSLI) {
        measurements.splice(0, measurements.length - this.maxMeasurementsPerSLI);
      }

      this.measurements.set(sliId, measurements);
    });
  }

  /**
   * Get measurements for SLI
   */
  getMeasurements(sliId: string, since?: Date): SLIMeasurement[] {
    const measurements = this.measurements.get(sliId) || [];
    
    if (!since) {
      return [...measurements];
    }

    return measurements.filter(m => m.timestamp >= since);
  }

  /**
   * Calculate SLI value over time window
   */
  calculateSLI(sliId: string, timeWindow: Duration.Duration): Effect.Effect<number, Error, never> {
    return Effect.sync(() => {
      const since = new Date(Date.now() - Duration.toMillis(timeWindow));
      const measurements = this.getMeasurements(sliId, since);

      if (measurements.length === 0) {
        return 0;
      }

      const successCount = measurements.filter(m => m.success).length;
      return (successCount / measurements.length) * 100;
    });
  }

  /**
   * Get SLI statistics
   */
  getSLIStatistics(sliId: string, timeWindow: Duration.Duration): {
    totalMeasurements: number;
    successfulMeasurements: number;
    failedMeasurements: number;
    successRate: number;
    averageValue: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const since = new Date(Date.now() - Duration.toMillis(timeWindow));
    const measurements = this.getMeasurements(sliId, since);

    if (measurements.length === 0) {
      return {
        totalMeasurements: 0,
        successfulMeasurements: 0,
        failedMeasurements: 0,
        successRate: 0,
        averageValue: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const successful = measurements.filter(m => m.success);
    const failed = measurements.filter(m => !m.success);
    const values = measurements.map(m => m.value).sort((a, b) => a - b);

    return {
      totalMeasurements: measurements.length,
      successfulMeasurements: successful.length,
      failedMeasurements: failed.length,
      successRate: (successful.length / measurements.length) * 100,
      averageValue: values.reduce((sum, v) => sum + v, 0) / values.length,
      p50: values[Math.floor(values.length * 0.5)] || 0,
      p95: values[Math.floor(values.length * 0.95)] || 0,
      p99: values[Math.floor(values.length * 0.99)] || 0,
    };
  }
}

/**
 * SLO calculator
 */
export class SLOCalculator {
  constructor(
    private readonly collector: SLICollector
  ) {}

  /**
   * Calculate SLO status
   */
  calculateSLOStatus(slo: SLODefinition): Effect.Effect<SLOStatus, Error, never> {
    return Effect.gen(function* (_) {
      // Calculate current SLI value
      const currentValue = yield* _(this.collector.calculateSLI(slo.sli.id, slo.timeWindow));
      
      // Calculate error budget
      const errorBudget = this.calculateErrorBudget(slo, currentValue);
      
      // Determine compliance
      const compliance = this.determineCompliance(currentValue, slo.target, errorBudget);
      
      // Calculate trend
      const trend = yield* _(this.calculateTrend(slo));
      
      // Get recent measurements
      const measurements = this.collector.getMeasurements(slo.sli.id, 
        new Date(Date.now() - Duration.toMillis(Duration.hours(1)))
      );

      return {
        slo,
        currentValue,
        target: slo.target,
        errorBudget,
        compliance,
        trend,
        lastUpdate: new Date(),
        measurements: measurements.slice(-100), // Last 100 measurements
      };
    });
  }

  /**
   * Calculate error budget
   */
  private calculateErrorBudget(slo: SLODefinition, currentValue: number): SLOStatus['errorBudget'] {
    const allowedFailureRate = 100 - slo.target;
    const actualFailureRate = 100 - currentValue;
    
    const totalBudget = allowedFailureRate;
    const consumed = Math.min(actualFailureRate, totalBudget);
    const remaining = Math.max(0, totalBudget - consumed);
    const consumptionRate = consumed / totalBudget;

    return {
      total: totalBudget,
      consumed,
      remaining,
      consumptionRate,
    };
  }

  /**
   * Determine compliance status
   */
  private determineCompliance(
    currentValue: number,
    target: number,
    errorBudget: SLOStatus['errorBudget']
  ): SLOStatus['compliance'] {
    if (currentValue >= target) {
      return 'compliant';
    }
    
    if (errorBudget.consumptionRate > 0.8) {
      return 'exhausted';
    }
    
    return 'at_risk';
  }

  /**
   * Calculate trend
   */
  private calculateTrend(slo: SLODefinition): Effect.Effect<SLOStatus['trend'], Error, never> {
    return Effect.gen(function* (_) {
      // Compare current period with previous period
      const currentWindow = Duration.toMillis(slo.timeWindow);
      const now = Date.now();
      
      const currentPeriodStart = new Date(now - currentWindow);
      const previousPeriodStart = new Date(now - (currentWindow * 2));
      const previousPeriodEnd = new Date(now - currentWindow);
      
      const currentMeasurements = this.collector.getMeasurements(slo.sli.id, currentPeriodStart);
      const previousMeasurements = this.collector.getMeasurements(slo.sli.id, previousPeriodStart)
        .filter(m => m.timestamp <= previousPeriodEnd);
      
      if (previousMeasurements.length === 0) {
        return 'stable';
      }
      
      const currentSuccess = currentMeasurements.filter(m => m.success).length / currentMeasurements.length;
      const previousSuccess = previousMeasurements.filter(m => m.success).length / previousMeasurements.length;
      
      const diff = currentSuccess - previousSuccess;
      
      if (diff > 0.01) return 'improving';
      if (diff < -0.01) return 'degrading';
      return 'stable';
    });
  }

  /**
   * Calculate multi-window SLO
   */
  calculateMultiWindowSLO(
    slo: SLODefinition,
    windows: Duration.Duration[]
  ): Effect.Effect<Array<{
    window: Duration.Duration;
    value: number;
    compliant: boolean;
  }>, Error, never> {
    return Effect.gen(function* (_) {
      const results = [];
      
      for (const window of windows) {
        const value = yield* _(this.collector.calculateSLI(slo.sli.id, window));
        const compliant = value >= slo.target;
        
        results.push({
          window,
          value,
          compliant,
        });
      }
      
      return results;
    });
  }
}

/**
 * Error budget manager
 */
export class ErrorBudgetManager {
  constructor(
    private readonly policies: Map<string, ErrorBudgetPolicy> = new Map()
  ) {}

  /**
   * Add error budget policy
   */
  addPolicy(policy: ErrorBudgetPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Evaluate error budget policies
   */
  evaluatePolicies(
    sloStatus: SLOStatus
  ): Array<{
    policy: ErrorBudgetPolicy;
    triggered: boolean;
    action: string;
    severity: string;
    reason: string;
  }> {
    const results = [];
    
    for (const policy of this.policies.values()) {
      for (const condition of policy.conditions) {
        const remainingBudget = sloStatus.errorBudget.remaining;
        const remainingPercentage = (remainingBudget / sloStatus.errorBudget.total) * 100;
        
        if (remainingPercentage <= condition.budgetRemaining) {
          results.push({
            policy,
            triggered: true,
            action: condition.action,
            severity: condition.severity,
            reason: `Error budget remaining: ${remainingPercentage.toFixed(2)}% (threshold: ${condition.budgetRemaining}%)`,
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Calculate burn rate
   */
  calculateBurnRate(
    sloStatus: SLOStatus,
    timeWindow: Duration.Duration
  ): {
    burnRate: number;
    timeToExhaustion: Duration.Duration;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const windowHours = Duration.toMillis(timeWindow) / (1000 * 60 * 60);
    const totalWindowHours = Duration.toMillis(sloStatus.slo.timeWindow) / (1000 * 60 * 60);
    
    const burnRate = sloStatus.errorBudget.consumptionRate / (windowHours / totalWindowHours);
    
    let timeToExhaustion = Duration.infinity;
    if (burnRate > 0) {
      const hoursToExhaustion = (sloStatus.errorBudget.remaining / burnRate);
      timeToExhaustion = Duration.hours(hoursToExhaustion);
    }
    
    // Determine severity based on burn rate
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (burnRate < 1) {
      severity = 'low';
    } else if (burnRate < 5) {
      severity = 'medium';
    } else if (burnRate < 20) {
      severity = 'high';
    } else {
      severity = 'critical';
    }
    
    return {
      burnRate,
      timeToExhaustion,
      severity,
    };
  }
}

/**
 * SLO alert manager
 */
export class SLOAlertManager {
  private activeAlerts = new Set<string>();
  
  constructor(
    private readonly alertCallback: (alert: SLOAlert) => Effect.Effect<void, never, never>
  ) {}

  /**
   * Check SLO alerts
   */
  checkAlerts(sloStatuses: SLOStatus[]): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      for (const status of sloStatuses) {
        // Check for SLO violations
        if (status.compliance === 'exhausted' && !this.activeAlerts.has(`slo-exhausted-${status.slo.id}`)) {
          const alert: SLOAlert = {
            id: `slo-exhausted-${status.slo.id}`,
            type: 'slo_violation',
            severity: status.slo.priority === 'P0' ? 'critical' : 'warning',
            slo: status.slo,
            message: `SLO "${status.slo.name}" error budget exhausted`,
            currentValue: status.currentValue,
            target: status.target,
            timestamp: new Date(),
          };
          
          this.activeAlerts.add(alert.id);
          yield* _(this.alertCallback(alert));
        }
        
        // Check for burn rate alerts
        const errorBudgetManager = new ErrorBudgetManager();
        const burnRate = errorBudgetManager.calculateBurnRate(status, Duration.hours(1));
        
        if (burnRate.severity === 'critical' && !this.activeAlerts.has(`burn-rate-${status.slo.id}`)) {
          const alert: SLOAlert = {
            id: `burn-rate-${status.slo.id}`,
            type: 'burn_rate',
            severity: 'critical',
            slo: status.slo,
            message: `High burn rate detected for SLO "${status.slo.name}": ${burnRate.burnRate.toFixed(2)}x`,
            currentValue: status.currentValue,
            target: status.target,
            timestamp: new Date(),
            metadata: {
              burnRate: burnRate.burnRate,
              timeToExhaustion: Duration.toMillis(burnRate.timeToExhaustion),
            },
          };
          
          this.activeAlerts.add(alert.id);
          yield* _(this.alertCallback(alert));
        }
        
        // Clear alerts if SLO is back to compliance
        if (status.compliance === 'compliant') {
          this.activeAlerts.delete(`slo-exhausted-${status.slo.id}`);
          this.activeAlerts.delete(`burn-rate-${status.slo.id}`);
        }
      }
    });
  }
}

/**
 * SLO alert
 */
export interface SLOAlert {
  readonly id: string;
  readonly type: 'slo_violation' | 'burn_rate' | 'error_budget';
  readonly severity: 'info' | 'warning' | 'critical';
  readonly slo: SLODefinition;
  readonly message: string;
  readonly currentValue: number;
  readonly target: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * SLO reporting
 */
export class SLOReporter {
  constructor(
    private readonly calculator: SLOCalculator
  ) {}

  /**
   * Generate SLO report
   */
  generateReport(
    slos: SLODefinition[],
    period: Duration.Duration
  ): Effect.Effect<SLOReport, Error, never> {
    return Effect.gen(function* (_) {
      const statuses = [];
      
      for (const slo of slos) {
        const status = yield* _(this.calculator.calculateSLOStatus(slo));
        statuses.push(status);
      }
      
      const compliantSLOs = statuses.filter(s => s.compliance === 'compliant');
      const atRiskSLOs = statuses.filter(s => s.compliance === 'at_risk');
      const exhaustedSLOs = statuses.filter(s => s.compliance === 'exhausted');
      
      return {
        period,
        totalSLOs: slos.length,
        compliantSLOs: compliantSLOs.length,
        atRiskSLOs: atRiskSLOs.length,
        exhaustedSLOs: exhaustedSLOs.length,
        overallCompliance: (compliantSLOs.length / slos.length) * 100,
        statuses,
        generatedAt: new Date(),
      };
    });
  }

  /**
   * Generate detailed SLA report
   */
  generateSLAReport(
    slos: SLODefinition[],
    period: Duration.Duration
  ): Effect.Effect<SLAReport, Error, never> {
    return Effect.gen(function* (_) {
      const report = yield* _(this.generateReport(slos, period));
      
      // Calculate SLA metrics
      const slaBreaches = report.statuses.filter(s => s.compliance === 'exhausted');
      const criticalSLOs = report.statuses.filter(s => s.slo.priority === 'P0');
      
      return {
        ...report,
        slaBreaches: slaBreaches.length,
        criticalSLOsAtRisk: criticalSLOs.filter(s => s.compliance !== 'compliant').length,
        averageAvailability: report.statuses.reduce((sum, s) => sum + s.currentValue, 0) / report.statuses.length,
        worstPerformingSLOs: report.statuses
          .sort((a, b) => a.currentValue - b.currentValue)
          .slice(0, 5),
        bestPerformingSLOs: report.statuses
          .sort((a, b) => b.currentValue - a.currentValue)
          .slice(0, 5),
      };
    });
  }
}

/**
 * SLO report
 */
export interface SLOReport {
  readonly period: Duration.Duration;
  readonly totalSLOs: number;
  readonly compliantSLOs: number;
  readonly atRiskSLOs: number;
  readonly exhaustedSLOs: number;
  readonly overallCompliance: number;
  readonly statuses: SLOStatus[];
  readonly generatedAt: Date;
}

/**
 * SLA report
 */
export interface SLAReport extends SLOReport {
  readonly slaBreaches: number;
  readonly criticalSLOsAtRisk: number;
  readonly averageAvailability: number;
  readonly worstPerformingSLOs: SLOStatus[];
  readonly bestPerformingSLOs: SLOStatus[];
}

/**
 * SLO monitoring service
 */
export interface SLOMonitoringService {
  readonly _tag: 'SLOMonitoringService';
  readonly collector: SLICollector;
  readonly calculator: SLOCalculator;
  readonly errorBudgetManager: ErrorBudgetManager;
  readonly alertManager: SLOAlertManager;
  readonly reporter: SLOReporter;
  readonly recordSLI: (sliId: string, measurement: SLIMeasurement) => Effect.Effect<void, never, never>;
  readonly getSLOStatus: (slo: SLODefinition) => Effect.Effect<SLOStatus, Error, never>;
  readonly generateReport: (slos: SLODefinition[], period: Duration.Duration) => Effect.Effect<SLOReport, Error, never>;
}

export const SLOMonitoringService = Context.GenericTag<SLOMonitoringService>('SLOMonitoringService');

/**
 * SLO monitoring layer
 */
export const SLOMonitoringLive = (config: {
  maxMeasurementsPerSLI?: number;
  alertCallback?: (alert: SLOAlert) => Effect.Effect<void, never, never>;
}) =>
  Layer.effect(
    SLOMonitoringService,
    Effect.gen(function* (_) {
      const collector = new SLICollector(config.maxMeasurementsPerSLI);
      const calculator = new SLOCalculator(collector);
      const errorBudgetManager = new ErrorBudgetManager();
      const alertManager = new SLOAlertManager(
        config.alertCallback || ((alert) => Effect.sync(() => console.log('SLO Alert:', alert)))
      );
      const reporter = new SLOReporter(calculator);

      return {
        _tag: 'SLOMonitoringService',
        collector,
        calculator,
        errorBudgetManager,
        alertManager,
        reporter,
        recordSLI: (sliId: string, measurement: SLIMeasurement) =>
          collector.recordMeasurement(sliId, measurement),
        getSLOStatus: (slo: SLODefinition) =>
          calculator.calculateSLOStatus(slo),
        generateReport: (slos: SLODefinition[], period: Duration.Duration) =>
          reporter.generateReport(slos, period),
      };
    })
  );

/**
 * CQRS-specific SLO definitions
 */
export const CQRSSLOs = {
  /**
   * Command processing availability
   */
  commandAvailability: (): SLODefinition => ({
    id: 'command-availability',
    name: 'Command Processing Availability',
    description: 'Percentage of commands processed successfully',
    service: 'cqrs',
    category: 'availability',
    sli: {
      id: 'command-success-rate',
      name: 'Command Success Rate',
      type: SLIType.AVAILABILITY,
      description: 'Ratio of successful commands to total commands',
      query: 'sum(rate(cqrs_commands_processed_total[5m])) / sum(rate(cqrs_commands_total[5m]))',
      goodEventQuery: 'sum(rate(cqrs_commands_processed_total[5m]))',
      validEventQuery: 'sum(rate(cqrs_commands_total[5m]))',
      thresholds: {
        good: 99.9,
        warning: 99.5,
        critical: 99.0,
      },
      unit: 'percent',
      tags: ['command', 'availability'],
    },
    target: 99.9,
    timeWindow: Duration.days(30),
    alertingWindows: [Duration.minutes(5), Duration.hours(1), Duration.hours(6)],
    owner: 'platform-team',
    priority: 'P0',
    tags: ['cqrs', 'commands', 'availability'],
  }),

  /**
   * Query response latency
   */
  queryLatency: (): SLODefinition => ({
    id: 'query-latency',
    name: 'Query Response Latency',
    description: '95th percentile query response time under 100ms',
    service: 'cqrs',
    category: 'latency',
    sli: {
      id: 'query-p95-latency',
      name: 'Query P95 Latency',
      type: SLIType.LATENCY,
      description: '95th percentile query response latency',
      query: 'histogram_quantile(0.95, sum(rate(cqrs_queries_duration_seconds_bucket[5m])) by (le))',
      thresholds: {
        good: 0.1, // 100ms
        warning: 0.2,
        critical: 0.5,
      },
      unit: 'seconds',
      tags: ['query', 'latency'],
    },
    target: 95.0, // 95% of queries under 100ms
    timeWindow: Duration.days(7),
    alertingWindows: [Duration.minutes(2), Duration.minutes(15), Duration.hours(1)],
    owner: 'platform-team',
    priority: 'P1',
    tags: ['cqrs', 'queries', 'latency'],
  }),

  /**
   * Event processing throughput
   */
  eventThroughput: (): SLODefinition => ({
    id: 'event-throughput',
    name: 'Event Processing Throughput',
    description: 'Events processed per second meets minimum threshold',
    service: 'cqrs',
    category: 'throughput',
    sli: {
      id: 'event-processing-rate',
      name: 'Event Processing Rate',
      type: SLIType.THROUGHPUT,
      description: 'Rate of events processed per second',
      query: 'sum(rate(cqrs_events_processed_total[5m]))',
      thresholds: {
        good: 1000, // 1000 events/sec
        warning: 500,
        critical: 100,
      },
      unit: 'events/second',
      tags: ['event', 'throughput'],
    },
    target: 95.0, // 95% of time above 1000 events/sec
    timeWindow: Duration.hours(24),
    alertingWindows: [Duration.minutes(5), Duration.minutes(30)],
    owner: 'platform-team',
    priority: 'P2',
    tags: ['cqrs', 'events', 'throughput'],
  }),

  /**
   * Data freshness
   */
  dataFreshness: (): SLODefinition => ({
    id: 'data-freshness',
    name: 'Projection Data Freshness',
    description: 'Projection data is updated within acceptable time from event',
    service: 'cqrs',
    category: 'freshness',
    sli: {
      id: 'projection-lag',
      name: 'Projection Update Lag',
      type: SLIType.FRESHNESS,
      description: 'Time between event emission and projection update',
      query: 'max(cqrs_projection_lag_seconds)',
      thresholds: {
        good: 5.0, // 5 seconds
        warning: 10.0,
        critical: 30.0,
      },
      unit: 'seconds',
      tags: ['projection', 'freshness'],
    },
    target: 99.0, // 99% of updates within 5 seconds
    timeWindow: Duration.hours(24),
    alertingWindows: [Duration.minutes(10), Duration.hours(1)],
    owner: 'platform-team',
    priority: 'P2',
    tags: ['cqrs', 'projections', 'freshness'],
  }),
};