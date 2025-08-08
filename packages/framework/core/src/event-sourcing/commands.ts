// Command system interfaces and types for CQRS
import type { AggregateId } from '../types/branded';
import type { Event } from './events';

// ============================================================================
// Command System with Enhanced Types
// ============================================================================

// Command type that produces events
export interface Command<
  TType extends string = string,
  TPayload = unknown,
  TEvent extends Event = Event,
  TError = Error
> {
  type: TType;
  aggregateId: AggregateId;
  payload: TPayload;
  execute(): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
  validate?(): TError | null;
  authorize?(userId: string): boolean;
}

// Command context for enhanced command execution
export interface CommandContext {
  userId?: string;
  correlationId?: string;
  causationId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

// Contextual command with execution context
export interface ContextualCommand<
  TType extends string = string,
  TPayload = unknown,
  TEvent extends Event = Event,
  TError = Error
> extends Command<TType, TPayload, TEvent, TError> {
  context: CommandContext;
}

// Command result with metadata
export interface CommandResult<TEvent extends Event = Event, TError = Error> {
  success: boolean;
  events?: TEvent[];
  error?: TError;
  metadata?: {
    executionTime: number;
    retryCount?: number;
  };
}

// Type-safe command factory
export type CommandFactory<
  TType extends string,
  TPayload,
  TEvent extends Event
> = (aggregateId: AggregateId, payload: TPayload) => Command<TType, TPayload, TEvent>;

// Command handler interface
export interface ICommandHandler<TCommand extends Command, TEvent extends Event> {
  handle(command: TCommand): TEvent | TEvent[] | Promise<TEvent | TEvent[]>;
}

// Batch command execution
export interface BatchCommandResult<TEvent extends Event = Event, TError = Error> {
  successful: CommandResult<TEvent>[];
  failed: Array<{ command: Command; error: TError }>;
  totalExecutionTime: number;
}

// Command validation result
export interface CommandValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Command validator
export type CommandValidator<TCommand extends Command> = (command: TCommand) => CommandValidationResult;

// ============================================================================
// Command Helpers
// ============================================================================

// Create a successful command result
export const commandSuccess = <TEvent extends Event>(
  events: TEvent[],
  metadata?: CommandResult['metadata']
): CommandResult<TEvent> => ({
  success: true,
  events,
  ...(metadata && { metadata }),
});

// Create a failed command result
export const commandFailure = <TError = Error>(
  error: TError,
  metadata?: CommandResult['metadata']
): CommandResult<never, TError> => ({
  success: false,
  error,
  ...(metadata && { metadata }),
});

// Execute command with timeout
export const executeWithTimeout = async <TCommand extends Command, TEvent extends Event>(
  command: TCommand,
  timeout: number = 5000
): Promise<CommandResult<TEvent>> => {
  const startTime = Date.now();
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Command execution timeout')), timeout);
    });
    
    const executionPromise = command.execute();
    const result = await Promise.race([executionPromise, timeoutPromise]);
    
    const events = Array.isArray(result) ? result : [result];
    
    return commandSuccess(events as TEvent[], {
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    return commandFailure(error as Error, {
      executionTime: Date.now() - startTime,
    });
  }
};

// Execute batch of commands
export const executeBatch = async <TCommand extends Command, TEvent extends Event>(
  commands: TCommand[],
  options?: {
    maxConcurrency?: number;
    stopOnError?: boolean;
  }
): Promise<BatchCommandResult<TEvent>> => {
  const startTime = Date.now();
  const { maxConcurrency = 10, stopOnError = false } = options || {};
  
  const successful: CommandResult<TEvent>[] = [];
  const failed: Array<{ command: Command; error: Error }> = [];
  
  // Process commands in chunks for concurrency control
  for (let i = 0; i < commands.length; i += maxConcurrency) {
    const chunk = commands.slice(i, i + maxConcurrency);
    const results = await Promise.allSettled(
      chunk.map(cmd => executeWithTimeout<TCommand, TEvent>(cmd))
    );
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const command = chunk[j];
      
      if (!result || !command) continue;
      
      if (result.status === 'fulfilled' && result.value.success) {
        successful.push(result.value);
      } else if (result.status === 'rejected') {
        const error = result.reason as Error;
        failed.push({ command, error });
        
        if (stopOnError) {
          break;
        }
      } else if (result.status === 'fulfilled' && !result.value.success) {
        const error = result.value.error || new Error('Unknown error');
        failed.push({ command, error });
        
        if (stopOnError) {
          break;
        }
      }
    }
    
    if (stopOnError && failed.length > 0) {
      break;
    }
  }
  
  return {
    successful,
    failed,
    totalExecutionTime: Date.now() - startTime,
  };
};

// ============================================================================
// Command Builder Pattern
// ============================================================================

export class CommandBuilder<
  TType extends string,
  TPayload,
  TEvent extends Event,
  TError = Error
> {
  private command: Partial<Command<TType, TPayload, TEvent, TError>> = {};
  
  type(type: TType): this {
    this.command.type = type;
    return this;
  }
  
  aggregateId(id: AggregateId): this {
    this.command.aggregateId = id;
    return this;
  }
  
  payload(payload: TPayload): this {
    this.command.payload = payload;
    return this;
  }
  
  execute(fn: () => TEvent | TEvent[] | Promise<TEvent | TEvent[]>): this {
    this.command.execute = fn;
    return this;
  }
  
  validate(fn: () => TError | null): this {
    this.command.validate = fn;
    return this;
  }
  
  authorize(fn: (userId: string) => boolean): this {
    this.command.authorize = fn;
    return this;
  }
  
  build(): Command<TType, TPayload, TEvent, TError> {
    if (!this.command.type || !this.command.aggregateId || !this.command.payload || !this.command.execute) {
      throw new Error('Command is missing required fields');
    }
    
    return this.command as Command<TType, TPayload, TEvent, TError>;
  }
}

// ============================================================================
// Template Literal Types for Command Naming
// ============================================================================

// Convert string to PascalCase
type PascalCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

// Command name builder
export type CommandName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAction>}${PascalCase<TAggregateType>}`;