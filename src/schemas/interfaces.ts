import type { GraphQLResolveInfo } from 'graphql';
import type { ResolverFn, ValidationError as DomainValidationError, AppError, ErrorFactory, UserId, TransactionId } from '../types';

// Error response builder interface
export interface IErrorResponseBuilder {
  build<T extends { success: boolean; errors?: Array<Pick<DomainValidationError, 'field' | 'message'>> | null }>(
    error: AppError | unknown
  ): T;
}

// Success response builder interface
export interface ISuccessResponseBuilder {
  build<TPayload extends { success: boolean }>(
    data: Omit<TPayload, 'success'>
  ): TPayload;
}

// Mutation resolver factory interface
export interface IMutationResolverFactory {
  create<TArgs, TResult>(
    handler: (args: TArgs) => Promise<TResult>
  ): ResolverFn<TResult | { success: boolean; errors?: unknown[] | null }, {}, unknown, TArgs>;
}

// Query context interface
export interface IQueryContext {
  rebuildProjections?: boolean;
  userId?: UserId;
}

// Mutation context interface
export interface IMutationContext extends IQueryContext {
  transactionId?: TransactionId;
}

// Resolver context factory interface
export interface IResolverContextFactory<TContext> {
  create(request: unknown): TContext;
}

// Schema builder interface
export interface ISchemaBuilder {
  buildTypeDefs(): string;
  buildResolvers(): Record<string, unknown>;
}

// Repository provider interface
export interface IRepositoryProvider<TRepository> {
  getRepository(): TRepository;
}

// Event publisher interface
export interface IEventPublisher<TEvent> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
}

// Command bus interface
export interface ICommandBus<TCommand, TResult> {
  send(command: TCommand): Promise<TResult>;
}

// Query bus interface
export interface IQueryBus<TQuery, TResult> {
  ask(query: TQuery): Promise<TResult>;
}

