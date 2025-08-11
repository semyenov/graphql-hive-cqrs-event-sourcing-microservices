/**
 * Performance Monitoring Dashboard
 * 
 * Real-time performance monitoring and visualization:
 * - System metrics collection
 * - Performance dashboards
 * - Alert management
 * - Historical analysis
 * - Resource utilization tracking
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Ref from 'effect/Ref';
import * as Queue from 'effect/Queue';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import * as os from 'os';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Metric point
 */
export interface MetricPoint {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly timestamp: Date;
  readonly labels?: Record<string, string>;
}

/**
 * System metrics
 */
export interface SystemMetrics {
  readonly cpu: {
    readonly usage: number;
    readonly cores: number;
    readonly loadAverage: number[];
  };
  readonly memory: {
    readonly total: number;
    readonly used: number;
    readonly free: number;
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
  };
  readonly disk: {
    readonly read: number;
    readonly write: number;
    readonly utilization: number;
  };
  readonly network: {
    readonly rx: number;
    readonly tx: number;
    readonly connections: number;
  };
}

/**
 * Application metrics
 */
export interface ApplicationMetrics {
  readonly events: {
    readonly processed: number;
    readonly failed: number;
    readonly rate: number;
    readonly latency: {
      readonly p50: number;
      readonly p95: number;
      readonly p99: number;
    };
  };
  readonly commands: {
    readonly executed: number;
    readonly failed: number;
    readonly queueSize: number;
    readonly processingTime: number;
  };
  readonly queries: {
    readonly executed: number;
    readonly cacheHits: number;
    readonly cacheMisses: number;
    readonly avgDuration: number;
  };
  readonly storage: {
    readonly events: number;
    readonly snapshots: number;
    readonly size: number;
    readonly compressionRatio: number;
  };
}

/**
 * Alert rule
 */
export interface AlertRule {
  readonly id: string;
  readonly name: string;
  readonly metric: string;
  readonly condition: {
    readonly operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    readonly threshold: number;
    readonly duration?: Duration.Duration;
  };
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly action: (alert: Alert) => Effect.Effect<void, never, never>;
}

/**
 * Alert
 */
export interface Alert {
  readonly rule: AlertRule;
  readonly value: number;
  readonly timestamp: Date;
  readonly message: string;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  readonly refreshInterval: Duration.Duration;
  readonly retentionPeriod: Duration.Duration;
  readonly maxDataPoints: number;
  readonly enableAlerts: boolean;
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  
  /**
   * Record counter
   */
  recordCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const current = this.counters.get(name) ?? 0;
      this.counters.set(name, current + value);
      
      this.addMetricPoint({
        name,
        type: MetricType.COUNTER,
        value: current + value,
        timestamp: new Date(),
        labels,
      });
    });
  }
  
  /**
   * Record gauge
   */
  recordGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      this.gauges.set(name, value);
      
      this.addMetricPoint({
        name,
        type: MetricType.GAUGE,
        value,
        timestamp: new Date(),
        labels,
      });
    });
  }
  
  /**
   * Record histogram
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      const values = this.histograms.get(name) ?? [];
      values.push(value);
      
      // Keep last 1000 values
      if (values.length > 1000) {
        values.shift();
      }
      
      this.histograms.set(name, values);
      
      this.addMetricPoint({
        name,
        type: MetricType.HISTOGRAM,
        value,
        timestamp: new Date(),
        labels,
      });
    });
  }
  
  /**
   * Add metric point
   */
  private addMetricPoint(point: MetricPoint): void {
    const key = this.getMetricKey(point.name, point.labels);
    const points = this.metrics.get(key) ?? [];
    points.push(point);
    
    // Keep last 1000 points
    if (points.length > 1000) {
      points.shift();
    }
    
    this.metrics.set(key, points);
  }
  
  /**
   * Get metric key
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }
  
  /**
   * Get metric
   */
  getMetric(name: string, labels?: Record<string, string>): MetricPoint[] {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key) ?? [];
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, MetricPoint[]> {
    return new Map(this.metrics);
  }
  
  /**
   * Calculate percentile
   */
  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string): {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const values = this.histograms.get(name) ?? [];
    
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p50: this.calculatePercentile(values, 50),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99),
    };
  }
  
  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

/**
 * System monitor
 */
export class SystemMonitor {
  private lastCpuInfo = os.cpus();
  private lastNetworkStats = { rx: 0, tx: 0 };
  
  /**
   * Collect system metrics
   */
  collectSystemMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memUsage = process.memoryUsage();
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach((cpu, i) => {
      const lastCpu = this.lastCpuInfo[i];
      
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times] - 
                    lastCpu.times[type as keyof typeof cpu.times];
      }
      
      totalIdle += cpu.times.idle - lastCpu.times.idle;
    });
    
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    this.lastCpuInfo = cpus;
    
    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        free: freeMemory,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      },
      disk: {
        read: 0, // Would need platform-specific implementation
        write: 0,
        utilization: 0,
      },
      network: {
        rx: 0, // Would need platform-specific implementation
        tx: 0,
        connections: 0,
      },
    };
  }
  
  /**
   * Format bytes
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * Alert manager
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  
  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.activeAlerts.delete(ruleId);
  }
  
  /**
   * Check alerts
   */
  checkAlerts(
    metrics: Map<string, MetricPoint[]>
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      for (const [ruleId, rule] of this.rules) {
        const points = metrics.get(rule.metric) ?? [];
        if (points.length === 0) continue;
        
        const latestValue = points[points.length - 1].value;
        const triggered = this.evaluateCondition(latestValue, rule.condition);
        
        if (triggered) {
          const alert: Alert = {
            rule,
            value: latestValue,
            timestamp: new Date(),
            message: `${rule.name}: ${rule.metric} is ${latestValue} (threshold: ${rule.condition.threshold})`,
          };
          
          // Check if already active
          if (!this.activeAlerts.has(ruleId)) {
            this.activeAlerts.set(ruleId, alert);
            this.alertHistory.push(alert);
            
            // Execute action
            yield* _(rule.action(alert));
          }
        } else {
          // Clear alert if condition no longer met
          this.activeAlerts.delete(ruleId);
        }
      }
    });
  }
  
  /**
   * Evaluate condition
   */
  private evaluateCondition(
    value: number,
    condition: AlertRule['condition']
  ): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      default: return false;
    }
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  
  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }
}

/**
 * Performance dashboard
 */
export class PerformanceDashboard {
  private collector: MetricsCollector;
  private systemMonitor: SystemMonitor;
  private alertManager: AlertManager;
  private monitoringFiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();
  private dashboardData: Ref.Ref<{
    system: SystemMetrics;
    application: ApplicationMetrics;
    alerts: Alert[];
  }>;
  
  constructor(
    private readonly config: DashboardConfig
  ) {
    this.collector = new MetricsCollector();
    this.systemMonitor = new SystemMonitor();
    this.alertManager = new AlertManager();
    this.dashboardData = Ref.unsafeMake({
      system: this.systemMonitor.collectSystemMetrics(),
      application: this.createEmptyAppMetrics(),
      alerts: [],
    });
  }
  
  /**
   * Start dashboard
   */
  start(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      // Setup default alert rules
      this.setupDefaultAlerts();
      
      // Start monitoring
      const fiber = yield* _(
        pipe(
          this.monitoringLoop(),
          Effect.fork
        )
      );
      
      this.monitoringFiber = Option.some(fiber);
      
      console.log('Performance dashboard started');
    });
  }
  
  /**
   * Stop dashboard
   */
  stop(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      if (Option.isSome(this.monitoringFiber)) {
        yield* _(Fiber.interrupt(this.monitoringFiber.value));
      }
      
      console.log('Performance dashboard stopped');
    });
  }
  
  /**
   * Monitoring loop
   */
  private monitoringLoop(): Effect.Effect<never, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        yield* _(Effect.sleep(this.config.refreshInterval));
        
        // Collect metrics
        const systemMetrics = this.systemMonitor.collectSystemMetrics();
        const applicationMetrics = yield* _(this.collectApplicationMetrics());
        
        // Record metrics
        yield* _(this.recordSystemMetrics(systemMetrics));
        yield* _(this.recordApplicationMetrics(applicationMetrics));
        
        // Check alerts
        if (this.config.enableAlerts) {
          yield* _(this.alertManager.checkAlerts(this.collector.getAllMetrics()));
        }
        
        // Update dashboard data
        yield* _(Ref.set(this.dashboardData, {
          system: systemMetrics,
          application: applicationMetrics,
          alerts: this.alertManager.getActiveAlerts(),
        }));
        
        // Render dashboard (in production, would send to UI)
        yield* _(this.renderDashboard());
      })
    );
  }
  
  /**
   * Collect application metrics
   */
  private collectApplicationMetrics(): Effect.Effect<ApplicationMetrics, never, never> {
    return Effect.sync(() => {
      // Get histogram stats for latency
      const eventLatency = this.collector.getHistogramStats('event.latency');
      const commandTime = this.collector.getHistogramStats('command.processing_time');
      
      return {
        events: {
          processed: this.collector.getMetric('events.processed')[0]?.value ?? 0,
          failed: this.collector.getMetric('events.failed')[0]?.value ?? 0,
          rate: this.calculateRate('events.processed'),
          latency: {
            p50: eventLatency.p50,
            p95: eventLatency.p95,
            p99: eventLatency.p99,
          },
        },
        commands: {
          executed: this.collector.getMetric('commands.executed')[0]?.value ?? 0,
          failed: this.collector.getMetric('commands.failed')[0]?.value ?? 0,
          queueSize: this.collector.getMetric('commands.queue_size')[0]?.value ?? 0,
          processingTime: commandTime.mean,
        },
        queries: {
          executed: this.collector.getMetric('queries.executed')[0]?.value ?? 0,
          cacheHits: this.collector.getMetric('queries.cache_hits')[0]?.value ?? 0,
          cacheMisses: this.collector.getMetric('queries.cache_misses')[0]?.value ?? 0,
          avgDuration: this.collector.getHistogramStats('query.duration').mean,
        },
        storage: {
          events: this.collector.getMetric('storage.events')[0]?.value ?? 0,
          snapshots: this.collector.getMetric('storage.snapshots')[0]?.value ?? 0,
          size: this.collector.getMetric('storage.size')[0]?.value ?? 0,
          compressionRatio: this.collector.getMetric('storage.compression_ratio')[0]?.value ?? 1,
        },
      };
    });
  }
  
  /**
   * Record system metrics
   */
  private recordSystemMetrics(metrics: SystemMetrics): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      yield* _(this.collector.recordGauge('system.cpu.usage', metrics.cpu.usage));
      yield* _(this.collector.recordGauge('system.memory.used', metrics.memory.used));
      yield* _(this.collector.recordGauge('system.memory.heap', metrics.memory.heapUsed));
    });
  }
  
  /**
   * Record application metrics
   */
  private recordApplicationMetrics(metrics: ApplicationMetrics): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      yield* _(this.collector.recordCounter('events.processed', metrics.events.processed));
      yield* _(this.collector.recordCounter('commands.executed', metrics.commands.executed));
      yield* _(this.collector.recordCounter('queries.executed', metrics.queries.executed));
    });
  }
  
  /**
   * Calculate rate
   */
  private calculateRate(metric: string): number {
    const points = this.collector.getMetric(metric);
    if (points.length < 2) return 0;
    
    const recent = points.slice(-10);
    const timeDiff = (recent[recent.length - 1].timestamp.getTime() - 
                     recent[0].timestamp.getTime()) / 1000;
    const valueDiff = recent[recent.length - 1].value - recent[0].value;
    
    return timeDiff > 0 ? valueDiff / timeDiff : 0;
  }
  
  /**
   * Setup default alerts
   */
  private setupDefaultAlerts(): void {
    // High CPU usage alert
    this.alertManager.addRule({
      id: 'high-cpu',
      name: 'High CPU Usage',
      metric: 'system.cpu.usage',
      condition: { operator: 'gt', threshold: 80 },
      severity: 'warning',
      action: (alert) => Effect.sync(() => {
        console.warn(`⚠️ ${alert.message}`);
      }),
    });
    
    // High memory usage alert
    this.alertManager.addRule({
      id: 'high-memory',
      name: 'High Memory Usage',
      metric: 'system.memory.used',
      condition: { operator: 'gt', threshold: os.totalmem() * 0.9 },
      severity: 'critical',
      action: (alert) => Effect.sync(() => {
        console.error(`🔴 ${alert.message}`);
      }),
    });
    
    // High error rate alert
    this.alertManager.addRule({
      id: 'high-errors',
      name: 'High Error Rate',
      metric: 'events.failed',
      condition: { operator: 'gt', threshold: 100 },
      severity: 'error',
      action: (alert) => Effect.sync(() => {
        console.error(`❌ ${alert.message}`);
      }),
    });
  }
  
  /**
   * Render dashboard
   */
  private renderDashboard(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const data = yield* _(Ref.get(this.dashboardData));
      
      console.clear();
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║           PERFORMANCE MONITORING DASHBOARD                ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      
      // System metrics
      console.log('║ SYSTEM METRICS                                            ║');
      console.log(`║  CPU Usage: ${data.system.cpu.usage}% (${data.system.cpu.cores} cores)                            ║`);
      console.log(`║  Memory: ${this.systemMonitor.formatBytes(data.system.memory.used)} / ${this.systemMonitor.formatBytes(data.system.memory.total)}                    ║`);
      console.log(`║  Heap: ${this.systemMonitor.formatBytes(data.system.memory.heapUsed)} / ${this.systemMonitor.formatBytes(data.system.memory.heapTotal)}                      ║`);
      console.log(`║  Load Average: ${data.system.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}                      ║`);
      
      // Application metrics
      console.log('║                                                           ║');
      console.log('║ APPLICATION METRICS                                       ║');
      console.log(`║  Events: ${data.application.events.processed} processed (${data.application.events.rate.toFixed(2)}/s)              ║`);
      console.log(`║  Commands: ${data.application.commands.executed} executed                            ║`);
      console.log(`║  Queries: ${data.application.queries.executed} (${((data.application.queries.cacheHits / (data.application.queries.cacheHits + data.application.queries.cacheMisses)) * 100).toFixed(1)}% cache hit)                   ║`);
      console.log(`║  Storage: ${data.application.storage.events} events, ${this.systemMonitor.formatBytes(data.application.storage.size)}               ║`);
      
      // Alerts
      if (data.alerts.length > 0) {
        console.log('║                                                           ║');
        console.log('║ ACTIVE ALERTS                                             ║');
        for (const alert of data.alerts) {
          const icon = alert.rule.severity === 'critical' ? '🔴' :
                       alert.rule.severity === 'error' ? '❌' :
                       alert.rule.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`║  ${icon} ${alert.rule.name}: ${alert.value}                     ║`);
        }
      }
      
      console.log('╚══════════════════════════════════════════════════════════╝');
    });
  }
  
  /**
   * Create empty application metrics
   */
  private createEmptyAppMetrics(): ApplicationMetrics {
    return {
      events: {
        processed: 0,
        failed: 0,
        rate: 0,
        latency: { p50: 0, p95: 0, p99: 0 },
      },
      commands: {
        executed: 0,
        failed: 0,
        queueSize: 0,
        processingTime: 0,
      },
      queries: {
        executed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        avgDuration: 0,
      },
      storage: {
        events: 0,
        snapshots: 0,
        size: 0,
        compressionRatio: 1,
      },
    };
  }
  
  /**
   * Get metrics collector
   */
  getCollector(): MetricsCollector {
    return this.collector;
  }
  
  /**
   * Get dashboard data
   */
  getDashboardData(): Effect.Effect<{
    system: SystemMetrics;
    application: ApplicationMetrics;
    alerts: Alert[];
  }, never, never> {
    return Ref.get(this.dashboardData);
  }
}

/**
 * Create performance dashboard
 */
export const createPerformanceDashboard = (
  config?: Partial<DashboardConfig>
): Effect.Effect<PerformanceDashboard, never, never> => {
  return Effect.gen(function* (_) {
    const fullConfig: DashboardConfig = {
      refreshInterval: config?.refreshInterval ?? Duration.seconds(5),
      retentionPeriod: config?.retentionPeriod ?? Duration.hours(24),
      maxDataPoints: config?.maxDataPoints ?? 1000,
      enableAlerts: config?.enableAlerts ?? true,
    };
    
    const dashboard = new PerformanceDashboard(fullConfig);
    yield* _(dashboard.start());
    
    return dashboard;
  });
};