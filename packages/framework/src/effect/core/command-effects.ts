/**
 * Framework Effect: Command Effects
 * 
 * Full Effect-based command handling with dependency injection,
 * error handling, and advanced patterns.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Data from 'effect/Data';
import * as Either from 'effect/Either';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import * as Schedule from 'effect/Schedule';
import * as Ref from 'effect/Ref';
import { pipe } from 'effect/Function';
import type { ICommand, ICommandHandler, ICommandResult, ICommandBus } from '../../core/command';
import type { IEventStore } from '../../core/event';
import type { IAggregate } from '../../core/aggregate';
import type { AggregateId } from '../../core/branded/types';

/**
 * Command handler context - dependencies for command execution
 */
export interface CommandContext {
  readonly eventStore: IEventStore<any>;
  readonly commandBus: ICommandBus;
}

/**
 * Command context tag for dependency injection
 */
export const CommandContext = Context.GenericTag<CommandContext>('CommandContext');

/**
 * Command execution error types
 */
export class CommandValidationError extends Data.TaggedError('CommandValidationError')<{
  readonly command: ICommand;
  readonly errors: ReadonlyArray<string>;
}> {}

export class CommandExecutionError extends Data.TaggedError('CommandExecutionError')<{
  readonly command: ICommand;
  readonly cause: unknown;
}> {}

export class AggregateNotFoundError extends Data.TaggedError('AggregateNotFoundError')<{
  readonly aggregateId: AggregateId;
}> {}

export class ConcurrencyError extends Data.TaggedError('ConcurrencyError')<{
  readonly aggregateId: AggregateId;
  readonly expectedVersion: number;
  readonly actualVersion: number;
}> {}

export type CommandError = 
  | CommandValidationError 
  | CommandExecutionError 
  | AggregateNotFoundError 
  | ConcurrencyError;

/**
 * Effect-based command handler
 */
export interface EffectCommandHandler<TCommand extends ICommand, TResult = unknown> {
  readonly canHandle: (command: ICommand) => boolean;
  readonly handle: (command: TCommand) => Effect.Effect<TResult, CommandError, CommandContext>;
}

/**
 * Create an effect-based command handler with full error handling
 */
export function createCommandHandler<TCommand extends ICommand, TResult = unknown>(
  config: {
    canHandle: (command: ICommand) => boolean;
    validate?: (command: TCommand) => Effect.Effect<void, CommandValidationError, never>;
    execute: (command: TCommand) => Effect.Effect<TResult, CommandError, CommandContext>;
    onSuccess?: (result: TResult, command: TCommand) => Effect.Effect<void, never, never>;
    onError?: (error: CommandError, command: TCommand) => Effect.Effect<void, never, never>;
  }
): EffectCommandHandler<TCommand, TResult> {
  return {
    canHandle: config.canHandle,
    handle: (command: TCommand) =>
      pipe(
        // Validation phase
        config.validate ? config.validate(command) : Effect.succeed(undefined),
        // Execution phase
        Effect.flatMap(() => config.execute(command)),
        // Success callback
        Effect.tap((result) => 
          config.onSuccess ? config.onSuccess(result, command) : Effect.succeed(undefined)
        ),
        // Error callback
        Effect.tapError((error) =>
          config.onError ? config.onError(error as CommandError, command) : Effect.succeed(undefined)
        )
      ),
  };
}

/**
 * Command handler with automatic retry using exponential backoff
 */
export function withRetry<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>,
  policy: Schedule.Schedule<unknown, unknown, never> = Schedule.exponential(Duration.millis(100))
): EffectCommandHandler<TCommand, TResult> {
  return {
    canHandle: handler.canHandle,
    handle: (command: TCommand) =>
      pipe(
        handler.handle(command),
        Effect.retry(policy)
      ),
  };
}

/**
 * Command handler with timeout
 */
export function withTimeout<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>,
  duration: Duration.Duration
): EffectCommandHandler<TCommand, TResult> {
  return {
    canHandle: handler.canHandle,
    handle: (command: TCommand) =>
      pipe(
        handler.handle(command),
        Effect.timeoutFail({
          duration,
          onTimeout: () =>
            new CommandExecutionError({
              command,
              cause: new Error(`Command timed out after ${Duration.toMillis(duration)}ms`),
            }),
        })
      ),
  };
}

/**
 * Command handler with circuit breaker pattern
 */
export function withCircuitBreaker<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>,
  config: {
    maxFailures: number;
    resetTimeout: Duration.Duration;
  }
): EffectCommandHandler<TCommand, TResult> {
  return {
    canHandle: handler.canHandle,
    handle: (command: TCommand) =>
      pipe(
        Ref.make<{
          failures: number;
          lastFailureTime: number | null;
          isOpen: boolean;
        }>({
          failures: 0,
          lastFailureTime: null,
          isOpen: false,
        }),
        Effect.flatMap((stateRef) =>
          pipe(
            Ref.get(stateRef),
            Effect.flatMap((state) => {
              // Check if circuit should be reset
              if (state.isOpen && state.lastFailureTime) {
                const elapsed = Date.now() - state.lastFailureTime;
                if (elapsed >= Duration.toMillis(config.resetTimeout)) {
                  return pipe(
                    Ref.set(stateRef, {
                      failures: 0,
                      lastFailureTime: null,
                      isOpen: false,
                    }),
                    Effect.flatMap(() => executeWithCircuitBreaker(handler, command, stateRef, config))
                  );
                }
              }

              // If circuit is open, fail fast
              if (state.isOpen) {
                return Effect.fail(
                  new CommandExecutionError({
                    command,
                    cause: new Error('Circuit breaker is open'),
                  })
                );
              }

              return executeWithCircuitBreaker(handler, command, stateRef, config);
            })
          )
        )
      ),
  };
}

/**
 * Helper function for circuit breaker execution
 */
function executeWithCircuitBreaker<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>,
  command: TCommand,
  stateRef: Ref.Ref<{
    failures: number;
    lastFailureTime: number | null;
    isOpen: boolean;
  }>,
  config: {
    maxFailures: number;
    resetTimeout: Duration.Duration;
  }
): Effect.Effect<TResult, CommandError, CommandContext> {
  return pipe(
    handler.handle(command),
    Effect.tapError(() =>
      Ref.modify(stateRef, (state) => {
        const newFailures = state.failures + 1;
        const newState = {
          failures: newFailures,
          lastFailureTime: Date.now(),
          isOpen: newFailures >= config.maxFailures,
        };
        return [Effect.succeed(undefined), newState];
      }).pipe(Effect.flatten)
    ),
    Effect.tap(() =>
      Ref.update(stateRef, (state) => ({
        ...state,
        failures: 0,
        lastFailureTime: null,
      }))
    )
  );
}

/**
 * Batch command execution with concurrency control
 */
export function batchCommands<TCommand extends ICommand, TResult>(
  commands: ReadonlyArray<TCommand>,
  handler: EffectCommandHandler<TCommand, TResult>,
  options?: {
    concurrency?: number;
    continueOnError?: boolean;
  }
): Effect.Effect<ReadonlyArray<Either.Either<TResult, CommandError>>, never, CommandContext> {
  const effects = commands.map((cmd) =>
    pipe(
      handler.handle(cmd),
      Effect.either
    )
  );

  return Effect.all(effects, {
    concurrency: options?.concurrency ?? 1,
  });
}

/**
 * Command pipeline builder for composable command handling
 */
export class CommandPipeline<TCommand extends ICommand, TResult> {
  constructor(
    private readonly handler: EffectCommandHandler<TCommand, TResult>
  ) {}

  retry(policy: Schedule.Schedule<unknown, unknown, never>): CommandPipeline<TCommand, TResult> {
    return new CommandPipeline(withRetry(this.handler, policy));
  }

  timeout(duration: Duration.Duration): CommandPipeline<TCommand, TResult> {
    return new CommandPipeline(withTimeout(this.handler, duration));
  }

  circuitBreaker(config: {
    maxFailures: number;
    resetTimeout: Duration.Duration;
  }): CommandPipeline<TCommand, TResult> {
    return new CommandPipeline(withCircuitBreaker(this.handler, config));
  }

  build(): EffectCommandHandler<TCommand, TResult> {
    return this.handler;
  }
}

/**
 * Create a command pipeline
 */
export function commandPipeline<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>
): CommandPipeline<TCommand, TResult> {
  return new CommandPipeline(handler);
}

/**
 * Convert traditional command handler to Effect-based
 */
export function fromCommandHandler<TCommand extends ICommand>(
  handler: ICommandHandler<TCommand>
): EffectCommandHandler<TCommand, ICommandResult> {
  return {
    canHandle: handler.canHandle,
    handle: (command: TCommand) =>
      Effect.tryPromise({
        try: () => handler.handle(command),
        catch: (error) =>
          new CommandExecutionError({
            command,
            cause: error,
          }),
      }),
  };
}

/**
 * Create a command handler service layer
 */
export const CommandHandlerServiceLive = Layer.succeed(
  CommandContext,
  CommandContext.of({
    eventStore: {} as IEventStore<any>, // Will be provided by actual implementation
    commandBus: {} as ICommandBus, // Will be provided by actual implementation
  })
);

/**
 * Execute command with automatic context provision
 */
export function executeCommand<TCommand extends ICommand, TResult>(
  command: TCommand,
  handler: EffectCommandHandler<TCommand, TResult>,
  context: CommandContext
): Promise<TResult> {
  return pipe(
    handler.handle(command),
    Effect.provideService(CommandContext, context),
    Effect.runPromise
  );
}

/**
 * Command saga - orchestrate multiple commands with compensation
 */
export function commandSaga<TResult>(
  steps: ReadonlyArray<{
    command: ICommand;
    handler: EffectCommandHandler<any, any>;
    compensate?: (error: CommandError) => Effect.Effect<void, never, CommandContext>;
  }>
): Effect.Effect<TResult, CommandError, CommandContext> {
  const executeWithCompensation = (
    index: number,
    compensations: Array<() => Effect.Effect<void, never, CommandContext>>
  ): Effect.Effect<any, CommandError, CommandContext> => {
    if (index >= steps.length) {
      return Effect.succeed(undefined);
    }

    const step = steps[index]!;
    return pipe(
      step.handler.handle(step.command),
      Effect.tapError((error) => {
        // Run compensations in reverse order
        const compensationEffects = compensations
          .reverse()
          .map((comp) => comp());
        
        return pipe(
          Effect.all(compensationEffects, { discard: true }),
          Effect.flatMap(() => Effect.fail(error))
        );
      }),
      Effect.tap(() => {
        if (step.compensate) {
          compensations.push(() => step.compensate!(undefined as any));
        }
      }),
      Effect.flatMap(() => executeWithCompensation(index + 1, compensations))
    );
  };

  return executeWithCompensation(0, []);
}

/**
 * Command handler with logging
 */
export function withLogging<TCommand extends ICommand, TResult>(
  handler: EffectCommandHandler<TCommand, TResult>,
  commandType: string
): EffectCommandHandler<TCommand, TResult> {
  return {
    canHandle: handler.canHandle,
    handle: (command: TCommand) =>
      pipe(
        Effect.log(`Executing command: ${commandType}`),
        Effect.flatMap(() => handler.handle(command)),
        Effect.tap(() => Effect.log(`Command ${commandType} completed`)),
        Effect.tapError((error) => Effect.log(`Command ${commandType} failed: ${error}`))
      ),
  };
}

/**
 * Compose multiple effects sequentially
 */
export function sequence<A>(
  ...effects: Effect.Effect<A, CommandError, CommandContext>[]
): Effect.Effect<A[], CommandError, CommandContext> {
  return Effect.all(effects);
}

/**
 * Compose effects in parallel
 */
export function parallel<A>(
  ...effects: Effect.Effect<A, CommandError, CommandContext>[]
): Effect.Effect<readonly A[], CommandError, CommandContext> {
  return Effect.all(effects, { concurrency: "unbounded" });
}