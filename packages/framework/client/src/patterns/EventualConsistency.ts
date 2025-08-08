import type { Result, BaseError } from '@cqrs-framework/types';

// Configuration for eventual consistency handling
export interface EventualConsistencyConfig {
  readonly defaultWaitTime: number;
  readonly maxRetries: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffTime: number;
}

// Default configuration for eventual consistency
export const DEFAULT_EVENTUAL_CONSISTENCY_CONFIG: EventualConsistencyConfig = {
  defaultWaitTime: 100,
  maxRetries: 3,
  backoffMultiplier: 2,
  maxBackoffTime: 5000,
} as const;

// Generic eventual consistency handler
export class EventualConsistencyHandler {
  constructor(
    private readonly config: EventualConsistencyConfig = DEFAULT_EVENTUAL_CONSISTENCY_CONFIG
  ) {}

  // Wait for eventual consistency with configurable delay
  async waitForConsistency(ms?: number): Promise<void> {
    const waitTime = ms ?? this.config.defaultWaitTime;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Retry operation with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    initialBackoff?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries;
    const backoff = initialBackoff ?? this.config.defaultWaitTime;
    
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries - 1) {
          const waitTime = Math.min(
            backoff * Math.pow(this.config.backoffMultiplier, attempt),
            this.config.maxBackoffTime
          );
          await this.waitForConsistency(waitTime);
        }
      }
    }

    throw lastError ?? new Error('Operation failed after maximum retries');
  }

  // Retry with Result type
  async withRetryResult<T, E extends BaseError>(
    operation: () => Promise<Result<T, E>>,
    maxRetries?: number,
    initialBackoff?: number
  ): Promise<Result<T, E>> {
    try {
      return await this.withRetry(operation, maxRetries, initialBackoff);
    } catch (error) {
      return {
        success: false,
        error: error as E,
      };
    }
  }

  // Poll until condition is met or timeout
  async pollUntil<T>(
    operation: () => Promise<T>,
    predicate: (result: T) => boolean,
    options?: {
      readonly pollInterval?: number;
      readonly maxAttempts?: number;
      readonly timeout?: number;
    }
  ): Promise<T> {
    const pollInterval = options?.pollInterval ?? this.config.defaultWaitTime;
    const maxAttempts = options?.maxAttempts ?? this.config.maxRetries * 5;
    const timeout = options?.timeout ?? 30000; // 30 seconds default
    
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < maxAttempts) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Polling timed out after ${timeout}ms`);
      }

      try {
        const result = await operation();
        if (predicate(result)) {
          return result;
        }
      } catch (error) {
        // Continue polling even if individual operations fail
        console.debug(`Polling attempt ${attempt + 1} failed:`, error);
      }

      attempt++;
      await this.waitForConsistency(pollInterval);
    }

    throw new Error(`Polling failed after ${maxAttempts} attempts`);
  }
}

// Singleton instance for convenience
export const eventualConsistency = new EventualConsistencyHandler();