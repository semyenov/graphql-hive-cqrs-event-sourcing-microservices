import type { Event } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Event processing context
export interface EventContext<TEvent extends Event = Event> {
  readonly event: TEvent;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

// Event middleware interface
export interface EventMiddleware<TEvent extends Event = Event> {
  readonly name: string;
  readonly priority?: number;
  readonly eventTypes?: string[]; // Optional filter for specific event types
  
  execute(
    context: EventContext<TEvent>,
    next: () => Promise<Result<void, EventMiddlewareError>>
  ): Promise<Result<void, EventMiddlewareError>>;
}

// Event pipeline for processing events with middleware
export class EventPipeline<TEvent extends Event = Event> {
  private readonly middleware: EventMiddleware<TEvent>[] = [];

  // Add middleware to the pipeline
  use(middleware: EventMiddleware<TEvent>): this {
    this.middleware.push(middleware);
    // Sort by priority (higher first)
    this.middleware.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Process event through middleware pipeline
  async process(
    event: TEvent,
    handler: (event: TEvent) => Promise<Result<void, EventMiddlewareError>>,
    options?: {
      metadata?: Record<string, unknown>;
    }
  ): Promise<Result<void, EventMiddlewareError>> {
    const baseContext = {
      event,
      timestamp: new Date(),
    };
    
    const context: EventContext<TEvent> = {
      ...baseContext,
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
    };

    // Filter middleware for this event type
    const applicableMiddleware = this.middleware.filter(m => 
      !m.eventTypes || m.eventTypes.includes(event.type)
    );

    let index = 0;

    const executeNext = async (): Promise<Result<void, EventMiddlewareError>> => {
      if (index < applicableMiddleware.length) {
        const middleware = applicableMiddleware[index++];
        if (middleware) {
          return await middleware.execute(context, executeNext);
        }
      }

      // Execute the actual event handler
      return await handler(event);
    };

    return await executeNext();
  }

  // Process multiple events in batch
  async processBatch(
    events: TEvent[],
    handler: (event: TEvent) => Promise<Result<void, EventMiddlewareError>>,
    options?: {
      metadata?: Record<string, unknown>;
      continueOnError?: boolean;
    }
  ): Promise<Result<EventBatchResult, EventMiddlewareError>> {
    const results: Array<{ event: TEvent; success: boolean; error?: EventMiddlewareError }> = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const event of events) {
      try {
        const processOptions = options?.metadata !== undefined ? { metadata: options.metadata } : undefined;
        const result = await this.process(event, handler, processOptions);
        
        if (result.success) {
          results.push({ event, success: true });
          processedCount++;
        } else {
          results.push({ event, success: false, error: result.error });
          errorCount++;
          
          if (!options?.continueOnError) {
            break;
          }
        }
      } catch (error) {
        const middlewareError = new EventMiddlewareError(
          `Unexpected error processing event: ${error}`,
          'PROCESSING_FAILED',
          event.type
        );
        
        results.push({ event, success: false, error: middlewareError });
        errorCount++;
        
        if (!options?.continueOnError) {
          break;
        }
      }
    }

    if (errorCount > 0 && !options?.continueOnError) {
      const firstError = results.find(r => !r.success)?.error;
      return {
        success: false,
        error: firstError ?? new EventMiddlewareError(
          'Batch processing failed with unknown error',
          'BATCH_PROCESSING_FAILED'
        ),
      };
    }

    return {
      success: true,
      value: {
        processedCount,
        errorCount,
        results,
      },
    };
  }

  // Get pipeline statistics
  getStatistics(): EventPipelineStatistics {
    return {
      middlewareCount: this.middleware.length,
      middlewareNames: this.middleware.map(m => m.name),
      priorityOrder: this.middleware.map(m => ({
        name: m.name,
        priority: m.priority ?? 0,
        ...(m.eventTypes !== undefined ? { eventTypes: m.eventTypes } : {}),
      })),
    };
  }
}

// Built-in event middleware implementations

// Event logging middleware
export class EventLoggingMiddleware<TEvent extends Event> implements EventMiddleware<TEvent> {
  readonly name = 'logging';
  readonly priority = 100;

  constructor(
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  async execute(
    context: EventContext<TEvent>,
    next: () => Promise<Result<void, EventMiddlewareError>>
  ): Promise<Result<void, EventMiddlewareError>> {
    const startTime = Date.now();
    
    this.logger.info('Processing event', {
      eventType: context.event.type,
      eventId: context.event.id,
      aggregateId: context.event.aggregateId,
    });

    const result = await next();
    const duration = Date.now() - startTime;

    if (result.success) {
      this.logger.info('Event processed successfully', {
        eventType: context.event.type,
        eventId: context.event.id,
        duration,
      });
    } else {
      this.logger.error('Event processing failed', {
        eventType: context.event.type,
        eventId: context.event.id,
        error: result.error.message,
        duration,
      });
    }

    return result;
  }
}

// Event filtering middleware
export class EventFilterMiddleware<TEvent extends Event> implements EventMiddleware<TEvent> {
  readonly name = 'filter';
  readonly priority = 150;

  constructor(
    private readonly filters: Array<(event: TEvent) => boolean | Promise<boolean>>
  ) {}

  async execute(
    context: EventContext<TEvent>,
    next: () => Promise<Result<void, EventMiddlewareError>>
  ): Promise<Result<void, EventMiddlewareError>> {
    // Apply all filters
    for (const filter of this.filters) {
      const shouldProcess = await filter(context.event);
      if (!shouldProcess) {
        // Event filtered out - return success without processing
        return {
          success: true,
          value: undefined,
        };
      }
    }

    return await next();
  }

  // Add filter
  addFilter(filter: (event: TEvent) => boolean | Promise<boolean>): this {
    this.filters.push(filter);
    return this;
  }
}

// Event enrichment middleware
export class EventEnrichmentMiddleware<TEvent extends Event> implements EventMiddleware<TEvent> {
  readonly name = 'enrichment';
  readonly priority = 120;

  constructor(
    private readonly enrichers: Map<string, (event: TEvent) => Promise<Record<string, unknown>>>
  ) {}

  async execute(
    context: EventContext<TEvent>,
    next: () => Promise<Result<void, EventMiddlewareError>>
  ): Promise<Result<void, EventMiddlewareError>> {
    const enricher = this.enrichers.get(context.event.type);
    
    if (enricher) {
      try {
        const enrichmentData = await enricher(context.event);
        
        // Create enriched context
        const enrichedContext: EventContext<TEvent> = {
          ...context,
          metadata: {
            ...context.metadata,
            ...enrichmentData,
          },
        };

        // Continue with enriched context (note: this is conceptual - 
        // in real implementation you'd need to pass enriched data to handlers)
        return await next();
      } catch (error) {
        return {
          success: false,
          error: new EventMiddlewareError(
            `Event enrichment failed: ${error}`,
            'ENRICHMENT_FAILED',
            context.event.type
          ),
        };
      }
    }

    return await next();
  }

  // Add enricher for event type
  addEnricher(
    eventType: string,
    enricher: (event: TEvent) => Promise<Record<string, unknown>>
  ): this {
    this.enrichers.set(eventType, enricher);
    return this;
  }
}

// Event metrics middleware
export class EventMetricsMiddleware<TEvent extends Event> implements EventMiddleware<TEvent> {
  readonly name = 'metrics';
  readonly priority = 50;

  private readonly metrics = new Map<string, EventMetrics>();

  async execute(
    context: EventContext<TEvent>,
    next: () => Promise<Result<void, EventMiddlewareError>>
  ): Promise<Result<void, EventMiddlewareError>> {
    const startTime = Date.now();
    const eventType = context.event.type;

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      this.updateMetrics(eventType, duration, result.success);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(eventType, duration, false);
      throw error;
    }
  }

  // Get metrics for event type
  getMetrics(eventType?: string): Map<string, EventMetrics> | EventMetrics | undefined {
    if (eventType) {
      return this.metrics.get(eventType);
    }
    return this.metrics;
  }

  // Clear metrics
  clearMetrics(eventType?: string): void {
    if (eventType) {
      this.metrics.delete(eventType);
    } else {
      this.metrics.clear();
    }
  }

  private updateMetrics(eventType: string, duration: number, success: boolean): void {
    const existing = this.metrics.get(eventType) ?? {
      totalProcessed: 0,
      successfullyProcessed: 0,
      failedToProcess: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      totalDuration: 0,
      lastProcessedAt: new Date(),
    };

    existing.totalProcessed++;
    if (success) {
      existing.successfullyProcessed++;
    } else {
      existing.failedToProcess++;
    }

    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalProcessed;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.lastProcessedAt = new Date();

    this.metrics.set(eventType, existing);
  }
}

// Type definitions and interfaces

export interface EventBatchResult {
  readonly processedCount: number;
  readonly errorCount: number;
  readonly results: Array<{
    readonly event: Event;
    readonly success: boolean;
    readonly error?: EventMiddlewareError;
  }>;
}

export interface EventMetrics {
  totalProcessed: number;
  successfullyProcessed: number;
  failedToProcess: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastProcessedAt: Date;
}

export interface EventPipelineStatistics {
  readonly middlewareCount: number;
  readonly middlewareNames: string[];
  readonly priorityOrder: Array<{
    readonly name: string;
    readonly priority: number;
    readonly eventTypes?: string[];
  }>;
}

// Event middleware-specific error class
export class EventMiddlewareError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'EVENT_MIDDLEWARE' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: EventMiddlewareErrorCode,
    public readonly eventType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EventMiddlewareError';
    this.code = code as ErrorCode;
  }
}

export type EventMiddlewareErrorCode =
  | 'PROCESSING_FAILED'
  | 'ENRICHMENT_FAILED'
  | 'FILTERING_FAILED'
  | 'BATCH_PROCESSING_FAILED'
  | 'MIDDLEWARE_EXECUTION_FAILED';