/**
 * Framework GraphQL: Context Builder
 * 
 * GraphQL context creation with CQRS infrastructure.
 */

import type { IGraphQLContext } from './types';
import type { ICommandBus } from '../core/command';
import type { IQueryBus } from '../core/query';
import type { IEvent, IEventBus } from '../core/event';
import type { YogaInitialContext } from 'graphql-yoga';

/**
 * Context builder configuration
 */
export interface IContextBuilderConfig<TEvent extends IEvent = IEvent> {
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly eventBus: IEventBus<TEvent>;
  readonly extractUserId?: (request: Request) => string | undefined;
  readonly extractRequestId?: (request: Request) => string | undefined;
  readonly extractMetadata?: (request: Request) => Record<string, unknown> | undefined;
}

/**
 * Create GraphQL context builder
 */
export function createContextBuilder<TEvent extends IEvent = IEvent>(
  config: IContextBuilderConfig<TEvent>
): (initialContext: YogaInitialContext) => Promise<IGraphQLContext> | IGraphQLContext {
  return (initialContext: YogaInitialContext): IGraphQLContext => {
    const request = initialContext.request;
    
    // Extract user ID from headers or JWT
    const userId = config.extractUserId?.(request) ?? 
      request.headers.get('x-user-id') ?? 
      undefined;
    
    // Extract or generate request ID for tracing
    const requestId = config.extractRequestId?.(request) ?? 
      request.headers.get('x-request-id') ?? 
      generateRequestId();
    
    // Extract additional metadata
    const metadata = config.extractMetadata?.(request) ?? {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') ?? 
          request.headers.get('x-real-ip'),
      origin: request.headers.get('origin'),
    };

    return {
      commandBus: config.commandBus,
      queryBus: config.queryBus,
      eventBus: config.eventBus as IEventBus<IEvent>,
      userId,
      requestId,
      timestamp: new Date(),
      metadata,
    };
  };
}

/**
 * Enhanced context builder with middleware support
 */
export interface IEnhancedContextBuilderConfig<TEvent extends IEvent = IEvent> 
  extends IContextBuilderConfig<TEvent> {
  readonly middleware?: Array<(
    context: IGraphQLContext,
    request: Request
  ) => Promise<IGraphQLContext> | IGraphQLContext>;
  readonly cache?: {
    readonly userCache?: Map<string, unknown>;
    readonly queryCache?: Map<string, unknown>;
  };
}

/**
 * Create enhanced GraphQL context builder with middleware
 */
export function createEnhancedContextBuilder<TEvent extends IEvent = IEvent>(
  config: IEnhancedContextBuilderConfig<TEvent>
): (initialContext: YogaInitialContext) => Promise<IGraphQLContext> {
  const baseBuilder = createContextBuilder(config);
  
  return async (initialContext: YogaInitialContext): Promise<IGraphQLContext> => {
    let context = await baseBuilder(initialContext);
    
    // Apply middleware
    if (config.middleware) {
      for (const middleware of config.middleware) {
        context = await middleware(context, initialContext.request);
      }
    }
    
    // Add cache if configured
    if (config.cache) {
      context = {
        ...context,
        metadata: {
          ...context.metadata,
          cache: config.cache,
        },
      };
    }
    
    return context;
  };
}

/**
 * Context middleware for authentication
 */
export function authenticationMiddleware(
  authenticate: (token: string) => Promise<{ userId: string; roles?: string[] } | null>
): (context: IGraphQLContext, request: Request) => Promise<IGraphQLContext> {
  return async (context: IGraphQLContext, request: Request): Promise<IGraphQLContext> => {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return context;
    }
    
    const token = authHeader.replace('Bearer ', '');
    const authResult = await authenticate(token);
    
    if (!authResult) {
      return context;
    }
    
    return {
      ...context,
      userId: authResult.userId,
      metadata: {
        ...context.metadata,
        roles: authResult.roles,
      },
    };
  };
}

/**
 * Context middleware for logging
 */
export function loggingMiddleware(
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, error?: unknown) => void;
  }
): (context: IGraphQLContext, request: Request) => IGraphQLContext {
  return (context: IGraphQLContext, request: Request): IGraphQLContext => {
    const startTime = Date.now();
    
    logger.info('GraphQL Request', {
      requestId: context.requestId,
      userId: context.userId,
      path: new URL(request.url).pathname,
      method: request.method,
    });
    
    // Add logging to metadata for later use
    return {
      ...context,
      metadata: {
        ...context.metadata,
        logger,
        startTime,
      },
    };
  };
}

/**
 * Context middleware for rate limiting
 */
export function rateLimitingMiddleware(
  rateLimiter: {
    check: (userId?: string, ip?: string) => Promise<boolean>;
    increment: (userId?: string, ip?: string) => Promise<void>;
  }
): (context: IGraphQLContext, request: Request) => Promise<IGraphQLContext> {
  return async (context: IGraphQLContext, request: Request): Promise<IGraphQLContext> => {
    const ip = context.metadata?.ip as string | undefined;
    const allowed = await rateLimiter.check(context.userId, ip);
    
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }
    
    await rateLimiter.increment(context.userId, ip);
    
    return context;
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract context value helper
 */
export function getContextValue<T>(
  context: IGraphQLContext,
  key: string,
  defaultValue?: T
): T | undefined {
  return (context.metadata?.[key] as T) ?? defaultValue;
}

/**
 * Set context value helper
 */
export function setContextValue<T>(
  context: IGraphQLContext,
  key: string,
  value: T
): IGraphQLContext {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      [key]: value,
    },
  };
}