// Universal error type hierarchy with discriminated unions (fixed version)
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
  readonly query?: string;
  readonly parameters?: unknown[];
  readonly sqlState?: string;
}

// Network error
export interface NetworkError extends InfrastructureError {
  readonly category: 'NETWORK';
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

// Error factory functions with exact optional properties support
export const ErrorFactory = {
  validation: (params: {
    code: string;
    message: string;
    field: string;
    value?: unknown;
    constraints?: Record<string, unknown>;
    correlationId?: string;
  }): ValidationError => {
    const base: ValidationError = {
      type: 'DOMAIN',
      category: 'VALIDATION',
      code: params.code as ErrorCode,
      message: params.message,
      field: params.field,
      timestamp: new Date(),
    };
    
    if (params.value !== undefined) {
      (base as any).value = params.value;
    }
    if (params.constraints !== undefined) {
      (base as any).constraints = params.constraints;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  businessRule: (params: {
    code: string;
    message: string;
    rule: string;
    aggregate?: string;
    aggregateId?: string;
    context?: Record<string, unknown>;
    correlationId?: string;
  }): BusinessRuleError => {
    const base: BusinessRuleError = {
      type: 'DOMAIN',
      category: 'BUSINESS_RULE',
      code: params.code as ErrorCode,
      message: params.message,
      rule: params.rule,
      timestamp: new Date(),
    };
    
    if (params.aggregate !== undefined) {
      (base as any).aggregate = params.aggregate;
    }
    if (params.aggregateId !== undefined) {
      (base as any).aggregateId = params.aggregateId;
    }
    if (params.context !== undefined) {
      (base as any).context = params.context;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  notFound: (params: {
    code: string;
    message: string;
    resourceType: string;
    resourceId: string;
    correlationId?: string;
  }): NotFoundError => {
    const base: NotFoundError = {
      type: 'DOMAIN',
      category: 'NOT_FOUND',
      code: params.code as ErrorCode,
      message: params.message,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      timestamp: new Date(),
    };
    
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  conflict: (params: {
    code: string;
    message: string;
    conflictType: ConflictError['conflictType'];
    aggregate?: string;
    aggregateId?: string;
    currentValue?: unknown;
    attemptedValue?: unknown;
    correlationId?: string;
  }): ConflictError => {
    const base: ConflictError = {
      type: 'DOMAIN',
      category: 'CONFLICT',
      code: params.code as ErrorCode,
      message: params.message,
      conflictType: params.conflictType,
      timestamp: new Date(),
    };
    
    if (params.aggregate !== undefined) {
      (base as any).aggregate = params.aggregate;
    }
    if (params.aggregateId !== undefined) {
      (base as any).aggregateId = params.aggregateId;
    }
    if (params.currentValue !== undefined) {
      (base as any).currentValue = params.currentValue;
    }
    if (params.attemptedValue !== undefined) {
      (base as any).attemptedValue = params.attemptedValue;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  database: (params: {
    code: string;
    message: string;
    operation?: string;
    query?: string;
    parameters?: unknown[];
    sqlState?: string;
    retryable?: boolean;
    correlationId?: string;
  }): DatabaseError => {
    const base: DatabaseError = {
      type: 'INFRASTRUCTURE',
      category: 'DATABASE',
      code: params.code as ErrorCode,
      message: params.message,
      retryable: params.retryable ?? false,
      timestamp: new Date(),
    };
    
    (base as any).service = 'database';
    if (params.operation !== undefined) {
      (base as any).operation = params.operation;
    }
    if (params.query !== undefined) {
      (base as any).query = params.query;
    }
    if (params.parameters !== undefined) {
      (base as any).parameters = params.parameters;
    }
    if (params.sqlState !== undefined) {
      (base as any).sqlState = params.sqlState;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  network: (params: {
    code: string;
    message: string;
    url?: string;
    method?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    retryable?: boolean;
    correlationId?: string;
  }): NetworkError => {
    const base: NetworkError = {
      type: 'INFRASTRUCTURE',
      category: 'NETWORK',
      code: params.code as ErrorCode,
      message: params.message,
      retryable: params.retryable ?? true,
      timestamp: new Date(),
    };
    
    (base as any).service = 'network';
    if (params.url !== undefined) {
      (base as any).url = params.url;
    }
    if (params.method !== undefined) {
      (base as any).method = params.method;
    }
    if (params.statusCode !== undefined) {
      (base as any).statusCode = params.statusCode;
    }
    if (params.headers !== undefined) {
      (base as any).headers = params.headers;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  externalService: (params: {
    code: string;
    message: string;
    service: string;
    endpoint?: string;
    responseCode?: string;
    responseBody?: unknown;
    retryable?: boolean;
    correlationId?: string;
  }): ExternalServiceError => {
    const base: ExternalServiceError = {
      type: 'INFRASTRUCTURE',
      category: 'EXTERNAL_SERVICE',
      code: params.code as ErrorCode,
      message: params.message,
      service: params.service,
      retryable: params.retryable ?? false,
      timestamp: new Date(),
    };
    
    if (params.endpoint !== undefined) {
      (base as any).endpoint = params.endpoint;
    }
    if (params.responseCode !== undefined) {
      (base as any).responseCode = params.responseCode;
    }
    if (params.responseBody !== undefined) {
      (base as any).responseBody = params.responseBody;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  invalidOperation: (params: {
    code: string;
    message: string;
    operation: string;
    allowedOperations?: string[];
    currentState?: string;
    correlationId?: string;
  }): InvalidOperationError => {
    const base: InvalidOperationError = {
      type: 'APPLICATION',
      category: 'INVALID_OPERATION',
      code: params.code as ErrorCode,
      message: params.message,
      operation: params.operation,
      timestamp: new Date(),
    };
    
    if (params.allowedOperations !== undefined) {
      (base as any).allowedOperations = params.allowedOperations;
    }
    if (params.currentState !== undefined) {
      (base as any).currentState = params.currentState;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  stateTransition: (params: {
    code: string;
    message: string;
    operation: string;
    fromState: string;
    toState: string;
    allowedTransitions?: string[];
    correlationId?: string;
  }): StateTransitionError => {
    const base: StateTransitionError = {
      type: 'APPLICATION',
      category: 'STATE_TRANSITION',
      code: params.code as ErrorCode,
      message: params.message,
      operation: params.operation,
      fromState: params.fromState,
      toState: params.toState,
      timestamp: new Date(),
    };
    
    if (params.allowedTransitions !== undefined) {
      (base as any).allowedTransitions = params.allowedTransitions;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  concurrency: (params: {
    code: string;
    message: string;
    operation: string;
    expectedVersion: number;
    actualVersion: number;
    entityType: string;
    entityId: string;
    correlationId?: string;
  }): ConcurrencyError => {
    const base: ConcurrencyError = {
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
    };
    
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },

  rateLimit: (params: {
    code: string;
    message: string;
    operation: string;
    limit: number;
    window: number;
    retryAfter?: Date;
    correlationId?: string;
  }): RateLimitError => {
    const base: RateLimitError = {
      type: 'APPLICATION',
      category: 'RATE_LIMIT',
      code: params.code as ErrorCode,
      message: params.message,
      operation: params.operation,
      limit: params.limit,
      window: params.window,
      timestamp: new Date(),
    };
    
    if (params.retryAfter !== undefined) {
      (base as any).retryAfter = params.retryAfter;
    }
    if (params.correlationId !== undefined) {
      (base as any).correlationId = params.correlationId;
    }
    
    return base;
  },
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