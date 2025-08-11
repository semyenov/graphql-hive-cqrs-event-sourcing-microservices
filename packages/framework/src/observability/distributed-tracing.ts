/**
 * Distributed Tracing Implementation
 * 
 * Comprehensive distributed tracing for CQRS/Event Sourcing systems:
 * - Trace propagation across service boundaries
 * - Span correlation for command/event/query flows
 * - Custom instrumentation for domain operations
 * - Trace sampling and collection strategies
 * - Integration with OpenTelemetry ecosystem
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Link,
  SpanAttributes,
} from '@opentelemetry/api';
import type { ICommand, IEvent, IQuery } from '../effect/core/types';
import type { AggregateId } from '../core/branded';

/**
 * Trace context information
 */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly traceFlags: number;
  readonly baggage?: Record<string, string>;
}

/**
 * Span metadata
 */
export interface SpanMetadata {
  readonly operationName: string;
  readonly operationType: 'command' | 'event' | 'query' | 'saga' | 'projection' | 'aggregate';
  readonly entityId?: string;
  readonly entityType?: string;
  readonly version?: number;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
}

/**
 * Trace configuration
 */
export interface TracingConfig {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: string;
  readonly samplingRate: number;
  readonly maxSpanAttributes: number;
  readonly maxSpanEvents: number;
  readonly maxSpanLinks: number;
  readonly exportBatchSize: number;
  readonly exportTimeout: Duration.Duration;
}

/**
 * Span builder for CQRS operations
 */
export class CQRSSpanBuilder {
  private attributes: Record<string, any> = {};
  private events: Array<{ name: string; attributes?: Record<string, any>; timestamp?: number }> = [];
  private links: Link[] = [];
  private status?: { code: SpanStatusCode; message?: string };

  constructor(
    private readonly tracer: trace.Tracer,
    private readonly metadata: SpanMetadata
  ) {}

  /**
   * Add attribute to span
   */
  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Add multiple attributes
   */
  setAttributes(attributes: Record<string, string | number | boolean>): this {
    Object.assign(this.attributes, attributes);
    return this;
  }

  /**
   * Add event to span
   */
  addEvent(name: string, attributes?: Record<string, any>, timestamp?: number): this {
    this.events.push({ name, attributes, timestamp });
    return this;
  }

  /**
   * Link to another span
   */
  addLink(spanContext: trace.SpanContext, attributes?: SpanAttributes): this {
    this.links.push({ context: spanContext, attributes });
    return this;
  }

  /**
   * Set span status
   */
  setStatus(code: SpanStatusCode, message?: string): this {
    this.status = { code, message };
    return this;
  }

  /**
   * Start span
   */
  start(): trace.Span {
    const span = this.tracer.startSpan(this.metadata.operationName, {
      kind: this.getSpanKind(),
      attributes: {
        // Standard CQRS attributes
        'cqrs.operation.type': this.metadata.operationType,
        'cqrs.entity.id': this.metadata.entityId,
        'cqrs.entity.type': this.metadata.entityType,
        'cqrs.version': this.metadata.version,
        'cqrs.causation_id': this.metadata.causationId,
        'cqrs.correlation_id': this.metadata.correlationId,
        'cqrs.user_id': this.metadata.userId,
        'cqrs.session_id': this.metadata.sessionId,
        // Custom attributes
        ...this.attributes,
      },
      links: this.links,
    });

    // Add events
    for (const event of this.events) {
      span.addEvent(event.name, event.attributes, event.timestamp);
    }

    // Set status if provided
    if (this.status) {
      span.setStatus(this.status);
    }

    return span;
  }

  /**
   * Get appropriate span kind based on operation type
   */
  private getSpanKind(): SpanKind {
    switch (this.metadata.operationType) {
      case 'command':
      case 'query':
        return SpanKind.SERVER;
      case 'event':
      case 'projection':
        return SpanKind.CONSUMER;
      case 'saga':
        return SpanKind.INTERNAL;
      case 'aggregate':
        return SpanKind.INTERNAL;
      default:
        return SpanKind.INTERNAL;
    }
  }
}

/**
 * Distributed tracer for CQRS operations
 */
export class CQRSDistributedTracer {
  constructor(
    private readonly tracer: trace.Tracer,
    private readonly config: TracingConfig
  ) {}

  /**
   * Create command span
   */
  createCommandSpan(
    command: ICommand,
    parentContext?: context.Context
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `command.${command.type}`,
      operationType: 'command',
      entityId: command.aggregateId,
      entityType: command.type.split('.')[0], // Extract aggregate type
      causationId: command.id,
      correlationId: command.metadata?.correlationId,
      userId: command.metadata?.userId,
      sessionId: command.metadata?.sessionId,
    })
      .setAttribute('command.type', command.type)
      .setAttribute('command.id', command.id)
      .setAttribute('command.aggregate_id', command.aggregateId)
      .setAttribute('command.timestamp', command.timestamp.toISOString());
  }

  /**
   * Create event span
   */
  createEventSpan(
    event: IEvent,
    parentContext?: context.Context
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `event.${event.type}`,
      operationType: 'event',
      entityId: event.aggregateId,
      entityType: event.type.split('.')[0],
      version: event.version,
      causationId: event.causationId,
      correlationId: event.correlationId,
    })
      .setAttribute('event.type', event.type)
      .setAttribute('event.id', event.id)
      .setAttribute('event.aggregate_id', event.aggregateId)
      .setAttribute('event.version', event.version)
      .setAttribute('event.timestamp', event.timestamp.toISOString())
      .setAttribute('event.causation_id', event.causationId || '')
      .setAttribute('event.correlation_id', event.correlationId || '');
  }

  /**
   * Create query span
   */
  createQuerySpan(
    query: IQuery,
    parentContext?: context.Context
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `query.${query.type}`,
      operationType: 'query',
      causationId: query.id,
      correlationId: query.metadata?.correlationId,
      userId: query.metadata?.userId,
      sessionId: query.metadata?.sessionId,
    })
      .setAttribute('query.type', query.type)
      .setAttribute('query.id', query.id)
      .setAttribute('query.timestamp', query.timestamp.toISOString());
  }

  /**
   * Create aggregate span
   */
  createAggregateSpan(
    aggregateId: AggregateId,
    aggregateType: string,
    operation: string,
    version?: number
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `aggregate.${aggregateType}.${operation}`,
      operationType: 'aggregate',
      entityId: aggregateId,
      entityType: aggregateType,
      version,
    })
      .setAttribute('aggregate.id', aggregateId)
      .setAttribute('aggregate.type', aggregateType)
      .setAttribute('aggregate.operation', operation)
      .setAttribute('aggregate.version', version || 0);
  }

  /**
   * Create saga span
   */
  createSagaSpan(
    sagaId: string,
    sagaType: string,
    step: string,
    correlationId?: string
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `saga.${sagaType}.${step}`,
      operationType: 'saga',
      entityId: sagaId,
      entityType: sagaType,
      correlationId,
    })
      .setAttribute('saga.id', sagaId)
      .setAttribute('saga.type', sagaType)
      .setAttribute('saga.step', step)
      .setAttribute('saga.correlation_id', correlationId || '');
  }

  /**
   * Create projection span
   */
  createProjectionSpan(
    projectionName: string,
    eventType: string,
    eventId: string
  ): CQRSSpanBuilder {
    return new CQRSSpanBuilder(this.tracer, {
      operationName: `projection.${projectionName}`,
      operationType: 'projection',
      entityId: eventId,
      entityType: eventType,
    })
      .setAttribute('projection.name', projectionName)
      .setAttribute('projection.event_type', eventType)
      .setAttribute('projection.event_id', eventId);
  }

  /**
   * Trace command execution
   */
  traceCommand<T>(
    command: ICommand,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.createCommandSpan(command).start();

      try {
        span.addEvent('command.processing.started');
        
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () => handler())
        );
        
        span.addEvent('command.processing.completed');
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        span.addEvent('command.processing.failed', {
          error: String(error),
        });
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Trace event processing
   */
  traceEvent<T>(
    event: IEvent,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.createEventSpan(event).start();

      try {
        span.addEvent('event.processing.started');
        
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () => handler())
        );
        
        span.addEvent('event.processing.completed');
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        span.addEvent('event.processing.failed', {
          error: String(error),
        });
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Trace query execution
   */
  traceQuery<T>(
    query: IQuery,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.createQuerySpan(query).start();

      try {
        span.addEvent('query.execution.started');
        
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () => handler())
        );
        
        span.addEvent('query.execution.completed');
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        span.addEvent('query.execution.failed', {
          error: String(error),
        });
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Trace aggregate operation
   */
  traceAggregate<T>(
    aggregateId: AggregateId,
    aggregateType: string,
    operation: string,
    version: number,
    handler: () => Effect.Effect<T, Error, never>
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      const span = this.createAggregateSpan(aggregateId, aggregateType, operation, version).start();

      try {
        span.addEvent(`aggregate.${operation}.started`);
        
        const result = yield* _(
          context.with(trace.setSpan(context.active(), span), () => handler())
        );
        
        span.addEvent(`aggregate.${operation}.completed`);
        span.setStatus({ code: SpanStatusCode.OK });
        
        return result;
      } catch (error) {
        span.addEvent(`aggregate.${operation}.failed`, {
          error: String(error),
        });
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

/**
 * Trace correlation manager
 */
export class TraceCorrelationManager {
  private correlations = new Map<string, Set<string>>();
  private causations = new Map<string, string>();

  /**
   * Register correlation between command and events
   */
  correlateCommandToEvents(commandId: string, eventIds: string[]): void {
    const correlationSet = this.correlations.get(commandId) || new Set();
    eventIds.forEach(eventId => {
      correlationSet.add(eventId);
      this.causations.set(eventId, commandId);
    });
    this.correlations.set(commandId, correlationSet);
  }

  /**
   * Register correlation between event and projections
   */
  correlateEventToProjections(eventId: string, projectionIds: string[]): void {
    const correlationSet = this.correlations.get(eventId) || new Set();
    projectionIds.forEach(projectionId => {
      correlationSet.add(projectionId);
      this.causations.set(projectionId, eventId);
    });
    this.correlations.set(eventId, correlationSet);
  }

  /**
   * Get correlated spans
   */
  getCorrelatedSpans(operationId: string): string[] {
    const correlatedSet = this.correlations.get(operationId);
    return correlatedSet ? Array.from(correlatedSet) : [];
  }

  /**
   * Get causation chain
   */
  getCausationChain(operationId: string): string[] {
    const chain: string[] = [operationId];
    let currentId = operationId;
    
    while (this.causations.has(currentId)) {
      const parentId = this.causations.get(currentId)!;
      chain.unshift(parentId);
      currentId = parentId;
    }
    
    return chain;
  }

  /**
   * Create trace links
   */
  createTraceLinks(operationId: string): Link[] {
    const correlatedIds = this.getCorrelatedSpans(operationId);
    const links: Link[] = [];

    for (const correlatedId of correlatedIds) {
      // In production, would get actual span context
      // For now, creating mock span context
      const spanContext = {
        traceId: `trace-${correlatedId}`,
        spanId: `span-${correlatedId}`,
        traceFlags: 1,
        isRemote: false,
      } as trace.SpanContext;

      links.push({
        context: spanContext,
        attributes: {
          'link.type': 'correlation',
          'link.operation_id': correlatedId,
        },
      });
    }

    return links;
  }
}

/**
 * Trace sampling strategies
 */
export class TraceSamplingStrategies {
  /**
   * Always sample
   */
  static alwaysSample(): (traceId: string) => boolean {
    return () => true;
  }

  /**
   * Never sample
   */
  static neverSample(): (traceId: string) => boolean {
    return () => false;
  }

  /**
   * Probability-based sampling
   */
  static probabilitySample(rate: number): (traceId: string) => boolean {
    return () => Math.random() < rate;
  }

  /**
   * Rate-based sampling (requests per second)
   */
  static rateLimitSample(requestsPerSecond: number): (traceId: string) => boolean {
    let lastReset = Date.now();
    let requestCount = 0;

    return () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        requestCount = 0;
      }
      
      if (requestCount < requestsPerSecond) {
        requestCount++;
        return true;
      }
      
      return false;
    };
  }

  /**
   * Error-biased sampling (always sample errors)
   */
  static errorBiasedSample(normalRate: number): {
    shouldSample: (traceId: string) => boolean;
    markError: (traceId: string) => void;
  } {
    const errorTraces = new Set<string>();
    const probabilitySampler = this.probabilitySample(normalRate);

    return {
      shouldSample: (traceId: string) => {
        return errorTraces.has(traceId) || probabilitySampler(traceId);
      },
      markError: (traceId: string) => {
        errorTraces.add(traceId);
        // Clean up old error traces periodically
        if (errorTraces.size > 10000) {
          const toDelete = Array.from(errorTraces).slice(0, 5000);
          toDelete.forEach(id => errorTraces.delete(id));
        }
      },
    };
  }

  /**
   * Adaptive sampling based on system load
   */
  static adaptiveSample(baseRate: number, loadThreshold: number): (traceId: string) => boolean {
    let currentLoad = 0;
    
    // In production, would get actual system metrics
    const getSystemLoad = () => {
      // Mock implementation
      return Math.random() * 100;
    };

    return (traceId: string) => {
      currentLoad = getSystemLoad();
      const adjustedRate = currentLoad > loadThreshold ? baseRate * 0.1 : baseRate;
      return Math.random() < adjustedRate;
    };
  }
}

/**
 * Distributed tracing service
 */
export interface DistributedTracingService {
  readonly _tag: 'DistributedTracingService';
  readonly tracer: CQRSDistributedTracer;
  readonly correlationManager: TraceCorrelationManager;
  readonly traceCommand: <T>(
    command: ICommand,
    handler: () => Effect.Effect<T, Error, never>
  ) => Effect.Effect<T, Error, never>;
  readonly traceEvent: <T>(
    event: IEvent,
    handler: () => Effect.Effect<T, Error, never>
  ) => Effect.Effect<T, Error, never>;
  readonly traceQuery: <T>(
    query: IQuery,
    handler: () => Effect.Effect<T, Error, never>
  ) => Effect.Effect<T, Error, never>;
}

export const DistributedTracingService = Context.GenericTag<DistributedTracingService>('DistributedTracingService');

/**
 * Distributed tracing layer
 */
export const DistributedTracingLive = (config: TracingConfig) =>
  Layer.effect(
    DistributedTracingService,
    Effect.gen(function* (_) {
      const otelTracer = trace.getTracer(config.serviceName, config.serviceVersion);
      const tracer = new CQRSDistributedTracer(otelTracer, config);
      const correlationManager = new TraceCorrelationManager();

      const traceCommand = <T>(
        command: ICommand,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceCommand(command, handler);

      const traceEvent = <T>(
        event: IEvent,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceEvent(event, handler);

      const traceQuery = <T>(
        query: IQuery,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceQuery(query, handler);

      return {
        _tag: 'DistributedTracingService',
        tracer,
        correlationManager,
        traceCommand,
        traceEvent,
        traceQuery,
      };
    })
  );

/**
 * Create distributed tracing service
 */
export const createDistributedTracingService = (
  config: TracingConfig
): Effect.Effect<DistributedTracingService, Error, never> => {
  return Effect.gen(function* (_) {
    const otelTracer = trace.getTracer(config.serviceName, config.serviceVersion);
    const tracer = new CQRSDistributedTracer(otelTracer, config);
    const correlationManager = new TraceCorrelationManager();

    return {
      _tag: 'DistributedTracingService',
      tracer,
      correlationManager,
      traceCommand: <T>(
        command: ICommand,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceCommand(command, handler),
      traceEvent: <T>(
        event: IEvent,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceEvent(event, handler),
      traceQuery: <T>(
        query: IQuery,
        handler: () => Effect.Effect<T, Error, never>
      ) => tracer.traceQuery(query, handler),
    };
  });
};

/**
 * Trace context propagation utilities
 */
export class TraceContextPropagation {
  /**
   * Extract trace context from headers
   */
  static extractFromHeaders(headers: Record<string, string>): Option.Option<TraceContext> {
    const traceparent = headers['traceparent'] || headers['x-trace-parent'];
    
    if (!traceparent) {
      return Option.none();
    }

    const parts = traceparent.split('-');
    if (parts.length !== 4) {
      return Option.none();
    }

    const [version, traceId, spanId, flags] = parts;
    
    return Option.some({
      traceId,
      spanId,
      traceFlags: parseInt(flags, 16),
      baggage: this.parseBaggage(headers['baggage']),
    });
  }

  /**
   * Inject trace context into headers
   */
  static injectIntoHeaders(
    traceContext: TraceContext,
    headers: Record<string, string>
  ): Record<string, string> {
    const traceparent = `00-${traceContext.traceId}-${traceContext.spanId}-${traceContext.traceFlags.toString(16).padStart(2, '0')}`;
    
    const result = {
      ...headers,
      'traceparent': traceparent,
    };

    if (traceContext.baggage && Object.keys(traceContext.baggage).length > 0) {
      result['baggage'] = this.serializeBaggage(traceContext.baggage);
    }

    return result;
  }

  /**
   * Parse baggage header
   */
  private static parseBaggage(baggage?: string): Record<string, string> | undefined {
    if (!baggage) return undefined;

    const items: Record<string, string> = {};
    const pairs = baggage.split(',');

    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=', 2);
      if (key && value) {
        items[key] = decodeURIComponent(value);
      }
    }

    return Object.keys(items).length > 0 ? items : undefined;
  }

  /**
   * Serialize baggage to header
   */
  private static serializeBaggage(baggage: Record<string, string>): string {
    return Object.entries(baggage)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join(',');
  }
}