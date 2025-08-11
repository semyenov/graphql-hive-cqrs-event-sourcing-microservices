/**
 * Command Handler - Application layer command processing
 *
 * Using Effect for dependency injection and error handling
 */

import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Schedule from "effect/Schedule";
import * as Duration from "effect/Duration";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { pipe } from "effect/Function";
import type { Command, DomainEvent } from "../schema/core/messages";
import type { AggregateId, Version } from "../schema/core/primitives";
import type { AggregateError } from "../functions/aggregate";

// Compatibility interface for aggregate-like behavior
export interface Aggregate {
  readonly id: AggregateId;
  readonly version: Version;
  handle(command: unknown): Effect.Effect<void, AggregateError>;
  getUncommittedEvents(): ReadonlyArray<DomainEvent>;
  markEventsAsCommitted(): void;
}

// ============================================================================
// Command Handler Errors
// ============================================================================

export class CommandValidationError
  extends Data.TaggedError("CommandValidationError")<{
    readonly command: Command;
    readonly errors: ReadonlyArray<string>;
  }> {}

export class CommandExecutionError
  extends Data.TaggedError("CommandExecutionError")<{
    readonly command: Command;
    readonly cause: unknown;
  }> {}

export class CommandTimeoutError
  extends Data.TaggedError("CommandTimeoutError")<{
    readonly command: Command;
    readonly duration: Duration.Duration;
  }> {}

export type CommandError =
  | CommandValidationError
  | CommandExecutionError
  | CommandTimeoutError
  | AggregateError;

// ============================================================================
// Services
// ============================================================================

/**
 * Aggregate repository for loading and saving aggregates
 */
export interface AggregateRepository<A extends Aggregate> {
  readonly load: (id: AggregateId) => Effect.Effect<A, AggregateError>;
  readonly save: (aggregate: A) => Effect.Effect<void, CommandError>;
  readonly exists: (id: AggregateId) => Effect.Effect<boolean, never>;
}

export const AggregateRepository = <A extends Aggregate>() =>
  Context.GenericTag<AggregateRepository<A>>("AggregateRepository");

/**
 * Command bus for publishing commands
 */
export interface CommandBus {
  readonly publish: (
    command: Command,
  ) => Effect.Effect<void, CommandExecutionError>;
  readonly subscribe: (
    handler: (command: Command) => Effect.Effect<void, CommandError>,
  ) => Effect.Effect<void, never>;
}

export class CommandBus extends Context.Tag("CommandBus")<
  CommandBus,
  CommandBus
>() {}

/**
 * Event bus for publishing domain events
 */
export interface EventBus {
  readonly publish: (
    events: ReadonlyArray<DomainEvent>,
  ) => Effect.Effect<void, never>;
  readonly subscribe: (
    handler: (event: DomainEvent) => Effect.Effect<void, never>,
  ) => Effect.Effect<void, never>;
}

export class EventBus extends Context.Tag("EventBus")<
  EventBus,
  EventBus
>() {}

// ============================================================================
// Command Handler
// ============================================================================

/**
 * Command handler configuration
 */
export interface CommandHandlerConfig<C extends Command, A extends Aggregate> {
  readonly commandType: C["type"];
  readonly aggregateFactory: (id: AggregateId) => A;
  readonly getAggregateId: (command: C) => AggregateId;
  readonly validate?: (
    command: C,
  ) => Effect.Effect<void, CommandValidationError>;
  readonly timeout?: Duration.Duration;
  readonly retry?: Schedule.Schedule<unknown, unknown, never>;
}

/**
 * Command handler implementation
 */
export class CommandHandler<C extends Command, A extends Aggregate> {
  constructor(private readonly config: CommandHandlerConfig<C, A>) {}

  /**
   * Handle command
   */
  handle(
    command: C,
  ): Effect.Effect<void, CommandError, AggregateRepository<A> | EventBus> {
    const config = this.config;
    return Effect.gen(function* (_) {
      // Validate command
      if (config.validate) {
        yield* config.validate(command);
      }

      // Get services
      const repository = yield* AggregateRepository<A>();
      const eventBus = yield* EventBus;

      // Load or create aggregate
      const aggregateId = config.getAggregateId(command);
      const aggregate = yield* pipe(
        repository.load(aggregateId),
        Effect.catchTag(
          "AggregateNotFoundError",
          () => Effect.succeed(config.aggregateFactory(aggregateId)),
        ),
      );

      // Execute command on aggregate
      yield* aggregate.handle(command);

      // Save aggregate
      yield* repository.save(aggregate);

      // Publish events
      const events = aggregate.getUncommittedEvents();
      if (events.length > 0) {
        yield* eventBus.publish(events);
      }
    });
  }

  /**
   * Create handler with middleware
   */
  withMiddleware(
    command: C,
  ): Effect.Effect<void, CommandError, AggregateRepository<A> | EventBus> {
    let handler = this.handle.bind(this);

    // Add timeout
    if (this.config.timeout) {
      const timeout = this.config.timeout;
      handler = (command: C) =>
        pipe(
          this.handle(command),
          Effect.timeoutFail({
            duration: timeout,
            onTimeout: () =>
              new CommandTimeoutError({
                command,
                duration: timeout,
              }),
          }),
        );
    }

    // Add retry
    if (this.config.retry) {
      const retry = this.config.retry;
      handler = (command: C) =>
        pipe(
          handler(command),
          Effect.retry(retry),
        );
    }

    return handler(command);
  }
}

// ============================================================================
// Command Handler Builder
// ============================================================================

/**
 * Builder for creating command handlers
 */
export class CommandHandlerBuilder<C extends Command, A extends Aggregate> {
  private config: CommandHandlerConfig<C, A>;

  constructor() {
    this.config = {} as CommandHandlerConfig<C, A>;
  }

  forCommand(commandType: C["type"]): this {
    this.config = { ...this.config, commandType };
    return this;
  }

  withAggregateFactory(factory: (id: AggregateId) => A): this {
    this.config = { ...this.config, aggregateFactory: factory };
    return this;
  }

  withAggregateId(getter: (command: C) => AggregateId): this {
    this.config = { ...this.config, getAggregateId: getter };
    return this;
  }

  withValidation(
    validate: (command: C) => Effect.Effect<void, CommandValidationError>,
  ): this {
    this.config = { ...this.config, validate };
    return this;
  }

  withTimeout(duration: Duration.Duration): this {
    this.config = { ...this.config, timeout: duration };
    return this;
  }

  withRetry(schedule: Schedule.Schedule<unknown, unknown, never>): this {
    this.config = { ...this.config, retry: schedule };
    return this;
  }

  build(): CommandHandler<C, A> {
    if (!this.config.commandType) {
      throw new Error("Command type is required");
    }
    if (!this.config.aggregateFactory) {
      throw new Error("Aggregate factory is required");
    }
    if (!this.config.getAggregateId) {
      throw new Error("Aggregate ID getter is required");
    }

    return new CommandHandler(this.config);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create command handler builder
 */
export const commandHandler = <C extends Command, A extends Aggregate>() =>
  new CommandHandlerBuilder<C, A>();

/**
 * Create command pipeline with multiple handlers
 */
export const commandPipeline = <C extends Command>(
  handlers: Array<(command: C) => Effect.Effect<void, CommandError, any>>,
) =>
(command: C) =>
  handlers.reduce(
    (acc: Effect.Effect<void, CommandError, any>, handler) =>
      pipe(
        acc,
        Effect.flatMap(() => handler(command)),
      ),
    Effect.succeed(undefined) as Effect.Effect<void, CommandError, any>,
  );

/**
 * Create saga for orchestrating multiple commands
 */
export interface SagaStep<C extends Command = Command> {
  readonly command: C;
  readonly compensate?: (
    error: CommandError,
  ) => Effect.Effect<void, never, any>;
}

export const saga = (
  steps: ReadonlyArray<SagaStep>,
): Effect.Effect<void, CommandError, CommandBus> =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const compensations: Array<() => Effect.Effect<void, never, any>> = [];

    for (const step of steps) {
      try {
        yield* commandBus.publish(step.command);

        if (step.compensate) {
          compensations.push(() => step.compensate!(undefined as any));
        }
      } catch (error) {
        // Run compensations in reverse order
        for (const compensate of compensations.reverse()) {
          yield* compensate().pipe(
            Effect.catchAll(() => Effect.succeed(undefined)),
          );
        }

        throw error;
      }
    }
  });

// ============================================================================
// Command Queue
// ============================================================================

/**
 * Command queue for processing commands asynchronously
 */
export class CommandQueue<C extends Command> {
  private queue: Effect.Effect<Queue.Queue<C>, never, never>;

  constructor() {
    this.queue = Queue.unbounded<C>();
  }

  /**
   * Enqueue command
   */
  enqueue(command: C): Effect.Effect<void, never> {
    return Effect.flatMap(
      this.queue,
      (queue) => Queue.offer(queue, command),
    );
  }

  /**
   * Process commands from queue
   */
  process(
    handler: (command: C) => Effect.Effect<void, CommandError, any>,
  ): Effect.Effect<void, never, any> {
    return Effect.flatMap(
      this.queue,
      (queue) =>
        pipe(
          Stream.fromQueue(queue),
          Stream.mapEffect(handler),
          Stream.runDrain,
          Effect.catchAll(() => Effect.succeed(undefined)),
        ),
    );
  }

  /**
   * Process with concurrency
   */
  processConcurrent(
    handler: (command: C) => Effect.Effect<void, CommandError, any>,
    concurrency: number,
  ): Effect.Effect<void, never, any> {
    return Effect.flatMap(
      this.queue,
      (queue) =>
        pipe(
          Stream.fromQueue(queue),
          Stream.mapEffect(handler, { concurrency }),
          Stream.runDrain,
          Effect.catchAll(() => Effect.succeed(undefined)),
        ),
    );
  }
}
