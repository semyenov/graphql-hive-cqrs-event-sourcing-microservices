/**
 * Framework Infrastructure: Command Bus
 * 
 * Routes commands to their appropriate handlers.
 */

import type { CommandPattern, ICommand, 
  ICommandHandler, 
  ICommandBus, 
  ICommandResult,
  ICommandMiddleware 
} from '../../core/command';
import { CommandHandlerNotFoundError } from '../../core/errors';
import { loggers, formatDuration, sanitizeForLog } from '../../core/logger';

const logger = loggers.commandBus;

/**
 * Command bus implementation
 */
export class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler<ICommand>>();
  private middleware: ICommandMiddleware[] = [];

  /**
   * Register a command handler (cannot infer type)
   * Use registerWithType(commandType, handler) instead.
   */
  register<TCommand extends ICommand>(
    _handler: ICommandHandler<TCommand>
  ): void {
    throw new Error(
      'CommandBus.register cannot infer command type. Use registerWithType(commandType, handler) or registerCommandHandler(bus, commandType, handler).'
    );
  }

  /**
   * Register a command handler with explicit command type
   */
  registerWithType<TCommand extends ICommand>(
    commandType: TCommand['type'],
    handler: ICommandHandler<TCommand>
  ): void {
    logger.debug(`Registering command handler`, {
      commandType,
      handlerName: handler.constructor.name,
    });
    
    this.handlers.set(commandType, handler);
    
    logger.info(`Command handler registered`, {
      commandType,
      totalHandlers: this.handlers.size,
    });
  }

  /**
   * Send a command to its handler
   */
  async send<TCommand extends ICommand, TResult = ICommandResult>(
    command: TCommand
  ): Promise<TResult> {
    const startTime = Date.now();
    const handler = this.handlers.get(command.type);
    
    if (!handler) {
      const registered = Array.from(this.handlers.keys());
      logger.error(`No handler found for command`, {
        commandType: command.type,
        aggregateId: command.aggregateId,
        registeredHandlers: registered,
      });
      throw new CommandHandlerNotFoundError(command.type, registered);
    }

    if (!handler.canHandle(command)) {
      logger.error(`Handler cannot handle command`, {
        commandType: command.type,
        handlerName: handler.constructor.name,
      });
      throw new Error(`Handler cannot handle command type: ${command.type}`);
    }

    logger.debug(`Executing command`, {
      commandType: command.type,
      aggregateId: command.aggregateId,
      payload: sanitizeForLog(command.payload as Record<string, any>),
      middlewareCount: this.middleware.length,
    });

    try {
      // Execute through middleware chain
      const result = await this.executeWithMiddleware(command, async (cmd) => {
        return handler.handle(cmd) as Promise<TResult>;
      });

      logger.info(`Command executed successfully`, {
        commandType: command.type,
        aggregateId: command.aggregateId,
        duration: formatDuration(startTime),
        success: (result as any).success,
      });

      return result;
    } catch (error) {
      logger.error(`Command execution failed`, {
        commandType: command.type,
        aggregateId: command.aggregateId,
        error: error instanceof Error ? error.message : String(error),
        duration: formatDuration(startTime),
      });
      throw error;
    }
  }

  /**
   * Add middleware to the command pipeline
   */
  use(middleware: ICommandMiddleware): void {
    logger.debug(`Adding command middleware`, {
      middlewareName: middleware.constructor.name,
    });
    
    this.middleware.push(middleware);
    
    logger.info(`Middleware added`, {
      totalMiddleware: this.middleware.length,
    });
  }

  /**
   * Add multiple middleware to the command pipeline in order
   */
  useAll(middlewares: ICommandMiddleware[]): void {
    for (const m of middlewares) this.use(m);
  }

  /**
   * Clear a specific handler
   */
  unregister(commandType: string): void {
    this.handlers.delete(commandType);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.middleware = [];
  }

  /**
   * Get registered command types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if handler is registered for command type
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  /**
   * Private: Execute command through middleware chain
   */
  private async executeWithMiddleware<TCommand extends ICommand, TResult>(
    command: TCommand,
    handler: (command: TCommand) => Promise<TResult>
  ): Promise<TResult> {
    // Build middleware chain
    const chain = this.middleware.reduceRight(
      (next, middleware) => {
        return async (cmd: TCommand) => {
          logger.debug(`Executing middleware`, {
            middlewareName: middleware.constructor.name,
            commandType: cmd.type,
          });
          return middleware.execute(cmd, next);
        };
      },
      handler
    );

    return chain(command);
  }
}

/**
 * Factory for creating command bus
 */
export function createCommandBus(): CommandBus {
  return new CommandBus();
}

/**
 * Command handler registration helper
 */
export function registerCommandHandler<TCommand extends ICommand>(
  bus: CommandBus,
  commandType: string,
  handler: ICommandHandler<TCommand>
): void {
  // Create a wrapper that knows its command type
  const wrappedHandler: ICommandHandler<TCommand> = {
    handle: handler.handle.bind(handler),
    canHandle: (command) => command.type === commandType
  };
  
  bus.registerWithType(commandType as TCommand['type'], wrappedHandler);
}

export function registerCommandPattern<TCommand extends ICommand, TResult>(
  bus: CommandBus,
  pattern: CommandPattern<TCommand, TResult>
): void {
  for (const type of Object.keys(pattern)) {
    const t = type as TCommand['type'];
    const handle = pattern[t] as (cmd: TCommand) => Promise<TResult>;
    const handler = {
      async handle(command: TCommand) {
        return handle(command) as Promise<ICommandResult>;
      },
      canHandle(command: ICommand) {
        return command.type === t;
      },
    } satisfies ICommandHandler<TCommand> as ICommandHandler<TCommand>;

    bus.registerWithType(t, handler);
  }
}