import type { Result } from '@cqrs-framework/types';
import { GraphQLError, responseToResult } from '../errors/GraphQLError';
import { EventualConsistencyHandler } from '../patterns/EventualConsistency';
import { BulkOperationHandler } from '../patterns/BulkOperations';
import { CacheWarmingHandler } from '../patterns/CacheWarming';

// Generic GraphQL request interface
export interface GraphQLRequest<TVariables = Record<string, unknown>> {
  readonly query: string;
  readonly variables?: TVariables;
  readonly operationName?: string;
}

// Generic GraphQL response interface
export interface GraphQLResponse<TData = unknown> {
  readonly data?: TData;
  readonly errors?: readonly {
    readonly message: string;
    readonly locations?: ReadonlyArray<{
      readonly line: number;
      readonly column: number;
    }>;
    readonly path?: ReadonlyArray<string | number>;
    readonly extensions?: Record<string, unknown>;
  }[];
  readonly extensions?: Record<string, unknown>;
}

// Client configuration interface
export interface GraphQLClientConfig {
  readonly endpoint: string;
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly retries?: {
    readonly maxRetries: number;
    readonly backoffMultiplier: number;
    readonly maxBackoffTime: number;
  };
  readonly cache?: {
    readonly enabled: boolean;
    readonly maxSize: number;
    readonly ttl: number;
  };
}

// Default client configuration
export const DEFAULT_CLIENT_CONFIG: Required<GraphQLClientConfig> = {
  endpoint: '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  retries: {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoffTime: 5000,
  },
  cache: {
    enabled: false,
    maxSize: 100,
    ttl: 300000, // 5 minutes
  },
} as const;

// Base GraphQL client with generic patterns
export abstract class BaseGraphQLClient {
  protected readonly config: Required<GraphQLClientConfig>;
  protected readonly eventualConsistency: EventualConsistencyHandler;
  protected readonly bulkOperations: BulkOperationHandler;
  protected readonly cache?: CacheWarmingHandler<string, unknown>;

  constructor(config: GraphQLClientConfig) {
    this.config = { ...DEFAULT_CLIENT_CONFIG, ...config };
    this.eventualConsistency = new EventualConsistencyHandler({
      defaultWaitTime: 100,
      maxRetries: this.config.retries.maxRetries,
      backoffMultiplier: this.config.retries.backoffMultiplier,
      maxBackoffTime: this.config.retries.maxBackoffTime,
    });
    this.bulkOperations = new BulkOperationHandler();
    
    if (this.config.cache.enabled) {
      this.cache = new CacheWarmingHandler(
        {
          maxCacheSize: this.config.cache.maxSize,
          warmingThreshold: 10,
          backgroundWarming: true,
          ttl: this.config.cache.ttl,
        },
        (key: string) => key
      );
    }
  }

  // Generic request method
  protected async request<TData, TVariables = Record<string, unknown>>(
    request: GraphQLRequest<TVariables>
  ): Promise<TData> {
    const response = await this.rawRequest<TData, TVariables>(request);
    const result = responseToResult(response);
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.value;
  }

  // Request method that returns Result type
  protected async requestResult<TData, TVariables = Record<string, unknown>>(
    request: GraphQLRequest<TVariables>
  ): Promise<Result<TData, GraphQLError>> {
    try {
      const response = await this.rawRequest<TData, TVariables>(request);
      return responseToResult(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof GraphQLError 
          ? error 
          : new GraphQLError([{ message: (error as Error).message }]),
      };
    }
  }

  // Raw request method with caching support
  protected async rawRequest<TData, TVariables = Record<string, unknown>>(
    request: GraphQLRequest<TVariables>
  ): Promise<GraphQLResponse<TData>> {
    const cacheKey = this.generateCacheKey(request);
    
    // Try cache for queries if enabled
    if (this.cache && this.isQueryOperation(request.query)) {
      try {
        const cached = await this.cache.get(
          cacheKey,
          () => this.performRequest<TData, TVariables>(request)
        );
        return cached as GraphQLResponse<TData>;
      } catch (error) {
        // Cache miss or error, continue with regular request
      }
    }
    
    return this.performRequest<TData, TVariables>(request);
  }

  // Perform the actual HTTP request
  private async performRequest<TData, TVariables = Record<string, unknown>>(
    request: GraphQLRequest<TVariables>
  ): Promise<GraphQLResponse<TData>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: request.query,
          variables: request.variables,
          operationName: request.operationName,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new GraphQLError([{
          message: `HTTP ${response.status}: ${response.statusText}`,
          extensions: {
            code: 'HTTP_ERROR',
            status: response.status,
            statusText: response.statusText,
          },
        }]);
      }

      const result = await response.json() as GraphQLResponse<TData>;
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof GraphQLError) {
        throw error;
      }
      
      if ((error as Error).name === 'AbortError') {
        throw new GraphQLError([{
          message: `Request timed out after ${this.config.timeout}ms`,
          extensions: { code: 'TIMEOUT' },
        }]);
      }
      
      throw new GraphQLError([{
        message: (error as Error).message,
        extensions: { code: 'NETWORK_ERROR' },
      }]);
    }
  }

  // Request with retry logic
  protected async requestWithRetry<TData, TVariables = Record<string, unknown>>(
    request: GraphQLRequest<TVariables>,
    maxRetries?: number
  ): Promise<TData> {
    return this.eventualConsistency.withRetry(
      () => this.request<TData, TVariables>(request),
      maxRetries
    );
  }

  // Batch requests
  protected async batchRequest<TData, TVariables = Record<string, unknown>>(
    requests: readonly GraphQLRequest<TVariables>[]
  ): Promise<TData[]> {
    const results: TData[] = [];
    
    for await (const progress of this.bulkOperations.executeBulk(
      requests,
      (request) => this.request<TData, TVariables>(request)
    )) {
      if (progress.result) {
        results.push(progress.result);
      }
    }
    
    return results;
  }

  // Get request headers
  protected getHeaders(): Record<string, string> {
    return {
      ...this.config.headers,
      'client-name': this.getClientName(),
      'client-version': this.getClientVersion(),
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getClientName(): string;
  protected abstract getClientVersion(): string;

  // Helper methods
  private generateCacheKey<TVariables>(request: GraphQLRequest<TVariables>): string {
    const key = {
      query: request.query.trim(),
      variables: request.variables,
      operationName: request.operationName,
    };
    return JSON.stringify(key);
  }

  private isQueryOperation(query: string): boolean {
    const trimmedQuery = query.trim();
    return trimmedQuery.startsWith('query') || 
           (!trimmedQuery.startsWith('mutation') && !trimmedQuery.startsWith('subscription'));
  }

  // Get client statistics
  getStats(): {
    readonly cache?: {
      readonly size: number;
      readonly hitRate: number;
      readonly warmingInProgress: number;
    };
  } {
    const cacheStats = this.cache?.getStats();
    return {
      ...(cacheStats !== undefined ? { cache: cacheStats } : {}),
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache?.clear();
  }
}