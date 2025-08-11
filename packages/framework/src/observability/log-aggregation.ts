/**
 * Log Aggregation System
 * 
 * Centralized log collection and analysis for CQRS/Event Sourcing systems:
 * - Structured logging with correlation IDs
 * - Log streaming and buffering
 * - Log parsing and enrichment
 * - Search and filtering capabilities
 * - Log retention and archiving
 * - Integration with ELK stack and similar systems
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Stream from 'effect/Stream';
import * as Queue from 'effect/Queue';
import * as Chunk from 'effect/Chunk';
import * as Ref from 'effect/Ref';
import * as Fiber from 'effect/Fiber';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log severity mapping
 */
export const LOG_SEVERITY: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 10,
  [LogLevel.DEBUG]: 20,
  [LogLevel.INFO]: 30,
  [LogLevel.WARN]: 40,
  [LogLevel.ERROR]: 50,
  [LogLevel.FATAL]: 60,
};

/**
 * Structured log entry
 */
export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly service: string;
  readonly version: string;
  readonly environment: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly aggregateId?: string;
  readonly aggregateType?: string;
  readonly eventType?: string;
  readonly commandType?: string;
  readonly queryType?: string;
  readonly error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  readonly metadata?: Record<string, any>;
  readonly labels?: Record<string, string>;
}

/**
 * Log query
 */
export interface LogQuery {
  readonly levels?: LogLevel[];
  readonly services?: string[];
  readonly timeRange?: {
    from: Date;
    to: Date;
  };
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly aggregateId?: string;
  readonly searchTerm?: string;
  readonly filters?: Record<string, string | string[]>;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Log sink configuration
 */
export interface LogSinkConfig {
  readonly type: 'console' | 'file' | 'elasticsearch' | 'loki' | 'custom';
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly index?: string;
  readonly batchSize?: number;
  readonly flushInterval?: Duration.Duration;
  readonly retryAttempts?: number;
  readonly retryDelay?: Duration.Duration;
}

/**
 * Log buffer
 */
export class LogBuffer {
  private buffer: LogEntry[] = [];
  private lastFlush = Date.now();

  constructor(
    private readonly maxSize: number = 1000,
    private readonly maxAge: Duration.Duration = Duration.seconds(30)
  ) {}

  /**
   * Add log entry to buffer
   */
  add(entry: LogEntry): boolean {
    this.buffer.push(entry);
    return this.buffer.length >= this.maxSize || this.shouldFlush();
  }

  /**
   * Check if buffer should flush
   */
  shouldFlush(): boolean {
    const age = Date.now() - this.lastFlush;
    return age >= Duration.toMillis(this.maxAge);
  }

  /**
   * Flush buffer
   */
  flush(): LogEntry[] {
    const entries = [...this.buffer];
    this.buffer = [];
    this.lastFlush = Date.now();
    return entries;
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}

/**
 * Log enricher
 */
export class LogEnricher {
  private enrichers: Array<(entry: LogEntry) => LogEntry> = [];

  /**
   * Add enricher function
   */
  addEnricher(enricher: (entry: LogEntry) => LogEntry): this {
    this.enrichers.push(enricher);
    return this;
  }

  /**
   * Enrich log entry
   */
  enrich(entry: LogEntry): LogEntry {
    return this.enrichers.reduce((enriched, enricher) => enricher(enriched), entry);
  }

  /**
   * Create default enrichers
   */
  static createDefault(): LogEnricher {
    return new LogEnricher()
      .addEnricher(LogEnricher.addTimestamp)
      .addEnricher(LogEnricher.addHostname)
      .addEnricher(LogEnricher.addProcessInfo)
      .addEnricher(LogEnricher.parseError);
  }

  /**
   * Add timestamp if missing
   */
  static addTimestamp(entry: LogEntry): LogEntry {
    return entry.timestamp ? entry : { ...entry, timestamp: new Date() };
  }

  /**
   * Add hostname
   */
  static addHostname(entry: LogEntry): LogEntry {
    const hostname = process.env.HOSTNAME || 'unknown';
    return {
      ...entry,
      metadata: {
        ...entry.metadata,
        hostname,
      },
    };
  }

  /**
   * Add process information
   */
  static addProcessInfo(entry: LogEntry): LogEntry {
    return {
      ...entry,
      metadata: {
        ...entry.metadata,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  /**
   * Parse error objects
   */
  static parseError(entry: LogEntry): LogEntry {
    if (entry.level === LogLevel.ERROR && entry.metadata?.error instanceof Error) {
      const error = entry.metadata.error as Error;
      return {
        ...entry,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        metadata: {
          ...entry.metadata,
          error: undefined, // Remove original error object
        },
      };
    }
    return entry;
  }
}

/**
 * Log sink interface
 */
export interface LogSink {
  write(entries: LogEntry[]): Effect.Effect<void, Error, never>;
  close(): Effect.Effect<void, never, never>;
}

/**
 * Console log sink
 */
export class ConsoleLogSink implements LogSink {
  write(entries: LogEntry[]): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      for (const entry of entries) {
        const logLine = this.formatEntry(entry);
        console.log(logLine);
      }
    });
  }

  close(): Effect.Effect<void, never, never> {
    return Effect.void;
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const service = `[${entry.service}]`;
    const trace = entry.traceId ? `trace=${entry.traceId.slice(0, 8)}` : '';
    const correlation = entry.correlationId ? `corr=${entry.correlationId.slice(0, 8)}` : '';
    const context = [trace, correlation].filter(Boolean).join(' ');
    
    return `${timestamp} ${level} ${service} ${context ? `{${context}}` : ''} ${entry.message}`;
  }
}

/**
 * File log sink
 */
export class FileLogSink implements LogSink {
  private writeStream?: any; // Would use fs.WriteStream in production

  constructor(
    private readonly filePath: string,
    private readonly maxFileSize: number = 100 * 1024 * 1024, // 100MB
    private readonly maxFiles: number = 10
  ) {}

  write(entries: LogEntry[]): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // In production, would implement actual file writing with rotation
      const lines = entries.map(entry => JSON.stringify(entry));
      const content = lines.join('\n') + '\n';
      
      console.log(`Writing ${entries.length} log entries to ${this.filePath}`);
      // fs.appendFileSync(this.filePath, content);
    });
  }

  close(): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      if (this.writeStream) {
        // this.writeStream.end();
      }
    });
  }
}

/**
 * Elasticsearch log sink
 */
export class ElasticsearchLogSink implements LogSink {
  constructor(
    private readonly config: {
      endpoint: string;
      apiKey?: string;
      index: string;
      batchSize: number;
    }
  ) {}

  write(entries: LogEntry[]): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // Batch entries
      const batches = this.createBatches(entries, this.config.batchSize);
      
      for (const batch of batches) {
        yield* _(this.sendBatch(batch));
      }
    });
  }

  close(): Effect.Effect<void, never, never> {
    return Effect.void;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private sendBatch(entries: LogEntry[]): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // Create Elasticsearch bulk request
      const bulkBody = entries.flatMap(entry => [
        { 
          index: { 
            _index: `${this.config.index}-${this.getDateSuffix(entry.timestamp)}`,
            _type: '_doc',
          }
        },
        this.transformForElasticsearch(entry),
      ]);

      // Send to Elasticsearch
      const response = yield* _(
        Effect.tryPromise({
          try: () => fetch(`${this.config.endpoint}/_bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.apiKey && { 'Authorization': `ApiKey ${this.config.apiKey}` }),
            },
            body: bulkBody.map(item => JSON.stringify(item)).join('\n') + '\n',
          }),
          catch: (error) => new Error(`Elasticsearch request failed: ${error}`),
        })
      );

      if (!response.ok) {
        const errorText = yield* _(
          Effect.tryPromise({
            try: () => response.text(),
            catch: () => 'Unknown error',
          })
        );
        return yield* _(Effect.fail(
          new Error(`Elasticsearch bulk insert failed: ${response.status} ${errorText}`)
        ));
      }
    });
  }

  private transformForElasticsearch(entry: LogEntry): any {
    return {
      '@timestamp': entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      service: {
        name: entry.service,
        version: entry.version,
        environment: entry.environment,
      },
      trace: {
        id: entry.traceId,
        span_id: entry.spanId,
      },
      correlation_id: entry.correlationId,
      causation_id: entry.causationId,
      user: {
        id: entry.userId,
        session_id: entry.sessionId,
      },
      cqrs: {
        aggregate_id: entry.aggregateId,
        aggregate_type: entry.aggregateType,
        event_type: entry.eventType,
        command_type: entry.commandType,
        query_type: entry.queryType,
      },
      error: entry.error,
      metadata: entry.metadata,
      labels: entry.labels,
    };
  }

  private getDateSuffix(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Log aggregator
 */
export class LogAggregator {
  private buffer: LogBuffer;
  private enricher: LogEnricher;
  private sinks: LogSink[] = [];
  private processingFiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();
  private logQueue: Queue.Queue<LogEntry>;

  constructor(
    private readonly config: {
      bufferSize: number;
      flushInterval: Duration.Duration;
      enrichment: boolean;
    }
  ) {
    this.buffer = new LogBuffer(config.bufferSize, config.flushInterval);
    this.enricher = config.enrichment ? LogEnricher.createDefault() : new LogEnricher();
    this.logQueue = Queue.unbounded<LogEntry>();
  }

  /**
   * Add log sink
   */
  addSink(sink: LogSink): this {
    this.sinks.push(sink);
    return this;
  }

  /**
   * Start log processing
   */
  start(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const fiber = yield* _(
        pipe(
          this.processLoop(),
          Effect.fork
        )
      );
      this.processingFiber = Option.some(fiber);
    });
  }

  /**
   * Stop log processing
   */
  stop(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      if (Option.isSome(this.processingFiber)) {
        yield* _(Fiber.interrupt(this.processingFiber.value));
      }

      // Flush remaining logs
      yield* _(this.flush());

      // Close all sinks
      for (const sink of this.sinks) {
        yield* _(sink.close());
      }
    });
  }

  /**
   * Log entry
   */
  log(entry: LogEntry): Effect.Effect<void, never, never> {
    return Queue.offer(this.logQueue, entry);
  }

  /**
   * Processing loop
   */
  private processLoop(): Effect.Effect<never, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        // Collect log entries
        const entries = yield* _(this.collectEntries());
        
        if (entries.length > 0) {
          // Enrich entries
          const enrichedEntries = entries.map(entry => this.enricher.enrich(entry));
          
          // Send to all sinks
          for (const sink of this.sinks) {
            try {
              yield* _(sink.write(enrichedEntries));
            } catch (error) {
              console.error('Log sink error:', error);
            }
          }
        }

        yield* _(Effect.sleep(Duration.millis(100)));
      })
    );
  }

  /**
   * Collect log entries from queue
   */
  private collectEntries(): Effect.Effect<LogEntry[], never, never> {
    return Effect.gen(function* (_) {
      const entries: LogEntry[] = [];
      let shouldFlush = false;

      // Collect entries until buffer is full or should flush
      while (!shouldFlush && entries.length < this.config.bufferSize) {
        const entry = yield* _(
          pipe(
            Queue.poll(this.logQueue),
            Effect.timeout(Duration.millis(10))
          )
        );

        if (Option.isSome(entry)) {
          shouldFlush = this.buffer.add(entry.value);
          entries.push(entry.value);
        } else {
          break;
        }
      }

      // Check if we should flush based on time
      if (this.buffer.shouldFlush()) {
        const bufferedEntries = this.buffer.flush();
        return [...entries, ...bufferedEntries];
      }

      if (shouldFlush) {
        return this.buffer.flush();
      }

      return entries;
    });
  }

  /**
   * Force flush
   */
  private flush(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const entries = this.buffer.flush();
      if (entries.length > 0) {
        for (const sink of this.sinks) {
          yield* _(sink.write(entries));
        }
      }
    });
  }
}

/**
 * Log search engine
 */
export class LogSearchEngine {
  private logs: LogEntry[] = [];

  /**
   * Index log entry
   */
  index(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only recent logs in memory
    if (this.logs.length > 100000) {
      this.logs.splice(0, this.logs.length - 50000);
    }
  }

  /**
   * Search logs
   */
  search(query: LogQuery): LogEntry[] {
    let results = [...this.logs];

    // Filter by level
    if (query.levels && query.levels.length > 0) {
      results = results.filter(entry => query.levels!.includes(entry.level));
    }

    // Filter by service
    if (query.services && query.services.length > 0) {
      results = results.filter(entry => query.services!.includes(entry.service));
    }

    // Filter by time range
    if (query.timeRange) {
      results = results.filter(entry => 
        entry.timestamp >= query.timeRange!.from && 
        entry.timestamp <= query.timeRange!.to
      );
    }

    // Filter by trace ID
    if (query.traceId) {
      results = results.filter(entry => entry.traceId === query.traceId);
    }

    // Filter by correlation ID
    if (query.correlationId) {
      results = results.filter(entry => entry.correlationId === query.correlationId);
    }

    // Filter by aggregate ID
    if (query.aggregateId) {
      results = results.filter(entry => entry.aggregateId === query.aggregateId);
    }

    // Search term
    if (query.searchTerm) {
      const searchTerm = query.searchTerm.toLowerCase();
      results = results.filter(entry => 
        entry.message.toLowerCase().includes(searchTerm) ||
        JSON.stringify(entry.metadata || {}).toLowerCase().includes(searchTerm)
      );
    }

    // Apply custom filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (Array.isArray(value)) {
          results = results.filter(entry => {
            const entryValue = this.getNestedValue(entry, key);
            return value.includes(entryValue);
          });
        } else {
          results = results.filter(entry => {
            const entryValue = this.getNestedValue(entry, key);
            return entryValue === value;
          });
        }
      }
    }

    // Sort
    results.sort((a, b) => {
      if (query.sortOrder === 'asc') {
        return a.timestamp.getTime() - b.timestamp.getTime();
      } else {
        return b.timestamp.getTime() - a.timestamp.getTime();
      }
    });

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 1000;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get value from nested object path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get log statistics
   */
  getStatistics(query?: LogQuery): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByService: Record<string, number>;
    recentErrors: LogEntry[];
    topErrorTypes: Array<{ error: string; count: number }>;
  } {
    const logs = query ? this.search(query) : this.logs;

    const logsByLevel: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };

    const logsByService: Record<string, number> = {};
    const errorTypes: Record<string, number> = {};

    for (const log of logs) {
      logsByLevel[log.level]++;
      
      logsByService[log.service] = (logsByService[log.service] || 0) + 1;
      
      if (log.level === LogLevel.ERROR && log.error) {
        const errorKey = `${log.error.name}: ${log.error.message}`;
        errorTypes[errorKey] = (errorTypes[errorKey] || 0) + 1;
      }
    }

    const recentErrors = logs
      .filter(log => log.level === LogLevel.ERROR)
      .slice(0, 10);

    const topErrorTypes = Object.entries(errorTypes)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      logsByLevel,
      logsByService,
      recentErrors,
      topErrorTypes,
    };
  }
}

/**
 * CQRS structured logger
 */
export class CQRSLogger {
  constructor(
    private readonly aggregator: LogAggregator,
    private readonly context: {
      service: string;
      version: string;
      environment: string;
    }
  ) {}

  /**
   * Log with level
   */
  private log(level: LogLevel, message: string, metadata?: any): Effect.Effect<void, never, never> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      service: this.context.service,
      version: this.context.version,
      environment: this.context.environment,
      metadata,
    };

    return this.aggregator.log(entry);
  }

  /**
   * Trace level
   */
  trace(message: string, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.TRACE, message, metadata);
  }

  /**
   * Debug level
   */
  debug(message: string, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Info level
   */
  info(message: string, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Warning level
   */
  warn(message: string, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Error level
   */
  error(message: string, error?: Error, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.ERROR, message, { ...metadata, error });
  }

  /**
   * Fatal level
   */
  fatal(message: string, error?: Error, metadata?: any): Effect.Effect<void, never, never> {
    return this.log(LogLevel.FATAL, message, { ...metadata, error });
  }

  /**
   * Log command processing
   */
  logCommandProcessing(
    commandType: string,
    commandId: string,
    aggregateId: string,
    metadata?: any
  ): Effect.Effect<void, never, never> {
    return this.info(`Processing command: ${commandType}`, {
      commandType,
      commandId,
      aggregateId,
      ...metadata,
    });
  }

  /**
   * Log event processing
   */
  logEventProcessing(
    eventType: string,
    eventId: string,
    aggregateId: string,
    metadata?: any
  ): Effect.Effect<void, never, never> {
    return this.info(`Processing event: ${eventType}`, {
      eventType,
      eventId,
      aggregateId,
      ...metadata,
    });
  }

  /**
   * Log query execution
   */
  logQueryExecution(
    queryType: string,
    queryId: string,
    metadata?: any
  ): Effect.Effect<void, never, never> {
    return this.info(`Executing query: ${queryType}`, {
      queryType,
      queryId,
      ...metadata,
    });
  }
}

/**
 * Log aggregation service
 */
export interface LogAggregationService {
  readonly _tag: 'LogAggregationService';
  readonly aggregator: LogAggregator;
  readonly searchEngine: LogSearchEngine;
  readonly logger: CQRSLogger;
  readonly search: (query: LogQuery) => LogEntry[];
  readonly getStatistics: (query?: LogQuery) => ReturnType<LogSearchEngine['getStatistics']>;
}

export const LogAggregationService = Context.GenericTag<LogAggregationService>('LogAggregationService');

/**
 * Log aggregation layer
 */
export const LogAggregationLive = (config: {
  service: string;
  version: string;
  environment: string;
  sinks: LogSinkConfig[];
  bufferSize?: number;
  flushInterval?: Duration.Duration;
  enableEnrichment?: boolean;
}) =>
  Layer.effect(
    LogAggregationService,
    Effect.gen(function* (_) {
      const aggregator = new LogAggregator({
        bufferSize: config.bufferSize ?? 1000,
        flushInterval: config.flushInterval ?? Duration.seconds(30),
        enrichment: config.enableEnrichment ?? true,
      });

      // Add configured sinks
      for (const sinkConfig of config.sinks) {
        let sink: LogSink;
        
        switch (sinkConfig.type) {
          case 'console':
            sink = new ConsoleLogSink();
            break;
          case 'file':
            sink = new FileLogSink(sinkConfig.endpoint || '/var/log/app.log');
            break;
          case 'elasticsearch':
            sink = new ElasticsearchLogSink({
              endpoint: sinkConfig.endpoint!,
              apiKey: sinkConfig.apiKey,
              index: sinkConfig.index || 'logs',
              batchSize: sinkConfig.batchSize || 100,
            });
            break;
          default:
            sink = new ConsoleLogSink();
        }
        
        aggregator.addSink(sink);
      }

      const searchEngine = new LogSearchEngine();
      const logger = new CQRSLogger(aggregator, {
        service: config.service,
        version: config.version,
        environment: config.environment,
      });

      // Start aggregator
      yield* _(aggregator.start());

      return {
        _tag: 'LogAggregationService',
        aggregator,
        searchEngine,
        logger,
        search: (query: LogQuery) => searchEngine.search(query),
        getStatistics: (query?: LogQuery) => searchEngine.getStatistics(query),
      };
    })
  );