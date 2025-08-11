/**
 * Framework Effect: OpenTelemetry Metrics
 * 
 * Metrics collection and reporting for CQRS/Event Sourcing patterns.
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Schedule from 'effect/Schedule';
import { pipe } from 'effect/Function';
import type { ICommand, IEvent, IQuery } from '../core/types';

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric value
 */
export interface MetricValue {
  readonly value: number;
  readonly labels?: Record<string, string>;
  readonly timestamp?: Date;
}

/**
 * Metric definition
 */
export interface MetricDefinition {
  readonly name: string;
  readonly type: MetricType;
  readonly description?: string;
  readonly unit?: string;
  readonly labels?: readonly string[];
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  readonly increment: (
    name: string,
    value?: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly gauge: (
    name: string,
    value: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly histogram: (
    name: string,
    value: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly summary: (
    name: string,
    value: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly getMetrics: () => Effect.Effect<Map<string, MetricValue[]>, never, never>;
}

/**
 * Create in-memory metrics collector
 */
export const createInMemoryCollector = (): Effect.Effect<MetricsCollector, never, never> =>
  Effect.gen(function* (_) {
    const metrics = yield* _(Ref.make(new Map<string, MetricValue[]>()));
    
    const addMetric = (
      name: string,
      value: number,
      labels?: Record<string, string>
    ): Effect.Effect<void, never, never> =>
      Ref.update(metrics, (map) => {
        const existing = map.get(name) ?? [];
        const newValue: MetricValue = {
          value,
          labels,
          timestamp: new Date(),
        };
        map.set(name, [...existing, newValue]);
        return new Map(map);
      });
    
    return {
      increment: (name, value = 1, labels) => addMetric(name, value, labels),
      gauge: (name, value, labels) => addMetric(name, value, labels),
      histogram: (name, value, labels) => addMetric(name, value, labels),
      summary: (name, value, labels) => addMetric(name, value, labels),
      getMetrics: () => Ref.get(metrics),
    };
  });

/**
 * CQRS metrics
 */
export interface CQRSMetrics {
  readonly commandsProcessed: number;
  readonly commandsFailed: number;
  readonly eventsEmitted: number;
  readonly eventsProcessed: number;
  readonly queriesExecuted: number;
  readonly queriesFailed: number;
  readonly snapshotsCreated: number;
  readonly snapshotsLoaded: number;
  readonly averageCommandDuration: number;
  readonly averageQueryDuration: number;
}

/**
 * Create CQRS metrics collector
 */
export const createCQRSMetricsCollector = (): Effect.Effect<{
  readonly collector: MetricsCollector;
  readonly recordCommand: (
    command: ICommand,
    duration: number,
    success: boolean
  ) => Effect.Effect<void, never, never>;
  readonly recordEvent: (
    event: IEvent,
    processed: boolean
  ) => Effect.Effect<void, never, never>;
  readonly recordQuery: (
    query: IQuery,
    duration: number,
    success: boolean
  ) => Effect.Effect<void, never, never>;
  readonly recordSnapshot: (
    operation: 'create' | 'load',
    aggregateId: string
  ) => Effect.Effect<void, never, never>;
  readonly getCQRSMetrics: () => Effect.Effect<CQRSMetrics, never, never>;
}, never, never> =>
  Effect.gen(function* (_) {
    const collector = yield* _(createInMemoryCollector());
    const cqrsMetrics = yield* _(Ref.make<CQRSMetrics>({
      commandsProcessed: 0,
      commandsFailed: 0,
      eventsEmitted: 0,
      eventsProcessed: 0,
      queriesExecuted: 0,
      queriesFailed: 0,
      snapshotsCreated: 0,
      snapshotsLoaded: 0,
      averageCommandDuration: 0,
      averageQueryDuration: 0,
    }));
    
    const commandDurations: number[] = [];
    const queryDurations: number[] = [];
    
    const recordCommand = (
      command: ICommand,
      duration: number,
      success: boolean
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const labels = {
          type: command.type,
          success: String(success),
        };
        
        yield* _(collector.increment('commands_total', 1, labels));
        yield* _(collector.histogram('command_duration_ms', duration, labels));
        
        commandDurations.push(duration);
        if (commandDurations.length > 100) {
          commandDurations.shift();
        }
        
        yield* _(Ref.update(cqrsMetrics, (m) => ({
          ...m,
          commandsProcessed: success ? m.commandsProcessed + 1 : m.commandsProcessed,
          commandsFailed: !success ? m.commandsFailed + 1 : m.commandsFailed,
          averageCommandDuration:
            commandDurations.reduce((a, b) => a + b, 0) / commandDurations.length,
        })));
      });
    
    const recordEvent = (
      event: IEvent,
      processed: boolean
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const labels = {
          type: event.type,
          processed: String(processed),
        };
        
        yield* _(collector.increment('events_total', 1, labels));
        
        yield* _(Ref.update(cqrsMetrics, (m) => ({
          ...m,
          eventsEmitted: processed ? m.eventsEmitted : m.eventsEmitted + 1,
          eventsProcessed: processed ? m.eventsProcessed + 1 : m.eventsProcessed,
        })));
      });
    
    const recordQuery = (
      query: IQuery,
      duration: number,
      success: boolean
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const labels = {
          type: query.type,
          success: String(success),
        };
        
        yield* _(collector.increment('queries_total', 1, labels));
        yield* _(collector.histogram('query_duration_ms', duration, labels));
        
        queryDurations.push(duration);
        if (queryDurations.length > 100) {
          queryDurations.shift();
        }
        
        yield* _(Ref.update(cqrsMetrics, (m) => ({
          ...m,
          queriesExecuted: success ? m.queriesExecuted + 1 : m.queriesExecuted,
          queriesFailed: !success ? m.queriesFailed + 1 : m.queriesFailed,
          averageQueryDuration:
            queryDurations.reduce((a, b) => a + b, 0) / queryDurations.length,
        })));
      });
    
    const recordSnapshot = (
      operation: 'create' | 'load',
      aggregateId: string
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const labels = {
          operation,
          aggregateId,
        };
        
        yield* _(collector.increment('snapshots_total', 1, labels));
        
        yield* _(Ref.update(cqrsMetrics, (m) => ({
          ...m,
          snapshotsCreated: operation === 'create' ? m.snapshotsCreated + 1 : m.snapshotsCreated,
          snapshotsLoaded: operation === 'load' ? m.snapshotsLoaded + 1 : m.snapshotsLoaded,
        })));
      });
    
    const getCQRSMetrics = (): Effect.Effect<CQRSMetrics, never, never> =>
      Ref.get(cqrsMetrics);
    
    return {
      collector,
      recordCommand,
      recordEvent,
      recordQuery,
      recordSnapshot,
      getCQRSMetrics,
    };
  });

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly cpuUsage: number;
  readonly memoryUsage: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly externalMemory: number;
  readonly activeHandles: number;
  readonly activeRequests: number;
}

/**
 * Collect performance metrics
 */
export const collectPerformanceMetrics = (): Effect.Effect<PerformanceMetrics, never, never> =>
  Effect.sync(() => {
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: memUsage.rss / 1024 / 1024, // Convert to MB
      heapUsed: memUsage.heapUsed / 1024 / 1024,
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      externalMemory: memUsage.external / 1024 / 1024,
      activeHandles: (process as any)._getActiveHandles?.()?.length ?? 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length ?? 0,
    };
  });

/**
 * Export metrics in Prometheus format
 */
export const exportPrometheusMetrics = (
  metrics: Map<string, MetricValue[]>
): string => {
  const lines: string[] = [];
  
  for (const [name, values] of metrics) {
    for (const value of values) {
      const labels = value.labels
        ? Object.entries(value.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')
        : '';
      
      const labelStr = labels ? `{${labels}}` : '';
      lines.push(`${name}${labelStr} ${value.value}`);
    }
  }
  
  return lines.join('\n');
};

/**
 * Export metrics in JSON format
 */
export const exportJSONMetrics = (
  metrics: Map<string, MetricValue[]>
): Record<string, MetricValue[]> => {
  const result: Record<string, MetricValue[]> = {};
  
  for (const [name, values] of metrics) {
    result[name] = values;
  }
  
  return result;
};

/**
 * Create metrics reporting service
 */
export const createMetricsReporter = (
  collector: MetricsCollector,
  config: {
    interval?: number;
    endpoint?: string;
    format?: 'prometheus' | 'json';
  } = {}
): Effect.Effect<{
  readonly start: () => Effect.Effect<void, never, never>;
  readonly stop: () => Effect.Effect<void, never, never>;
  readonly reportOnce: () => Effect.Effect<void, never, never>;
}, never, never> =>
  Effect.gen(function* (_) {
    const interval = config.interval ?? 60000; // 1 minute default
    const format = config.format ?? 'json';
    const fiberRef = yield* _(Ref.make<any>(null));
    
    const reportMetrics = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const metrics = yield* _(collector.getMetrics());
        const exported = format === 'prometheus'
          ? exportPrometheusMetrics(metrics)
          : JSON.stringify(exportJSONMetrics(metrics));
        
        if (config.endpoint) {
          yield* _(Effect.tryPromise({
            try: () =>
              fetch(config.endpoint!, {
                method: 'POST',
                headers: {
                  'Content-Type': format === 'prometheus'
                    ? 'text/plain'
                    : 'application/json',
                },
                body: exported,
              }),
            catch: (error) => {
              console.error('Failed to report metrics:', error);
              return error;
            },
          }));
        } else {
          console.log('Metrics:', exported);
        }
      });
    
    const start = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const fiber = yield* _(Effect.fork(
          pipe(
            reportMetrics(),
            Effect.repeat(Schedule.spaced(Duration.millis(interval))),
            Effect.forever
          )
        ));
        yield* _(Ref.set(fiberRef, fiber));
      });
    
    const stop = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* (_) {
        const fiber = yield* _(Ref.get(fiberRef));
        if (fiber) {
          yield* _(Effect.fork(Effect.interrupt(fiber)));
          yield* _(Ref.set(fiberRef, null));
        }
      });
    
    return {
      start,
      stop,
      reportOnce: reportMetrics,
    };
  });