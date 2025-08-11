/**
 * Effect-based Core Types
 *
 * Core domain types for the Effect-based CQRS/Event Sourcing framework
 */

import type {
  AggregateId,
  AggregateVersion,
  Timestamp,
} from "../../core/branded/types";

/**
 * Base command interface
 */
export interface ICommand {
  readonly type: string;
  readonly aggregateId: AggregateId;
  readonly payload: unknown;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Command handler interface
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = unknown> {
  readonly canHandle: (command: ICommand) => boolean;
  readonly handle: (command: TCommand) => Promise<TResult>;
}

/**
 * Command result
 */
export interface ICommandResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: unknown;
}

/**
 * Base event interface
 */
export interface IEvent<TType extends string = string, TData = unknown> {
  readonly type: TType;
  readonly data: TData;
  readonly aggregateId: AggregateId;
  readonly version: AggregateVersion;
  readonly timestamp: Timestamp;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type EventHandler<TEvent extends IEvent> = (
  event: TEvent,
) => void | Promise<void>;

/**
 * Event store interface
 */
export interface IEventStore<
  TEvent extends IEvent = IEvent,
  TId extends AggregateId = AggregateId,
> {
  readonly getEvents: <TType extends TEvent["type"]>(
    aggregateId: TId,
    fromVersion?: AggregateVersion,
  ) => Promise<ReadonlyArray<Extract<TEvent, { type: TType }>>>;

  // readonly getEventsByStream: <TType extends TEvent["type"]>(
  //   streamId: TId,
  //   fromVersion?: AggregateVersion,
  // ) => Promise<ReadonlyArray<Extract<TEvent, { type: TType }>>>;

  readonly appendBatch: <TType extends TEvent["type"]>(
    events: ReadonlyArray<Extract<TEvent, { type: TType }>>,
    expectedVersion?: AggregateVersion,
  ) => Promise<void>;

  // readonly appendToStream: <TType extends TEvent["type"]>(
  //   streamId: TId,
  //   events: ReadonlyArray<Extract<TEvent, { type: TType }>>,
  //   expectedVersion?: AggregateVersion,
  // ) => Promise<void>;

  // readonly saveEvents: <TType extends TEvent["type"]>(
  //   aggregateId: TId,
  //   events: ReadonlyArray<Extract<TEvent, { type: TType }>>,
  //   expectedVersion?: AggregateVersion,
  // ) => Promise<void>;

  readonly getAllEvents: <TType extends TEvent["type"]>() => Promise<
    ReadonlyArray<Extract<TEvent, { type: TType }>>
  >;
  readonly subscribe: <TType extends TEvent["type"]>(
    handler: EventHandler<TEvent>,
  ) => void;
}

/**
 * Aggregate behavior interface
 */
export interface IAggregateBehavior<
  TState,
  TEvent extends IEvent = IEvent,
  TId extends AggregateId = AggregateId,
> {
  readonly id: TId;
  readonly version: AggregateVersion;
  readonly uncommittedEvents: ReadonlyArray<TEvent>;
  readonly markEventsAsCommitted: () => void;
}

/**
 * Aggregate snapshot interface
 */
export interface ISnapshot<TState = unknown> {
  readonly aggregateId: AggregateId;
  readonly version: AggregateVersion;
  readonly state: TState;
  readonly timestamp: Timestamp;
}

/**
 * Base query interface
 */
export interface IQuery {
  readonly type: string;
  readonly parameters?: Record<string, unknown>;
}

/**
 * Query handler interface
 */
export interface IQueryHandler<TQuery extends IQuery, TResult = unknown> {
  readonly canHandle: (query: IQuery) => boolean;
  readonly handle: (query: TQuery) => Promise<TResult>;
}

/**
 * Projection builder interface
 */
export interface IProjectionBuilder<TEvent extends IEvent, TState> {
  readonly initialState: TState;
  readonly handle: (state: TState, event: TEvent) => TState;
}

/**
 * Command bus interface
 */
export interface ICommandBus {
  readonly send: <TCommand extends ICommand>(
    command: TCommand,
  ) => Promise<unknown>;
}

/**
 * Query bus interface
 */
export interface IQueryBus {
  readonly ask: <TQuery extends IQuery>(query: TQuery) => Promise<unknown>;
}

/**
 * Event bus interface
 */
export interface IEventBus {
  readonly publish: <TEvent extends IEvent>(event: TEvent) => Promise<void>;
  readonly subscribe: <TEvent extends IEvent>(
    handler: EventHandler<TEvent>,
  ) => void;
}

/**
 * Query result interface
 */
export interface IQueryResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: unknown;
}

/**
 * Projection interface
 */
export interface IProjection<TState> {
  readonly getState: () => TState;
  readonly reset: () => void;
}
