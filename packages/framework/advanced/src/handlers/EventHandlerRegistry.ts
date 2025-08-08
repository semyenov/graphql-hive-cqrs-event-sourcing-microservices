import type { Event } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Generic event handler interface
export interface EventHandler<TEvent extends Event = Event> {
  readonly eventType: string;
  readonly priority?: number;
  handle(event: TEvent): Promise<Result<void, EventHandlerError>>;
}

// Event handler with retry capabilities
export interface RetryableEventHandler<TEvent extends Event = Event> extends EventHandler<TEvent> {
  readonly maxRetries: number;
  readonly retryDelay: number;
  canRetry(error: EventHandlerError, attempt: number): boolean;
}

// Event handler middleware interface
export interface EventHandlerMiddleware {
  readonly name: string;
  readonly priority: number;
  execute<TEvent extends Event>(
    event: TEvent,
    next: (event: TEvent) => Promise<Result<void, EventHandlerError>>
  ): Promise<Result<void, EventHandlerError>>;
}

// Event handler registry
export class EventHandlerRegistry {
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly middleware: EventHandlerMiddleware[] = [];
  private readonly metrics = new Map<string, HandlerMetrics>();

  // Register event handler
  register<TEvent extends Event>(handler: EventHandler<TEvent>): void {
    const eventType = handler.eventType;
    const existingHandlers = this.handlers.get(eventType) ?? [];
    
    // Sort by priority (higher priority first)
    const sortedHandlers = [...existingHandlers, handler]
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    this.handlers.set(eventType, sortedHandlers);
    
    // Initialize metrics
    if (!this.metrics.has(eventType)) {
      this.metrics.set(eventType, {
        eventType,
        totalProcessed: 0,
        totalFailed: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
      });
    }
  }

  // Register middleware
  registerMiddleware(middleware: EventHandlerMiddleware): void {
    this.middleware.push(middleware);
    // Sort middleware by priority
    this.middleware.sort((a, b) => b.priority - a.priority);
  }

  // Handle event with all registered handlers
  async handle<TEvent extends Event>(event: TEvent): Promise<Result<void, EventHandlerError>> {
    const handlers = this.handlers.get(event.type) ?? [];
    
    if (handlers.length === 0) {
      return {
        success: true,
        value: undefined,
      };
    }

    const startTime = Date.now();
    const results: Array<Result<void, EventHandlerError>> = [];

    // Process handlers in parallel by default (can be configured)
    const handlerPromises = handlers.map(async (handler) => {
      try {
        return await this.executeHandlerWithMiddleware(event, handler);
      } catch (error) {
        return {
          success: false,
          error: new EventHandlerError(
            `Handler execution failed: ${error}`,
            'HANDLER_EXECUTION_FAILED',
            handler.eventType
          ),
        } as Result<void, EventHandlerError>;
      }
    });

    const handlerResults = await Promise.allSettled(handlerPromises);
    
    // Collect results and handle failures
    const failures: EventHandlerError[] = [];
    for (const result of handlerResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (!result.value.success) {
          failures.push(result.value.error);
        }
      } else {
        failures.push(new EventHandlerError(
          `Handler promise rejected: ${result.reason}`,
          'HANDLER_PROMISE_REJECTED',
          event.type
        ));
      }
    }

    // Update metrics
    this.updateMetrics(event.type, Date.now() - startTime, failures.length === 0);

    // Return aggregated result
    if (failures.length > 0) {
      return {
        success: false,
        error: new EventHandlerError(
          `${failures.length} handler(s) failed`,
          'MULTIPLE_HANDLER_FAILURES',
          event.type,
          { failures }
        ),
      };
    }

    return {
      success: true,
      value: undefined,
    };
  }

  // Execute handler with middleware chain
  private async executeHandlerWithMiddleware<TEvent extends Event>(
    event: TEvent,
    handler: EventHandler<TEvent>
  ): Promise<Result<void, EventHandlerError>> {
    let index = 0;

    const executeNext = async (currentEvent: TEvent): Promise<Result<void, EventHandlerError>> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          return await middleware.execute(currentEvent, executeNext);
        }
      }
      
      // Execute the actual handler
      if (this.isRetryableHandler(handler)) {
        return await this.executeWithRetry(currentEvent, handler);
      }
      
      return await handler.handle(currentEvent);
    };

    return await executeNext(event);
  }

  // Execute handler with retry logic
  private async executeWithRetry<TEvent extends Event>(
    event: TEvent,
    handler: RetryableEventHandler<TEvent>
  ): Promise<Result<void, EventHandlerError>> {
    let attempt = 1;
    let lastError: EventHandlerError | null = null;

    while (attempt <= handler.maxRetries + 1) {
      const result = await handler.handle(event);
      
      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Check if we should retry
      if (attempt <= handler.maxRetries && handler.canRetry(result.error, attempt)) {
        await this.delay(handler.retryDelay * attempt);
        attempt++;
        continue;
      }

      break;
    }

    return {
      success: false,
      error: lastError ?? new EventHandlerError(
        'Retry execution failed',
        'RETRY_FAILED',
        handler.eventType
      ),
    };
  }

  // Get handlers for event type
  getHandlers(eventType: string): readonly EventHandler[] {
    return this.handlers.get(eventType) ?? [];
  }

  // Get all registered event types
  getRegisteredEventTypes(): readonly string[] {
    return Array.from(this.handlers.keys());
  }

  // Get metrics for event type
  getMetrics(eventType?: string): HandlerMetrics | Map<string, HandlerMetrics> {
    if (eventType) {
      return this.metrics.get(eventType) ?? {
        eventType,
        totalProcessed: 0,
        totalFailed: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
      };
    }
    
    return new Map(this.metrics);
  }

  // Clear all handlers and metrics
  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
    this.metrics.clear();
  }

  // Private helper methods
  private isRetryableHandler<TEvent extends Event>(
    handler: EventHandler<TEvent>
  ): handler is RetryableEventHandler<TEvent> {
    return 'maxRetries' in handler && 'retryDelay' in handler && 'canRetry' in handler;
  }

  private updateMetrics(eventType: string, processingTime: number, success: boolean): void {
    const metrics = this.metrics.get(eventType);
    if (!metrics) return;

    const newTotalProcessed = metrics.totalProcessed + 1;
    const newTotalFailed = success ? metrics.totalFailed : metrics.totalFailed + 1;
    
    // Calculate new average processing time
    const newAverageTime = (
      (metrics.averageProcessingTime * metrics.totalProcessed) + processingTime
    ) / newTotalProcessed;

    this.metrics.set(eventType, {
      ...metrics,
      totalProcessed: newTotalProcessed,
      totalFailed: newTotalFailed,
      averageProcessingTime: newAverageTime,
      lastProcessedAt: new Date(),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Event handler error class
export class EventHandlerError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'EVENT_HANDLER' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: EventHandlerErrorCode,
    public readonly eventType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EventHandlerError';
    this.code = code as ErrorCode;
  }
}

// Event handler error codes
export type EventHandlerErrorCode =
  | 'HANDLER_EXECUTION_FAILED'
  | 'HANDLER_PROMISE_REJECTED'
  | 'MULTIPLE_HANDLER_FAILURES'
  | 'RETRY_FAILED'
  | 'MIDDLEWARE_FAILED';

// Handler metrics interface
export interface HandlerMetrics {
  readonly eventType: string;
  readonly totalProcessed: number;
  readonly totalFailed: number;
  readonly averageProcessingTime: number;
  readonly lastProcessedAt: Date | null;
}

// Built-in middleware implementations

// Logging middleware
export class LoggingMiddleware implements EventHandlerMiddleware {
  readonly name = 'logging';
  readonly priority = 100;

  constructor(
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  async execute<TEvent extends Event>(
    event: TEvent,
    next: (event: TEvent) => Promise<Result<void, EventHandlerError>>
  ): Promise<Result<void, EventHandlerError>> {
    const startTime = Date.now();
    
    this.logger.info('Processing event', {
      eventType: event.type,
      eventId: event.id,
      aggregateId: event.aggregateId,
    });

    const result = await next(event);
    const duration = Date.now() - startTime;

    if (result.success) {
      this.logger.info('Event processed successfully', {
        eventType: event.type,
        eventId: event.id,
        duration,
      });
    } else {
      this.logger.error('Event processing failed', {
        eventType: event.type,
        eventId: event.id,
        duration,
        error: result.error.message,
      });
    }

    return result;
  }
}

// Metrics collection middleware
export class MetricsMiddleware implements EventHandlerMiddleware {
  readonly name = 'metrics';
  readonly priority = 200;

  constructor(
    private readonly metricsCollector: {
      increment: (metric: string, tags?: Record<string, string>) => void;
      timing: (metric: string, value: number, tags?: Record<string, string>) => void;
    }
  ) {}

  async execute<TEvent extends Event>(
    event: TEvent,
    next: (event: TEvent) => Promise<Result<void, EventHandlerError>>
  ): Promise<Result<void, EventHandlerError>> {
    const startTime = Date.now();
    const tags = { eventType: event.type };

    this.metricsCollector.increment('event_handler.started', tags);

    const result = await next(event);
    const duration = Date.now() - startTime;

    this.metricsCollector.timing('event_handler.duration', duration, tags);

    if (result.success) {
      this.metricsCollector.increment('event_handler.success', tags);
    } else {
      this.metricsCollector.increment('event_handler.error', tags);
    }

    return result;
  }
}

// Global registry instance
export const eventHandlerRegistry = new EventHandlerRegistry();