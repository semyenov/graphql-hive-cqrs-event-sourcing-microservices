/**
 * Grafana Dashboards Configuration
 * 
 * Pre-configured Grafana dashboards for CQRS/Event Sourcing observability:
 * - System overview dashboard
 * - Command/Query/Event metrics
 * - Performance monitoring
 * - Error tracking and alerting
 * - Custom dashboard builder
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  readonly id: string;
  readonly uid: string;
  readonly title: string;
  readonly description: string;
  readonly tags: string[];
  readonly refresh: string;
  readonly timeRange: {
    from: string;
    to: string;
  };
  readonly panels: Panel[];
  readonly variables?: Variable[];
}

/**
 * Panel configuration
 */
export interface Panel {
  readonly id: number;
  readonly title: string;
  readonly type: PanelType;
  readonly gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  readonly targets: Target[];
  readonly options?: Record<string, any>;
  readonly fieldConfig?: FieldConfig;
  readonly alert?: AlertConfig;
}

/**
 * Panel types
 */
export enum PanelType {
  GRAPH = 'graph',
  STAT = 'stat',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  GAUGE = 'gauge',
  BAR_GAUGE = 'bargauge',
  TEXT = 'text',
  LOGS = 'logs',
  NODE_GRAPH = 'nodeGraph',
}

/**
 * Target configuration (Prometheus query)
 */
export interface Target {
  readonly expr: string;
  readonly legendFormat?: string;
  readonly refId: string;
  readonly interval?: string;
  readonly hide?: boolean;
}

/**
 * Field configuration
 */
export interface FieldConfig {
  readonly defaults: {
    unit?: string;
    min?: number;
    max?: number;
    thresholds?: {
      steps: Array<{
        color: string;
        value: number | null;
      }>;
    };
  };
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  readonly conditions: Array<{
    evaluator: {
      params: number[];
      type: string;
    };
    operator: {
      type: string;
    };
    query: {
      params: string[];
    };
    reducer: {
      params: any[];
      type: string;
    };
    type: string;
  }>;
  readonly executionErrorState: string;
  readonly frequency: string;
  readonly handler: number;
  readonly name: string;
  readonly noDataState: string;
  readonly notifications: any[];
}

/**
 * Dashboard variable
 */
export interface Variable {
  readonly name: string;
  readonly type: string;
  readonly query: string;
  readonly label?: string;
  readonly multi?: boolean;
  readonly includeAll?: boolean;
}

/**
 * Grafana API client
 */
export class GrafanaClient {
  constructor(
    private readonly config: {
      url: string;
      apiKey: string;
    }
  ) {}

  /**
   * Create dashboard
   */
  createDashboard(dashboard: DashboardConfig): Effect.Effect<{ id: number; uid: string }, Error, never> {
    return Effect.gen(function* (_) {
      const response = yield* _(
        Effect.tryPromise({
          try: () => fetch(`${this.config.url}/api/dashboards/db`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dashboard,
              overwrite: true,
            }),
          }),
          catch: (error) => new Error(`Failed to create dashboard: ${error}`),
        })
      );

      if (!response.ok) {
        return yield* _(Effect.fail(
          new Error(`Dashboard creation failed: ${response.status} ${response.statusText}`)
        ));
      }

      const result = yield* _(
        Effect.tryPromise({
          try: () => response.json(),
          catch: (error) => new Error(`Failed to parse response: ${error}`),
        })
      );

      return result;
    });
  }

  /**
   * Update dashboard
   */
  updateDashboard(dashboard: DashboardConfig): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      yield* _(this.createDashboard(dashboard));
    });
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(uid: string): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const response = yield* _(
        Effect.tryPromise({
          try: () => fetch(`${this.config.url}/api/dashboards/uid/${uid}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }),
          catch: (error) => new Error(`Failed to delete dashboard: ${error}`),
        })
      );

      if (!response.ok) {
        return yield* _(Effect.fail(
          new Error(`Dashboard deletion failed: ${response.status} ${response.statusText}`)
        ));
      }
    });
  }

  /**
   * Get dashboard
   */
  getDashboard(uid: string): Effect.Effect<DashboardConfig, Error, never> {
    return Effect.gen(function* (_) {
      const response = yield* _(
        Effect.tryPromise({
          try: () => fetch(`${this.config.url}/api/dashboards/uid/${uid}`, {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }),
          catch: (error) => new Error(`Failed to get dashboard: ${error}`),
        })
      );

      if (!response.ok) {
        return yield* _(Effect.fail(
          new Error(`Get dashboard failed: ${response.status} ${response.statusText}`)
        ));
      }

      const result = yield* _(
        Effect.tryPromise({
          try: () => response.json(),
          catch: (error) => new Error(`Failed to parse response: ${error}`),
        })
      );

      return result.dashboard;
    });
  }
}

/**
 * Dashboard builder
 */
export class DashboardBuilder {
  private config: Partial<DashboardConfig> = {};
  private panels: Panel[] = [];
  private variables: Variable[] = [];
  private panelId = 1;

  /**
   * Set basic configuration
   */
  setConfig(config: Partial<DashboardConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Add panel
   */
  addPanel(panel: Omit<Panel, 'id'>): this {
    this.panels.push({
      ...panel,
      id: this.panelId++,
    });
    return this;
  }

  /**
   * Add variable
   */
  addVariable(variable: Variable): this {
    this.variables.push(variable);
    return this;
  }

  /**
   * Add metric panel
   */
  addMetricPanel(
    title: string,
    query: string,
    position: { x: number; y: number; w: number; h: number },
    options?: {
      unit?: string;
      type?: PanelType;
      legendFormat?: string;
      alert?: AlertConfig;
    }
  ): this {
    return this.addPanel({
      title,
      type: options?.type ?? PanelType.GRAPH,
      gridPos: position,
      targets: [{
        expr: query,
        refId: 'A',
        legendFormat: options?.legendFormat,
      }],
      fieldConfig: options?.unit ? {
        defaults: { unit: options.unit }
      } : undefined,
      alert: options?.alert,
    });
  }

  /**
   * Add stat panel
   */
  addStatPanel(
    title: string,
    query: string,
    position: { x: number; y: number; w: number; h: number },
    options?: {
      unit?: string;
      thresholds?: Array<{ color: string; value: number | null }>;
    }
  ): this {
    return this.addPanel({
      title,
      type: PanelType.STAT,
      gridPos: position,
      targets: [{
        expr: query,
        refId: 'A',
      }],
      fieldConfig: {
        defaults: {
          unit: options?.unit,
          thresholds: options?.thresholds ? {
            steps: options.thresholds
          } : undefined,
        }
      },
    });
  }

  /**
   * Add gauge panel
   */
  addGaugePanel(
    title: string,
    query: string,
    position: { x: number; y: number; w: number; h: number },
    options?: {
      unit?: string;
      min?: number;
      max?: number;
      thresholds?: Array<{ color: string; value: number | null }>;
    }
  ): this {
    return this.addPanel({
      title,
      type: PanelType.GAUGE,
      gridPos: position,
      targets: [{
        expr: query,
        refId: 'A',
      }],
      fieldConfig: {
        defaults: {
          unit: options?.unit,
          min: options?.min,
          max: options?.max,
          thresholds: options?.thresholds ? {
            steps: options.thresholds
          } : undefined,
        }
      },
    });
  }

  /**
   * Build dashboard
   */
  build(): DashboardConfig {
    const config: DashboardConfig = {
      id: this.config.id ?? 0,
      uid: this.config.uid ?? `cqrs-${Date.now()}`,
      title: this.config.title ?? 'CQRS Dashboard',
      description: this.config.description ?? 'Generated CQRS/Event Sourcing Dashboard',
      tags: this.config.tags ?? ['cqrs', 'event-sourcing'],
      refresh: this.config.refresh ?? '5s',
      timeRange: this.config.timeRange ?? {
        from: 'now-1h',
        to: 'now',
      },
      panels: this.panels,
      variables: this.variables.length > 0 ? this.variables : undefined,
    };

    return config;
  }
}

/**
 * Pre-configured dashboards
 */
export class CQRSDashboards {
  /**
   * Create system overview dashboard
   */
  static createSystemOverview(): DashboardConfig {
    return new DashboardBuilder()
      .setConfig({
        uid: 'cqrs-system-overview',
        title: 'CQRS System Overview',
        description: 'High-level system metrics and health indicators',
        tags: ['cqrs', 'overview', 'system'],
      })
      .addVariable({
        name: 'instance',
        type: 'query',
        query: 'label_values(up, instance)',
        label: 'Instance',
        multi: true,
        includeAll: true,
      })
      // System metrics row
      .addStatPanel(
        'System Uptime',
        'up{instance=~"$instance"}',
        { x: 0, y: 0, w: 4, h: 4 },
        {
          thresholds: [
            { color: 'red', value: null },
            { color: 'green', value: 1 },
          ]
        }
      )
      .addStatPanel(
        'CPU Usage',
        'avg(100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle",instance=~"$instance"}[5m])) * 100))',
        { x: 4, y: 0, w: 4, h: 4 },
        {
          unit: 'percent',
          thresholds: [
            { color: 'green', value: null },
            { color: 'yellow', value: 70 },
            { color: 'red', value: 90 },
          ]
        }
      )
      .addStatPanel(
        'Memory Usage',
        'avg((1 - (node_memory_MemAvailable_bytes{instance=~"$instance"} / node_memory_MemTotal_bytes{instance=~"$instance"})) * 100)',
        { x: 8, y: 0, w: 4, h: 4 },
        {
          unit: 'percent',
          thresholds: [
            { color: 'green', value: null },
            { color: 'yellow', value: 80 },
            { color: 'red', value: 95 },
          ]
        }
      )
      .addStatPanel(
        'Events/sec',
        'sum(rate(cqrs_events_processed_total{instance=~"$instance"}[1m]))',
        { x: 12, y: 0, w: 4, h: 4 },
        { unit: 'reqps' }
      )
      .addStatPanel(
        'Commands/sec',
        'sum(rate(cqrs_commands_processed_total{instance=~"$instance"}[1m]))',
        { x: 16, y: 0, w: 4, h: 4 },
        { unit: 'reqps' }
      )
      .addStatPanel(
        'Queries/sec',
        'sum(rate(cqrs_queries_executed_total{instance=~"$instance"}[1m]))',
        { x: 20, y: 0, w: 4, h: 4 },
        { unit: 'reqps' }
      )
      // Performance graphs
      .addMetricPanel(
        'Command Processing Latency',
        'histogram_quantile(0.95, sum(rate(cqrs_commands_duration_seconds_bucket{instance=~"$instance"}[5m])) by (le))',
        { x: 0, y: 4, w: 12, h: 8 },
        {
          unit: 's',
          legendFormat: 'P95',
        }
      )
      .addMetricPanel(
        'Query Execution Latency',
        'histogram_quantile(0.95, sum(rate(cqrs_queries_duration_seconds_bucket{instance=~"$instance"}[5m])) by (le))',
        { x: 12, y: 4, w: 12, h: 8 },
        {
          unit: 's',
          legendFormat: 'P95',
        }
      )
      // Error rates
      .addMetricPanel(
        'Error Rate',
        'sum(rate(cqrs_commands_failed_total{instance=~"$instance"}[5m])) / sum(rate(cqrs_commands_processed_total{instance=~"$instance"}[5m])) * 100',
        { x: 0, y: 12, w: 8, h: 6 },
        {
          unit: 'percent',
          legendFormat: 'Command Errors',
        }
      )
      .addMetricPanel(
        'Event Processing Rate',
        'sum(rate(cqrs_events_processed_total{instance=~"$instance"}[5m]))',
        { x: 8, y: 12, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: 'Events/sec',
        }
      )
      .addMetricPanel(
        'Cache Hit Rate',
        'sum(rate(cqrs_queries_cache_hits_total{instance=~"$instance"}[5m])) / (sum(rate(cqrs_queries_cache_hits_total{instance=~"$instance"}[5m])) + sum(rate(cqrs_queries_cache_misses_total{instance=~"$instance"}[5m]))) * 100',
        { x: 16, y: 12, w: 8, h: 6 },
        {
          unit: 'percent',
          legendFormat: 'Hit Rate',
        }
      )
      .build();
  }

  /**
   * Create performance monitoring dashboard
   */
  static createPerformanceMonitoring(): DashboardConfig {
    return new DashboardBuilder()
      .setConfig({
        uid: 'cqrs-performance',
        title: 'CQRS Performance Monitoring',
        description: 'Detailed performance metrics and bottleneck analysis',
        tags: ['cqrs', 'performance', 'latency'],
      })
      .addVariable({
        name: 'service',
        type: 'query',
        query: 'label_values(cqrs_commands_processed_total, service)',
        label: 'Service',
        multi: true,
        includeAll: true,
      })
      // Latency heatmaps
      .addPanel({
        title: 'Command Latency Heatmap',
        type: PanelType.HEATMAP,
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        targets: [{
          expr: 'sum(rate(cqrs_commands_duration_seconds_bucket{service=~"$service"}[5m])) by (le)',
          refId: 'A',
        }],
      })
      .addPanel({
        title: 'Query Latency Heatmap',
        type: PanelType.HEATMAP,
        gridPos: { x: 12, y: 0, w: 12, h: 8 },
        targets: [{
          expr: 'sum(rate(cqrs_queries_duration_seconds_bucket{service=~"$service"}[5m])) by (le)',
          refId: 'A',
        }],
      })
      // Throughput metrics
      .addMetricPanel(
        'Throughput by Command Type',
        'sum(rate(cqrs_commands_processed_total{service=~"$service"}[5m])) by (type)',
        { x: 0, y: 8, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: '{{type}}',
        }
      )
      .addMetricPanel(
        'Throughput by Query Type',
        'sum(rate(cqrs_queries_executed_total{service=~"$service"}[5m])) by (type)',
        { x: 8, y: 8, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: '{{type}}',
        }
      )
      .addMetricPanel(
        'Event Stream Throughput',
        'sum(rate(cqrs_events_emitted_total{service=~"$service"}[5m])) by (aggregate_type)',
        { x: 16, y: 8, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: '{{aggregate_type}}',
        }
      )
      // Resource utilization
      .addMetricPanel(
        'Memory Usage by Service',
        'process_resident_memory_bytes{service=~"$service"}',
        { x: 0, y: 14, w: 12, h: 6 },
        {
          unit: 'bytes',
          legendFormat: '{{service}}',
        }
      )
      .addMetricPanel(
        'CPU Usage by Service',
        'rate(process_cpu_seconds_total{service=~"$service"}[5m]) * 100',
        { x: 12, y: 14, w: 12, h: 6 },
        {
          unit: 'percent',
          legendFormat: '{{service}}',
        }
      )
      .build();
  }

  /**
   * Create error tracking dashboard
   */
  static createErrorTracking(): DashboardConfig {
    return new DashboardBuilder()
      .setConfig({
        uid: 'cqrs-errors',
        title: 'CQRS Error Tracking',
        description: 'Error rates, failure patterns, and alerting',
        tags: ['cqrs', 'errors', 'alerts'],
      })
      // Error rate overview
      .addStatPanel(
        'Overall Error Rate',
        '(sum(rate(cqrs_commands_failed_total[5m])) + sum(rate(cqrs_queries_failed_total[5m]))) / (sum(rate(cqrs_commands_processed_total[5m])) + sum(rate(cqrs_queries_executed_total[5m]))) * 100',
        { x: 0, y: 0, w: 6, h: 4 },
        {
          unit: 'percent',
          thresholds: [
            { color: 'green', value: null },
            { color: 'yellow', value: 1 },
            { color: 'red', value: 5 },
          ]
        }
      )
      .addStatPanel(
        'Failed Commands',
        'sum(increase(cqrs_commands_failed_total[1h]))',
        { x: 6, y: 0, w: 6, h: 4 }
      )
      .addStatPanel(
        'Failed Queries',
        'sum(increase(cqrs_queries_failed_total[1h]))',
        { x: 12, y: 0, w: 6, h: 4 }
      )
      .addStatPanel(
        'Event Processing Failures',
        'sum(increase(cqrs_events_failed_total[1h]))',
        { x: 18, y: 0, w: 6, h: 4 }
      )
      // Error trends
      .addMetricPanel(
        'Error Rate by Command Type',
        'sum(rate(cqrs_commands_failed_total[5m])) by (type) / sum(rate(cqrs_commands_processed_total[5m])) by (type) * 100',
        { x: 0, y: 4, w: 12, h: 8 },
        {
          unit: 'percent',
          legendFormat: '{{type}}',
        }
      )
      .addMetricPanel(
        'Error Rate by Query Type',
        'sum(rate(cqrs_queries_failed_total[5m])) by (type) / sum(rate(cqrs_queries_executed_total[5m])) by (type) * 100',
        { x: 12, y: 4, w: 12, h: 8 },
        {
          unit: 'percent',
          legendFormat: '{{type}}',
        }
      )
      // Error details table
      .addPanel({
        title: 'Recent Errors',
        type: PanelType.LOGS,
        gridPos: { x: 0, y: 12, w: 24, h: 8 },
        targets: [{
          expr: '{level="error"} | json | line_format "{{.timestamp}} [{{.service}}] {{.message}}"',
          refId: 'A',
        }],
      })
      .build();
  }

  /**
   * Create business metrics dashboard
   */
  static createBusinessMetrics(): DashboardConfig {
    return new DashboardBuilder()
      .setConfig({
        uid: 'cqrs-business',
        title: 'CQRS Business Metrics',
        description: 'Domain-specific metrics and KPIs',
        tags: ['cqrs', 'business', 'kpi'],
      })
      // Domain aggregate metrics
      .addStatPanel(
        'Total Users',
        'cqrs_aggregate_count{type="User"}',
        { x: 0, y: 0, w: 4, h: 4 }
      )
      .addStatPanel(
        'Total Orders',
        'cqrs_aggregate_count{type="Order"}',
        { x: 4, y: 0, w: 4, h: 4 }
      )
      .addStatPanel(
        'Total Products',
        'cqrs_aggregate_count{type="Product"}',
        { x: 8, y: 0, w: 4, h: 4 }
      )
      .addStatPanel(
        'Active Sessions',
        'cqrs_projection_size{name="active_sessions"}',
        { x: 12, y: 0, w: 4, h: 4 }
      )
      // Business flow metrics
      .addMetricPanel(
        'User Registration Rate',
        'sum(rate(cqrs_events_emitted_total{type="UserCreated"}[5m]))',
        { x: 0, y: 4, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: 'Registrations/sec',
        }
      )
      .addMetricPanel(
        'Order Creation Rate',
        'sum(rate(cqrs_events_emitted_total{type="OrderCreated"}[5m]))',
        { x: 8, y: 4, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: 'Orders/sec',
        }
      )
      .addMetricPanel(
        'Payment Processing',
        'sum(rate(cqrs_events_emitted_total{type=~"PaymentProcessed|PaymentFailed"}[5m])) by (type)',
        { x: 16, y: 4, w: 8, h: 6 },
        {
          unit: 'reqps',
          legendFormat: '{{type}}',
        }
      )
      // Saga metrics
      .addMetricPanel(
        'Saga Completion Rate',
        'sum(rate(cqrs_saga_completed_total[5m])) / sum(rate(cqrs_saga_started_total[5m])) * 100',
        { x: 0, y: 10, w: 12, h: 6 },
        {
          unit: 'percent',
          legendFormat: 'Completion Rate',
        }
      )
      .addMetricPanel(
        'Saga Duration',
        'histogram_quantile(0.95, sum(rate(cqrs_saga_duration_seconds_bucket[5m])) by (le))',
        { x: 12, y: 10, w: 12, h: 6 },
        {
          unit: 's',
          legendFormat: 'P95 Duration',
        }
      )
      .build();
  }
}

/**
 * Dashboard manager service
 */
export interface DashboardManagerService {
  readonly _tag: 'DashboardManagerService';
  readonly client: GrafanaClient;
  readonly deployDashboards: () => Effect.Effect<void, Error, never>;
  readonly updateDashboards: () => Effect.Effect<void, Error, never>;
  readonly createCustomDashboard: (config: DashboardConfig) => Effect.Effect<{ id: number; uid: string }, Error, never>;
}

export const DashboardManagerService = Context.GenericTag<DashboardManagerService>('DashboardManagerService');

/**
 * Dashboard manager layer
 */
export const DashboardManagerLive = (config: {
  grafanaUrl: string;
  apiKey: string;
}) =>
  Layer.effect(
    DashboardManagerService,
    Effect.gen(function* (_) {
      const client = new GrafanaClient({
        url: config.grafanaUrl,
        apiKey: config.apiKey,
      });

      const deployDashboards = (): Effect.Effect<void, Error, never> => {
        return Effect.gen(function* (_) {
          console.log('Deploying CQRS dashboards to Grafana...');

          // Deploy all pre-configured dashboards
          const dashboards = [
            CQRSDashboards.createSystemOverview(),
            CQRSDashboards.createPerformanceMonitoring(),
            CQRSDashboards.createErrorTracking(),
            CQRSDashboards.createBusinessMetrics(),
          ];

          for (const dashboard of dashboards) {
            try {
              const result = yield* _(client.createDashboard(dashboard));
              console.log(`Dashboard "${dashboard.title}" deployed: ${result.uid}`);
            } catch (error) {
              console.error(`Failed to deploy dashboard "${dashboard.title}":`, error);
            }
          }

          console.log('All dashboards deployed successfully');
        });
      };

      const updateDashboards = (): Effect.Effect<void, Error, never> => {
        return deployDashboards(); // Same as deploy with overwrite
      };

      const createCustomDashboard = (config: DashboardConfig): Effect.Effect<{ id: number; uid: string }, Error, never> => {
        return client.createDashboard(config);
      };

      return {
        _tag: 'DashboardManagerService',
        client,
        deployDashboards,
        updateDashboards,
        createCustomDashboard,
      };
    })
  );

/**
 * Create dashboard manager service
 */
export const createDashboardManager = (config: {
  grafanaUrl: string;
  apiKey: string;
}): Effect.Effect<DashboardManagerService, Error, never> => {
  return Effect.gen(function* (_) {
    const client = new GrafanaClient({
      url: config.grafanaUrl,
      apiKey: config.apiKey,
    });

    const deployDashboards = (): Effect.Effect<void, Error, never> => {
      return Effect.gen(function* (_) {
        console.log('Deploying CQRS dashboards to Grafana...');

        const dashboards = [
          CQRSDashboards.createSystemOverview(),
          CQRSDashboards.createPerformanceMonitoring(),
          CQRSDashboards.createErrorTracking(),
          CQRSDashboards.createBusinessMetrics(),
        ];

        for (const dashboard of dashboards) {
          const result = yield* _(client.createDashboard(dashboard));
          console.log(`Dashboard "${dashboard.title}" deployed: ${result.uid}`);
        }
      });
    };

    return {
      _tag: 'DashboardManagerService',
      client,
      deployDashboards,
      updateDashboards: deployDashboards,
      createCustomDashboard: (config: DashboardConfig) => client.createDashboard(config),
    };
  });
};

/**
 * Dashboard templates for common use cases
 */
export const DashboardTemplates = {
  /**
   * Create minimal monitoring dashboard
   */
  minimal: (): DashboardConfig => {
    return new DashboardBuilder()
      .setConfig({
        title: 'CQRS Minimal Monitoring',
        tags: ['cqrs', 'minimal'],
      })
      .addStatPanel('Commands/sec', 'sum(rate(cqrs_commands_processed_total[1m]))', { x: 0, y: 0, w: 6, h: 4 }, { unit: 'reqps' })
      .addStatPanel('Events/sec', 'sum(rate(cqrs_events_processed_total[1m]))', { x: 6, y: 0, w: 6, h: 4 }, { unit: 'reqps' })
      .addStatPanel('Queries/sec', 'sum(rate(cqrs_queries_executed_total[1m]))', { x: 12, y: 0, w: 6, h: 4 }, { unit: 'reqps' })
      .addStatPanel('Error Rate', 'sum(rate(cqrs_commands_failed_total[5m])) / sum(rate(cqrs_commands_processed_total[5m])) * 100', { x: 18, y: 0, w: 6, h: 4 }, { unit: 'percent' })
      .build();
  },

  /**
   * Create development dashboard
   */
  development: (): DashboardConfig => {
    return new DashboardBuilder()
      .setConfig({
        title: 'CQRS Development Dashboard',
        tags: ['cqrs', 'development'],
        refresh: '1s',
      })
      .addMetricPanel('Recent Commands', 'increase(cqrs_commands_processed_total[1m])', { x: 0, y: 0, w: 12, h: 6 })
      .addMetricPanel('Recent Events', 'increase(cqrs_events_emitted_total[1m])', { x: 12, y: 0, w: 12, h: 6 })
      .addPanel({
        title: 'Recent Logs',
        type: PanelType.LOGS,
        gridPos: { x: 0, y: 6, w: 24, h: 8 },
        targets: [{
          expr: '{service="cqrs"} | json | line_format "{{.level}} {{.message}}"',
          refId: 'A',
        }],
      })
      .build();
  },
};