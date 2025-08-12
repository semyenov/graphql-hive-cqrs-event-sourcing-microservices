/**
 * Functional Command Handler Pattern
 * 
 * Pure functions for command processing without classes or 'this' context
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type { Aggregate, CommandDecision, EventApplicator } from "./aggregate"
import type { DomainEvent, Command } from "../schema/core/messages"
import type { AggregateId } from "../schema/core/primitives"

// ============================================================================
// Command Handler Types
// ============================================================================

/**
 * Command validation function
 */
export type CommandValidator<Cmd, Error = never, Requirements = never> = (
  command: Cmd
) => Effect.Effect<void, Error, Requirements>

/**
 * Command executor function
 */
export type CommandExecutor<State, Cmd, Event extends DomainEvent, Error = never, Requirements = never> = (
  aggregate: Aggregate<State, Event>,
  command: Cmd
) => Effect.Effect<ReadonlyArray<Event>, Error, Requirements>

/**
 * Command handler configuration
 */
export interface CommandHandlerConfig<
  State,
  Cmd extends Command,
  Event extends DomainEvent,
  Error = never,
  Requirements = never
> {
  readonly name: string
  readonly commandType: string
  readonly validate?: CommandValidator<Cmd, Error, Requirements>
  readonly execute: CommandExecutor<State, Cmd, Event, Error, Requirements>
  readonly applicator: EventApplicator<State, Event>
  readonly retry?: {
    readonly schedule: Schedule.Schedule<unknown, Error, never>
    readonly filter?: (error: Error) => boolean
  }
  readonly timeout?: Duration.Duration
}

/**
 * Command handler function
 */
export interface CommandHandlerFn<
  State,
  Cmd extends Command,
  Event extends DomainEvent,
  Error = never,
  Requirements = never
> {
  (
    aggregate: Aggregate<State, Event>,
    command: Cmd
  ): Effect.Effect<Aggregate<State, Event>, Error, Requirements>
  readonly config: CommandHandlerConfig<State, Cmd, Event, Error, Requirements>
}

// ============================================================================
// Command Handler Creation
// ============================================================================

/**
 * Create a command handler function
 */
export const createCommandHandler = <
  State,
  Cmd extends Command,
  Event extends DomainEvent,
  Error = never,
  Requirements = never
>(
  config: CommandHandlerConfig<State, Cmd, Event, Error, Requirements>
): CommandHandlerFn<State, Cmd, Event, Error, Requirements> => {
  const handler: CommandHandlerFn<State, Cmd, Event, Error, Requirements> = (aggregate, command) =>
    pipe(
      // Validate command if validator provided
      config.validate ? config.validate(command) : Effect.void,
      // Execute command to get events
      Effect.flatMap(() => config.execute(aggregate, command)),
      // Apply retry strategy if configured
      config.retry
        ? Effect.retry(config.retry.schedule)
        : (x: Effect.Effect<ReadonlyArray<Event>, Error, Requirements>) => x,
      // Apply timeout if configured
      config.timeout
        ? Effect.timeout(config.timeout)
        : (x: Effect.Effect<ReadonlyArray<Event>, Error, Requirements>) => x,
      // Apply events to aggregate
      Effect.map((events) => {
        return events.reduce(
          (agg, event) => ({
            ...agg,
            state: config.applicator(agg.state, event),
            version: (agg.version + 1) as any,
            uncommittedEvents: [...agg.uncommittedEvents, event],
          }),
          aggregate
        )
      })
    )

  handler.config = config
  return handler
}

/**
 * Compose multiple command handlers
 */
export const composeHandlers = <
  State,
  Event extends DomainEvent,
  Error = never,
  Requirements = never
>(
  handlers: ReadonlyArray<CommandHandlerFn<State, any, Event, Error, Requirements>>
): (<Cmd extends Command>(
  aggregate: Aggregate<State, Event>,
  command: Cmd
) => Effect.Effect<Aggregate<State, Event>, Error | UnhandledCommandError, Requirements>) => {
  const handlerMap = handlers.reduce(
    (map, handler) => HashMap.set(map, handler.config.commandType, handler),
    HashMap.empty<string, CommandHandlerFn<State, any, Event, Error, Requirements>>()
  )

  return (aggregate, command) =>
    pipe(
      HashMap.get(handlerMap, command.type),
      Option.match({
        onNone: () =>
          Effect.fail(
            new UnhandledCommandError({
              commandType: command.type,
              availableHandlers: Array.from(HashMap.keys(handlerMap)),
            })
          ),
        onSome: (handler) => handler(aggregate, command),
      })
    )
}

// ============================================================================
// Command Bus Service
// ============================================================================

/**
 * Command bus interface
 */
export interface CommandBus {
  readonly send: <State, Cmd extends Command, Event extends DomainEvent, Error>(
    aggregateId: AggregateId,
    command: Cmd
  ) => Effect.Effect<Aggregate<State, Event>, Error | CommandBusError>
  
  readonly register: <State, Cmd extends Command, Event extends DomainEvent, Error>(
    handler: CommandHandlerFn<State, Cmd, Event, Error>
  ) => Effect.Effect<void>
}

/**
 * Command bus errors
 */
export class CommandBusError {
  readonly _tag = "CommandBusError"
  constructor(
    readonly reason: "HandlerNotFound" | "AggregateNotFound" | "ConcurrencyConflict",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

export class UnhandledCommandError {
  readonly _tag = "UnhandledCommandError"
  constructor(
    readonly details: {
      readonly commandType: string
      readonly availableHandlers: ReadonlyArray<string>
    }
  ) {}
}

/**
 * Command bus service tag
 */
export const CommandBus = Context.GenericTag<CommandBus>("CommandBus")

// ============================================================================
// Command Pipeline
// ============================================================================

/**
 * Middleware for command processing
 */
export type CommandMiddleware<Error = never, Requirements = never> = <
  State,
  Cmd extends Command,
  Event extends DomainEvent
>(
  next: (
    aggregate: Aggregate<State, Event>,
    command: Cmd
  ) => Effect.Effect<Aggregate<State, Event>, Error, Requirements>
) => (
  aggregate: Aggregate<State, Event>,
  command: Cmd
) => Effect.Effect<Aggregate<State, Event>, Error, Requirements>

/**
 * Logging middleware
 */
export const loggingMiddleware: CommandMiddleware = (next) => (aggregate, command) =>
  pipe(
    Effect.log(`Processing command: ${command.type} for aggregate: ${aggregate.id}`),
    Effect.flatMap(() => next(aggregate, command)),
    Effect.tap((result) =>
      Effect.log(`Command processed: ${result.uncommittedEvents.length} events generated`)
    )
  )

/**
 * Metrics middleware
 */
export const metricsMiddleware = (
  recordMetric: (commandType: string, duration: number, success: boolean) => Effect.Effect<void>
): CommandMiddleware => (next) => (aggregate, command) =>
  pipe(
    Effect.succeed(Date.now()),
    Effect.flatMap((startTime) =>
      pipe(
        next(aggregate, command),
        Effect.tapBoth({
          onFailure: () =>
            recordMetric(command.type, Date.now() - startTime, false),
          onSuccess: () =>
            recordMetric(command.type, Date.now() - startTime, true),
        })
      )
    )
  )

/**
 * Apply middleware to command handler
 */
export const withMiddleware = <
  State,
  Cmd extends Command,
  Event extends DomainEvent,
  Error,
  Requirements
>(
  handler: CommandHandlerFn<State, Cmd, Event, Error, Requirements>,
  middleware: CommandMiddleware<Error, Requirements>
): CommandHandlerFn<State, Cmd, Event, Error, Requirements> => {
  const wrapped: CommandHandlerFn<State, Cmd, Event, Error, Requirements> = 
    middleware(handler) as any
  wrapped.config = handler.config
  return wrapped
}

// ============================================================================
// Command Validation Helpers
// ============================================================================

/**
 * Combine multiple validators
 */
export const combineValidators = <Cmd, Error, Requirements>(
  ...validators: ReadonlyArray<CommandValidator<Cmd, Error, Requirements>>
): CommandValidator<Cmd, Error, Requirements> => (command) =>
  Effect.all(validators.map((validator) => validator(command)), { discard: true })

/**
 * Conditional validator
 */
export const conditionalValidator = <Cmd, Error, Requirements>(
  condition: (command: Cmd) => boolean,
  validator: CommandValidator<Cmd, Error, Requirements>
): CommandValidator<Cmd, Error, Requirements> => (command) =>
  condition(command) ? validator(command) : Effect.void

// ============================================================================
// Command Result Builders
// ============================================================================

/**
 * Create success decision
 */
export const success = <Event extends DomainEvent>(
  events: ReadonlyArray<Event>
): CommandDecision<Event> => ({
  type: "success",
  events,
})

/**
 * Create failure decision
 */
export const failure = <Error>(error: Error): CommandDecision<never, Error> => ({
  type: "failure",
  error,
})

/**
 * Create no-op decision
 */
export const none = (): CommandDecision<never, never> => ({
  type: "none",
})