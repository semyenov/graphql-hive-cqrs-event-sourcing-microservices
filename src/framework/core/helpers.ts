/**
 * Framework Core: Helper Utilities
 * 
 * Common helper functions for framework operations.
 */

import type { IEvent, IEventMetadata } from './event';
import type { ICommand, ICommandResult } from './command';
import type { IQuery } from './query';
import type { AggregateId, EventVersion } from './branded/types';
import { BrandedTypes } from './branded/factories';

/**
 * Create event metadata with defaults
 */
export function createEventMetadata(
  partial: Partial<IEventMetadata> = {}
): IEventMetadata {
  const eventId = crypto.randomUUID();
  return {
    correlationId: partial.correlationId ?? BrandedTypes.correlationId(eventId),
    causationId: partial.causationId ?? BrandedTypes.causationId(eventId),
    timestamp: partial.timestamp ?? BrandedTypes.timestamp(new Date()),
    userId: partial.userId,
    ...partial,
  };
}

/**
 * Create a new event with metadata
 */
export function createEvent<TEvent extends IEvent>(
  event: Omit<TEvent, 'metadata'>,
  metadata?: Partial<IEventMetadata>
): TEvent {
  return {
    ...event,
    metadata: createEventMetadata(metadata),
  } as unknown as TEvent;
}

/**
 * Create command result
 */
export function createCommandResult<T>(
  data: T,
  error?: Error
): ICommandResult<T> {
  return {
    success: !error,
    data,
    error,
  };
}

/**
 * Create success result
 */
export function success<T>(data: T): ICommandResult<T> {
  return createCommandResult(data);
}

/**
 * Create failure result
 */
export function failure<T = never>(error: Error | string): ICommandResult<T> {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  return createCommandResult(undefined as T, errorObj);
}

/**
 * Check if result is successful
 */
export function isSuccess<T>(result: ICommandResult<T>): result is ICommandResult<T> & { success: true } {
  return result.success;
}

/**
 * Check if result is failure
 */
export function isFailure<T>(result: ICommandResult<T>): result is ICommandResult<T> & { success: false } {
  return !result.success;
}

/**
 * Create a new command
 */
export function createCommand<TCommand extends ICommand>(
  type: TCommand['type'],
  payload: TCommand['payload'],
  metadata?: Partial<IEventMetadata>
): TCommand {
  return {
    type,
    payload,
    id: BrandedTypes.eventId(crypto.randomUUID()),
    timestamp: BrandedTypes.timestamp(new Date()),
    metadata: metadata ? createEventMetadata(metadata) : undefined,
  } as unknown as TCommand;
}

/**
 * Create a new query
 */
export function createQuery<TQuery extends IQuery>(
  type: TQuery['type'],
  parameters?: TQuery['parameters']
): TQuery {
  return {
    type,
    parameters,
  } as TQuery;
}

/**
 * Event version helpers
 */
export const EventVersionHelpers = {
  /**
   * Increment version
   */
  increment(version: EventVersion): EventVersion {
    return BrandedTypes.eventVersion(version + 1);
  },

  /**
   * Check if version is newer
   */
  isNewer(version1: EventVersion, version2: EventVersion): boolean {
    return version1 > version2;
  },

  /**
   * Check if versions are sequential
   */
  isSequential(prev: EventVersion, next: EventVersion): boolean {
    return next === prev + 1;
  },

  /**
   * Get initial version
   */
  initial(): EventVersion {
    return BrandedTypes.eventVersion(1);
  },
};

/**
 * Aggregate helpers
 */
export const AggregateHelpers = {
  /**
   * Check if aggregate exists
   */
  exists<T>(aggregate: T | null | undefined): aggregate is T {
    return aggregate !== null && aggregate !== undefined;
  },

  /**
   * Create new aggregate ID
   */
  createId(prefix?: string): AggregateId {
    const id = crypto.randomUUID();
    return BrandedTypes.aggregateId(prefix ? `${prefix}_${id}` : id);
  },

  /**
   * Parse aggregate ID from string
   */
  parseId(id: string): AggregateId {
    return BrandedTypes.aggregateId(id);
  },
};

/**
 * Retry helper for operations
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    onError?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 100,
    backoff = true,
    onError,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (onError) {
        onError(lastError, attempt);
      }
      
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Batch operations helper
 */
export async function batch<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Debounce helper
 */
export function debounce<T extends AnyFunction>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle helper
 */
export function throttle<T extends AnyFunction>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Type alias for any function
 */
type AnyFunction = (...args: unknown[]) => unknown;