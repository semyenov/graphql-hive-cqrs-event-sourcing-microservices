/**
 * Framework Infrastructure: Query Bus
 * 
 * Routes queries to their appropriate handlers for read operations.
 */

import type { IQuery, IQueryHandler, IQueryBus } from '../../core/query';

/**
 * Query bus implementation
 */
export class QueryBus implements IQueryBus {
  private handlers = new Map<string, IQueryHandler<any, any>>();
  private cache = new Map<string, { result: any; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute default

  constructor(
    private readonly cacheEnabled = false,
    cacheTimeout?: number
  ) {
    if (cacheTimeout) {
      this.cacheTimeout = cacheTimeout;
    }
  }

  /**
   * Register a query handler
   */
  register<TQuery extends IQuery, TResult>(
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    // In production, use decorators or explicit type registration
    // For now, handlers need to be registered with their query type
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
      throw new Error(`No handler registered for query type: ${query.type}`);
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
    if (!enabled) {
      this.cache.clear();
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