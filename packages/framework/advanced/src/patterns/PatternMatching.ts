import type { Event } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Advanced pattern matching for events
export interface EventPattern<TEvent extends Event, TResult> {
  readonly [eventType: string]: (event: TEvent) => TResult;
}

// Conditional pattern matching
export interface ConditionalPattern<TEvent extends Event, TResult> {
  readonly condition: (event: TEvent) => boolean;
  readonly handler: (event: TEvent) => TResult;
}

// Pattern matcher with advanced features
export class EventPatternMatcher<TEvent extends Event = Event> {
  private readonly patterns = new Map<string, (event: TEvent) => unknown>();
  private readonly conditionalPatterns: ConditionalPattern<TEvent, unknown>[] = [];
  private readonly middleware: PatternMiddleware<TEvent>[] = [];
  private fallbackHandler?: (event: TEvent) => unknown;

  // Register pattern for specific event type
  on<TResult>(
    eventType: string,
    handler: (event: Extract<TEvent, { type: typeof eventType }>) => TResult
  ): this {
    this.patterns.set(eventType, handler as (event: TEvent) => unknown);
    return this;
  }

  // Register conditional pattern
  when<TResult>(
    condition: (event: TEvent) => boolean,
    handler: (event: TEvent) => TResult
  ): this {
    this.conditionalPatterns.push({
      condition,
      handler: handler as (event: TEvent) => unknown,
    });
    return this;
  }

  // Register fallback handler
  otherwise<TResult>(handler: (event: TEvent) => TResult): this {
    this.fallbackHandler = handler as (event: TEvent) => unknown;
    return this;
  }

  // Add middleware
  use(middleware: PatternMiddleware<TEvent>): this {
    this.middleware.push(middleware);
    // Sort by priority (higher first)
    this.middleware.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Match single event
  match<TResult = unknown>(event: TEvent): Result<TResult, PatternMatchError> {
    try {
      return this.executeWithMiddleware(event, (processedEvent) => {
        // Try exact type match first
        const handler = this.patterns.get(processedEvent.type);
        if (handler) {
          return handler(processedEvent) as TResult;
        }

        // Try conditional patterns
        for (const pattern of this.conditionalPatterns) {
          if (pattern.condition(processedEvent)) {
            return pattern.handler(processedEvent) as TResult;
          }
        }

        // Use fallback if available
        if (this.fallbackHandler) {
          return this.fallbackHandler(processedEvent) as TResult;
        }

        throw new PatternMatchError(
          `No pattern matched for event type: ${processedEvent.type}`,
          'NO_PATTERN_MATCHED',
          processedEvent.type
        );
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof PatternMatchError 
          ? error 
          : new PatternMatchError(
              `Pattern matching failed: ${error}`,
              'PATTERN_EXECUTION_FAILED',
              event.type
            ),
      };
    }
  }

  // Match multiple events
  matchAll<TResult = unknown>(events: TEvent[]): Result<TResult[], PatternMatchError> {
    const results: TResult[] = [];
    const errors: PatternMatchError[] = [];

    for (const event of events) {
      const result = this.match<TResult>(event);
      if (result.success) {
        results.push(result.value);
      } else {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: new PatternMatchError(
          `${errors.length} events failed to match`,
          'BATCH_PATTERN_MATCH_FAILED',
          undefined,
          { errors }
        ),
      };
    }

    return {
      success: true,
      value: results,
    };
  }

  // Create specialized matcher for event category
  forCategory(
    category: string,
    predicate: (event: TEvent) => boolean = (e) => e.type.includes(category)
  ): EventPatternMatcher<TEvent> {
    const categoryMatcher = new EventPatternMatcher<TEvent>();
    
    // Copy middleware
    for (const middleware of this.middleware) {
      categoryMatcher.use(middleware);
    }
    
    // Add category filter
    categoryMatcher.when(predicate, (event) => {
      const result = this.match(event);
      if (result.success) {
        return result.value;
      }
      throw result.error;
    });

    return categoryMatcher;
  }

  // Get pattern statistics
  getStatistics(): PatternStatistics {
    return {
      explicitPatterns: this.patterns.size,
      conditionalPatterns: this.conditionalPatterns.length,
      middlewareCount: this.middleware.length,
      hasFallback: !!this.fallbackHandler,
    };
  }

  // Clear all patterns
  clear(): void {
    this.patterns.clear();
    this.conditionalPatterns.length = 0;
    this.middleware.length = 0;
    delete this.fallbackHandler;
  }

  // Private helper methods
  private executeWithMiddleware<TResult>(
    event: TEvent,
    handler: (event: TEvent) => TResult
  ): Result<TResult, PatternMatchError> {
    let index = 0;

    const executeNext = (currentEvent: TEvent): TResult => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          return middleware.execute(currentEvent, executeNext);
        }
      }
      
      return handler(currentEvent);
    };

    try {
      const result = executeNext(event);
      return {
        success: true,
        value: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof PatternMatchError 
          ? error 
          : new PatternMatchError(
              `Middleware execution failed: ${error}`,
              'MIDDLEWARE_FAILED',
              event.type
            ),
      };
    }
  }
}

// Pattern matching middleware interface
export interface PatternMiddleware<TEvent extends Event> {
  readonly name: string;
  readonly priority?: number;
  execute<TResult>(
    event: TEvent,
    next: (event: TEvent) => TResult
  ): TResult;
}

// Built-in middleware implementations

// Logging middleware
export class LoggingPatternMiddleware<TEvent extends Event> implements PatternMiddleware<TEvent> {
  readonly name = 'logging';
  readonly priority = 100;

  constructor(
    private readonly logger: {
      debug: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  execute<TResult>(
    event: TEvent,
    next: (event: TEvent) => TResult
  ): TResult {
    this.logger.debug('Pattern matching event', {
      eventType: event.type,
      eventId: event.id,
      aggregateId: event.aggregateId,
    });

    const result = next(event);

    this.logger.debug('Pattern matching completed', {
      eventType: event.type,
      eventId: event.id,
      resultType: typeof result,
    });

    return result;
  }
}

// Event transformation middleware
export class TransformationMiddleware<TEvent extends Event> implements PatternMiddleware<TEvent> {
  readonly name = 'transformation';
  readonly priority = 200;

  constructor(
    private readonly transformers: Map<string, (event: TEvent) => TEvent>
  ) {}

  execute<TResult>(
    event: TEvent,
    next: (event: TEvent) => TResult
  ): TResult {
    const transformer = this.transformers.get(event.type);
    const transformedEvent = transformer ? transformer(event) : event;
    return next(transformedEvent);
  }
}

// Caching middleware
export class CachingPatternMiddleware<TEvent extends Event> implements PatternMiddleware<TEvent> {
  readonly name = 'caching';
  readonly priority = 50;

  private readonly cache = new Map<string, { result: unknown; timestamp: number }>();

  constructor(
    private readonly ttl: number = 60000, // 1 minute
    private readonly keyGenerator: (event: TEvent) => string = (e) => `${e.type}:${e.id}`
  ) {}

  execute<TResult>(
    event: TEvent,
    next: (event: TEvent) => TResult
  ): TResult {
    const key = this.keyGenerator(event);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result as TResult;
    }

    const result = next(event);
    
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }
}

// Advanced pattern builders

// Builder for complex event patterns
export class EventPatternBuilder<TEvent extends Event> {
  private readonly matcher = new EventPatternMatcher<TEvent>();

  static create<TEvent extends Event>(): EventPatternBuilder<TEvent> {
    return new EventPatternBuilder<TEvent>();
  }

  // Add event type patterns with fluent API
  handle<TEventType extends string>(
    eventType: TEventType,
    handler: (event: TEvent) => unknown
  ): this {
    this.matcher.on(eventType, handler as (event: TEvent) => unknown);
    return this;
  }

  // Add conditional patterns
  handleWhen(
    condition: (event: TEvent) => boolean,
    handler: (event: TEvent) => unknown
  ): this {
    this.matcher.when(condition, handler);
    return this;
  }

  // Add fallback
  handleOtherwise(handler: (event: TEvent) => unknown): this {
    this.matcher.otherwise(handler);
    return this;
  }

  // Add middleware
  withMiddleware(middleware: PatternMiddleware<TEvent>): this {
    this.matcher.use(middleware);
    return this;
  }

  // Build the matcher
  build(): EventPatternMatcher<TEvent> {
    return this.matcher;
  }
}

// Utility functions for common patterns

// Create matcher for domain events
export function createDomainEventMatcher<TEvent extends Event>(): EventPatternBuilder<TEvent> {
  return EventPatternBuilder.create<TEvent>()
    .withMiddleware(new LoggingPatternMiddleware({
      debug: (message, context) => console.debug(message, context),
    }));
}

// Create matcher with caching
export function createCachedMatcher<TEvent extends Event>(
  ttl: number = 60000
): EventPatternBuilder<TEvent> {
  return EventPatternBuilder.create<TEvent>()
    .withMiddleware(new CachingPatternMiddleware(ttl));
}

// Pattern matching for event types
export function matchEventType<TEvent extends Event, TResult>(
  event: TEvent,
  patterns: EventPattern<TEvent, TResult>
): TResult {
  const handler = patterns[event.type];
  if (!handler) {
    throw new PatternMatchError(
      `No handler for event type: ${event.type}`,
      'NO_PATTERN_MATCHED',
      event.type
    );
  }
  return handler(event);
}

// Types and interfaces
export interface PatternStatistics {
  readonly explicitPatterns: number;
  readonly conditionalPatterns: number;
  readonly middlewareCount: number;
  readonly hasFallback: boolean;
}

// Error class
export class PatternMatchError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'PATTERN_MATCHING' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: PatternMatchErrorCode,
    public readonly eventType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PatternMatchError';
    this.code = code as ErrorCode;
  }
}

export type PatternMatchErrorCode =
  | 'NO_PATTERN_MATCHED'
  | 'PATTERN_EXECUTION_FAILED'
  | 'MIDDLEWARE_FAILED'
  | 'BATCH_PATTERN_MATCH_FAILED';