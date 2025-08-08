// Universal error type hierarchy (completely type-safe without any)
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

// Domain errors
export interface DomainError extends BaseError {
  readonly type: 'DOMAIN';
  readonly category: DomainErrorCategory;
  readonly aggregate?: string;
  readonly aggregateId?: string;
  readonly field?: string;
}

// Validation error
export interface ValidationError extends DomainError {
  readonly category: 'VALIDATION';
  readonly field: string;
  readonly value?: unknown;
  readonly constraints?: Record<string, unknown>;
}

// Business rule violation
export interface BusinessRuleError extends DomainError {
  readonly category: 'BUSINESS_RULE';
  readonly rule: string;
  readonly context?: Record<string, unknown>;
}

// Not found error
export interface NotFoundError extends DomainError {
  readonly category: 'NOT_FOUND';
  readonly resourceType: string;
  readonly resourceId: string;
}

// Conflict error
export interface ConflictError extends DomainError {
  readonly category: 'CONFLICT';
  readonly conflictType: 'DUPLICATE' | 'VERSION_MISMATCH' | 'STATE_CONFLICT';
  readonly currentValue?: unknown;
  readonly attemptedValue?: unknown;
}

// Infrastructure errors
export interface InfrastructureError extends BaseError {
  readonly type: 'INFRASTRUCTURE';
  readonly category: InfrastructureErrorCategory;
  readonly service?: string;
  readonly operation?: string;
  readonly retryable: boolean;
}

// Database error
export interface DatabaseError extends InfrastructureError {
  readonly category: 'DATABASE';
  readonly service: 'database';
  readonly query?: string;
  readonly parameters?: unknown[];
  readonly sqlState?: string;
}

// Network error
export interface NetworkError extends InfrastructureError {
  readonly category: 'NETWORK';
  readonly service: 'network';
  readonly url?: string;
  readonly method?: string;
  readonly statusCode?: number;
  readonly headers?: Record<string, string>;
}

// External service error
export interface ExternalServiceError extends InfrastructureError {
  readonly category: 'EXTERNAL_SERVICE';
  readonly service: string;
  readonly endpoint?: string;
  readonly responseCode?: string;
  readonly responseBody?: unknown;
}

// Application errors
export interface ApplicationError extends BaseError {
  readonly type: 'APPLICATION';
  readonly category: ApplicationErrorCategory;
  readonly operation: string;
}

// Invalid operation error
export interface InvalidOperationError extends ApplicationError {
  readonly category: 'INVALID_OPERATION';
  readonly allowedOperations?: string[];
  readonly currentState?: string;
}

// State transition error
export interface StateTransitionError extends ApplicationError {
  readonly category: 'STATE_TRANSITION';
  readonly fromState: string;
  readonly toState: string;
  readonly allowedTransitions?: string[];
}

// Concurrency error
export interface ConcurrencyError extends ApplicationError {
  readonly category: 'CONCURRENCY';
  readonly expectedVersion: number;
  readonly actualVersion: number;
  readonly entityType: string;
  readonly entityId: string;
}

// Rate limit error
export interface RateLimitError extends ApplicationError {
  readonly category: 'RATE_LIMIT';
  readonly limit: number;
  readonly window: number;
  readonly retryAfter?: Date;
}

// Union type for all errors
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

// Type-safe error factory functions using utility types
type BuildValidationError<T> = {
  type: 'DOMAIN';
  category: 'VALIDATION';
  code: ErrorCode;
  message: string;
  field: string;
  timestamp: Date;
} & T;

type BuildBusinessRuleError<T> = {
  type: 'DOMAIN';
  category: 'BUSINESS_RULE';
  code: ErrorCode;
  message: string;
  rule: string;
  timestamp: Date;
} & T;

type BuildNotFoundError<T> = {
  type: 'DOMAIN';
  category: 'NOT_FOUND';
  code: ErrorCode;
  message: string;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
} & T;

type BuildConflictError<T> = {
  type: 'DOMAIN';
  category: 'CONFLICT';
  code: ErrorCode;
  message: string;
  conflictType: ConflictError['conflictType'];
  timestamp: Date;
} & T;

type BuildDatabaseError<T> = {
  type: 'INFRASTRUCTURE';
  category: 'DATABASE';
  code: ErrorCode;
  message: string;
  service: 'database';
  retryable: boolean;
  timestamp: Date;
} & T;

type BuildNetworkError<T> = {
  type: 'INFRASTRUCTURE';
  category: 'NETWORK';
  code: ErrorCode;
  message: string;
  service: 'network';
  retryable: boolean;
  timestamp: Date;
} & T;

type BuildExternalServiceError<T> = {
  type: 'INFRASTRUCTURE';
  category: 'EXTERNAL_SERVICE';
  code: ErrorCode;
  message: string;
  service: string;
  retryable: boolean;
  timestamp: Date;
} & T;

type BuildInvalidOperationError<T> = {
  type: 'APPLICATION';
  category: 'INVALID_OPERATION';
  code: ErrorCode;
  message: string;
  operation: string;
  timestamp: Date;
} & T;

type BuildStateTransitionError<T> = {
  type: 'APPLICATION';
  category: 'STATE_TRANSITION';
  code: ErrorCode;
  message: string;
  operation: string;
  fromState: string;
  toState: string;
  timestamp: Date;
} & T;

type BuildConcurrencyError<T> = {
  type: 'APPLICATION';
  category: 'CONCURRENCY';
  code: ErrorCode;
  message: string;
  operation: string;
  expectedVersion: number;
  actualVersion: number;
  entityType: string;
  entityId: string;
  timestamp: Date;
} & T;

type BuildRateLimitError<T> = {
  type: 'APPLICATION';
  category: 'RATE_LIMIT';
  code: ErrorCode;
  message: string;
  operation: string;
  limit: number;
  window: number;
  timestamp: Date;
} & T;

// Completely type-safe error factory without any
export const ErrorFactory = {
  validation: (params: {
    code: string;
    message: string;
    field: string;
    value?: unknown;
    constraints?: Record<string, unknown>;
    correlationId?: string;
  }): ValidationError => ({
    type: 'DOMAIN',
    category: 'VALIDATION',
    code: params.code as ErrorCode,
    message: params.message,
    field: params.field,
    timestamp: new Date(),
    ...(params.value !== undefined ? { value: params.value } : {}),
    ...(params.constraints !== undefined ? { constraints: params.constraints } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as ValidationError),

  businessRule: (params: {
    code: string;
    message: string;
    rule: string;
    aggregate?: string;
    aggregateId?: string;
    context?: Record<string, unknown>;
    correlationId?: string;
  }): BusinessRuleError => ({
    type: 'DOMAIN',
    category: 'BUSINESS_RULE',
    code: params.code as ErrorCode,
    message: params.message,
    rule: params.rule,
    timestamp: new Date(),
    ...(params.aggregate !== undefined ? { aggregate: params.aggregate } : {}),
    ...(params.aggregateId !== undefined ? { aggregateId: params.aggregateId } : {}),
    ...(params.context !== undefined ? { context: params.context } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as BusinessRuleError),

  notFound: (params: {
    code: string;
    message: string;
    resourceType: string;
    resourceId: string;
    correlationId?: string;
  }): NotFoundError => ({
    type: 'DOMAIN',
    category: 'NOT_FOUND',
    code: params.code as ErrorCode,
    message: params.message,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    timestamp: new Date(),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as NotFoundError),

  conflict: (params: {
    code: string;
    message: string;
    conflictType: ConflictError['conflictType'];
    aggregate?: string;
    aggregateId?: string;
    currentValue?: unknown;
    attemptedValue?: unknown;
    correlationId?: string;
  }): ConflictError => ({
    type: 'DOMAIN',
    category: 'CONFLICT',
    code: params.code as ErrorCode,
    message: params.message,
    conflictType: params.conflictType,
    timestamp: new Date(),
    ...(params.aggregate !== undefined ? { aggregate: params.aggregate } : {}),
    ...(params.aggregateId !== undefined ? { aggregateId: params.aggregateId } : {}),
    ...(params.currentValue !== undefined ? { currentValue: params.currentValue } : {}),
    ...(params.attemptedValue !== undefined ? { attemptedValue: params.attemptedValue } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as ConflictError),

  database: (params: {
    code: string;
    message: string;
    operation?: string;
    query?: string;
    parameters?: unknown[];
    sqlState?: string;
    retryable?: boolean;
    correlationId?: string;
  }): DatabaseError => ({
    type: 'INFRASTRUCTURE',
    category: 'DATABASE',
    code: params.code as ErrorCode,
    message: params.message,
    service: 'database',
    retryable: params.retryable ?? false,
    timestamp: new Date(),
    ...(params.operation !== undefined ? { operation: params.operation } : {}),
    ...(params.query !== undefined ? { query: params.query } : {}),
    ...(params.parameters !== undefined ? { parameters: params.parameters } : {}),
    ...(params.sqlState !== undefined ? { sqlState: params.sqlState } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as DatabaseError),

  network: (params: {
    code: string;
    message: string;
    url?: string;
    method?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    retryable?: boolean;
    correlationId?: string;
  }): NetworkError => ({
    type: 'INFRASTRUCTURE',
    category: 'NETWORK',
    code: params.code as ErrorCode,
    message: params.message,
    service: 'network',
    retryable: params.retryable ?? true,
    timestamp: new Date(),
    ...(params.url !== undefined ? { url: params.url } : {}),
    ...(params.method !== undefined ? { method: params.method } : {}),
    ...(params.statusCode !== undefined ? { statusCode: params.statusCode } : {}),
    ...(params.headers !== undefined ? { headers: params.headers } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as NetworkError),

  externalService: (params: {
    code: string;
    message: string;
    service: string;
    endpoint?: string;
    responseCode?: string;
    responseBody?: unknown;
    retryable?: boolean;
    correlationId?: string;
  }): ExternalServiceError => ({
    type: 'INFRASTRUCTURE',
    category: 'EXTERNAL_SERVICE',
    code: params.code as ErrorCode,
    message: params.message,
    service: params.service,
    retryable: params.retryable ?? false,
    timestamp: new Date(),
    ...(params.endpoint !== undefined ? { endpoint: params.endpoint } : {}),
    ...(params.responseCode !== undefined ? { responseCode: params.responseCode } : {}),
    ...(params.responseBody !== undefined ? { responseBody: params.responseBody } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as ExternalServiceError),

  invalidOperation: (params: {
    code: string;
    message: string;
    operation: string;
    allowedOperations?: string[];
    currentState?: string;
    correlationId?: string;
  }): InvalidOperationError => ({
    type: 'APPLICATION',
    category: 'INVALID_OPERATION',
    code: params.code as ErrorCode,
    message: params.message,
    operation: params.operation,
    timestamp: new Date(),
    ...(params.allowedOperations !== undefined ? { allowedOperations: params.allowedOperations } : {}),
    ...(params.currentState !== undefined ? { currentState: params.currentState } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as InvalidOperationError),

  stateTransition: (params: {
    code: string;
    message: string;
    operation: string;
    fromState: string;
    toState: string;
    allowedTransitions?: string[];
    correlationId?: string;
  }): StateTransitionError => ({
    type: 'APPLICATION',
    category: 'STATE_TRANSITION',
    code: params.code as ErrorCode,
    message: params.message,
    operation: params.operation,
    fromState: params.fromState,
    toState: params.toState,
    timestamp: new Date(),
    ...(params.allowedTransitions !== undefined ? { allowedTransitions: params.allowedTransitions } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as StateTransitionError),

  concurrency: (params: {
    code: string;
    message: string;
    operation: string;
    expectedVersion: number;
    actualVersion: number;
    entityType: string;
    entityId: string;
    correlationId?: string;
  }): ConcurrencyError => ({
    type: 'APPLICATION',
    category: 'CONCURRENCY',
    code: params.code as ErrorCode,
    message: params.message,
    operation: params.operation,
    expectedVersion: params.expectedVersion,
    actualVersion: params.actualVersion,
    entityType: params.entityType,
    entityId: params.entityId,
    timestamp: new Date(),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as ConcurrencyError),

  rateLimit: (params: {
    code: string;
    message: string;
    operation: string;
    limit: number;
    window: number;
    retryAfter?: Date;
    correlationId?: string;
  }): RateLimitError => ({
    type: 'APPLICATION',
    category: 'RATE_LIMIT',
    code: params.code as ErrorCode,
    message: params.message,
    operation: params.operation,
    limit: params.limit,
    window: params.window,
    timestamp: new Date(),
    ...(params.retryAfter !== undefined ? { retryAfter: params.retryAfter } : {}),
    ...(params.correlationId !== undefined ? { correlationId: params.correlationId } : {}),
  } as RateLimitError),
} as const;

// Error type guards
export const ErrorGuards = {
  isDomainError: (error: unknown): error is DomainError => 
    typeof error === 'object' && error !== null && 'type' in error && error.type === 'DOMAIN',
  isInfrastructureError: (error: unknown): error is InfrastructureError => 
    typeof error === 'object' && error !== null && 'type' in error && error.type === 'INFRASTRUCTURE',
  isApplicationError: (error: unknown): error is ApplicationError => 
    typeof error === 'object' && error !== null && 'type' in error && error.type === 'APPLICATION',
  
  isValidationError: (error: AppError): error is ValidationError => 
    error.type === 'DOMAIN' && error.category === 'VALIDATION',
  
  isBusinessRuleError: (error: AppError): error is BusinessRuleError => 
    error.type === 'DOMAIN' && error.category === 'BUSINESS_RULE',
  
  isNotFoundError: (error: AppError): error is NotFoundError => 
    error.type === 'DOMAIN' && error.category === 'NOT_FOUND',
  
  isConflictError: (error: AppError): error is ConflictError => 
    error.type === 'DOMAIN' && error.category === 'CONFLICT',
  
  isDatabaseError: (error: AppError): error is DatabaseError => 
    error.type === 'INFRASTRUCTURE' && error.category === 'DATABASE',
  
  isNetworkError: (error: AppError): error is NetworkError => 
    error.type === 'INFRASTRUCTURE' && error.category === 'NETWORK',
  
  isExternalServiceError: (error: AppError): error is ExternalServiceError => 
    error.type === 'INFRASTRUCTURE' && error.category === 'EXTERNAL_SERVICE',
  
  isInvalidOperationError: (error: AppError): error is InvalidOperationError => 
    error.type === 'APPLICATION' && error.category === 'INVALID_OPERATION',
  
  isStateTransitionError: (error: AppError): error is StateTransitionError => 
    error.type === 'APPLICATION' && error.category === 'STATE_TRANSITION',
  
  isConcurrencyError: (error: AppError): error is ConcurrencyError => 
    error.type === 'APPLICATION' && error.category === 'CONCURRENCY',
  
  isRateLimitError: (error: AppError): error is RateLimitError => 
    error.type === 'APPLICATION' && error.category === 'RATE_LIMIT',
  
  isRetryableError: (error: AppError): boolean => {
    if (error.type === 'INFRASTRUCTURE') {
      return error.retryable;
    }
    return error.type === 'APPLICATION' && error.category === 'RATE_LIMIT';
  },
} as const;

// Error result type for functional error handling
export type Result<T, E extends BaseError = AppError> = 
  | { success: true; value: T }
  | { success: false; error: E };

// Multiple errors result type
export type MultiResult<T, E extends BaseError = AppError> = 
  | { success: true; value: T }
  | { success: false; errors: E[] };

// Result helpers
export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ success: true, value }),
  
  err: <E extends BaseError>(error: E): Result<never, E> => ({ success: false, error }),
  
  multiErr: <E extends BaseError>(errors: E[]): MultiResult<never, E> => ({ success: false, errors }),
  
  isOk: <T, E extends BaseError>(result: Result<T, E>): result is { success: true; value: T } => 
    result.success,
  
  isErr: <T, E extends BaseError>(result: Result<T, E>): result is { success: false; error: E } => 
    !result.success,
  
  isMultiErr: <T, E extends BaseError>(result: MultiResult<T, E>): result is { success: false; errors: E[] } => 
    !result.success,
  
  map: <T, U, E extends BaseError>(
    result: Result<T, E>,
    fn: (value: T) => U
  ): Result<U, E> => {
    if (result.success) {
      return Result.ok(fn(result.value));
    }
    return result;
  },
  
  mapErr: <T, E extends BaseError, F extends BaseError>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> => {
    if (!result.success) {
      return Result.err(fn(result.error));
    }
    return result as Result<T, F>;
  },
  
  chain: <T, U, E extends BaseError>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> => {
    if (result.success) {
      return fn(result.value);
    }
    return result;
  },
  
  match: <T, E extends BaseError, R>(
    result: Result<T, E>,
    handlers: {
      ok: (value: T) => R;
      err: (error: E) => R;
    }
  ): R => {
    if (result.success) {
      return handlers.ok(result.value);
    }
    return handlers.err(result.error);
  },
} as const;

// Error codes enum for common errors
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