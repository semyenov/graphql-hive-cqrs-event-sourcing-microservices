import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Generic GraphQL error interface
export interface GraphQLErrorInfo {
  readonly message: string;
  readonly locations?: ReadonlyArray<{
    readonly line: number;
    readonly column: number;
  }>;
  readonly path?: ReadonlyArray<string | number>;
  readonly extensions?: Record<string, unknown>;
}

// Generic GraphQL error class for client operations
export class GraphQLError extends Error implements BaseError {
  public readonly errors: readonly GraphQLErrorInfo[];
  public readonly name = 'GraphQLError';
  public readonly type = 'CLIENT' as const;
  public readonly category = 'GRAPHQL' as const;
  public readonly code: ErrorCode = 'GRAPHQL_ERROR' as ErrorCode;
  public readonly timestamp: Date;

  constructor(errors: readonly GraphQLErrorInfo[]) {
    const message = errors.map(e => e.message).join(', ');
    super(message);
    this.errors = errors;
    this.timestamp = new Date();
  }

  // Check if error contains specific error codes
  hasErrorCode(code: string): boolean {
    return this.errors.some(error => 
      error.extensions?.code === code
    );
  }

  // Get all error codes from the errors
  getErrorCodes(): string[] {
    return this.errors
      .map(error => error.extensions?.code as string)
      .filter(Boolean);
  }

  // Check if error is related to validation
  isValidationError(): boolean {
    return this.hasErrorCode('VALIDATION_ERROR') || 
           this.hasErrorCode('BAD_USER_INPUT');
  }

  // Check if error is authorization related
  isAuthorizationError(): boolean {
    return this.hasErrorCode('FORBIDDEN') || 
           this.hasErrorCode('UNAUTHENTICATED');
  }

  // Convert to Result type
  toResult<T>(): Result<T, GraphQLError> {
    return {
      success: false,
      error: this,
    };
  }
}

// Generic client error that satisfies BaseError
export class ClientError extends Error implements BaseError {
  public readonly type = 'CLIENT' as const;
  public readonly category: string;
  public readonly code: ErrorCode;
  public readonly timestamp: Date;

  constructor(
    message: string, 
    code: ErrorCode = 'CLIENT_ERROR' as ErrorCode,
    category: string = 'CLIENT'
  ) {
    super(message);
    this.name = 'ClientError';
    this.code = code;
    this.category = category;
    this.timestamp = new Date();
  }
}

// Type guard for GraphQL errors
export function isGraphQLError(error: unknown): error is GraphQLError {
  return error instanceof GraphQLError;
}

// Type guard for client errors
export function isClientError(error: unknown): error is ClientError {
  return error instanceof ClientError;
}

// Helper to create GraphQL error from response
export function createGraphQLError(response: {
  errors?: readonly GraphQLErrorInfo[];
}): GraphQLError | null {
  if (!response.errors || response.errors.length === 0) {
    return null;
  }
  return new GraphQLError(response.errors);
}

// Generic operation result interface
export interface OperationResult<TData, TError = GraphQLError> {
  readonly success: boolean;
  readonly data?: TData;
  readonly errors?: readonly TError[];
}

// Helper to convert GraphQL response to Result
export function responseToResult<TData>(
  response: { data?: TData; errors?: readonly GraphQLErrorInfo[] }
): Result<TData, GraphQLError> {
  const error = createGraphQLError(response);
  
  if (error) {
    return {
      success: false,
      error,
    };
  }

  if (response.data === undefined || response.data === null) {
    return {
      success: false,
      error: new GraphQLError([{
        message: 'No data returned from GraphQL operation',
      }]),
    };
  }

  return {
    success: true,
    value: response.data,
  };
}