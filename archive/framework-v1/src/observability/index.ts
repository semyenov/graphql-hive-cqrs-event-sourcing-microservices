/**
 * Observability Module - Complete Export Index
 * 
 * Comprehensive observability suite for CQRS/Event Sourcing systems
 */

// OpenTelemetry Integration
export * from './opentelemetry-integration';
export type {
  OTelConfig,
  TelemetryContext,
  Logger,
  TelemetryService,
} from './opentelemetry-integration';

// Grafana Dashboards
export * from './grafana-dashboards';
export type {
  DashboardConfig,
  Panel,
  PanelType,
  Target,
  FieldConfig,
  AlertConfig,
  Variable,
  DashboardManagerService,
} from './grafana-dashboards';

// Distributed Tracing
export * from './distributed-tracing';
export type {
  TraceContext,
  SpanMetadata,
  TracingConfig,
  DistributedTracingService,
} from './distributed-tracing';

// SLO Monitoring
export * from './slo-monitoring';
export type {
  SLIType,
  SLIMeasurement,
  SLIDefinition,
  SLODefinition,
  SLOStatus,
  ErrorBudgetPolicy,
  SLOAlert,
  SLOReport,
  SLAReport,
  SLOMonitoringService,
} from './slo-monitoring';

// Log Aggregation
export * from './log-aggregation';
export type {
  LogLevel,
  LogEntry,
  LogQuery,
  LogSinkConfig,
  LogAggregationService,
} from './log-aggregation';

// Anomaly Detection
export * from './anomaly-detection';
export type {
  AnomalyType,
  AnomalySeverity,
  MetricDataPoint,
  AnomalyResult,
  DetectionConfig,
  IAnomalyDetectionService as AnomalyDetectionService,
} from './anomaly-detection';

// Health Checks
export * from './health-checks';
export type {
  HealthStatus,
  HealthCheckResult,
  HealthIndicator,
  HealthCheckConfig,
  HealthReport,
  IHealthCheckService as HealthCheckService,
} from './health-checks';

// CLI Tools
export * from './cli-tools';
export type {
  CLICommand,
  CLIArgument,
} from './cli-tools';

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  readonly service: {
    name: string;
    version: string;
    environment: string;
  };
  readonly opentelemetry?: {
    otlpEndpoint?: string;
    samplingRate?: number;
    enableConsoleExport?: boolean;
  };
  readonly grafana?: {
    url: string;
    apiKey: string;
  };
  readonly slo?: {
    enableMonitoring: boolean;
    checkInterval?: Duration;
  };
  readonly logs?: {
    sinks: Array<{
      type: 'console' | 'file' | 'elasticsearch';
      config: Record<string, any>;
    }>;
    enableEnrichment?: boolean;
  };
  readonly anomaly?: {
    enableDetection: boolean;
    sensitivity?: number;
  };
  readonly health?: {
    checkInterval?: Duration;
    indicators: string[];
  };
}

/**
 * Complete observability suite
 */
export interface ObservabilitySuite {
  readonly telemetry: TelemetryService;
  readonly dashboards: DashboardManagerService;
  readonly tracing: DistributedTracingService;
  readonly slo: SLOMonitoringService;
  readonly logs: LogAggregationService;
  readonly anomaly: AnomalyDetectionService;
  readonly health: HealthCheckService;
  readonly cli: ObservabilityCLI;
}

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Duration from 'effect/Duration';
import { TelemetryLive } from './opentelemetry-integration';
import { DashboardManagerLive } from './grafana-dashboards';
import { DistributedTracingLive } from './distributed-tracing';
import { SLOMonitoringLive } from './slo-monitoring';
import { LogAggregationLive } from './log-aggregation';
import { AnomalyDetectionLive } from './anomaly-detection';
import { HealthCheckLive } from './health-checks';
import { ObservabilityCLI, createObservabilityCLI } from './cli-tools';

/**
 * Create complete observability suite
 */
export const createObservabilitySuite = (
  config: ObservabilityConfig
): Effect.Effect<ObservabilitySuite, Error, never> => {
  return Effect.gen(function* (_) {
    // Initialize telemetry
    const telemetryLayer = TelemetryLive({
      serviceName: config.service.name,
      serviceVersion: config.service.version,
      environment: config.service.environment,
      otlpEndpoint: config.opentelemetry?.otlpEndpoint,
      samplingRate: config.opentelemetry?.samplingRate ?? 1.0,
      enableConsoleExport: config.opentelemetry?.enableConsoleExport ?? false,
    });

    // Initialize dashboard manager
    const dashboardLayer = config.grafana 
      ? DashboardManagerLive({
          grafanaUrl: config.grafana.url,
          apiKey: config.grafana.apiKey,
        })
      : Layer.succeed({
          _tag: 'DashboardManagerService' as const,
          client: null,
          deployDashboards: () => Effect.void,
          updateDashboards: () => Effect.void,
          createCustomDashboard: () => Effect.succeed({ id: 0, uid: 'mock' }),
        });

    // Initialize distributed tracing
    const tracingLayer = DistributedTracingLive({
      serviceName: config.service.name,
      serviceVersion: config.service.version,
      environment: config.service.environment,
      samplingRate: config.opentelemetry?.samplingRate ?? 1.0,
      maxSpanAttributes: 32,
      maxSpanEvents: 128,
      maxSpanLinks: 32,
      exportBatchSize: 512,
      exportTimeout: Duration.seconds(30),
    });

    // Initialize SLO monitoring
    const sloLayer = SLOMonitoringLive({
      maxMeasurementsPerSLI: 10000,
      alertCallback: (alert) => Effect.sync(() => console.log('SLO Alert:', alert)),
    });

    // Initialize log aggregation
    const logLayer = LogAggregationLive({
      service: config.service.name,
      version: config.service.version,
      environment: config.service.environment,
      sinks: config.logs?.sinks ?? [{ type: 'console', endpoint: undefined }],
      enableEnrichment: config.logs?.enableEnrichment ?? true,
    });

    // Initialize anomaly detection
    const anomalyLayer = AnomalyDetectionLive({
      maxHistorySize: 10000,
      maxBufferSize: 1000,
      alertCallback: (anomaly) => Effect.sync(() => console.log('Anomaly Alert:', anomaly)),
    });

    // Initialize health checks
    const healthLayer = HealthCheckLive({
      indicators: [], // Would be populated with actual indicators
      checkInterval: Duration.seconds(30),
      aggregationStrategy: 'majority_up',
    });

    // Create the complete layer composition
    const observabilityLayer = Layer.mergeAll(
      telemetryLayer,
      dashboardLayer,
      tracingLayer,
      sloLayer,
      logLayer,
      anomalyLayer,
      healthLayer
    );

    // Provide services and extract them
    const services = yield* _(
      Effect.gen(function* (_) {
        const telemetry = yield* _(telemetryLayer.pipe(Layer.toRuntime, Effect.scoped));
        const dashboards = yield* _(dashboardLayer.pipe(Layer.toRuntime, Effect.scoped));
        const tracing = yield* _(tracingLayer.pipe(Layer.toRuntime, Effect.scoped));
        const slo = yield* _(sloLayer.pipe(Layer.toRuntime, Effect.scoped));
        const logs = yield* _(logLayer.pipe(Layer.toRuntime, Effect.scoped));
        const anomaly = yield* _(anomalyLayer.pipe(Layer.toRuntime, Effect.scoped));
        const health = yield* _(healthLayer.pipe(Layer.toRuntime, Effect.scoped));

        return {
          telemetry,
          dashboards,
          tracing,
          slo,
          logs,
          anomaly,
          health,
        };
      }).pipe(Effect.scoped)
    );

    // Create CLI
    const cli = createObservabilityCLI({
      health: services.health,
      slo: services.slo,
      logs: services.logs,
      anomaly: services.anomaly,
    });

    return {
      telemetry: services.telemetry,
      dashboards: services.dashboards,
      tracing: services.tracing,
      slo: services.slo,
      logs: services.logs,
      anomaly: services.anomaly,
      health: services.health,
      cli,
    };
  });
};

/**
 * Observability layer for Effect applications
 */
export const ObservabilityLive = (config: ObservabilityConfig) =>
  Layer.mergeAll(
    TelemetryLive({
      serviceName: config.service.name,
      serviceVersion: config.service.version,
      environment: config.service.environment,
      otlpEndpoint: config.opentelemetry?.otlpEndpoint,
      samplingRate: config.opentelemetry?.samplingRate ?? 1.0,
      enableConsoleExport: config.opentelemetry?.enableConsoleExport ?? false,
    }),
    config.grafana 
      ? DashboardManagerLive({
          grafanaUrl: config.grafana.url,
          apiKey: config.grafana.apiKey,
        })
      : Layer.succeed({
          _tag: 'DashboardManagerService' as const,
          client: null,
          deployDashboards: () => Effect.void,
          updateDashboards: () => Effect.void,
          createCustomDashboard: () => Effect.succeed({ id: 0, uid: 'mock' }),
        }),
    DistributedTracingLive({
      serviceName: config.service.name,
      serviceVersion: config.service.version,
      environment: config.service.environment,
      samplingRate: config.opentelemetry?.samplingRate ?? 1.0,
      maxSpanAttributes: 32,
      maxSpanEvents: 128,
      maxSpanLinks: 32,
      exportBatchSize: 512,
      exportTimeout: Duration.seconds(30),
    }),
    SLOMonitoringLive({
      maxMeasurementsPerSLI: 10000,
      alertCallback: (alert) => Effect.sync(() => console.log('SLO Alert:', alert)),
    }),
    LogAggregationLive({
      service: config.service.name,
      version: config.service.version,
      environment: config.service.environment,
      sinks: config.logs?.sinks ?? [{ type: 'console', endpoint: undefined }],
      enableEnrichment: config.logs?.enableEnrichment ?? true,
    }),
    AnomalyDetectionLive({
      maxHistorySize: 10000,
      maxBufferSize: 1000,
      alertCallback: (anomaly) => Effect.sync(() => console.log('Anomaly Alert:', anomaly)),
    }),
    HealthCheckLive({
      indicators: [], // Would be populated with actual indicators
      checkInterval: Duration.seconds(30),
      aggregationStrategy: 'majority_up',
    })
  );

/**
 * Default observability configuration
 */
export const defaultObservabilityConfig: ObservabilityConfig = {
  service: {
    name: 'cqrs-service',
    version: '1.0.0',
    environment: 'development',
  },
  opentelemetry: {
    samplingRate: 1.0,
    enableConsoleExport: true,
  },
  slo: {
    enableMonitoring: true,
  },
  logs: {
    sinks: [{ type: 'console', config: {} }],
    enableEnrichment: true,
  },
  anomaly: {
    enableDetection: true,
    sensitivity: 0.8,
  },
  health: {
    indicators: ['database', 'memory', 'diskSpace'],
  },
};