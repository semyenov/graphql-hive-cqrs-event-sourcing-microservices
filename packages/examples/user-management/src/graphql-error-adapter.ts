import type { DomainError } from '@cqrs-framework/types';

// Simple GraphQL error type matching our schema
export interface SimpleGraphQLError {
  field: string | null;
  message: string;
}

import type { Error as GraphQLError } from './generated/resolvers';

/**
 * Adapter to convert between DomainError and GraphQL Error types
 * This bridges the gap between our rich error types and the simple GraphQL schema
 */
export function toGraphQLError(error: DomainError): SimpleGraphQLError {
  // Extract field from validation errors, otherwise null
  const field = 'field' in error ? error.field || null : null;
  
  return {
    field,
    message: error.message
  };
}

/**
 * Convert array of DomainErrors to GraphQL errors
 */
export function toGraphQLErrors(errors: DomainError[]): SimpleGraphQLError[] {
  return errors.map(toGraphQLError);
}

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'DOMAIN' &&
    'message' in error
  );
}

/**
 * Convert any error to GraphQL error format
 */
export function errorToGraphQL(error: unknown): SimpleGraphQLError {
  if (isDomainError(error)) {
    return toGraphQLError(error);
  }
  
  // Fallback for non-domain errors
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  
  return {
    field: null,
    message
  };
}

/**
 * Create a GraphQL error with field information
 */
export function createFieldError(field: string, message: string): SimpleGraphQLError {
  return {
    field,
    message
  };
}

/**
 * Create a general GraphQL error without field information
 */
export function createGeneralError(message: string): SimpleGraphQLError {
  return {
    field: null,
    message
  };
}