import type { Command, Event, IAggregate } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Command execution context
export interface CommandContext<TCommand extends Command = Command, TEvent extends Event = Event> {
  readonly command: TCommand;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata?: Record<string, unknown>;
}

// Command middleware interface
export interface CommandMiddleware<TCommand extends Command = Command, TEvent extends Event = Event> {
  readonly name: string;
  readonly priority?: number;
  
  execute<TState, TAggregate extends IAggregate<TState, TEvent>>(
    context: CommandContext<TCommand, TEvent>,
    aggregate: TAggregate,
    next: () => Promise<Result<TEvent[], CommandMiddlewareError>>
  ): Promise<Result<TEvent[], CommandMiddlewareError>>;
}

// Command pipeline for executing commands with middleware
export class CommandPipeline<TCommand extends Command = Command, TEvent extends Event = Event> {
  private readonly middleware: CommandMiddleware<TCommand, TEvent>[] = [];

  // Add middleware to the pipeline
  use(middleware: CommandMiddleware<TCommand, TEvent>): this {
    this.middleware.push(middleware);
    // Sort by priority (higher first)
    this.middleware.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Execute command through middleware pipeline
  async execute<TState, TAggregate extends IAggregate<TState, TEvent>>(
    command: TCommand,
    aggregate: TAggregate,
    handler: <TState, TAggregate extends IAggregate<TState, TEvent>>(command: TCommand, aggregate: TAggregate) => Promise<Result<TEvent[], CommandMiddlewareError>>,
    options?: {
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Result<TEvent[], CommandMiddlewareError>> {
    const baseContext = {
      command,
      timestamp: new Date(),
    };
    
    const context: CommandContext<TCommand, TEvent> = {
      ...baseContext,
      ...(options?.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
      ...(options?.causationId !== undefined ? { causationId: options.causationId } : {}),
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
    };

    let index = 0;

    const executeNext = async (): Promise<Result<TEvent[], CommandMiddlewareError>> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          return await middleware.execute(context, aggregate, executeNext);
        }
      }

      // Execute the actual command handler
      return await handler(command, aggregate);
    };

    return await executeNext();
  }

  // Get middleware statistics
  getStatistics(): CommandPipelineStatistics {
    return {
      middlewareCount: this.middleware.length,
      middlewareNames: this.middleware.map(m => m.name),
      priorityOrder: this.middleware.map(m => ({ name: m.name, priority: m.priority ?? 0 })),
    };
  }
}

// Built-in middleware implementations

// Logging middleware
export class CommandLoggingMiddleware<TCommand extends Command, TEvent extends Event> 
  implements CommandMiddleware<TCommand, TEvent> {
  readonly name = 'logging';
  readonly priority = 100;

  constructor(
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  async execute<TState, TAggregate extends IAggregate<TState, TEvent>>(
    context: CommandContext<TCommand, TEvent>,
    aggregate: TAggregate,
    next: () => Promise<Result<TEvent[], CommandMiddlewareError>>
  ): Promise<Result<TEvent[], CommandMiddlewareError>> {
    const startTime = Date.now();
    
    this.logger.info('Executing command', {
      commandType: context.command.type,
      aggregateId: context.command.aggregateId,
      correlationId: context.correlationId,
    });

    const result = await next();
    const duration = Date.now() - startTime;

    if (result.success) {
      this.logger.info('Command executed successfully', {
        commandType: context.command.type,
        aggregateId: context.command.aggregateId,
        eventCount: result.value.length,
        duration,
      });
    } else {
      this.logger.error('Command execution failed', {
        commandType: context.command.type,
        aggregateId: context.command.aggregateId,
        error: result.error.message,
        duration,
      });
    }

    return result;
  }
}

// Validation middleware
export class CommandValidationMiddleware<TCommand extends Command, TEvent extends Event> 
  implements CommandMiddleware<TCommand, TEvent> {
  readonly name = 'validation';
  readonly priority = 200;

  constructor(
    private readonly validators: Map<string, (command: TCommand) => Promise<ValidationResult>>
  ) {}

  async execute<TState, TAggregate extends IAggregate<TState, TEvent>>(
    context: CommandContext<TCommand, TEvent>,
    aggregate: TAggregate,
    next: () => Promise<Result<TEvent[], CommandMiddlewareError>>
  ): Promise<Result<TEvent[], CommandMiddlewareError>> {
    const validator = this.validators.get(context.command.type);
    
    if (validator) {
      const validationResult = await validator(context.command);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: new CommandMiddlewareError(
            `Command validation failed: ${validationResult.errors.join(', ')}`,
            'VALIDATION_FAILED',
            context.command.type,
            { validationErrors: validationResult.errors }
          ),
        };
      }
    }

    return await next();
  }

  // Add validator for command type
  addValidator(
    commandType: string, 
    validator: (command: TCommand) => Promise<ValidationResult>
  ): this {
    this.validators.set(commandType, validator);
    return this;
  }
}

// Performance monitoring middleware
export class CommandPerformanceMiddleware<TCommand extends Command, TEvent extends Event> 
  implements CommandMiddleware<TCommand, TEvent> {
  readonly name = 'performance';
  readonly priority = 50;

  private readonly metrics = new Map<string, PerformanceMetrics>();

  async execute<TState, TAggregate extends IAggregate<TState, TEvent>>(
    context: CommandContext<TCommand, TEvent>,
    aggregate: TAggregate,
    next: () => Promise<Result<TEvent[], CommandMiddlewareError>>
  ): Promise<Result<TEvent[], CommandMiddlewareError>> {
    const startTime = Date.now();
    const commandType = context.command.type;

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      this.updateMetrics(commandType, duration, result.success);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(commandType, duration, false);
      throw error;
    }
  }

  // Get performance metrics for command type
  getMetrics(commandType?: string): Map<string, PerformanceMetrics> | PerformanceMetrics | undefined {
    if (commandType) {
      return this.metrics.get(commandType);
    }
    return this.metrics;
  }

  // Clear metrics
  clearMetrics(commandType?: string): void {
    if (commandType) {
      this.metrics.delete(commandType);
    } else {
      this.metrics.clear();
    }
  }

  private updateMetrics(commandType: string, duration: number, success: boolean): void {
    const existing = this.metrics.get(commandType) ?? {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      totalDuration: 0,
    };

    existing.totalExecutions++;
    if (success) {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
    }

    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalExecutions;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);

    this.metrics.set(commandType, existing);
  }
}

// Type definitions and interfaces

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
}

export interface PerformanceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
}

export interface CommandPipelineStatistics {
  readonly middlewareCount: number;
  readonly middlewareNames: string[];
  readonly priorityOrder: Array<{ name: string; priority: number }>;
}

// Command middleware-specific error class
export class CommandMiddlewareError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'COMMAND_MIDDLEWARE' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: CommandMiddlewareErrorCode,
    public readonly commandType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CommandMiddlewareError';
    this.code = code as ErrorCode;
  }
}

export type CommandMiddlewareErrorCode =
  | 'VALIDATION_FAILED'
  | 'MIDDLEWARE_EXECUTION_FAILED'
  | 'PIPELINE_EXECUTION_FAILED';