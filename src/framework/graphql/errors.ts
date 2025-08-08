/**
 * Framework GraphQL: Error Handling
 * 
 * Error transformation and handling for GraphQL responses.
 */

import type { IGraphQLError, IGraphQLMutationResponse } from './types';
import type { ValidationError, ICommandResult } from '../core/command';
import { GraphQLError as GraphQLErrorClass } from 'graphql';

/**
 * Error codes for GraphQL errors
 */
export enum GraphQLErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Convert validation errors to GraphQL errors
 */
export function validationErrorsToGraphQL(
  errors: ValidationError[]
): IGraphQLError[] {
  return errors.map(error => ({
    message: error.message,
    field: error.field,
    code: error.code || GraphQLErrorCode.VALIDATION_ERROR,
    extensions: {
      field: error.field,
      code: error.code || GraphQLErrorCode.VALIDATION_ERROR,
    },
  }));
}

/**
 * Convert command result to GraphQL mutation response
 */
export function commandResultToGraphQLResponse<TData = unknown>(
  result: ICommandResult<TData>,
  dataMapper?: (data: TData) => unknown
): IGraphQLMutationResponse {
  if (result.success && result.data !== undefined) {
    return {
      success: true,
      data: dataMapper ? dataMapper(result.data) : result.data,
      errors: undefined,
    };
  }

  return {
    success: false,
    data: undefined,
    errors: result.error ? [errorToGraphQL(result.error)] : undefined,
  };
}

/**
 * Convert generic error to GraphQL error
 */
export function errorToGraphQL(error: unknown): IGraphQLError {
  // Handle Error instances
  if (error instanceof Error) {
    // Check if it's already a GraphQL error
    if (error instanceof GraphQLErrorClass) {
      return {
        message: error.message,
        code: error.extensions?.code as string || GraphQLErrorCode.INTERNAL_ERROR,
        extensions: error.extensions as Record<string, unknown>,
      };
    }

    // Handle domain errors with specific patterns
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('not found')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.NOT_FOUND,
        extensions: { code: GraphQLErrorCode.NOT_FOUND },
      };
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.UNAUTHORIZED,
        extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
      };
    }
    
    if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.FORBIDDEN,
        extensions: { code: GraphQLErrorCode.FORBIDDEN },
      };
    }
    
    if (errorMessage.includes('conflict') || errorMessage.includes('already exists')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.CONFLICT,
        extensions: { code: GraphQLErrorCode.CONFLICT },
      };
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.VALIDATION_ERROR,
        extensions: { code: GraphQLErrorCode.VALIDATION_ERROR },
      };
    }
    
    if (errorMessage.includes('timeout')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.TIMEOUT,
        extensions: { code: GraphQLErrorCode.TIMEOUT },
      };
    }
    
    if (errorMessage.includes('rate limit')) {
      return {
        message: error.message,
        code: GraphQLErrorCode.RATE_LIMITED,
        extensions: { code: GraphQLErrorCode.RATE_LIMITED },
      };
    }

    // Default error
    return {
      message: error.message,
      code: GraphQLErrorCode.INTERNAL_ERROR,
      extensions: {
        code: GraphQLErrorCode.INTERNAL_ERROR,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: GraphQLErrorCode.INTERNAL_ERROR,
      extensions: { code: GraphQLErrorCode.INTERNAL_ERROR },
    };
  }

  // Handle objects with message property
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return {
      message: (error as { message: string }).message,
      code: GraphQLErrorCode.INTERNAL_ERROR,
      extensions: { code: GraphQLErrorCode.INTERNAL_ERROR },
    };
  }

  // Fallback for unknown error types
  return {
    message: 'An unexpected error occurred',
    code: GraphQLErrorCode.INTERNAL_ERROR,
    extensions: {
      code: GraphQLErrorCode.INTERNAL_ERROR,
      error: String(error),
    },
  };
}

/**
 * Create a GraphQL error with extensions
 */
export function createGraphQLError(
  message: string,
  code: GraphQLErrorCode = GraphQLErrorCode.INTERNAL_ERROR,
  extensions?: Record<string, unknown>
): GraphQLErrorClass {
  return new GraphQLErrorClass(message, {
    extensions: {
      code,
      ...extensions,
    },
  });
}

/**
 * Wrap async resolver with error handling
 */
export function withErrorHandling<TArgs, TResult>(
  resolver: (args: TArgs) => Promise<TResult>,
  options?: {
    mapError?: (error: unknown) => IGraphQLError;
    returnMutationResponse?: boolean;
  }
): (args: TArgs) => Promise<TResult | IGraphQLMutationResponse> {
  return async (args: TArgs) => {
    try {
      const result = await resolver(args);
      return result;
    } catch (error) {
      const graphqlError = options?.mapError
        ? options.mapError(error)
        : errorToGraphQL(error);

      if (options?.returnMutationResponse) {
        return {
          success: false,
          errors: [graphqlError],
        } as unknown as TResult | IGraphQLMutationResponse;
      }

      throw createGraphQLError(
        graphqlError.message,
        graphqlError.code as GraphQLErrorCode,
        graphqlError.extensions
      );
    }
  };
}

/**
 * Aggregate multiple errors into a single GraphQL error
 */
export function aggregateErrors(errors: IGraphQLError[]): GraphQLErrorClass {
  if (errors.length === 0) {
    return createGraphQLError('Unknown error occurred');
  }

  if (errors.length === 1) {
    const error = errors[0];
    return createGraphQLError(
      error?.message ?? 'Unknown error occurred',
      error?.code as GraphQLErrorCode,
      error?.extensions
    );
  }

  const message = errors.map(e => e.message).join('; ');
  const fields = errors
    .filter(e => e.field)
    .map(e => e.field);

  return createGraphQLError(
    message,
    GraphQLErrorCode.VALIDATION_ERROR,
    {
      errors: errors,
      fields: fields.length > 0 ? fields : undefined,
    }
  );
}