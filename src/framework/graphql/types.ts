/**
 * Framework GraphQL: Type Definitions
 * 
 * Core types for GraphQL-to-CQRS bridge.
 */

import type { 
  ICommand, 
  IAggregateCommand, 
  ICommandResult,
  ICommandBus
} from '../core/command';
import type { 
  IQuery, 
  IQueryBus 
} from '../core/query';
import type { 
  IEvent, 
  IEventBus 
} from '../core/event';
import type { AggregateId } from '../core/branded/types';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';

/**
 * GraphQL context with CQRS infrastructure
 */
export interface IGraphQLContext {
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly eventBus: IEventBus<IEvent>;
  readonly requestId?: string;
  readonly userId?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * GraphQL error with extensions
 */
export interface IGraphQLError {
  readonly message: string;
  readonly code?: string;
  readonly field?: string;
  readonly extensions?: Record<string, unknown>;
}

/**
 * GraphQL mutation response pattern
 */
export interface IGraphQLMutationResponse<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly errors?: IGraphQLError[];
}

/**
 * Mutation resolver configuration
 */
export interface IMutationResolverConfig<
  TArgs = unknown,
  TCommand extends ICommand = ICommand,
  TResult = unknown
> {
  readonly commandType: TCommand['type'];
  readonly mapInput: (args: TArgs, context: IGraphQLContext) => {
    aggregateId?: AggregateId;
    payload: TCommand['payload'];
    metadata?: Record<string, unknown>;
  };
  readonly mapResult?: (result: ICommandResult, args: TArgs) => TResult;
  readonly validate?: (args: TArgs) => Promise<IGraphQLError[]>;
}

/**
 * Query resolver configuration
 */
export interface IQueryResolverConfig<
  TArgs = unknown,
  TQuery extends IQuery = IQuery,
  TResult = unknown
> {
  readonly queryType: TQuery['type'];
  readonly mapParams: (args: TArgs, context: IGraphQLContext) => TQuery['parameters'];
  readonly mapResult?: (result: unknown, args: TArgs) => TResult;
  readonly cache?: {
    readonly ttl?: number;
    readonly key?: (args: TArgs) => string;
  };
}

/**
 * Subscription resolver configuration
 */
export interface ISubscriptionResolverConfig<
  TArgs = unknown,
  TEvent extends IEvent = IEvent,
  TPayload = unknown
> {
  readonly eventTypes: TEvent['type'][];
  readonly filter?: (event: TEvent, args: TArgs, context: IGraphQLContext) => boolean;
  readonly mapPayload: (event: TEvent, args: TArgs) => TPayload;
}

/**
 * Resolver factory result
 */
export type ResolverFunction<TParent = unknown, TArgs = unknown, TContext = IGraphQLContext, TResult = unknown> = 
  GraphQLFieldResolver<TParent, TContext, TArgs, TResult>;

/**
 * Command input mapper
 */
export type CommandInputMapper<TArgs, TCommand extends ICommand> = (
  args: TArgs,
  context: IGraphQLContext
) => Omit<TCommand, 'type'>;

/**
 * Query params mapper
 */
export type QueryParamsMapper<TArgs, TQuery extends IQuery> = (
  args: TArgs,
  context: IGraphQLContext
) => TQuery['parameters'];

/**
 * Result mapper
 */
export type ResultMapper<TFrom, TTo> = (result: TFrom, originalArgs?: unknown) => TTo;

/**
 * GraphQL resolver builder options
 */
export interface IResolverBuilderOptions {
  readonly errorHandler?: (error: Error) => IGraphQLError;
  readonly middleware?: Array<(
    args: unknown,
    context: IGraphQLContext,
    info: GraphQLResolveInfo
  ) => Promise<void>>;
  readonly metrics?: {
    readonly enabled: boolean;
    readonly collector?: (
      operation: string,
      duration: number,
      success: boolean
    ) => void;
  };
}

/**
 * Schema builder configuration
 */
export interface ISchemaBuilderConfig {
  readonly domains: Array<{
    readonly name: string;
    readonly typeDefs: string;
    readonly resolvers: Record<string, unknown>;
  }>;
  readonly baseTypeDefs?: string;
  readonly directives?: Record<string, unknown>;
  readonly scalars?: Record<string, unknown>;
}

/**
 * Type guards
 */
export function isGraphQLMutationResponse(value: unknown): value is IGraphQLMutationResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as IGraphQLMutationResponse).success === 'boolean'
  );
}

export function isGraphQLError(value: unknown): value is IGraphQLError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as IGraphQLError).message === 'string'
  );
}

/**
 * Helper type for extracting resolver args
 */
export type ExtractResolverArgs<T> = T extends ResolverFunction<any, infer TArgs> ? TArgs : never;

/**
 * Helper type for extracting resolver result
 */
export type ExtractResolverResult<T> = T extends ResolverFunction<any, any, any, infer TResult> ? TResult : never;