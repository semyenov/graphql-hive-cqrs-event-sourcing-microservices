/**
 * Framework Patterns: Command Handler Patterns
 * 
 * Pattern-based command routing and handling with validation and middleware.
 * Provides type-safe command dispatching with exhaustive matching.
 */

import { match, P } from 'ts-pattern';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import type { ICommand } from '../effect/core/types';
import { CommandValidationError } from '../effect/core/command-effects';
import type { z } from 'zod';
import { validateEffect } from '../validation/validators';
import { CommandValidationMiddleware } from '../validation';

/**
 * Command router with pattern matching
 * 
 * @example
 * ```typescript
 * const router = createCommandRouter<UserCommand>()
 *   .route('CREATE_USER', createUserHandler)
 *   .route('UPDATE_USER', updateUserHandler)
 *   .route('DELETE_USER', deleteUserHandler)
 *   .routeWithValidation(
 *     'TRANSFER_FUNDS',
 *     TransferFundsSchema,
 *     transferFundsHandler
 *   )
 *   .build();
 * ```
 */
export class CommandRouter<C extends ICommand, R = unknown> {
  private routes: Map<
    C['type'],
    {
      handler: (command: C) => Promise<R> | R;
      schema?: z.ZodSchema<C>;
      middleware?: Array<CommandValidationMiddleware<C, C>>;
    }
  > = new Map();
  
  route<T extends C['type']>(
    type: T,
    handler: (command: Extract<C, { type: T }>) => Promise<R> | R
  ): this {
    this.routes.set(type, {
      handler: handler as (command: C) => Promise<R> | R,
    });
    return this;
  }
  
  routeWithValidation<T extends C['type']>(
    type: T,
    schema: z.ZodSchema,
    handler: (command: Extract<C, { type: T }>) => Promise<R> | R
  ): this {
    this.routes.set(type, {
      handler: handler as (command: C) => Promise<R> | R,
      schema,
    });
    return this;
  }
  
  routeWithMiddleware<T extends C['type'], M extends CommandValidationMiddleware<C, C>>(
    type: T,
    middleware: M[],
    handler: (command: Extract<C, { type: T }>) => Promise<R> | R
  ): this {
    this.routes.set(type, {
      handler: handler as (command: C) => Promise<R> | R,
      middleware: middleware,
    });
    return this;  
  }
  
  async dispatch(command: C): Promise<R> {
    const route = this.routes.get(command.type);
    
    if (!route) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    
    let processedCommand: C = command;
    
    // Apply validation if schema is provided
    if (route.schema) {
      const validation = route.schema.safeParse(command);
      if (!validation.success) {
        throw new CommandValidationError({
          command,
          errors: validation.error.errors.map(issue => issue.message) as string[],
        });
      }
      processedCommand = validation.data as C;
    }
    
    // Apply middleware
    if (route.middleware) { 
      for (const mw of route.middleware) {
        processedCommand = await mw(processedCommand) as C;
      }
    }
    
    // Execute handler
    return route.handler(processedCommand);
  }
  
  build(): (command: C) => Promise<R> {
    return this.dispatch.bind(this);
  }
}

export function createCommandRouter<C extends ICommand, R = unknown>(): CommandRouter<C, R> {
  return new CommandRouter<C, R>();
}

/**
 * Effect-based command handler builder
 */
export class EffectCommandHandler<C extends ICommand, R, E, Deps> {
  private handlers: Array<{
    predicate: (command: C) => boolean;
    effect: (command: C) => Effect.Effect<R, E, Deps>;
    priority?: number;
  }> = [];
  
  handle<T extends C['type']>(
    type: T,
    effect: (command: Extract<C, { type: T }>) => Effect.Effect<R, E, Deps>
  ): this {
    this.handlers.push({
      predicate: (command) => command.type === type,
      effect: effect as (command: C) => Effect.Effect<R, E, Deps>,
      priority: 0,
    });
    return this;
  }
  
  handlePattern(
    predicate: (command: C) => boolean,
    effect: (command: C) => Effect.Effect<R, E, Deps>,
    priority: number = 0
  ): this {
    this.handlers.push({ predicate, effect, priority });
    return this;
  }
  
  build(): (command: C) => Effect.Effect<R, E | Error, Deps> {
    // Sort by priority
    const sortedHandlers = [...this.handlers].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
    
    return (command: C) => {
      const handler = sortedHandlers.find(h => h.predicate(command));
      
      if (!handler) {
        return Effect.fail(
          new Error(`No handler for command type: ${command.type}`) as E | Error
        );
      }
      
      return handler.effect(command);
    };
  }
}

export function createEffectCommandHandler<
  C extends ICommand,
  R = void,
  E = never,
  Deps = never
>(): EffectCommandHandler<C, R, E, Deps> {
  return new EffectCommandHandler<C, R, E, Deps>();
}

/**
 * Command pipeline with middleware
 */
export class CommandPipeline<C extends ICommand, R> {
  private middlewares: Array<{
    name: string;
    process: (command: C, next: () => Promise<R>) => Promise<R>;
  }> = [];
  
  use(
    name: string,
    middleware: (command: C, next: () => Promise<R>) => Promise<R>
  ): this {
    this.middlewares.push({ name, process: middleware });
    return this;
  }
  
  useValidation(schema: z.ZodSchema): this {
    return this.use('validation', async (command, next) => {
      const validation = schema.safeParse(command);
      if (!validation.success) {
        throw new CommandValidationError({
          command,
          errors: validation.error.errors.map(issue => issue.message) as string[],
        });
      }
      return next();
    });
  }
  
  useLogging(): this {
    return this.use('logging', async (command, next) => {
      console.log(`Executing command: ${command.type}`, command);
      const startTime = Date.now();
      try {
        const result = await next();
        console.log(
          `Command ${command.type} completed in ${Date.now() - startTime}ms`
        );
        return result;
      } catch (error) {
        console.error(`Command ${command.type} failed:`, error);
        throw error;
      }
    });
  }
  
  useAuth(
    authenticate: (command: C) => Promise<boolean>
  ): this {
    return this.use('auth', async (command, next) => {
      const isAuthenticated = await authenticate(command);
      if (!isAuthenticated) {
        throw new Error('Unauthorized');
      }
      return next();
    });
  }
  
  useRetry(maxAttempts: number = 3, delay: number = 1000): this {
    return this.use('retry', async (command, next) => {
      let lastError: Error | undefined;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await next();
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
          }
        }
      }
      
      throw lastError;
    });
  }
  
  execute(handler: (command: C) => Promise<R> | R): (command: C) => Promise<R> {
    return async (command: C): Promise<R> => {
      // Build middleware chain
      const chain = this.middlewares.reduceRight(
        (next: () => Promise<R>, middleware: { name: string; process: (command: C, next: () => Promise<R>) => Promise<R> }) => {
          return () => middleware.process(command, next);
        },
        () => Promise.resolve(handler(command))
      );
      
      return chain();
    };
  }
}

export function createCommandPipeline<C extends ICommand, R>(): CommandPipeline<C, R> {
  return new CommandPipeline<C, R>();
}

/**
 * Command saga for complex workflows
 */
export class CommandSaga<C extends ICommand, Context = {}> {
  private steps: Array<{
    name: string;
    command: (ctx: Context) => C;
    handler: (command: C, ctx: Context) => Promise<void>;
    compensate?: (ctx: Context) => Promise<void>;
  }> = [];
  
  step(
    name: string,
    command: (ctx: Context) => C,
    handler: (command: C, ctx: Context) => Promise<void>,
    compensate?: (ctx: Context) => Promise<void>
  ): this {
    this.steps.push({ name, command, handler, compensate });
    return this;
  }
  
  async execute(initialContext: Context): Promise<void> {
    const executedSteps: typeof this.steps = [];
    const context = { ...initialContext };
    
    try {
      for (const step of this.steps) {
        const command = step.command(context);
        await step.handler(command, context);
        executedSteps.push(step);
      }
    } catch (error) {
      // Compensate in reverse order
      for (const step of executedSteps.reverse()) {
        if (step.compensate) {
          try {
            await step.compensate(context);
          } catch (compensateError) {
            console.error(
              `Failed to compensate step ${step.name}:`,
              compensateError
            );
          }
        }
      }
      throw error;
    }
  }
}

export function createCommandSaga<C extends ICommand, Context = {}>(): CommandSaga<C, Context> {
  return new CommandSaga<C, Context>();
}

/**
 * Pattern matching for command handlers
 */
export function matchCommand<C extends ICommand, TType extends C['type'], TResult=unknown>(
  command: C,
  patterns: Record<TType, (command: Extract<C, { type: TType }>) => TResult>
): TResult {
  const handler = patterns[command.type as TType];
  if (handler) {
    return handler(command as Extract<C, { type: TType }>);
  }
  throw new Error(`No handler for command type: ${command.type}`);
} 

/**
 * Command validation patterns
 */
export const CommandValidationPatterns = {
  /**
   * Validate command with schema
   */
  withSchema<C extends ICommand>(
    schema: z.ZodSchema<C>
  ): (command: unknown) => Effect.Effect<C, CommandValidationError, never> {
    return (command) =>
      pipe(
        validateEffect(schema, command),
        Effect.mapError((error) =>
          new CommandValidationError({
            command: command as C,
            errors: error.issues.map(issue => issue.message) as string[],
          })
        )
      );
  },
  
  /**
   * Validate command with business rules
   */
  withBusinessRules<C extends ICommand>(
    rules: Array<{
      name: string;
      validate: (command: C) => boolean;
      message: string;
    }>
  ): (command: C) => Effect.Effect<C, CommandValidationError, never> {
    return (command) => {
      for (const rule of rules) {
        if (!rule.validate(command)) {
          return Effect.fail(
            new CommandValidationError({
              command,
              errors: [`Business rule '${rule.name}' failed: ${rule.message}`],
            })
          );
        }
      }
      return Effect.succeed(command);
    };
  },
  
  /**
   * Compose multiple validations
   */
  // compose<C extends ICommand>(
  //   ...validations: Array<(command: C) => Effect.Effect<C, CommandValidationError, never>>
  // ): (command: C) => Effect.Effect<C, CommandValidationError, never> {
  //   return (command) =>
  //     pipe(
  //       Effect.succeed(command),
  //       Effect.flatMap(command => validations.reduce(
  //         (acc, validation) => pipe(acc, Effect.flatMap(validation)),
  //         Effect.succeed(command)
  //       )) 
  //     );
  // },
};

/**
 * Command batching utilities
 */
export class CommandBatcher<C extends ICommand, R> {
  private batch: C[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private handler: (commands: C[]) => Promise<R[]>,
    private options: {
      maxBatchSize: number;
      maxWaitTime: number;
    }
  ) {}
  
  async add(command: C): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push(command);
      
      if (this.batch.length >= this.options.maxBatchSize) {
        this.flush().then(
          results => resolve(results[results.length - 1]),
          reject
        );
      } else {
        if (!this.timer) {
          this.timer = setTimeout(() => {
            this.flush().then(
              results => resolve(results[results.length - 1]),
              reject
            );
          }, this.options.maxWaitTime);
        }
      }
    });
  }
  
  private async flush(): Promise<R[]> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    const commands = [...this.batch];
    this.batch = [];
    
    if (commands.length === 0) {
      return [];
    }
    
    return this.handler(commands);
  }
}

export function createCommandBatcher<C extends ICommand, R>(
  handler: (commands: C[]) => Promise<R[]>,
  options: { maxBatchSize: number; maxWaitTime: number }
): CommandBatcher<C, R> {
  return new CommandBatcher(handler, options);
}