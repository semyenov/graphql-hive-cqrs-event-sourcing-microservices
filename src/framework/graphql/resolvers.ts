/**
 * Framework GraphQL: Resolver Factories
 * 
 * Factory functions for creating type-safe GraphQL resolvers.
 */

import type {
  IGraphQLContext,
  IMutationResolverConfig,
  IQueryResolverConfig,
  ISubscriptionResolverConfig,
  ResolverFunction,
  IGraphQLMutationResponse,
} from './types';
import type { ICommand, IAggregateCommand, ICommandResult } from '../core/command';
import type { IQuery } from '../core/query';
import type { IEvent } from '../core/event';
import type { AggregateId } from '../core/branded/types';
import { 
  errorToGraphQL, 
  commandResultToGraphQLResponse,
  withErrorHandling,
  validationErrorsToGraphQL,
} from './errors';
import { getContextValue } from './context';

/**
 * Create a mutation resolver that maps to a command
 */
export function createMutationResolver<
  TArgs = unknown,
  TCommand extends ICommand = ICommand,
  TResult = IGraphQLMutationResponse
>(
  config: IMutationResolverConfig<TArgs, TCommand, TResult>
): ResolverFunction<unknown, TArgs, IGraphQLContext, Promise<TResult>> {
  return withErrorHandling(
    async (_parent: unknown , args: TArgs, context: IGraphQLContext): Promise<TResult> => {
      const startTime = Date.now();
      
      try {
        // Run validation if provided
        if (config.validate) {
          const errors = await config.validate(args);
          if (errors.length > 0) {
            return {
              success: false,
              errors: errors,
            } as unknown as TResult;
          }
        }
        
        // Map input to command
        const { aggregateId, payload, metadata } = config.mapInput(args, context);
        
        // Create command
        const command: ICommand = {
          type: config.commandType,
          payload,
          metadata: {
            ...metadata,
            userId: context.userId,
            requestId: context.requestId,
            timestamp: context.timestamp,
          },
        };
        
        // Add aggregateId if provided (for aggregate commands)
        const finalCommand = aggregateId
          ? { ...command, aggregateId } as IAggregateCommand
          : command;
        
        // Send command through command bus
        const result = await context.commandBus.send(finalCommand);
        
        // Log metrics if configured
        const logger = getContextValue(context, 'logger');
        if (logger) {
          (logger as { info: Function }).info('Mutation executed', {
            mutation: config.commandType,
            duration: Date.now() - startTime,
            success: result.success,
          });
        }
        
        // Map result if mapper provided
        if (config.mapResult) {
          return config.mapResult(result, args);
        }
        
        // Default to mutation response format
        return commandResultToGraphQLResponse(result) as unknown as TResult;
        
      } catch (error) {
        // Log error if logger available
        const logger = getContextValue(context, 'logger');
        if (logger) {
          (logger as { error: Function }).error('Mutation failed', {
            mutation: config.commandType,
            duration: Date.now() - startTime,
            error,
          });
        }
        
        // Return error response
        return {
          success: false,
          errors: [errorToGraphQL(error)],
        } as unknown as TResult;
      }
    },
    { returnMutationResponse: true }
  ) as ResolverFunction<unknown, TArgs, IGraphQLContext, Promise<TResult>>;
}

/**
 * Create a query resolver that maps to a query bus
 */
export function createQueryResolver<
  TArgs = unknown,
  TQuery extends IQuery = IQuery,
  TResult = unknown
>(
  config: IQueryResolverConfig<TArgs, TQuery, TResult>
): ResolverFunction<unknown, TArgs, IGraphQLContext, Promise<TResult>> {
  return async (_parent: unknown, args: TArgs, context: IGraphQLContext): Promise<TResult> => {
    const startTime = Date.now();
    
    try {
      // Check cache if configured
      if (config.cache) {
        const cacheKey = config.cache.key?.(args) ?? JSON.stringify(args);
        const queryCache = getContextValue<Map<string, { result: TResult; timestamp: number }>>(
          context, 
          'queryCache'
        );
        
        if (queryCache) {
          const cached = queryCache.get(cacheKey);
          if (cached) {
            const age = Date.now() - cached.timestamp;
            const ttl = config.cache.ttl ?? 60000; // Default 1 minute
            
            if (age < ttl) {
              return cached.result;
            }
          }
        }
      }
      
      // Map parameters
      const parameters = config.mapParams(args, context);
      
      // Create query
      const query: IQuery = {
        type: config.queryType,
        parameters,
      };
      
      // Execute query through query bus
      const result = await context.queryBus.ask(query);
      
      // Map result if mapper provided
      const finalResult = config.mapResult 
        ? config.mapResult(result, args)
        : result as TResult;
      
      // Update cache if configured
      if (config.cache) {
        const cacheKey = config.cache.key?.(args) ?? JSON.stringify(args);
        const queryCache = getContextValue<Map<string, { result: TResult; timestamp: number }>>(
          context, 
          'queryCache'
        );
        
        if (queryCache) {
          queryCache.set(cacheKey, {
            result: finalResult,
            timestamp: Date.now(),
          });
        }
      }
      
      // Log metrics if configured
      const logger = getContextValue(context, 'logger');
      if (logger) {
        (logger as { info: Function }).info('Query executed', {
          query: config.queryType,
          duration: Date.now() - startTime,
          cached: false,
        });
      }
      
      return finalResult;
      
    } catch (error) {
      // Log error if logger available
      const logger = getContextValue(context, 'logger');
      if (logger) {
        (logger as { error: Function }).error('Query failed', {
          query: config.queryType,
          duration: Date.now() - startTime,
          error,
        });
      }
      
      throw error;
    }
  };
}

/**
 * Create a subscription resolver that maps to event bus
 */
export function createSubscriptionResolver<
  TArgs = unknown,
  TEvent extends IEvent = IEvent,
  TPayload = unknown
>(
  config: ISubscriptionResolverConfig<TArgs, TEvent, TPayload>
): {
  subscribe: ResolverFunction<unknown, TArgs, IGraphQLContext, AsyncIterable<TPayload>>;
  resolve?: ResolverFunction<TPayload, TArgs, IGraphQLContext, TPayload>;
} {
  return {
    subscribe: async (_parent: unknown, args: TArgs, context: IGraphQLContext) => {
      // Create async iterator for events
      const asyncIterator = createAsyncIterator<TEvent, TPayload>(
        context.eventBus,
        config.eventTypes,
        (event) => {
          // Apply filter if provided
          if (config.filter && !config.filter(event, args, context)) {
            return null;
          }
          
          // Map event to payload
          return config.mapPayload(event, args);
        }
      );
      
      return asyncIterator;
    },
    resolve: (payload: TPayload) => payload,
  };
}

/**
 * Create async iterator for event subscriptions
 */
function createAsyncIterator<TEvent extends IEvent, TPayload>(
  eventBus: IGraphQLContext['eventBus'],
  eventTypes: string[],
  mapEvent: (event: TEvent) => TPayload | null
): AsyncIterable<TPayload> {
  const queue: TPayload[] = [];
  const resolvers: Array<(value: IteratorResult<TPayload>) => void> = [];
  let unsubscribers: Array<() => void> = [];
  
  // Subscribe to each event type
  for (const eventType of eventTypes) {
    const unsubscribe = eventBus.subscribe(
      eventType,
      (event: IEvent) => {
        const payload = mapEvent(event as TEvent);
        if (payload !== null) {
          if (resolvers.length > 0) {
            const resolver = resolvers.shift()!;
            resolver({ value: payload, done: false });
          } else {
            queue.push(payload);
          }
        }
      }
    );
    unsubscribers.push(unsubscribe);
  }
  
  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          if (queue.length > 0) {
            yield queue.shift()!;
          } else {
            yield await new Promise<TPayload>((resolve) => {
              resolvers.push((result) => {
                if (!result.done) {
                  resolve(result.value);
                }
              });
            });
          }
        }
      } finally {
        // Cleanup subscriptions
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      }
    },
  };
}

/**
 * Batch resolver factory for DataLoader pattern
 */
export function createBatchResolver<TKey, TResult>(
  batchFn: (keys: readonly TKey[]) => Promise<TResult[]>,
  options?: {
    cache?: boolean;
    maxBatchSize?: number;
  }
): (key: TKey) => Promise<TResult> {
  const batch: { key: TKey; resolve: (value: TResult) => void; reject: (error: Error) => void }[] = [];
  let scheduled = false;
  
  const executeBatch = async () => {
    const currentBatch = [...batch];
    batch.length = 0;
    scheduled = false;
    
    try {
      const keys = currentBatch.map(item => item.key);
      const results = await batchFn(keys);
      
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(error as Error);
      });
    }
  };
  
  return (key: TKey): Promise<TResult> => {
    return new Promise((resolve, reject) => {
      batch.push({ key, resolve, reject });
      
      if (!scheduled) {
        scheduled = true;
        process.nextTick(executeBatch);
      } else if (options?.maxBatchSize && batch.length >= options.maxBatchSize) {
        executeBatch();
      }
    });
  };
}

/**
 * Helper to create resolver map for a domain
 */
export function createResolverMap(resolvers: {
  Query?: Record<string, ResolverFunction>;
  Mutation?: Record<string, ResolverFunction>;
  Subscription?: Record<string, { subscribe: ResolverFunction; resolve?: ResolverFunction }>;
  [typeName: string]: unknown;
}): typeof resolvers {
  return resolvers;
}