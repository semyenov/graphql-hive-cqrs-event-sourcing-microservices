// Universal error type hierarchy for CQRS/Event Sourcing framework
import type { Brand } from './branded';

// Error code branding
export type ErrorCode = Brand<string, 'ErrorCode'>;

// Base error interface
export interface BaseError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly stack?: string;
}

// Domain error categories
export type DomainErrorCategory = 
  | 'VALIDATION'
  | 'BUSINESS_RULE'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED';

// Infrastructure error categories
export type InfrastructureErrorCategory = 
  | 'DATABASE'
  | 'NETWORK'
  | 'EXTERNAL_SERVICE'
  | 'CONFIGURATION'
  | 'TIMEOUT';

// Application error categories
export type ApplicationErrorCategory = 
  | 'INVALID_OPERATION'
  | 'STATE_TRANSITION'
  | 'CONCURRENCY'
  | 'RATE_LIMIT';

// Framework error types
export interface DomainError extends BaseError {
  readonly type: 'DOMAIN';
  readonly category: DomainErrorCategory;
  readonly aggregate?: string;
  readonly aggregateId?: string;
  readonly field?: string;
}

export interface ValidationError extends DomainError {
  readonly category: 'VALIDATION';
  readonly field: string;
  readonly value?: unknown;
}

export interface BusinessRuleError extends DomainError {
  readonly category: 'BUSINESS_RULE';
  readonly rule: string;
  readonly context?: Record<string, unknown>;
}

export interface NotFoundError extends DomainError {
  readonly category: 'NOT_FOUND';
  readonly entityType: string;
  readonly entityId: string;
}

export interface ConflictError extends DomainError {
  readonly category: 'CONFLICT';
  readonly conflictType: string;
  readonly expectedVersion?: number;
  readonly actualVersion?: number;
}

export interface InfrastructureError extends BaseError {
  readonly type: 'INFRASTRUCTURE';
  readonly category: InfrastructureErrorCategory;
  readonly service?: string;
  readonly operation?: string;
}

export interface DatabaseError extends InfrastructureError {
  readonly category: 'DATABASE';
  readonly query?: string;
  readonly constraint?: string;
}

export interface NetworkError extends InfrastructureError {
  readonly category: 'NETWORK';
  readonly endpoint?: string;
  readonly statusCode?: number;
}

export interface ExternalServiceError extends InfrastructureError {
  readonly category: 'EXTERNAL_SERVICE';
  readonly serviceName: string;
  readonly serviceError?: unknown;
}

export interface ApplicationError extends BaseError {
  readonly type: 'APPLICATION';
  readonly category: ApplicationErrorCategory;
  readonly operation?: string;
  readonly state?: string;
}

export interface InvalidOperationError extends ApplicationError {
  readonly category: 'INVALID_OPERATION';
  readonly operation: string;
  readonly reason: string;
}

export interface StateTransitionError extends ApplicationError {
  readonly category: 'STATE_TRANSITION';
  readonly fromState: string;
  readonly toState: string;
  readonly reason: string;
}

export interface ConcurrencyError extends ApplicationError {
  readonly category: 'CONCURRENCY';
  readonly resource: string;
  readonly conflictingOperation: string;
}

export interface RateLimitError extends ApplicationError {
  readonly category: 'RATE_LIMIT';
  readonly limit: number;
  readonly current: number;
  readonly resetTime?: Date;
}

// Union type for all framework errors
export type AppError = 
  | ValidationError 
  | BusinessRuleError 
  | NotFoundError 
  | ConflictError
  | DatabaseError 
  | NetworkError 
  | ExternalServiceError
  | InvalidOperationError 
  | StateTransitionError 
  | ConcurrencyError 
  | RateLimitError;

// Result type for error handling
export type Result<T, E extends BaseError = AppError> = 
  | { success: true; value: T }
  | { success: false; error: E };

// Error factory for creating typed errors
export const ErrorFactory = {
  validation: (params: {
    code: ErrorCode;
    message: string;
    field: string;
    value?: unknown;
    correlationId: string;
    aggregate: string;
    aggregateId: string;
  }): ValidationError => ({
    type: 'DOMAIN',
    category: 'VALIDATION',
    code: params.code,
    message: params.message,
    field: params.field,
    value: params.value,
    timestamp: new Date(),
    correlationId: params.correlationId,
    aggregate: params.aggregate,
    aggregateId: params.aggregateId,
  }),

  businessRule: (params: {
    code: ErrorCode;
    message: string;
    rule: string;
    context: Record<string, unknown>;
    correlationId: string;
    aggregate: string;
    aggregateId: string;
  }): BusinessRuleError => ({
    type: 'DOMAIN',
    category: 'BUSINESS_RULE',
    code: params.code,
    message: params.message,
    rule: params.rule,
    context: params.context,
    timestamp: new Date(),
    correlationId: params.correlationId,
    aggregate: params.aggregate,
    aggregateId: params.aggregateId,
  }),

  notFound: (params: {
    code: ErrorCode;
    message: string;
    entityType: string;
    entityId: string;
    correlationId: string;
  }): NotFoundError => ({
    type: 'DOMAIN',
    category: 'NOT_FOUND',
    code: params.code,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  conflict: (params: {
    code: ErrorCode;
    message: string;
    conflictType: string;
    expectedVersion: number;
    actualVersion: number;
    correlationId: string;
    aggregate: string;
    aggregateId: string;
  }): ConflictError => ({
    type: 'DOMAIN',
    category: 'CONFLICT',
    code: params.code,
    message: params.message,
    conflictType: params.conflictType,
    expectedVersion: params.expectedVersion,
    actualVersion: params.actualVersion,
    timestamp: new Date(),
    correlationId: params.correlationId,
    aggregate: params.aggregate,
    aggregateId: params.aggregateId,
  }),

  database: (params: {
    code: ErrorCode;
    message: string;
    query: string;
    constraint: string;
    service: string;
    correlationId: string;
  }): DatabaseError => ({
    type: 'INFRASTRUCTURE',
    category: 'DATABASE',
    code: params.code,
    message: params.message,
    query: params.query,
    constraint: params.constraint,
    service: params.service,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  network: (params: {
    code: ErrorCode;
    message: string;
    endpoint: string;
    statusCode: number;
    correlationId: string;
  }): NetworkError => ({
    type: 'INFRASTRUCTURE',
    category: 'NETWORK',
    code: params.code,
    message: params.message,
    endpoint: params.endpoint,
    statusCode: params.statusCode,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  externalService: (params: {
    code: ErrorCode;
    message: string;
    serviceName: string;
    serviceError?: unknown;
    correlationId: string;
  }): ExternalServiceError => ({
    type: 'INFRASTRUCTURE',
    category: 'EXTERNAL_SERVICE',
    code: params.code,
    message: params.message,
    serviceName: params.serviceName,
    serviceError: params.serviceError,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  invalidOperation: (params: {
    code: ErrorCode;
    message: string;
    operation: string;
    reason: string;
    correlationId: string;
  }): InvalidOperationError => ({
    type: 'APPLICATION',
    category: 'INVALID_OPERATION',
    code: params.code,
    message: params.message,
    operation: params.operation,
    reason: params.reason,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  stateTransition: (params: {
    code: ErrorCode;
    message: string;
    fromState: string;
    toState: string;
    reason: string;
    correlationId: string;
  }): StateTransitionError => ({
    type: 'APPLICATION',
    category: 'STATE_TRANSITION',
    code: params.code,
    message: params.message,
    fromState: params.fromState,
    toState: params.toState,
    reason: params.reason,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  concurrency: (params: {
    code: ErrorCode;
    message: string;
    resource: string;
    conflictingOperation: string;
    correlationId: string;
  }): ConcurrencyError => ({
    type: 'APPLICATION',
    category: 'CONCURRENCY',
    code: params.code,
    message: params.message,
    resource: params.resource,
    conflictingOperation: params.conflictingOperation,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),

  rateLimit: (params: {
    code: ErrorCode;
    message: string;
    limit: number;
    current: number;
    resetTime: Date;
    correlationId: string;
  }): RateLimitError => ({
    type: 'APPLICATION',
    category: 'RATE_LIMIT',
    code: params.code,
    message: params.message,
    limit: params.limit,
    current: params.current,
    resetTime: params.resetTime,
    timestamp: new Date(),
    correlationId: params.correlationId,
  }),
} as const;

// Error type guards
export const ErrorGuards = {
  isDomainError: (error: BaseError): error is DomainError => {
    return (error as DomainError).type === 'DOMAIN';
  },

  isValidationError: (error: BaseError): error is ValidationError => {
    return ErrorGuards.isDomainError(error) && error.category === 'VALIDATION';
  },

  isBusinessRuleError: (error: BaseError): error is BusinessRuleError => {
    return ErrorGuards.isDomainError(error) && error.category === 'BUSINESS_RULE';
  },

  isNotFoundError: (error: BaseError): error is NotFoundError => {
    return ErrorGuards.isDomainError(error) && error.category === 'NOT_FOUND';
  },

  isConflictError: (error: BaseError): error is ConflictError => {
    return ErrorGuards.isDomainError(error) && error.category === 'CONFLICT';
  },

  isInfrastructureError: (error: BaseError): error is InfrastructureError => {
    return (error as InfrastructureError).type === 'INFRASTRUCTURE';
  },

  isDatabaseError: (error: BaseError): error is DatabaseError => {
    return ErrorGuards.isInfrastructureError(error) && error.category === 'DATABASE';
  },

  isNetworkError: (error: BaseError): error is NetworkError => {
    return ErrorGuards.isInfrastructureError(error) && error.category === 'NETWORK';
  },

  isApplicationError: (error: BaseError): error is ApplicationError => {
    return (error as ApplicationError).type === 'APPLICATION';
  },

  isConcurrencyError: (error: BaseError): error is ConcurrencyError => {
    return ErrorGuards.isApplicationError(error) && error.category === 'CONCURRENCY';
  },

  isRateLimitError: (error: BaseError): error is RateLimitError => {
    return ErrorGuards.isApplicationError(error) && error.category === 'RATE_LIMIT';
  },
} as const;

// Result helpers
export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ success: true, value }),
  
  err: <E extends BaseError>(error: E): Result<never, E> => ({ success: false, error }),
  
  isOk: <T, E extends BaseError>(result: Result<T, E>): result is { success: true; value: T } => {
    return result.success;
  },
  
  isErr: <T, E extends BaseError>(result: Result<T, E>): result is { success: false; error: E } => {
    return !result.success;
  },

  map: <T, U, E extends BaseError>(
    result: Result<T, E>,
    fn: (value: T) => U
  ): Result<U, E> => {
    return result.success ? Result.ok(fn(result.value)) : result;
  },

  mapErr: <T, E1 extends BaseError, E2 extends BaseError>(
    result: Result<T, E1>,
    fn: (error: E1) => E2
  ): Result<T, E2> => {
    return result.success ? result : Result.err(fn(result.error));
  },

  flatMap: <T, U, E extends BaseError>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> => {
    return result.success ? fn(result.value) : result;
  },

  match: <T, E extends BaseError, U>(
    result: Result<T, E>,
    patterns: { ok: (value: T) => U; err: (error: E) => U }
  ): U => {
    return result.success ? patterns.ok(result.value) : patterns.err(result.error);
  },

  chain: <T, U, E extends BaseError>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> => {
    return result.success ? fn(result.value) : result;
  },
} as const;

// Common error codes for the framework
export const ErrorCodes = {
  // Validation errors
  FIELD_REQUIRED: 'FIELD_REQUIRED' as ErrorCode,
  INVALID_FORMAT: 'INVALID_FORMAT' as ErrorCode,
  VALUE_TOO_SHORT: 'VALUE_TOO_SHORT' as ErrorCode,
  VALUE_TOO_LONG: 'VALUE_TOO_LONG' as ErrorCode,
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE' as ErrorCode,
  
  // Business rule errors
  INVARIANT_VIOLATION: 'INVARIANT_VIOLATION' as ErrorCode,
  PRECONDITION_FAILED: 'PRECONDITION_FAILED' as ErrorCode,
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION' as ErrorCode,
  
  // Not found errors
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND' as ErrorCode,
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND' as ErrorCode,
  
  // Conflict errors
  DUPLICATE_ENTITY: 'DUPLICATE_ENTITY' as ErrorCode,
  VERSION_MISMATCH: 'VERSION_MISMATCH' as ErrorCode,
  STATE_CONFLICT: 'STATE_CONFLICT' as ErrorCode,
  
  // Database errors
  CONNECTION_FAILED: 'CONNECTION_FAILED' as ErrorCode,
  QUERY_FAILED: 'QUERY_FAILED' as ErrorCode,
  TRANSACTION_FAILED: 'TRANSACTION_FAILED' as ErrorCode,
  
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT' as ErrorCode,
  CONNECTION_REFUSED: 'CONNECTION_REFUSED' as ErrorCode,
  REQUEST_FAILED: 'REQUEST_FAILED' as ErrorCode,
  
  // External service errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE' as ErrorCode,
  SERVICE_ERROR: 'SERVICE_ERROR' as ErrorCode,
  
  // Application errors
  INVALID_OPERATION: 'INVALID_OPERATION' as ErrorCode,
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION' as ErrorCode,
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT' as ErrorCode,
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED' as ErrorCode,
} as const;