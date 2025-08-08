import type { Result, BaseError } from '@cqrs-framework/types';

// Progress information for bulk operations
export interface BulkOperationProgress<TInput, TResult> {
  readonly progress: number; // 0-1
  readonly completed: number;
  readonly successful: number;
  readonly failed: number;
  readonly total: number;
  readonly current?: TInput;
  readonly result?: TResult;
  readonly error?: Error;
}

// Configuration for bulk operations
export interface BulkOperationConfig {
  readonly batchSize?: number;
  readonly concurrencyLimit?: number;
  readonly continueOnError?: boolean;
  readonly reportProgress?: boolean;
}

// Default configuration for bulk operations
export const DEFAULT_BULK_CONFIG: Required<BulkOperationConfig> = {
  batchSize: 10,
  concurrencyLimit: 5,
  continueOnError: true,
  reportProgress: true,
} as const;

// Generic bulk operation handler
export class BulkOperationHandler {
  constructor(
    private readonly config: Required<BulkOperationConfig> = DEFAULT_BULK_CONFIG
  ) {}

  // Execute bulk operations with progress tracking
  async *executeBulk<TInput, TResult>(
    inputs: readonly TInput[],
    operation: (input: TInput) => Promise<TResult>,
    config?: BulkOperationConfig
  ): AsyncGenerator<BulkOperationProgress<TInput, TResult>, void, unknown> {
    const finalConfig = { ...this.config, ...config };
    const total = inputs.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;

    // Process in batches with concurrency control
    for (let i = 0; i < inputs.length; i += finalConfig.batchSize) {
      const batch = inputs.slice(i, i + finalConfig.batchSize);
      
      // Limit concurrency within each batch
      const batchPromises = batch.map(async (input) => {
        try {
          const result = await operation(input);
          successful++;
          completed++;
          
          if (finalConfig.reportProgress) {
            return {
              progress: completed / total,
              completed,
              successful,
              failed,
              total,
              current: input,
              result,
            } as BulkOperationProgress<TInput, TResult>;
          }
          
          return null;
        } catch (error) {
          failed++;
          completed++;
          
          if (!finalConfig.continueOnError) {
            throw error;
          }
          
          if (finalConfig.reportProgress) {
            return {
              progress: completed / total,
              completed,
              successful,
              failed,
              total,
              current: input,
              error: error as Error,
            } as BulkOperationProgress<TInput, TResult>;
          }
          
          return null;
        }
      });

      // Execute batch with concurrency limit
      const batchResults = await this.limitConcurrency(
        batchPromises,
        finalConfig.concurrencyLimit
      );

      // Yield progress for each completed operation
      for (const result of batchResults) {
        if (result !== null && finalConfig.reportProgress) {
          yield result;
        }
      }
    }
  }

  // Execute bulk operations with Result type
  async executeBulkResult<TInput, TResult, TError extends BaseError>(
    inputs: readonly TInput[],
    operation: (input: TInput) => Promise<Result<TResult, TError>>,
    config?: BulkOperationConfig
  ): Promise<{
    readonly successful: Result<TResult, TError>[];
    readonly failed: Result<TResult, TError>[];
    readonly summary: {
      readonly total: number;
      readonly successful: number;
      readonly failed: number;
      readonly successRate: number;
    };
  }> {
    const successful: Result<TResult, TError>[] = [];
    const failed: Result<TResult, TError>[] = [];

    for await (const progress of this.executeBulk(inputs, operation, config)) {
      if (progress.result) {
        const result = progress.result as Result<TResult, TError>;
        if (result.success) {
          successful.push(result);
        } else {
          failed.push(result);
        }
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: inputs.length,
        successful: successful.length,
        failed: failed.length,
        successRate: inputs.length > 0 ? successful.length / inputs.length : 0,
      },
    };
  }

  // Batch operations into groups
  batch<T>(items: readonly T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  // Limit concurrency of promises
  private async limitConcurrency<T>(
    promises: Promise<T>[],
    limit: number
  ): Promise<T[]> {
    if (promises.length <= limit) {
      return Promise.all(promises);
    }

    const results: (T | undefined)[] = new Array(promises.length);
    let index = 0;

    const executeNext = async (): Promise<void> => {
      while (index < promises.length) {
        const currentIndex = index++;
        try {
          const result = await promises[currentIndex];
          results[currentIndex] = result;
        } catch (error) {
          // Re-throw to be handled by caller
          throw error;
        }
      }
    };

    // Create limited number of concurrent executors
    const executors = Array(Math.min(limit, promises.length))
      .fill(null)
      .map(() => executeNext());

    await Promise.all(executors);
    
    // Filter out undefined values and assert type safety
    return results.filter((result): result is T => result !== undefined);
  }
}