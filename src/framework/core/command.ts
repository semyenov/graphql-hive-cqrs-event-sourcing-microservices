/**
 * Framework Core: Command Types and Interfaces
 * 
 * Commands represent intentions to change state in the system.
 * They are processed by command handlers which generate events.
 */

import type { AggregateId } from './branded/types';
import type { IEventMetadata } from './event';

/**
 * Base command interface - represents an intent to change state
 * @template TType - Command type discriminator
 * @template TPayload - Command data payload
 */
export interface ICommand<
  TType extends string = string,
  TPayload = unknown
> {
  readonly type: TType;
  readonly aggregateId: AggregateId;
  readonly payload: TPayload;
  readonly metadata?: IEventMetadata;
}

/**
 * Command result with success/failure indication
 */
export interface ICommandResult<TData = unknown, TError = Error> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: TError;
  readonly metadata?: {
    readonly executionTime: number;
    readonly retryCount?: number;
    readonly version?: number;
  };
}

/**
 * Command handler interface
 */
export interface ICommandHandler<
  TCommand extends ICommand,
  TResult = ICommandResult
> {
  handle(command: TCommand): Promise<TResult>;
  canHandle(command: ICommand): boolean;
}

/**
 * Command bus for routing commands to handlers
 */
export interface ICommandBus {
  send<TCommand extends ICommand, TResult = ICommandResult>(
    command: TCommand
  ): Promise<TResult>;
  register<TCommand extends ICommand>(
    handler: ICommandHandler<TCommand>
  ): void;
}

/**
 * Command validator interface
 */
export interface ICommandValidator<TCommand extends ICommand> {
  validate(command: TCommand): Promise<ValidationResult>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors?: ReadonlyArray<ValidationError>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}

/**
 * Command middleware for cross-cutting concerns
 */
export interface ICommandMiddleware {
  execute<TCommand extends ICommand, TResult>(
    command: TCommand,
    next: (command: TCommand) => Promise<TResult>
  ): Promise<TResult>;
}

/**
 * Command factory type for creating commands
 */
export type CommandFactory<TCommand extends ICommand> = (
  aggregateId: AggregateId,
  payload: TCommand['payload'],
  metadata?: IEventMetadata
) => TCommand;

/**
 * Extract command payload type
 */
export type ExtractCommandPayload<TCommand extends ICommand> = TCommand['payload'];

/**
 * Extract command type
 */
export type ExtractCommandType<TCommand extends ICommand> = TCommand['type'];

/**
 * Command pattern matching for type-safe command handling
 */
export type CommandPattern<TCommand extends ICommand, TResult> = {
  readonly [K in TCommand['type']]: (
    command: Extract<TCommand, { type: K }>
  ) => Promise<TResult>;
};

/**
 * Saga interface for handling cross-aggregate transactions
 */
export interface ISaga<TCommand extends ICommand> {
  handleCommand(command: TCommand): Promise<ICommand[]>;
  getHandledCommandTypes(): TCommand['type'][];
}