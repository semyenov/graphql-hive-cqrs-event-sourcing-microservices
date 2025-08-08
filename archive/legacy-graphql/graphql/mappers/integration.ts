// Integration layer between GraphQL types and domain events
// This ensures type safety across all boundaries

import type {
  CreateUserInput as GraphQLCreateUserInput,
  UpdateUserInput as GraphQLUpdateUserInput,
  MutationCreateUserArgs,
  MutationUpdateUserArgs,
  MutationDeleteUserArgs,
} from '../../types/generated/resolvers';

import type { ICommand, ICommandResult } from '../../core/types';
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
} from '../../domain/events/user-events';

import type { AggregateId, UserId } from '../../core/branded';

// ============================================================================
// GraphQL Input to Domain Event Data Mapping
// ============================================================================

// Type-safe conversion from GraphQL input to domain event data
export type GraphQLToDomainMapper<TGraphQLInput, TDomainData> = (
  input: TGraphQLInput
) => TDomainData;

// Specific mappers for user operations
export const createUserMapper: GraphQLToDomainMapper<
  GraphQLCreateUserInput,
  UserCreatedEvent['data']
> = (input) => ({
  name: input.name,
  email: input.email,
});

export const updateUserMapper: GraphQLToDomainMapper<
  GraphQLUpdateUserInput,
  UserUpdatedEvent['data']
> = (input) => ({
  ...(input.name !== undefined && input.name !== null && { name: input.name }),
  ...(input.email !== undefined && input.email !== null && { email: input.email }),
});

// ============================================================================
// Command Factory with GraphQL Integration
// ============================================================================

// Enhanced command interface with GraphQL metadata
export interface GraphQLCommand<
  TArgs extends Record<string, unknown>,
  TEvent
> extends ICommand {
  graphqlArgs: TArgs;
  operationName?: string;
  clientInfo?: {
    name: string;
    version: string;
  };
}

// Command factories for GraphQL mutations
export const createUserCommand = (
  args: MutationCreateUserArgs,
  aggregateId: AggregateId,
  metadata?: { operationName?: string; clientInfo?: any }
): GraphQLCommand<MutationCreateUserArgs, UserCreatedEvent> => ({
  type: 'CreateUser',
  aggregateId,
  payload: createUserMapper(args.input),
  graphqlArgs: args,
  operationName: metadata?.operationName,
  clientInfo: metadata?.clientInfo,
  execute: async () => {
    // This would be implemented by the command handler
    throw new Error('Command execution not implemented in factory');
  },
});

export const updateUserCommand = (
  args: MutationUpdateUserArgs,
  metadata?: { operationName?: string; clientInfo?: any }
): GraphQLCommand<MutationUpdateUserArgs, UserUpdatedEvent> => ({
  type: 'UpdateUser',
  aggregateId: args.id,
  payload: updateUserMapper(args.input),
  graphqlArgs: args,
  operationName: metadata?.operationName,
  clientInfo: metadata?.clientInfo,
  execute: async () => {
    throw new Error('Command execution not implemented in factory');
  },
});

export const deleteUserCommand = (
  args: MutationDeleteUserArgs,
  metadata?: { operationName?: string; clientInfo?: any }
): GraphQLCommand<MutationDeleteUserArgs, UserDeletedEvent> => ({
  type: 'DeleteUser',
  aggregateId: args.id,
  payload: {},
  graphqlArgs: args,
  operationName: metadata?.operationName,
  clientInfo: metadata?.clientInfo,
  execute: async () => {
    throw new Error('Command execution not implemented in factory');
  },
});

// ============================================================================
// Resolver Integration Helpers
// ============================================================================

// Type-safe resolver wrapper that converts GraphQL args to commands
export type GraphQLCommandResolver<
  TArgs,
  TPayload,
  TResult extends Event
> = (
  parent: unknown,
  args: TArgs,
  context: { userId?: UserId; requestId?: string },
  info: { operation: { name?: { value: string } } }
) => Promise<CommandResult<TResult>>;

// Command execution wrapper with error handling
export const executeCommand = async <TEvent extends Event>(
  command: GraphQLCommand<any, TEvent>,
  handler: (cmd: GraphQLCommand<any, TEvent>) => Promise<CommandResult<TEvent>>
): Promise<CommandResult<TEvent>> => {
  try {
    const result = await handler(command);
    return {
      success: true,
      events: result.events,
      metadata: {
        executionTime: Date.now() - (result.metadata?.executionTime ?? Date.now()),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      metadata: {
        executionTime: 0,
      },
    };
  }
};

// ============================================================================
// Event to GraphQL Response Mapping
// ============================================================================

// Type-safe conversion from domain events to GraphQL response types
export type EventToGraphQLMapper<TEvent, TGraphQLResponse> = (
  event: TEvent
) => TGraphQLResponse;

// Response builders for GraphQL mutations
export const buildCreateUserResponse = (
  result: ICommandResult<UserCreatedEvent[]>
): import('../../types/generated/resolvers').CreateUserPayload => ({
  success: result.success,
  user: result.success && result.events?.[0] ? {
    id: result.events[0].aggregateId,
    name: result.events[0].data.name,
    email: result.events[0].data.email,
    createdAt: result.events[0].timestamp.toISOString(),
    updatedAt: result.events[0].timestamp.toISOString(),
  } : null,
  errors: result.error ? [{
    message: result.error.message,
    field: null,
  }] : null,
});

export const buildUpdateUserResponse = (
  result: ICommandResult<UserUpdatedEvent[]>,
  currentUser?: import('../../types/generated/resolvers').User
): import('../../types/generated/resolvers').UpdateUserPayload => ({
  success: result.success,
  user: result.success && result.events?.[0] && currentUser ? {
    ...currentUser,
    ...(result.events[0].data.name && { name: result.events[0].data.name }),
    ...(result.events[0].data.email && { email: result.events[0].data.email }),
    updatedAt: result.events[0].timestamp.toISOString(),
  } : null,
  errors: result.error ? [{
    message: result.error.message,
    field: null,
  }] : null,
});

export const buildDeleteUserResponse = (
  result: ICommandResult<UserDeletedEvent[]>
): import('../../types/generated/resolvers').DeleteUserPayload => ({
  success: result.success,
  errors: result.error ? [{
    message: result.error.message,
    field: null,
  }] : null,
});

// ============================================================================
// Type Guards for GraphQL Operations
// ============================================================================

// Type guards to ensure proper operation routing
export const isQueryOperation = (
  operationType: string
): operationType is 'query' => operationType === 'query';

export const isMutationOperation = (
  operationType: string
): operationType is 'mutation' => operationType === 'mutation';

export const isSubscriptionOperation = (
  operationType: string
): operationType is 'subscription' => operationType === 'subscription';

// ============================================================================
// Validation Helpers
// ============================================================================

// GraphQL input validation that produces domain-compatible errors
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

export const validateCreateUserInput = (
  input: GraphQLCreateUserInput
): ValidationResult => {
  const errors: ValidationResult['errors'] = [];

  if (!input.name || input.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Name must be at least 2 characters long',
      code: 'MIN_LENGTH',
    });
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_FORMAT',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateUpdateUserInput = (
  input: GraphQLUpdateUserInput
): ValidationResult => {
  const errors: ValidationResult['errors'] = [];

  if (input.name !== undefined && input.name !== null && input.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Name must be at least 2 characters long',
      code: 'MIN_LENGTH',
    });
  }

  if (input.email !== undefined && input.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_FORMAT',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};