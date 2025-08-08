import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';
import type { Projection, ProjectionStore, ProjectionFilter, QueryOptions } from '../builders/ProjectionBuilder';

// Generic query interface
export interface Query<TParams = unknown, TResult = unknown> {
  readonly name: string;
  readonly params: TParams;
}

// Query handler interface
export interface QueryHandler<TParams = unknown, TResult = unknown, TReadModel = unknown> {
  readonly queryName: string;
  readonly cacheable?: boolean;
  readonly cacheKey?: (params: TParams) => string;
  
  handle(
    params: TParams,
    projectionStore: ProjectionStore<TReadModel>
  ): Promise<Result<TResult, QueryError>>;
}

// Query registry for managing query handlers
export class QueryRegistry<TReadModel = unknown> {
  private readonly handlers = new Map<string, QueryHandler<unknown, unknown, TReadModel>>();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly middleware: QueryMiddleware<TReadModel>[] = [];

  constructor(
    private readonly projectionStore: ProjectionStore<TReadModel>,
    private readonly options: QueryRegistryOptions = {}
  ) {
    this.options = { ...DEFAULT_QUERY_OPTIONS, ...options };
  }

  // Register query handler
  register<TParams, TResult>(
    handler: QueryHandler<TParams, TResult, TReadModel>
  ): void {
    this.handlers.set(handler.queryName, handler as QueryHandler<unknown, unknown, TReadModel>);
  }

  // Add middleware
  use(middleware: QueryMiddleware<TReadModel>): this {
    this.middleware.push(middleware);
    // Sort by priority (higher first)
    this.middleware.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Execute query
  async execute<TParams, TResult>(
    query: Query<TParams, TResult>
  ): Promise<Result<TResult, QueryError>> {
    const handler = this.handlers.get(query.name);
    if (!handler) {
      return {
        success: false,
        error: new QueryError(
          `No handler registered for query: ${query.name}`,
          'HANDLER_NOT_FOUND',
          query.name
        ),
      };
    }

    try {
      // Check cache first
      if (handler.cacheable && this.options.enableCache) {
        const cacheKey = this.getCacheKey(query, handler);
        const cached = this.cache.get(cacheKey);
        
        if (cached && !this.isCacheExpired(cached)) {
          return {
            success: true,
            value: cached.value as TResult,
          };
        }
      }

      // Execute with middleware
      const result = await this.executeWithMiddleware(query, handler);
      
      // Cache successful results
      if (result.success && handler.cacheable && this.options.enableCache) {
        const cacheKey = this.getCacheKey(query, handler);
        this.cache.set(cacheKey, {
          value: result.value,
          timestamp: Date.now(),
          ttl: this.options.cacheTtl ?? 300000,
        });
      }

      return result as Result<TResult, QueryError>;
    } catch (error) {
      return {
        success: false,
        error: new QueryError(
          `Query execution failed: ${error}`,
          'EXECUTION_FAILED',
          query.name
        ),
      };
    }
  }

  // Execute multiple queries in parallel
  async executeBatch<TResult>(
    queries: Query[]
  ): Promise<Result<TResult[], QueryError>> {
    const results = await Promise.allSettled(
      queries.map(query => this.execute(query))
    );

    const successful: TResult[] = [];
    const errors: QueryError[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful.push(result.value.value as TResult);
        } else {
          errors.push(result.value.error);
        }
      } else {
        errors.push(new QueryError(
          `Query promise rejected: ${result.reason}`,
          'PROMISE_REJECTED'
        ));
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: new QueryError(
          `${errors.length} queries failed`,
          'BATCH_EXECUTION_FAILED',
          undefined,
          { errors }
        ),
      };
    }

    return {
      success: true,
      value: successful,
    };
  }

  // Clear query cache
  clearCache(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }

    let cleared = 0;
    const regex = new RegExp(pattern);
    
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }

  // Get registry statistics
  getStatistics(): QueryRegistryStatistics {
    return {
      handlerCount: this.handlers.size,
      middlewareCount: this.middleware.length,
      cacheSize: this.cache.size,
      registeredQueries: Array.from(this.handlers.keys()),
    };
  }

  // Private helper methods
  private async executeWithMiddleware<TParams, TResult>(
    query: Query<TParams, TResult>,
    handler: QueryHandler<TParams, TResult, TReadModel>
  ): Promise<Result<TResult, QueryError>> {
    let index = 0;

    const executeNext = async (): Promise<Result<TResult, QueryError>> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          return await middleware.execute(query, handler, this.projectionStore, executeNext);
        }
      }

      // Execute the actual handler
      return await handler.handle(query.params, this.projectionStore);
    };

    return await executeNext();
  }

  private getCacheKey<TParams, TResult>(
    query: Query<TParams, TResult>,
    handler: QueryHandler<TParams, TResult, TReadModel>
  ): string {
    if (handler.cacheKey) {
      return handler.cacheKey(query.params);
    }
    
    // Default cache key
    return `${query.name}:${JSON.stringify(query.params)}`;
  }

  private isCacheExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}

// Built-in query handlers

// Generic projection query handler
export class ProjectionQueryHandler<TReadModel> implements QueryHandler<ProjectionQueryParams, TReadModel[], TReadModel> {
  readonly queryName = 'projections';
  readonly cacheable = true;

  async handle(
    params: ProjectionQueryParams,
    projectionStore: ProjectionStore<TReadModel>
  ): Promise<Result<TReadModel[], QueryError>> {
    try {
      const projections = await projectionStore.query(params.filter, params.options);
      const data = projections.map(p => p.data);
      
      return {
        success: true,
        value: data,
      };
    } catch (error) {
      return {
        success: false,
        error: new QueryError(
          `Projection query failed: ${error}`,
          'PROJECTION_QUERY_FAILED',
          this.queryName
        ),
      };
    }
  }

  cacheKey(params: ProjectionQueryParams): string {
    return `projections:${JSON.stringify(params)}`;
  }
}

// Single projection query handler
export class SingleProjectionQueryHandler<TReadModel> implements QueryHandler<string, TReadModel | null, TReadModel> {
  readonly queryName = 'projection';
  readonly cacheable = true;

  async handle(
    id: string,
    projectionStore: ProjectionStore<TReadModel>
  ): Promise<Result<TReadModel | null, QueryError>> {
    try {
      const projection = await projectionStore.get(id);
      
      return {
        success: true,
        value: projection?.data ?? null,
      };
    } catch (error) {
      return {
        success: false,
        error: new QueryError(
          `Single projection query failed: ${error}`,
          'SINGLE_PROJECTION_QUERY_FAILED',
          this.queryName
        ),
      };
    }
  }

  cacheKey(id: string): string {
    return `projection:${id}`;
  }
}

// Count query handler
export class ProjectionCountQueryHandler<TReadModel> implements QueryHandler<ProjectionFilter, number, TReadModel> {
  readonly queryName = 'projections_count';
  readonly cacheable = true;

  async handle(
    filter: ProjectionFilter,
    projectionStore: ProjectionStore<TReadModel>
  ): Promise<Result<number, QueryError>> {
    try {
      const count = await projectionStore.count(filter);
      
      return {
        success: true,
        value: count,
      };
    } catch (error) {
      return {
        success: false,
        error: new QueryError(
          `Projection count query failed: ${error}`,
          'PROJECTION_COUNT_FAILED',
          this.queryName
        ),
      };
    }
  }

  cacheKey(filter: ProjectionFilter): string {
    return `projections_count:${JSON.stringify(filter)}`;
  }
}

// Query middleware interface
export interface QueryMiddleware<TReadModel> {
  readonly name: string;
  readonly priority?: number;
  
  execute<TParams, TResult>(
    query: Query<TParams, TResult>,
    handler: QueryHandler<TParams, TResult, TReadModel>,
    projectionStore: ProjectionStore<TReadModel>,
    next: () => Promise<Result<TResult, QueryError>>
  ): Promise<Result<TResult, QueryError>>;
}

// Built-in middleware implementations

// Logging middleware
export class QueryLoggingMiddleware<TReadModel> implements QueryMiddleware<TReadModel> {
  readonly name = 'logging';
  readonly priority = 100;

  constructor(
    private readonly logger: {
      debug: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  async execute<TParams, TResult>(
    query: Query<TParams, TResult>,
    handler: QueryHandler<TParams, TResult, TReadModel>,
    projectionStore: ProjectionStore<TReadModel>,
    next: () => Promise<Result<TResult, QueryError>>
  ): Promise<Result<TResult, QueryError>> {
    const startTime = Date.now();
    
    this.logger.debug('Executing query', {
      queryName: query.name,
      params: query.params,
    });

    const result = await next();
    const duration = Date.now() - startTime;

    if (result.success) {
      this.logger.debug('Query executed successfully', {
        queryName: query.name,
        duration,
      });
    } else {
      this.logger.debug('Query execution failed', {
        queryName: query.name,
        duration,
        error: result.error.message,
      });
    }

    return result;
  }
}

// Types and interfaces
export interface ProjectionQueryParams {
  readonly filter?: ProjectionFilter;
  readonly options?: QueryOptions;
}

export interface QueryRegistryOptions {
  readonly enableCache?: boolean;
  readonly cacheTtl?: number;
}

export const DEFAULT_QUERY_OPTIONS: Required<QueryRegistryOptions> = {
  enableCache: true,
  cacheTtl: 300000, // 5 minutes
} as const;

interface CacheEntry {
  readonly value: unknown;
  readonly timestamp: number;
  readonly ttl: number;
}

export interface QueryRegistryStatistics {
  readonly handlerCount: number;
  readonly middlewareCount: number;
  readonly cacheSize: number;
  readonly registeredQueries: readonly string[];
}

// Query-specific error class
export class QueryError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'QUERY' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: QueryErrorCode,
    public readonly queryName?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QueryError';
    this.code = code as ErrorCode;
  }
}

export type QueryErrorCode =
  | 'HANDLER_NOT_FOUND'
  | 'EXECUTION_FAILED'
  | 'PROMISE_REJECTED'
  | 'BATCH_EXECUTION_FAILED'
  | 'PROJECTION_QUERY_FAILED'
  | 'SINGLE_PROJECTION_QUERY_FAILED'
  | 'PROJECTION_COUNT_FAILED';