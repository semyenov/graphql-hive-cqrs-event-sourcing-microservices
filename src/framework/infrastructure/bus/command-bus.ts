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
 * Command bus implementation
 */
export class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler<any>>();
  private middleware: ICommandMiddleware[] = [];

  /**
   * Register a command handler
   */
  register<TCommand extends ICommand>(
    handler: ICommandHandler<TCommand>
  ): void {
    // Get command types this handler can handle
    const commandType = this.getHandlerCommandType(handler);
    if (commandType) {
      this.handlers.set(commandType, handler);
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
   * Private: Extract command type from handler
   */
  private getHandlerCommandType(handler: ICommandHandler<any>): string | null {
    // This is a simplified approach - in production, you might want to
    // use decorators or explicit registration with command type
    const testCommand: ICommand = {
      type: '__test__',
      aggregateId: '' as any,
      payload: {}
    };

    // Try to infer from canHandle method
    // In real implementation, handlers should declare their command type
    return null; // Requires explicit registration with command type
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
  
  bus.register(wrappedHandler);
}