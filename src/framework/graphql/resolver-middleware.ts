/**
 * Framework GraphQL: Resolver Middleware
 * 
 * Separate middleware components for cross-cutting concerns.
 * Each middleware focuses on a single responsibility.
 */

import type { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';
import type { IValidator } from '../core/validation';

/**
 * Generic middleware function type
 */
export type ResolverMiddleware<TContext = any> = (
  resolver: GraphQLFieldConfig<any, TContext>['resolve']
) => GraphQLFieldConfig<any, TContext>['resolve'];

/**
 * Validation middleware
 */
export function withValidation<TContext extends { validators?: Map<string, IValidator<unknown>> }>(
  validatorName: string
): ResolverMiddleware<TContext> {
  return (originalResolver) => {
    return async (parent, args, context, info) => {
      const validator = context.validators?.get(validatorName);
      
      if (validator) {
        const result = await validator.validate(args);
        if (!result.isValid) {
          throw new Error(`Validation failed: ${result.errors.map(e => e.message).join(', ')}`);
        }
      }
      
      return originalResolver!(parent, args, context, info);
    };
  };
}

/**
 * Error handling middleware
 */
export function withErrorHandling<TContext = any>(): ResolverMiddleware<TContext> {
  return (originalResolver) => {
    return async (parent, args, context, info) => {
      try {
        return await originalResolver!(parent, args, context, info);
      } catch (error) {
        console.error(`Resolver ${info.fieldName} error:`, error);
        
        // Map domain errors to GraphQL errors
        if (error instanceof Error) {
          throw new Error(`Operation failed: ${error.message}`);
        }
        
        throw new Error('An unexpected error occurred');
      }
    };
  };
}

/**
 * Performance monitoring middleware
 */
export function withMetrics<TContext extends { requestId?: string }>(
  metricsCollector?: { recordTiming: (operation: string, duration: number) => void }
): ResolverMiddleware<TContext> {
  return (originalResolver) => {
    return async (parent, args, context, info) => {
      const startTime = Date.now();
      
      try {
        const result = await originalResolver!(parent, args, context, info);
        const duration = Date.now() - startTime;
        
        metricsCollector?.recordTiming(`resolver.${info.fieldName}`, duration);
        console.log(`📊 ${info.fieldName} completed in ${duration}ms`);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        metricsCollector?.recordTiming(`resolver.${info.fieldName}.error`, duration);
        throw error;
      }
    };
  };
}

/**
 * Authorization middleware
 */
export function withAuth<TContext extends { userId?: string; permissions?: string[] }>(
  requiredPermissions: string[]
): ResolverMiddleware<TContext> {
  return (originalResolver) => {
    return async (parent, args, context, info) => {
      if (!context.userId) {
        throw new Error('Authentication required');
      }
      
      const userPermissions = context.permissions || [];
      const hasPermission = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );
      
      if (!hasPermission) {
        throw new Error(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
      }
      
      return originalResolver!(parent, args, context, info);
    };
  };
}

/**
 * Simple caching middleware
 */
export function withCache<TContext extends { requestId?: string }>(
  ttlMs: number = 5 * 60 * 1000 // 5 minutes
): ResolverMiddleware<TContext> {
  const cache = new Map<string, { data: any; expiry: number }>();

  return (originalResolver) => {
    return async (parent, args, context, info) => {
      const cacheKey = `${info.fieldName}:${JSON.stringify(args)}`;
      const now = Date.now();
      
      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && cached.expiry > now) {
        console.log(`💾 Cache hit for ${info.fieldName}`);
        return cached.data;
      }
      
      // Execute resolver
      const result = await originalResolver!(parent, args, context, info);
      
      // Store in cache
      cache.set(cacheKey, {
        data: result,
        expiry: now + ttlMs
      });
      
      // Cleanup expired entries periodically
      if (cache.size > 1000) {
        for (const [key, value] of cache.entries()) {
          if (value.expiry <= now) {
            cache.delete(key);
          }
        }
      }
      
      return result;
    };
  };
}

/**
 * Rate limiting middleware
 */
export function withRateLimit<TContext extends { userId?: string }>(
  maxRequests: number = 60,
  windowMs: number = 60 * 1000 // 1 minute
): ResolverMiddleware<TContext> {
  const rateLimits = new Map<string, { count: number; resetTime: number }>();

  return (originalResolver) => {
    return async (parent, args, context, info) => {
      const key = context.userId || 'anonymous';
      const now = Date.now();
      
      let limit = rateLimits.get(key);
      if (!limit || limit.resetTime <= now) {
        limit = { count: 0, resetTime: now + windowMs };
        rateLimits.set(key, limit);
      }
      
      if (limit.count >= maxRequests) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      limit.count++;
      return originalResolver!(parent, args, context, info);
    };
  };
}

/**
 * Middleware composition utility
 */
export function compose<TContext = any>(
  ...middlewares: ResolverMiddleware<TContext>[]
): ResolverMiddleware<TContext> {
  return (resolver) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), resolver);
  };
}

/**
 * Common middleware combinations
 */
export const MiddlewarePresets = {
  /**
   * Standard middleware for mutations (validation + error handling + metrics)
   */
  mutation: <TContext extends { validators?: Map<string, IValidator<unknown>>; requestId?: string }>(
    validatorName: string
  ) => compose<TContext>(
    withValidation(validatorName),
    withErrorHandling(),
    withMetrics()
  ),

  /**
   * Standard middleware for queries (caching + error handling + metrics)
   */
  query: <TContext extends { requestId?: string }>() => compose<TContext>(
    withCache(5 * 60 * 1000), // 5 minutes
    withErrorHandling(),
    withMetrics()
  ),

  /**
   * Protected resolver (auth + validation + error handling)
   */
  protected: <TContext extends { 
    userId?: string; 
    permissions?: string[]; 
    validators?: Map<string, IValidator<unknown>> 
  }>(
    requiredPermissions: string[],
    validatorName?: string
  ) => compose<TContext>(
    withAuth(requiredPermissions),
    ...(validatorName ? [withValidation(validatorName)] : []),
    withErrorHandling()
  ),

  /**
   * High-traffic resolver (rate limiting + caching + error handling)
   */
  highTraffic: <TContext extends { userId?: string; requestId?: string }>(
    rateLimit: number = 100
  ) => compose<TContext>(
    withRateLimit(rateLimit),
    withCache(1 * 60 * 1000), // 1 minute
    withErrorHandling()
  )
};