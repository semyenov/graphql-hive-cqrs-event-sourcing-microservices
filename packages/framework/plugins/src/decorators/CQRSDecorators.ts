import 'reflect-metadata';
import type { Command, Event, IAggregate } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Decorator metadata keys
export const COMMAND_HANDLER_METADATA = Symbol('command:handler');
export const EVENT_HANDLER_METADATA = Symbol('event:handler');
export const SAGA_METADATA = Symbol('saga:metadata');
export const AGGREGATE_METADATA = Symbol('aggregate:metadata');

// Method decorator for command handlers
export function CommandHandler(commandType: string, options?: CommandHandlerOptions): MethodDecorator {
  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metadata: CommandHandlerMetadata = {
      commandType,
      methodName: String(propertyKey),
      options: options ?? {},
    };

    // Store metadata
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, metadata, target, propertyKey!);

    // Wrap the original method with error handling and logging if enabled
    if (options?.enableLogging || options?.enableMetrics) {
      descriptor.value = async function (command: Command, ...args: unknown[]) {
        const startTime = Date.now();
        
        try {
          if (options?.enableLogging) {
            console.log(`Executing command handler for ${commandType}`, { command });
          }

          const result = await originalMethod.call(this, command, ...args);
          
          if (options?.enableMetrics) {
            const duration = Date.now() - startTime;
            recordMetric('command_handler_duration', duration, { commandType: String(commandType) });
          }

          return result;
        } catch (error) {
          if (options?.enableLogging) {
            console.error(`Command handler failed for ${commandType}`, { command, error });
          }

          if (options?.enableMetrics) {
            recordMetric('command_handler_error', 1, { commandType: String(commandType) });
          }

          throw error;
        }
      };
    }

    return descriptor;
  };
}

// Method decorator for event handlers
export function EventHandler(eventType: string, options?: EventHandlerOptions): MethodDecorator {
  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metadata: EventHandlerMetadata = {
      eventType,
      methodName: String(propertyKey),
      options: options ?? {},
    };

    // Store metadata
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, metadata, target, propertyKey!);

    // Wrap the original method if needed
    if (options?.enableLogging || options?.enableMetrics || options?.enableRetry) {
      descriptor.value = async function (event: Event, ...args: unknown[]) {
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = options?.retryOptions?.maxAttempts ?? 1;

        while (attempts < maxAttempts) {
          attempts++;
          
          try {
            if (options?.enableLogging) {
              console.log(`Processing event ${eventType} (attempt ${attempts})`, { event });
            }

            const result = await originalMethod.call(this, event, ...args);
            
            if (options?.enableMetrics) {
              const duration = Date.now() - startTime;
              recordMetric('event_handler_duration', duration, { eventType: String(eventType), attempts: String(attempts) });
            }

            return result;
          } catch (error) {
            if (attempts >= maxAttempts) {
              if (options?.enableLogging) {
                console.error(`Event handler failed for ${eventType} after ${attempts} attempts`, { event, error });
              }

              if (options?.enableMetrics) {
                recordMetric('event_handler_error', 1, { eventType: String(eventType), attempts: String(attempts) });
              }

              throw error;
            }

            // Wait before retrying if configured
            if (options?.retryOptions?.delayMs && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, options.retryOptions!.delayMs!));
            }
          }
        }
      };
    }

    return descriptor;
  };
}

// Class decorator for sagas
export function Saga(sagaName: string, options?: SagaOptions): ClassDecorator {
  return function <TConstructor extends Function>(constructor: TConstructor) {
    const metadata: SagaMetadata = {
      sagaName,
      options: options ?? {},
    };

    Reflect.defineMetadata(SAGA_METADATA, metadata, constructor);
    return constructor;
  };
}

// Class decorator for aggregates
export function AggregateRoot(aggregateName: string, options?: AggregateOptions): ClassDecorator {
  return function <TConstructor extends Function>(constructor: TConstructor) {
    const metadata: AggregateMetadata = {
      aggregateName,
      options: options ?? {},
    };

    Reflect.defineMetadata(AGGREGATE_METADATA, metadata, constructor);
    return constructor;
  };
}

// Method decorator for validation
export function Validate(validator: (input: unknown) => boolean | Promise<boolean>): MethodDecorator {
  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Validate the first argument (usually command or event)
      if (args.length > 0) {
        const isValid = await validator(args[0]);
        if (!isValid) {
          throw new ValidationDecoratorError(
            `Validation failed for method ${String(propertyKey)}`,
            'VALIDATION_FAILED',
            String(propertyKey)
          );
        }
      }

      return await originalMethod.call(this, ...args);
    };

    return descriptor;
  };
}

// Method decorator for caching
export function Cache(options: CacheOptions): MethodDecorator {
  const cache = new Map<string, CacheEntry>();

  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(...args)
        : `${String(propertyKey)}:${JSON.stringify(args)}`;

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < options.ttlMs) {
        return cached.value;
      }

      // Execute method and cache result
      const result = await originalMethod.call(this, ...args);
      cache.set(cacheKey, {
        value: result,
        timestamp: Date.now(),
      });

      // Clean expired entries if cache is getting large
      if (cache.size > 1000) {
        const now = Date.now();
        for (const [key, entry] of cache.entries()) {
          if (now - entry.timestamp >= options.ttlMs) {
            cache.delete(key);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}

// Method decorator for rate limiting
export function RateLimit(options: RateLimitOptions): MethodDecorator {
  const requests = new Map<string, number[]>();

  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Generate rate limit key
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : 'default';

      const now = Date.now();
      const windowStart = now - options.windowMs;
      
      // Get existing requests for this key
      const keyRequests = requests.get(key) ?? [];
      
      // Remove expired requests
      const validRequests = keyRequests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (validRequests.length >= options.maxRequests) {
        throw new RateLimitDecoratorError(
          `Rate limit exceeded for ${String(propertyKey)}`,
          'RATE_LIMIT_EXCEEDED',
          String(propertyKey)
        );
      }

      // Add current request
      validRequests.push(now);
      requests.set(key, validRequests);

      return await originalMethod.call(this, ...args);
    };

    return descriptor;
  };
}

// Method decorator for circuit breaker
export function CircuitBreaker(options: CircuitBreakerOptions): MethodDecorator {
  let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  let failureCount = 0;
  let lastFailureTime = 0;
  let successCount = 0;

  return function (target: object, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const now = Date.now();

      // Check if circuit should move from OPEN to HALF_OPEN
      if (state === 'OPEN' && now - lastFailureTime > options.timeoutMs) {
        state = 'HALF_OPEN';
        successCount = 0;
      }

      // Reject if circuit is OPEN
      if (state === 'OPEN') {
        throw new CircuitBreakerDecoratorError(
          `Circuit breaker is OPEN for ${String(propertyKey)}`,
          'CIRCUIT_BREAKER_OPEN',
          String(propertyKey)
        );
      }

      try {
        const result = await originalMethod.call(this, ...args);

        // Handle success
        if (state === 'HALF_OPEN') {
          successCount++;
          if (successCount >= options.successThreshold) {
            state = 'CLOSED';
            failureCount = 0;
          }
        } else if (state === 'CLOSED') {
          failureCount = 0;
        }

        return result;
      } catch (error) {
        // Handle failure
        failureCount++;
        lastFailureTime = now;

        if (state === 'HALF_OPEN' || failureCount >= options.failureThreshold) {
          state = 'OPEN';
        }

        throw error;
      }
    };

    return descriptor;
  };
}

// Utility function for recording metrics (placeholder implementation)
function recordMetric(name: string, value: number, tags: Record<string, string>): void {
  // In a real implementation, this would send metrics to your monitoring system
  console.debug(`Metric: ${name} = ${value}`, tags);
}

// Metadata reflection utilities
export class DecoratorReflection {
  static getCommandHandlerMetadata(target: object, propertyKey: string): CommandHandlerMetadata | undefined {
    return Reflect.getMetadata(COMMAND_HANDLER_METADATA, target, propertyKey);
  }

  static getEventHandlerMetadata(target: object, propertyKey: string): EventHandlerMetadata | undefined {
    return Reflect.getMetadata(EVENT_HANDLER_METADATA, target, propertyKey);
  }

  static getSagaMetadata(constructor: Function): SagaMetadata | undefined {
    return Reflect.getMetadata(SAGA_METADATA, constructor);
  }

  static getAggregateMetadata(constructor: Function): AggregateMetadata | undefined {
    return Reflect.getMetadata(AGGREGATE_METADATA, constructor);
  }

  static getAllCommandHandlers(target: object): Array<{ propertyKey: string; metadata: CommandHandlerMetadata }> {
    const result: Array<{ propertyKey: string; metadata: CommandHandlerMetadata }> = [];
    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(target));

    for (const propertyName of propertyNames) {
      const metadata = this.getCommandHandlerMetadata(target, propertyName);
      if (metadata) {
        result.push({ propertyKey: propertyName, metadata });
      }
    }

    return result;
  }

  static getAllEventHandlers(target: object): Array<{ propertyKey: string; metadata: EventHandlerMetadata }> {
    const result: Array<{ propertyKey: string; metadata: EventHandlerMetadata }> = [];
    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(target));

    for (const propertyName of propertyNames) {
      const metadata = this.getEventHandlerMetadata(target, propertyName);
      if (metadata) {
        result.push({ propertyKey: propertyName, metadata });
      }
    }

    return result;
  }
}

// Type definitions and interfaces

export interface CommandHandlerOptions {
  readonly enableLogging?: boolean;
  readonly enableMetrics?: boolean;
  readonly timeout?: number;
}

export interface EventHandlerOptions {
  readonly enableLogging?: boolean;
  readonly enableMetrics?: boolean;
  readonly enableRetry?: boolean;
  readonly retryOptions?: {
    readonly maxAttempts: number;
    readonly delayMs: number;
  };
}

export interface SagaOptions {
  readonly startingEvents?: string[];
  readonly timeout?: number;
}

export interface AggregateOptions {
  readonly snapshotFrequency?: number;
  readonly enableCaching?: boolean;
}

export interface CacheOptions {
  readonly ttlMs: number;
  readonly keyGenerator?: (...args: unknown[]) => string;
}

export interface RateLimitOptions {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly keyGenerator?: (...args: unknown[]) => string;
}

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly timeoutMs: number;
  readonly successThreshold: number;
}

export interface CommandHandlerMetadata {
  readonly commandType: string;
  readonly methodName: string;
  readonly options: CommandHandlerOptions;
}

export interface EventHandlerMetadata {
  readonly eventType: string;
  readonly methodName: string;
  readonly options: EventHandlerOptions;
}

export interface SagaMetadata {
  readonly sagaName: string;
  readonly options: SagaOptions;
}

export interface AggregateMetadata {
  readonly aggregateName: string;
  readonly options: AggregateOptions;
}

interface CacheEntry {
  readonly value: unknown;
  readonly timestamp: number;
}

// Decorator-specific error classes

export class ValidationDecoratorError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'VALIDATION' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: ValidationDecoratorErrorCode,
    public readonly methodName?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationDecoratorError';
    this.code = code as ErrorCode;
  }
}

export class RateLimitDecoratorError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'RATE_LIMIT' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: RateLimitDecoratorErrorCode,
    public readonly methodName?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RateLimitDecoratorError';
    this.code = code as ErrorCode;
  }
}

export class CircuitBreakerDecoratorError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'CIRCUIT_BREAKER' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: CircuitBreakerDecoratorErrorCode,
    public readonly methodName?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CircuitBreakerDecoratorError';
    this.code = code as ErrorCode;
  }
}

export type ValidationDecoratorErrorCode = 'VALIDATION_FAILED';
export type RateLimitDecoratorErrorCode = 'RATE_LIMIT_EXCEEDED';
export type CircuitBreakerDecoratorErrorCode = 'CIRCUIT_BREAKER_OPEN';