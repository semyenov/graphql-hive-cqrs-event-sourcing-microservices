/**
 * Framework Effect: Simplified Command Effects
 * 
 * Basic Effect-based command handling that works with current TypeScript setup.
 * More advanced features can be added as the Effect library matures.
 */

import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import type { ICommand, ICommandHandler, ICommandResult } from '../core/command';

/**
 * Command effect type - represents a command execution with effects
 */
export type CommandEffect<A> = Effect.Effect<A, Error, never>;

/**
 * Create an effect-based command handler
 */
export function createEffectHandler<TCommand extends ICommand>(
  handler: (command: TCommand) => CommandEffect<ICommandResult>
): ICommandHandler<TCommand> {
  return {
    canHandle(command: ICommand): boolean {
      return true;
    },
    async handle(command: TCommand): Promise<ICommandResult> {
      try {
        return await Effect.runPromise(handler(command));
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
  };
}

/**
 * Execute command with automatic error handling
 */
export function executeCommand<TCommand extends ICommand>(
  command: TCommand,
  handler: (cmd: TCommand) => CommandEffect<ICommandResult>
): CommandEffect<ICommandResult> {
  return pipe(
    Effect.try(() => handler(command)),
    Effect.flatten,
    Effect.catchAll((error) =>
      Effect.succeed({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      } as ICommandResult)
    )
  );
}

/**
 * Command with logging
 */
export function withLogging<A>(
  effect: CommandEffect<A>,
  commandType: string
): CommandEffect<A> {
  return pipe(
    Effect.log(`Executing command: ${commandType}`),
    Effect.flatMap(() => effect),
    Effect.tap(() => Effect.log(`Command ${commandType} completed`)),
    Effect.tapError((error) => Effect.log(`Command ${commandType} failed: ${error}`))
  );
}

/**
 * Compose multiple effects sequentially
 */
export function sequence<A>(
  ...effects: CommandEffect<A>[]
): CommandEffect<A[]> {
  return Effect.all(effects);
}

/**
 * Compose effects in parallel
 */
export function parallel<A>(
  ...effects: CommandEffect<A>[]
): CommandEffect<readonly A[]> {
  return Effect.all(effects, { concurrency: "unbounded" });
}