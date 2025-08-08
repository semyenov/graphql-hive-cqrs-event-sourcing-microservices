// Import types for internal use
import type {
  User as UserType,
  UserList as UserListType,
  Query as QueryType,
  CreateUserInput as CreateUserInputType,
  UpdateUserInput as UpdateUserInputType,
  CreateUserPayload as CreateUserPayloadType,
  UpdateUserPayload as UpdateUserPayloadType,
  DeleteUserPayload as DeleteUserPayloadType,
  Error as GraphQLErrorType,
  Mutation as MutationType,
  QueryGetUserArgs,
  QueryListUsersArgs,
  QuerySearchUsersArgs,
  MutationCreateUserArgs,
  MutationDeleteUserArgs,
  MutationUpdateUserArgs,
} from './generated/schema';

import type {
  ResolverFn as ResolverFnType,
} from './generated/resolvers';

// Export specific types from unified schema
export type {
  User,
  UserList,
  Query,
  QueryGetUserArgs,
  QueryListUsersArgs,
  QuerySearchUsersArgs,
  CreateUserInput,
  UpdateUserInput,
  CreateUserPayload,
  UpdateUserPayload,
  DeleteUserPayload,
  Error as GraphQLError,
  Mutation,
  MutationCreateUserArgs,
  MutationDeleteUserArgs,
  MutationUpdateUserArgs,
} from './generated/schema';

export type {
  QueryResolvers,
  MutationResolvers,
  Resolvers,
  ResolverFn,
  ResolverTypeWrapper,
  ResolversTypes,
  ResolversParentTypes,
} from './generated/resolvers';

// Common types (export from unified schema)
export type {
  Maybe,
  InputMaybe,
  Exact,
  MakeOptional,
  MakeMaybe,
  MakeEmpty,
  Incremental,
  Scalars,
} from './generated/schema';

// Re-export User type for backward compatibility
export type { User as UnifiedUser } from './generated/schema';

// Generic types for better type inference

// Extract the data type from a payload
export type ExtractPayloadData<T> = T extends { user?: infer U | null | undefined } ? U : never;

// Generic success/error payload type
export interface PayloadResult<TData = unknown, TError = GraphQLErrorType> {
  success: boolean;
  data?: TData | null;
  errors?: TError[] | null;
}

// Infer mutation input type from mutation name
export type InferMutationInput<TMutation extends keyof MutationType> =
  TMutation extends 'createUser' ? CreateUserInputType :
  TMutation extends 'updateUser' ? UpdateUserInputType :
  never;

// Infer mutation payload type from mutation name
export type InferMutationPayload<TMutation extends keyof MutationType> =
  TMutation extends 'createUser' ? CreateUserPayloadType :
  TMutation extends 'updateUser' ? UpdateUserPayloadType :
  TMutation extends 'deleteUser' ? DeleteUserPayloadType :
  never;

// Generic resolver with better type inference
export type TypedResolver<
  TResult,
  TArgs = {},
  TContext = unknown,
  TParent = unknown
> = ResolverFnType<TResult, TParent, TContext, TArgs>;

// Extract args type from resolver
export type ExtractResolverArgs<T> = T extends TypedResolver<unknown, infer TArgs> ? TArgs : never;

// Extract result type from resolver
export type ExtractResolverResult<T> = T extends TypedResolver<infer TResult> ? TResult : never;

// Type-safe query builder
export type QueryBuilder<TQuery extends keyof QueryType> = {
  [K in TQuery]: QueryType[K];
};

// Type-safe mutation builder
export type MutationBuilder<TMutation extends keyof MutationType> = {
  [K in TMutation]: MutationType[K];
};

// Type guards with generics
export const isPayloadSuccess = <T extends PayloadResult>(
  payload: T
): payload is T & { success: true; data: NonNullable<T['data']> } => {
  return payload.success === true && payload.data != null;
};

export const hasErrors = <T extends { errors?: unknown[] | null }>(
  payload: T
): payload is T & { errors: NonNullable<T['errors']> } => {
  return Array.isArray(payload.errors) && payload.errors.length > 0;
};

// Map GraphQL types to domain event types
export type CreateUserEventData = Pick<CreateUserInputType, 'name' | 'email'>;
export type UpdateUserEventData = Partial<UpdateUserInputType>;

// Conditional types for nullable handling
export type NonNullableFields<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Type-safe field selector
export type FieldSelector<T, K extends keyof T = keyof T> = {
  [P in K]: T[P];
};

// Extract nested type from GraphQL response
export type ExtractType<T, K extends keyof T> = T[K];

// Utility type to make specific fields optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type to make specific fields required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Export branded types
export * from '../core/branded';

// Export validation types
export {
  type MinLength,
  type MaxLength,
  type ValidEmail,
  type ValidUUID,
  type Range,
  type Pattern,
  type ValidationResult,
  type ValidationError,
  type ValidationErrorCode,
  type Validator,
  type AsyncValidator,
  type ValidatorChain,
  type FieldValidation,
  type ValidationSchema,
  ValidationBuilder,
  validate,
  validateAsync,
  ValidationException,
} from './validation';

// Export error types
export * from '../core/errors';

// Export event types from generic-types
export type {
  Event,
  EventType,
  EventTypes,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  UserEvent,
  EventMetadata,
  EnhancedEvent,
  EventHandler,
  EventReducer,
  Command,
  CommandFactory,
  Projection,
  Snapshot,
  ExtractEventData,
  ExtractAggregateId,
  EventPattern,
  InferAggregateState,
} from '../events/generic-types';

// Export event utilities
export {
  createTypeGuard,
  isUserCreatedEvent,
  isUserUpdatedEvent,
  isUserDeletedEvent,
  createEvent,
  EventFactories,
  foldEvents,
  matchEvent,
} from '../events/generic-types';

// Export event interfaces
export type {
  IEventStore,
  IAggregate,
  IAggregateInternal,
  IAggregateConstructor,
  ICommandHandler,
  IAggregateRepository,
  IProjectionBuilder,
  IQueryHandler,
  ISaga,
  ISnapshotStore,
  IEventHandler,
  IAggregateFactory,
} from '../events/interfaces';

// Export schema interfaces
export type {
  IErrorResponseBuilder,
  ISuccessResponseBuilder,
  IMutationResolverFactory,
  IQueryContext,
  IMutationContext,
  IResolverContextFactory,
  ISchemaBuilder,
  IRepositoryProvider,
  IEventPublisher,
  ICommandBus,
  IQueryBus,
} from '../schemas/interfaces';