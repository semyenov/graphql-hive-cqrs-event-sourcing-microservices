/**
 * Framework Infrastructure: Query Bus
 * 
 * Routes queries to their appropriate handlers for read operations.
 */

import type { IQuery, IQueryHandler, IQueryBus, QueryPattern } from '../../core/query';
import { QueryHandlerNotFoundError } from '../../core/errors';

/**
 * Query bus implementation
 */
export class QueryBus implements IQueryBus {
  private handlers = new Map<string, IQueryHandler<IQuery, unknown>>();
  private cache = new Map<string, { result: unknown; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute default

  constructor(
    private cacheEnabled = false,
    cacheTimeout?: number
  ) {
    if (cacheTimeout) {
      this.cacheTimeout = cacheTimeout;
    }
  }

  /**
   * Register a query handler
   * Use registerWithType(queryType, handler) instead.
   */
  register<TQuery extends IQuery, TResult>(
    _handler: IQueryHandler<TQuery, TResult>
  ): void {
    throw new Error(
      'QueryBus.register cannot infer query type. Use registerWithType(queryType, handler) or registerQueryHandler(bus, queryType, handler).'
    );
  }

  /**
   * Register handler with explicit query type
   */
  registerWithType<TQuery extends IQuery, TResult>(
    queryType: string,
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    this.handlers.set(queryType, handler);
  }

  /**
   * Execute a query
   */
  async ask<TQuery extends IQuery, TResult>(
    query: TQuery
  ): Promise<TResult> {
    // Check cache if enabled
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(query);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result as TResult;
      }
    }

    // Find handler
    const handler = this.handlers.get(query.type);
    
    if (!handler) {
      const registered = Array.from(this.handlers.keys());
      throw new QueryHandlerNotFoundError(query.type, registered);
    }

    if (!handler.canHandle(query)) {
      throw new Error(`Handler cannot handle query type: ${query.type}`);
    }

    // Execute query
    const result = await handler.handle(query) as TResult;

    // Cache result if enabled
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(query);
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Clear a specific handler
   */
  unregister(queryType: string): void {
    this.handlers.delete(queryType);
  }

  /**
   * Clear all handlers and cache
   */
  clear(): void {
    this.handlers.clear();
    this.cache.clear();
  }

  /**
   * Clear cache only
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get registered query types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if handler is registered
   */
  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }

  /**
   * Enable/disable caching
   */
  setCache(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.cache.clear();
    }
  }

  /**
   * Inspect cache setting
   */
  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  /**
   * Prime the cache for a given query shape (type+parameters)
   */
  primeCache<TResult>(query: IQuery, result: TResult): void {
    const key = this.getCacheKey(query);
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Prime cache for many entries
   */
  primeCacheMany(entries: Array<{ query: IQuery; result: unknown }>): void {
    for (const { query, result } of entries) {
      this.primeCache(query, result);
    }
  }

  /**
   * Private: Generate cache key for query
   */
  private getCacheKey(query: IQuery): string {
    return `${query.type}:${JSON.stringify(query.parameters || {})}`;
  }
}

/**
 * Factory for creating query bus
 */
export function createQueryBus(
  cacheEnabled = false,
  cacheTimeout?: number
): QueryBus {
  return new QueryBus(cacheEnabled, cacheTimeout);
}

/**
 * Query handler registration helper
 */
export function registerQueryHandler<TQuery extends IQuery, TResult>(
  bus: QueryBus,
  queryType: string,
  handler: IQueryHandler<TQuery, TResult>
): void {
  bus.registerWithType(queryType, handler);
}

/**
 * Bulk register handlers from a QueryPattern
 */
export function registerQueryPattern<TQuery extends IQuery, TResult>(
  bus: QueryBus,
  pattern: QueryPattern<TQuery, TResult>
): void {
  for (const type of Object.keys(pattern)) {
    const t = type as TQuery['type'];
    const handle = pattern[t] as (q: TQuery) => Promise<TResult>;
    const handler = {
      async handle(query: TQuery): Promise<TResult> {
        return handle(query);
      },
      canHandle(query: IQuery): boolean {
        return query.type === t;
      },
    } as IQueryHandler<TQuery, TResult>;

    bus.registerWithType(t, handler);
  }
}