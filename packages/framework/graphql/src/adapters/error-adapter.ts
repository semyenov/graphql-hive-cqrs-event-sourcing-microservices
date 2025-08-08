// Universal GraphQL Error Adapter for CQRS framework
// Converts rich domain errors to simple GraphQL error format

import type { 
  DomainError, 
  ValidationError, 
  AppError,
  BaseError,
} from '@cqrs-framework/core';

// Simple GraphQL error type that matches common GraphQL schemas
export interface GraphQLError {
  field: string | null;
  message: string;
  code?: string;
  path?: (string | number)[];
}

// Extended GraphQL error with additional metadata
export interface ExtendedGraphQLError extends GraphQLError {
  extensions?: {
    code?: string;
    timestamp?: string;
    correlationId?: string;
    category?: string;
    type?: string;
  };
}

/**
 * Convert a domain error to GraphQL error format
 */
export function toGraphQLError(error: BaseError): GraphQLError {
  let field: string | null = null;
  let code: string | undefined = undefined;

  // Extract field information from validation errors
  if ('field' in error && typeof error.field === 'string') {
    field = error.field;
  }

  // Extract code from branded error code
  if ('code' in error) {
    code = typeof error.code === 'string' ? error.code : String(error.code);
  }

  return {
    field,
    message: error.message,
    ...(code !== undefined && { code }),
  };
}

/**
 * Convert a domain error to extended GraphQL error format with metadata
 */
export function toExtendedGraphQLError(error: BaseError): ExtendedGraphQLError {
  const baseError = toGraphQLError(error);
  
  return {
    ...baseError,
    extensions: {
      ...(baseError.code !== undefined && { code: baseError.code }),
      timestamp: error.timestamp.toISOString(),
      ...(error.correlationId !== undefined && { correlationId: error.correlationId }),
      ...(('category' in error && error.category !== undefined && typeof error.category === 'string') && { category: error.category }),
      ...(('type' in error && error.type !== undefined && typeof error.type === 'string') && { type: error.type }),
    },
  };
}

/**
 * Convert array of domain errors to GraphQL errors
 */
export function toGraphQLErrors(errors: BaseError[]): GraphQLError[] {
  return errors.map(toGraphQLError);
}

/**
 * Convert array of domain errors to extended GraphQL errors
 */
export function toExtendedGraphQLErrors(errors: BaseError[]): ExtendedGraphQLError[] {
  return errors.map(toExtendedGraphQLError);
}

/**
 * Type guard to check if an error is a domain error
 */
export function isDomainError(error: unknown): error is DomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'DOMAIN' &&
    'category' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    isDomainError(error) &&
    error.category === 'VALIDATION' &&
    'field' in error
  );
}

/**
 * Convert any error to GraphQL error format with fallbacks
 */
export function errorToGraphQL(error: unknown): GraphQLError {
  // Handle domain errors
  if (isDomainError(error)) {
    return toGraphQLError(error);
  }
  
  // Handle standard Error objects
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const errorName = 'name' in error && typeof error.name === 'string' ? error.name : undefined;
    return {
      field: null,
      message: error.message,
      ...(errorName && errorName !== 'Error' && { code: errorName }),
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      field: null,
      message: error,
    };
  }
  
  // Fallback for unknown error types
  return {
    field: null,
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Create a GraphQL error with field information
 */
export function createFieldError(
  field: string, 
  message: string, 
  code?: string
): GraphQLError {
  return {
    field,
    message,
    ...(code !== undefined && { code }),
  };
}

/**
 * Create a general GraphQL error without field information
 */
export function createGeneralError(
  message: string, 
  code?: string
): GraphQLError {
  return {
    field: null,
    message,
    ...(code !== undefined && { code }),
  };
}

/**
 * Error adapter class for more complex scenarios
 */
export class GraphQLErrorAdapter {
  private fieldMappings = new Map<string, string>();
  private messageMappings = new Map<string, string>();

  /**
   * Add field name mapping (domain field -> GraphQL field)
   */
  mapField(domainField: string, graphqlField: string): this {
    this.fieldMappings.set(domainField, graphqlField);
    return this;
  }

  /**
   * Add message mapping for specific error codes
   */
  mapMessage(errorCode: string, message: string): this {
    this.messageMappings.set(errorCode, message);
    return this;
  }

  /**
   * Convert error with applied mappings
   */
  adapt(error: BaseError): GraphQLError {
    const baseError = toGraphQLError(error);
    
    // Apply field mapping
    if (baseError.field && this.fieldMappings.has(baseError.field)) {
      baseError.field = this.fieldMappings.get(baseError.field)!;
    }
    
    // Apply message mapping
    if (baseError.code && this.messageMappings.has(baseError.code)) {
      baseError.message = this.messageMappings.get(baseError.code)!;
    }
    
    return baseError;
  }

  /**
   * Convert multiple errors with applied mappings
   */
  adaptMany(errors: BaseError[]): GraphQLError[] {
    return errors.map(error => this.adapt(error));
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.fieldMappings.clear();
    this.messageMappings.clear();
  }
}

/**
 * Default error adapter instance
 */
export const defaultErrorAdapter = new GraphQLErrorAdapter();

/**
 * Validation-specific error formatter
 */
export function formatValidationErrors(errors: ValidationError[]): GraphQLError[] {
  return errors.map(error => ({
    field: error.field,
    message: error.message,
    code: String(error.code),
  }));
}

/**
 * Helper to extract error path from GraphQL execution context
 */
export function addErrorPath(
  error: GraphQLError, 
  path: (string | number)[]
): GraphQLError & { path: (string | number)[] } {
  return {
    ...error,
    path,
  };
}

/**
 * Combine multiple error sources into a single GraphQL error list
 */
export function combineErrors(
  validationErrors?: ValidationError[],
  otherErrors?: BaseError[]
): GraphQLError[] {
  const allErrors: GraphQLError[] = [];
  
  if (validationErrors?.length) {
    allErrors.push(...formatValidationErrors(validationErrors));
  }
  
  if (otherErrors?.length) {
    allErrors.push(...toGraphQLErrors(otherErrors));
  }
  
  return allErrors;
}