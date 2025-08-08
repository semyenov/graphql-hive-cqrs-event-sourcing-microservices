/**
 * Framework Infrastructure: Metrics Middleware
 * 
 * Command and query metrics collection middleware.
 */

import type { ICommandMiddleware } from '../../core/command';
import type { IQueryMiddleware } from '../../core/query';
import type { ICommand, IQuery } from '../../core';

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  incrementCounter(name: string, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}

/**
 * In-memory metrics collector
 */
export class InMemoryMetricsCollector implements IMetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();
  
  incrementCounter(name: string, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }
  
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }
  
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    this.gauges.set(key, value);
  }
  
  private createKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}{${tagString}}`;
  }
  
  getMetrics(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            p50: this.percentile(values, 0.5),
            p95: this.percentile(values, 0.95),
            p99: this.percentile(values, 0.99),
          },
        ])
      ),
      gauges: Object.fromEntries(this.gauges),
    };
  }
  
  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
  
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

/**
 * Create command metrics middleware
 */
export function createCommandMetricsMiddleware<TCommand extends ICommand = ICommand>(
  collector: IMetricsCollector = new InMemoryMetricsCollector()
): ICommandMiddleware<TCommand> {
  return {
    async execute(command, next) {
      const startTime = Date.now();
      const tags = { command_type: command.type };
      
      // Increment command counter
      collector.incrementCounter('commands.total', tags);
      
      try {
        const result = await next(command);
        const duration = Date.now() - startTime;
        
        // Record success metrics
        collector.incrementCounter('commands.success', tags);
        collector.recordHistogram('commands.duration', duration, tags);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record failure metrics
        collector.incrementCounter('commands.failure', tags);
        collector.recordHistogram('commands.duration', duration, tags);
        
        // Track error types
        const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
        collector.incrementCounter('commands.errors', { ...tags, error_type: errorType });
        
        throw error;
      }
    },
  };
}

/**
 * Create query metrics middleware
 */
export function createQueryMetricsMiddleware<TQuery extends IQuery = IQuery>(
  collector: IMetricsCollector = new InMemoryMetricsCollector()
): IQueryMiddleware<TQuery> {
  return {
    async execute(query, next) {
      const startTime = Date.now();
      const tags = { query_type: query.type };
      
      // Increment query counter
      collector.incrementCounter('queries.total', tags);
      
      // Track cache hits/misses if available
      const fromCache = (query as any).fromCache;
      if (fromCache !== undefined) {
        collector.incrementCounter(
          fromCache ? 'queries.cache_hits' : 'queries.cache_misses',
          tags
        );
      }
      
      try {
        const result = await next(query);
        const duration = Date.now() - startTime;
        
        // Record success metrics
        collector.incrementCounter('queries.success', tags);
        collector.recordHistogram('queries.duration', duration, tags);
        
        // Record result size
        if (Array.isArray(result)) {
          collector.recordHistogram('queries.result_size', result.length, tags);
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record failure metrics
        collector.incrementCounter('queries.failure', tags);
        collector.recordHistogram('queries.duration', duration, tags);
        
        // Track error types
        const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
        collector.incrementCounter('queries.errors', { ...tags, error_type: errorType });
        
        throw error;
      }
    },
  };
}

/**
 * Create performance monitoring middleware
 */
export function createPerformanceMiddleware<T extends ICommand | IQuery>(
  thresholdMs = 1000,
  onSlowOperation?: (operation: T, duration: number) => void
): ICommandMiddleware<T extends ICommand ? T : never> | IQueryMiddleware<T extends IQuery ? T : never> {
  return {
    async execute(operation: any, next: any) {
      const startTime = Date.now();
      
      try {
        const result = await next(operation);
        const duration = Date.now() - startTime;
        
        // Alert on slow operations
        if (duration > thresholdMs) {
          console.warn(
            `⚠️ Slow operation detected: ${operation.type} took ${duration}ms (threshold: ${thresholdMs}ms)`
          );
          
          if (onSlowOperation) {
            onSlowOperation(operation, duration);
          }
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Also track slow failures
        if (duration > thresholdMs) {
          console.warn(
            `⚠️ Slow failed operation: ${operation.type} took ${duration}ms before failing`
          );
        }
        
        throw error;
      }
    },
  } as any;
}

/**
 * Export metrics as Prometheus format
 */
export function exportPrometheusMetrics(
  collector: InMemoryMetricsCollector
): string {
  const metrics = collector.getMetrics();
  const lines: string[] = [];
  
  // Export counters
  for (const [key, value] of Object.entries(metrics.counters as Record<string, number>)) {
    lines.push(`# TYPE ${key.split('{')[0]} counter`);
    lines.push(`${key} ${value}`);
  }
  
  // Export histograms
  for (const [key, stats] of Object.entries(metrics.histograms as Record<string, any>)) {
    const metricName = key.split('{')[0];
    lines.push(`# TYPE ${metricName} histogram`);
    lines.push(`${key}_count ${stats.count}`);
    lines.push(`${key}_sum ${stats.avg * stats.count}`);
    lines.push(`${key}_min ${stats.min}`);
    lines.push(`${key}_max ${stats.max}`);
    lines.push(`${key}_p50 ${stats.p50}`);
    lines.push(`${key}_p95 ${stats.p95}`);
    lines.push(`${key}_p99 ${stats.p99}`);
  }
  
  // Export gauges
  for (const [key, value] of Object.entries(metrics.gauges as Record<string, number>)) {
    lines.push(`# TYPE ${key.split('{')[0]} gauge`);
    lines.push(`${key} ${value}`);
  }
  
  return lines.join('\n');
}