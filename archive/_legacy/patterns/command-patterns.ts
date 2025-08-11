/**
 * Framework Patterns: Command Pattern Matching
 * 
 * Type-safe command handling with pattern matching.
 */

import { match, P } from 'ts-pattern';
import type { ICommand, ICommandHandler, ICommandResult } from '../core/command';

/**
 * Create a command handler using pattern matching
 */
export function createPatternCommandHandler<TCommand extends ICommand>(
  patterns: {
    [K in TCommand['type']]: (
      command: Extract<TCommand, { type: K }>
    ) => Promise<ICommandResult> | ICommandResult;
  }
): ICommandHandler<TCommand> {
  return {
    canHandle(command: TCommand): boolean {
      return command.type in patterns;
    },
    async handle(command: TCommand): Promise<ICommandResult> {
      return match(command)
        .when(
          (c): c is TCommand => c.type in patterns,
          async (c) => {
            const handler = patterns[c.type as TCommand['type']];
            return await handler(c as any);
          }
        )
        .otherwise(() => ({
          success: false,
          error: new Error(`No handler for command type: ${command.type}`),
        }));
    },
  };
}

/**
 * Command pattern builder for fluent API
 */
export class CommandPatternBuilder<TCommand extends ICommand> {
  private patterns: Partial<{
    [K in TCommand['type']]: (
      command: Extract<TCommand, { type: K }>
    ) => Promise<ICommandResult> | ICommandResult;
  }> = {};
  
  private defaultHandler?: (command: TCommand) => Promise<ICommandResult> | ICommandResult;

  on<K extends TCommand['type']>(
    type: K,
    handler: (command: Extract<TCommand, { type: K }>) => Promise<ICommandResult> | ICommandResult
  ): this {
    this.patterns[type] = handler as any;
    return this;
  }

  default(handler: (command: TCommand) => Promise<ICommandResult> | ICommandResult): this {
    this.defaultHandler = handler;
    return this;
  }

  build(): ICommandHandler<TCommand> {
    const patterns = this.patterns;
    const defaultHandler = this.defaultHandler;
    
    return { 
      canHandle(command: TCommand): boolean {
        return command.type in patterns;
      },  
      async handle(command: TCommand): Promise<ICommandResult> {
        return match(command)
          .when(
            (c): c is TCommand => c.type in patterns,
            async (c) => {
              const handler = patterns[c.type as TCommand['type']];
              return handler ? await handler(c as any) : { success: false, error: new Error('No handler') };
            }
          ) 
          .otherwise(async (c) => 
            defaultHandler 
              ? await defaultHandler(c)
              : { success: false, error: new Error(`No handler for command type: ${c}`) }
          );
      }
    };
  }
}

/**
 * Create command pattern builder
 */
export function commandPattern<TCommand extends ICommand>() {
  return new CommandPatternBuilder<TCommand>();
}

/**
 * Match command with validation patterns
 */
export function matchCommandWithValidation<TCommand extends ICommand>(
  command: TCommand,
  patterns: {
    [K in TCommand['type']]?: {
      validate?: (cmd: Extract<TCommand, { type: K }>) => boolean | Promise<boolean>;
      handle: (cmd: Extract<TCommand, { type: K }>) => Promise<ICommandResult> | ICommandResult;
    };
  }
): Promise<ICommandResult> {
  return match(command)
    .when(
      (c): c is TCommand => c.type in patterns,
      async (c) => {
        const pattern = patterns[c.type as TCommand['type']];
        if (!pattern) {
          return { success: false, error: new Error('No handler') };
        }
        
        if (pattern.validate) {
          const isValid = await pattern.validate(c as any);
          if (!isValid) {
            return { success: false, error: new Error('Validation failed') };
          }
        }
        
        return await pattern.handle(c as any);
      }
    )
    .otherwise(() => 
      Promise.resolve({ success: false, error: new Error(`Unknown command type: ${command.type}`) })
    );
}

/**
 * Command router using pattern matching
 */
export class PatternCommandRouter<TCommand extends ICommand> {
  private handlers = new Map<TCommand['type'], ICommandHandler<any>>();

  register<K extends TCommand['type']>(
    type: K,
    handler: ICommandHandler<Extract<TCommand, { type: K }>>
  ): this {
    this.handlers.set(type, handler);
    return this;
  }

  async route(command: TCommand): Promise<ICommandResult> {
    return match(command)
      .when(
        (c): c is TCommand => this.handlers.has(c.type),
        async (c) => {
          const handler = this.handlers.get(c.type)!;
          return await handler.handle(c);
        }
      )
      .otherwise(() => 
        Promise.resolve({ 
          success: false, 
          error: new Error(`No handler registered for command type: ${command.type}`) 
        })
      );
  }
}

/**
 * Conditional command execution
 */
export function executeConditionally<TCommand extends ICommand>(
  command: TCommand,
  conditions: Array<{
    when: (cmd: TCommand) => boolean;
    then: (cmd: TCommand) => Promise<ICommandResult> | ICommandResult;
  }>
): Promise<ICommandResult> {
  return match(command)
    .with(
      P.when((cmd): cmd is TCommand => conditions.some(c => c.when(cmd as TCommand))),
      async (cmd) => {
        const condition = conditions.find(c => c.when(cmd as TCommand))!;
        return await condition.then(cmd as TCommand);
      }
    )
    .otherwise(() => 
      Promise.resolve({ success: false, error: new Error('No conditions met') })
    );
}