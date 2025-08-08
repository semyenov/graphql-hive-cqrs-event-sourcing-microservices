/**
 * Framework Infrastructure: Command Bus
 * 
 * Routes commands to their appropriate handlers.
 */

import type { 
  ICommand, 
  ICommandHandler, 
  ICommandBus, 
  ICommandResult,
  ICommandMiddleware 
} from '../../core/command';

/**
 * Type-safe command handler map
 */
type CommandHandlerMap = Map<string, ICommandHandler<ICommand>>;

/**
 * Command bus implementation with improved type safety
 */
export class CommandBus<TCommand extends ICommand = ICommand> implements ICommandBus {
  private handlers: CommandHandlerMap = new Map();
  private middleware: ICommandMiddleware[] = [];

  /**
   * Register a command handler
   */
  register<TSpecificCommand extends ICommand>(
    handler: ICommandHandler<TSpecificCommand>
  ): void {
    // Get command types this handler can handle
    const commandType = this.getHandlerCommandType(handler as ICommandHandler<ICommand>);
    if (commandType) {
      this.handlers.set(commandType, handler as ICommandHandler<ICommand>);
    }
  }

  /**
   * Send a command to its handler
   */
  async send<TCommand extends ICommand, TResult = ICommandResult>(
    command: TCommand
  ): Promise<TResult> {
    const handler = this.handlers.get(command.type);
    
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }

    if (!handler.canHandle(command)) {
      throw new Error(`Handler cannot handle command type: ${command.type}`);
    }

    // Execute through middleware chain
    return this.executeWithMiddleware(command, async (cmd) => {
      return handler.handle(cmd) as Promise<TResult>;
    });
  }

  /**
   * Add middleware to the command pipeline
   */
  use(middleware: ICommandMiddleware): void {
    this.middleware.push(middleware);
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
        return (cmd: TCommand) => middleware.execute(cmd, next);
      },
      handler
    );

    return chain(command);
  }

  /**
   * Register a command handler with explicit type
   */
  registerWithType<TSpecificCommand extends TCommand>(
    commandType: TSpecificCommand['type'],
    handler: ICommandHandler<TSpecificCommand>
  ): void {
    this.handlers.set(commandType, handler as ICommandHandler<ICommand>);
  }

  /**
   * Private: Extract command type from handler
   */
  private getHandlerCommandType(_handler: ICommandHandler<ICommand>): string | null {
    // This is a simplified approach - in production, you might want to
    // use decorators or explicit registration with command type
    // For now, return null to require explicit registration
    return null;
  }
}

/**
 * Factory for creating command bus with type safety
 */
export function createCommandBus<TCommand extends ICommand = ICommand>(): CommandBus<TCommand> {
  return new CommandBus<TCommand>();
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
  
  bus.register(wrappedHandler);
}