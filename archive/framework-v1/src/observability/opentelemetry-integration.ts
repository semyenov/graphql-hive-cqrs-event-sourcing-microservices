/**
 * Full OpenTelemetry Integration
 * 
 * Comprehensive observability with OpenTelemetry:
 * - Distributed tracing with auto-instrumentation
 * - Metrics collection and aggregation
 * - Structured logging with correlation
 * - Context propagation across boundaries
 * - Custom instrumentation for CQRS patterns
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import {
  trace,
  metrics,
  context,
  SpanKind,
  SpanStatusCode,
  ValueType,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { 
  BasicTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { ICommand, IEvent, IQuery } from '../effect/core/types';
import type { AggregateId } from '../core/branded';

/**
 * OpenTelemetry configuration
 */
export interface OTelConfig {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: string;
  readonly otlpEndpoint?: string;
  readonly prometheusPort?: number;
  readonly enableConsoleExport?: boolean;
  readonly enableAutoInstrumentation?: boolean;
  readonly samplingRate?: number;
}

/**
 * Telemetry context
 */
export interface TelemetryContext {
  readonly tracer: trace.Tracer;
  readonly meter: metrics.Meter;
  readonly logger: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, attributes?: Record<string, any>): void;
  info(message: string, attributes?: Record<string, any>): void;
  warn(message: string, attributes?: Record<string, any>): void;
  error(message: string, attributes?: Record<string, any>): void;
}

/**
 * Span attributes for CQRS
 */
export const CQRSAttributes = {
  COMMAND_TYPE: 'cqrs.command.type',
  COMMAND_ID: 'cqrs.command.id',
  EVENT_TYPE: 'cqrs.event.type',
  EVENT_ID: 'cqrs.event.id',
  EVENT_VERSION: 'cqrs.event.version',
  QUERY_TYPE: 'cqrs.query.type',
  QUERY_ID: 'cqrs.query.id',
  AGGREGATE_ID: 'cqrs.aggregate.id',
  AGGREGATE_TYPE: 'cqrs.aggregate.type',
  PROJECTION_NAME: 'cqrs.projection.name',
  SAGA_ID: 'cqrs.saga.id',
  SAGA_STEP: 'cqrs.saga.step',
} as const;

/**
 * Metric names for CQRS
 */
export const CQRSMetrics = {
  COMMANDS_PROCESSED: 'cqrs.commands.processed',
  COMMANDS_FAILED: 'cqrs.commands.failed',
  COMMANDS_DURATION: 'cqrs.commands.duration',
  EVENTS_EMITTED: 'cqrs.events.emitted',
  EVENTS_PROCESSED: 'cqrs.events.processed',
  EVENTS_FAILED: 'cqrs.events.failed',
  QUERIES_EXECUTED: 'cqrs.queries.executed',
  QUERIES_FAILED: 'cqrs.queries.failed',
  QUERIES_DURATION: 'cqrs.queries.duration',
  PROJECTIONS_UPDATED: 'cqrs.projections.updated',
  SAGA_STARTED: 'cqrs.saga.started',
  SAGA_COMPLETED: 'cqrs.saga.completed',
  SAGA_FAILED: 'cqrs.saga.failed',
} as const;

/**
 * OpenTelemetry SDK wrapper
 */
export class OpenTelemetrySDK {
  private sdk: NodeSDK | null = null;
  private tracerProvider: BasicTracerProvider | null = null;
  private meterProvider: MeterProvider | null = null;
  private prometheusExporter: PrometheusExporter | null = null;
  
  constructor(private readonly config: OTelConfig) {}
  
  /**
   * Initialize SDK
   */
  initialize(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // Set up diagnostics
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
      
      // Create resource
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        })
      );
      
      // Initialize tracer provider
      yield* _(this.initializeTracing(resource));
      
      // Initialize meter provider
      yield* _(this.initializeMetrics(resource));
      
      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        instrumentations: this.config.enableAutoInstrumentation ? 
          this.getInstrumentations() : [],
      });
      
      // Start SDK
      yield* _(Effect.tryPromise({
        try: () => this.sdk!.start(),
        catch: (e) => new Error(`Failed to start OpenTelemetry SDK: ${e}`),
      }));
      
      console.log('OpenTelemetry SDK initialized');
    });
  }
  
  /**
   * Initialize tracing
   */
  private initializeTracing(resource: Resource): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      this.tracerProvider = new BasicTracerProvider({
        resource,
        sampler: {
          shouldSample: () => ({
            decision: Math.random() < (this.config.samplingRate ?? 1) ? 1 : 0,
            attributes: {},
          }),
          toString: () => 'ProbabilitySampler',
        },
      });
      
      // Add exporters
      if (this.config.otlpEndpoint) {
        const otlpExporter = new OTLPTraceExporter({
          url: `${this.config.otlpEndpoint}/v1/traces`,
        });
        this.tracerProvider.addSpanProcessor(
          new BatchSpanProcessor(otlpExporter)
        );
      }
      
      if (this.config.enableConsoleExport) {
        this.tracerProvider.addSpanProcessor(
          new BatchSpanProcessor(new ConsoleSpanExporter())
        );
      }
      
      this.tracerProvider.register();
    });
  }
  
  /**
   * Initialize metrics
   */
  private initializeMetrics(resource: Resource): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const readers = [];
      
      // Add OTLP exporter
      if (this.config.otlpEndpoint) {
        const otlpExporter = new OTLPMetricExporter({
          url: `${this.config.otlpEndpoint}/v1/metrics`,
        });
        readers.push(
          new PeriodicExportingMetricReader({
            exporter: otlpExporter,
            exportIntervalMillis: 60000,
          })
        );
      }
      
      // Add Prometheus exporter
      if (this.config.prometheusPort) {
        this.prometheusExporter = new PrometheusExporter({
          port: this.config.prometheusPort,
        });
        readers.push(this.prometheusExporter);
      }
      
      // Add console exporter
      if (this.config.enableConsoleExport) {
        readers.push(
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: 60000,
          })
        );
      }
      
      this.meterProvider = new MeterProvider({
        resource,
        readers,
      });
      
      metrics.setGlobalMeterProvider(this.meterProvider);
    });
  }
  
  /**
   * Get instrumentations
   */
  private getInstrumentations(): any[] {
    // In production, would include auto-instrumentations
    // for HTTP, gRPC, databases, etc.
    return [];
  }
  
  /**
   * Shutdown SDK
   */
  shutdown(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      if (this.sdk) {
        yield* _(Effect.tryPromise({
          try: () => this.sdk!.shutdown(),
          catch: () => undefined,
        }));
      }
      
      if (this.prometheusExporter) {
        yield* _(Effect.sync(() => this.prometheusExporter!.shutdown()));
      }
      
      console.log('OpenTelemetry SDK shutdown');
    });
  }
  
  /**
   * Get tracer
   */
  getTracer(name: string = 'cqrs-framework'): trace.Tracer {
    return trace.getTracer(name, this.config.serviceVersion);
  }
  
  /**
   * Get meter
   */
  getMeter(name: string = 'cqrs-framework'): metrics.Meter {
    return metrics.getMeter(name, this.config.serviceVersion);
  }
}

/**
 * CQRS instrumentation
 */
export class CQRSInstrumentation {
  private tracer: trace.Tracer;
  private meter: metrics.Meter;
  private commandCounter: metrics.Counter;
  private commandDuration: metrics.Histogram;
  private eventCounter: metrics.Counter;
  private queryCounter: metrics.Counter;
  private queryDuration: metrics.Histogram;
  
  constructor(telemetry: TelemetryContext) {
    this.tracer = telemetry.tracer;
    this.meter = telemetry.meter;
    
    // Initialize metrics
    this.commandCounter = this.meter.createCounter(CQRSMetrics.COMMANDS_PROCESSED, {
      description: 'Number of commands processed',
      valueType: ValueType.INT,
    });
    
    this.commandDuration = this.meter.createHistogram(CQRSMetrics.COMMANDS_DURATION, {
      description: 'Command processing duration',
      valueType: ValueType.DOUBLE,
      unit: 'ms',
    });
    
    this.eventCounter = this.meter.createCounter(CQRSMetrics.EVENTS_EMITTED, {
      description: 'Number of events emitted',
      valueType: ValueType.INT,
    });
    
    this.queryCounter = this.meter.createCounter(CQRSMetrics.QUERIES_EXECUTED, {
      description: 'Number of queries executed',
      valueType: ValueType.INT,
    });
    
    this.queryDuration = this.meter.createHistogram(CQRSMetrics.QUERIES_DURATION, {
      description: 'Query execution duration',
      valueType: ValueType.DOUBLE,
      unit: 'ms',
    });
  }
  
  /**
   * Instrument command handler
   */
  instrumentCommand<T>(
    command: ICommand,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.tracer.startSpan(`command.${command.type}`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          [CQRSAttributes.COMMAND_TYPE]: command.type,
          [CQRSAttributes.COMMAND_ID]: command.id,
          [CQRSAttributes.AGGREGATE_ID]: command.aggregateId,
        },
      });
      
      const startTime = Date.now();
      
      try {
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () =>
            handler()
          )
        );
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        const duration = Date.now() - startTime;
        this.commandCounter.add(1, { type: command.type, status: 'success' });
        this.commandDuration.record(duration, { type: command.type });
        
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        span.recordException(error as Error);
        
        this.commandCounter.add(1, { type: command.type, status: 'error' });
        
        throw error;
      } finally {
        span.end();
      }
    });
  }
  
  /**
   * Instrument event handler
   */
  instrumentEvent<T>(
    event: IEvent,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.tracer.startSpan(`event.${event.type}`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          [CQRSAttributes.EVENT_TYPE]: event.type,
          [CQRSAttributes.EVENT_ID]: event.id,
          [CQRSAttributes.EVENT_VERSION]: event.version,
          [CQRSAttributes.AGGREGATE_ID]: event.aggregateId,
        },
      });
      
      try {
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () =>
            handler()
          )
        );
        
        span.setStatus({ code: SpanStatusCode.OK });
        this.eventCounter.add(1, { type: event.type });
        
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        span.recordException(error as Error);
        
        throw error;
      } finally {
        span.end();
      }
    });
  }
  
  /**
   * Instrument query handler
   */
  instrumentQuery<T>(
    query: IQuery,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.tracer.startSpan(`query.${query.type}`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          [CQRSAttributes.QUERY_TYPE]: query.type,
          [CQRSAttributes.QUERY_ID]: query.id,
        },
      });
      
      const startTime = Date.now();
      
      try {
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () =>
            handler()
          )
        );
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        const duration = Date.now() - startTime;
        this.queryCounter.add(1, { type: query.type, status: 'success' });
        this.queryDuration.record(duration, { type: query.type });
        
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        span.recordException(error as Error);
        
        this.queryCounter.add(1, { type: query.type, status: 'error' });
        
        throw error;
      } finally {
        span.end();
      }
    });
  }
  
  /**
   * Create saga span
   */
  createSagaSpan(
    sagaId: string,
    step: string
  ): trace.Span {
    return this.tracer.startSpan(`saga.${sagaId}.${step}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        [CQRSAttributes.SAGA_ID]: sagaId,
        [CQRSAttributes.SAGA_STEP]: step,
      },
    });
  }
  
  /**
   * Create projection span
   */
  createProjectionSpan(
    projectionName: string,
    eventType: string
  ): trace.Span {
    return this.tracer.startSpan(`projection.${projectionName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        [CQRSAttributes.PROJECTION_NAME]: projectionName,
        [CQRSAttributes.EVENT_TYPE]: eventType,
      },
    });
  }
}

/**
 * Structured logger with OpenTelemetry
 */
export class OTelLogger implements Logger {
  constructor(
    private readonly name: string,
    private readonly tracer: trace.Tracer
  ) {}
  
  debug(message: string, attributes?: Record<string, any>): void {
    this.log('DEBUG', message, attributes);
  }
  
  info(message: string, attributes?: Record<string, any>): void {
    this.log('INFO', message, attributes);
  }
  
  warn(message: string, attributes?: Record<string, any>): void {
    this.log('WARN', message, attributes);
  }
  
  error(message: string, attributes?: Record<string, any>): void {
    this.log('ERROR', message, attributes);
  }
  
  private log(
    level: string,
    message: string,
    attributes?: Record<string, any>
  ): void {
    const span = trace.getActiveSpan();
    
    if (span) {
      span.addEvent(message, {
        'log.level': level,
        'log.logger': this.name,
        ...attributes,
      });
    }
    
    // Also log to console with correlation
    const traceId = span?.spanContext().traceId ?? 'no-trace';
    const spanId = span?.spanContext().spanId ?? 'no-span';
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      traceId,
      spanId,
      ...attributes,
    }));
  }
}

/**
 * Context propagation helpers
 */
export class ContextPropagation {
  /**
   * Extract context from headers
   */
  static extractFromHeaders(headers: Record<string, string>): context.Context {
    const propagator = new W3CTraceContextPropagator();
    return propagator.extract(context.active(), headers, {
      get: (carrier, key) => carrier[key],
      keys: (carrier) => Object.keys(carrier),
    });
  }
  
  /**
   * Inject context into headers
   */
  static injectIntoHeaders(headers: Record<string, string>): Record<string, string> {
    const propagator = new W3CTraceContextPropagator();
    propagator.inject(context.active(), headers, {
      set: (carrier, key, value) => {
        carrier[key] = value;
      },
    });
    return headers;
  }
  
  /**
   * Run with context
   */
  static runWithContext<T>(
    ctx: context.Context,
    fn: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.sync(() => {
      return context.with(ctx, () => Effect.runSync(fn()));
    });
  }
}

/**
 * W3C Trace Context Propagator
 */
class W3CTraceContextPropagator {
  private readonly TRACEPARENT = 'traceparent';
  private readonly TRACESTATE = 'tracestate';
  
  inject(
    context: context.Context,
    carrier: any,
    setter: any
  ): void {
    const span = trace.getSpan(context);
    if (!span) return;
    
    const spanContext = span.spanContext();
    const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${
      spanContext.traceFlags.toString(16).padStart(2, '0')
    }`;
    
    setter.set(carrier, this.TRACEPARENT, traceparent);
    
    if (spanContext.traceState) {
      setter.set(carrier, this.TRACESTATE, spanContext.traceState.serialize());
    }
  }
  
  extract(
    context: context.Context,
    carrier: any,
    getter: any
  ): context.Context {
    const traceparent = getter.get(carrier, this.TRACEPARENT);
    if (!traceparent) return context;
    
    const matches = traceparent.match(
      /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/
    );
    
    if (!matches) return context;
    
    const [, version, traceId, spanId, flags] = matches;
    
    const spanContext = {
      traceId,
      spanId,
      traceFlags: parseInt(flags, 16),
      isRemote: true,
    };
    
    return trace.setSpanContext(context, spanContext);
  }
}

/**
 * Telemetry service
 */
export interface TelemetryService {
  readonly _tag: 'TelemetryService';
  readonly sdk: OpenTelemetrySDK;
  readonly instrumentation: CQRSInstrumentation;
  readonly logger: Logger;
}

export const TelemetryService = Context.GenericTag<TelemetryService>('TelemetryService');

/**
 * Telemetry layer
 */
export const TelemetryLive = (config: OTelConfig) =>
  Layer.effect(
    TelemetryService,
    Effect.gen(function* (_) {
      const sdk = new OpenTelemetrySDK(config);
      yield* _(sdk.initialize());
      
      const telemetryContext: TelemetryContext = {
        tracer: sdk.getTracer(),
        meter: sdk.getMeter(),
        logger: new OTelLogger('cqrs-framework', sdk.getTracer()),
      };
      
      const instrumentation = new CQRSInstrumentation(telemetryContext);
      
      return {
        _tag: 'TelemetryService',
        sdk,
        instrumentation,
        logger: telemetryContext.logger,
      };
    })
  );

/**
 * Create telemetry service
 */
export const createTelemetryService = (
  config: OTelConfig
): Effect.Effect<TelemetryService, Error, never> => {
  return Effect.gen(function* (_) {
    const sdk = new OpenTelemetrySDK(config);
    yield* _(sdk.initialize());
    
    const telemetryContext: TelemetryContext = {
      tracer: sdk.getTracer(),
      meter: sdk.getMeter(),
      logger: new OTelLogger('cqrs-framework', sdk.getTracer()),
    };
    
    const instrumentation = new CQRSInstrumentation(telemetryContext);
    
    return {
      _tag: 'TelemetryService',
      sdk,
      instrumentation,
      logger: telemetryContext.logger,
    };
  });
};