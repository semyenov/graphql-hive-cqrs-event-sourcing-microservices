// Generic CQRS Client Base for Command Query Responsibility Segregation
import type { Event } from '@cqrs-framework/core';

// Read client interface
export interface IReadClient<TQuery = unknown, TResult = unknown> {
  query(query: TQuery): Promise<TResult>;
  queryBatch(queries: TQuery[]): Promise<TResult[]>;
}

// Write client interface
export interface IWriteClient<TCommand = unknown, TResult = unknown> {
  execute(command: TCommand): Promise<TResult>;
  executeBatch(commands: TCommand[]): Promise<TResult[]>;
}

// Base CQRS client options
export interface CQRSClientOptions {
  readEndpoint?: string;
  writeEndpoint?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  consistencyTimeout?: number;
  consistencyCheckInterval?: number;
}

// Command result
export interface CommandResult<TData = unknown, TError = unknown> {
  success: boolean;
  data?: TData;
  errors?: TError[];
  version?: number;
  timestamp?: Date;
}

// Query result
export interface QueryResult<TData = unknown> {
  data: TData;
  fromCache?: boolean;
  timestamp?: Date;
}

// Abstract CQRS client base
export abstract class CQRSClientBase<
  TReadClient extends IReadClient = IReadClient,
  TWriteClient extends IWriteClient = IWriteClient
> {
  protected readonly options: Required<CQRSClientOptions>;
  
  public abstract readonly read: TReadClient;
  public abstract readonly write: TWriteClient;

  constructor(options: CQRSClientOptions = {}) {
    this.options = {
      readEndpoint: options.readEndpoint || options.writeEndpoint || '/graphql',
      writeEndpoint: options.writeEndpoint || options.readEndpoint || '/graphql',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      consistencyTimeout: options.consistencyTimeout || 5000,
      consistencyCheckInterval: options.consistencyCheckInterval || 100,
    };
  }

  // Wait for eventual consistency
  async waitForConsistency(
    checkFn?: () => Promise<boolean>,
    timeout?: number
  ): Promise<void> {
    const startTime = Date.now();
    const maxTimeout = timeout || this.options.consistencyTimeout;
    
    if (!checkFn) {
      // Default wait if no check function provided
      await new Promise(resolve => 
        setTimeout(resolve, this.options.consistencyCheckInterval)
      );
      return;
    }

    while (Date.now() - startTime < maxTimeout) {
      if (await checkFn()) {
        return;
      }
      await new Promise(resolve => 
        setTimeout(resolve, this.options.consistencyCheckInterval)
      );
    }
    
    throw new Error('Consistency check timed out');
  }

  // Retry logic for commands
  protected async retryCommand<T>(
    fn: () => Promise<T>,
    retries = this.options.retryCount
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.options.retryDelay * Math.pow(2, i))
          );
        }
      }
    }
    
    throw lastError || new Error('Command failed after retries');
  }

  // Optimistic concurrency control
  async executeWithOptimisticLock<TCommand, TResult>(
    getCurrentVersion: () => Promise<number>,
    createCommand: (version: number) => TCommand,
    executeCommand: (command: TCommand) => Promise<TResult>,
    maxRetries = 3
  ): Promise<TResult> {
    let retries = 0;
    
    while (retries < maxRetries) {
      const currentVersion = await getCurrentVersion();
      const command = createCommand(currentVersion);
      
      try {
        return await executeCommand(command);
      } catch (error) {
        if (this.isConcurrencyError(error)) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('Optimistic lock failed after maximum retries');
          }
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.options.retryDelay * Math.pow(2, retries))
          );
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Optimistic lock failed');
  }

  // Check if error is a concurrency error
  protected isConcurrencyError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message: string }).message.toLowerCase();
      return message.includes('version') || 
             message.includes('concurrency') || 
             message.includes('conflict');
    }
    return false;
  }

  // Batch operations with chunking
  protected async processBatch<TInput, TOutput>(
    items: TInput[],
    processor: (batch: TInput[]) => Promise<TOutput[]>,
    batchSize = 10
  ): Promise<TOutput[]> {
    const results: TOutput[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  // Circuit breaker pattern
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  protected async withCircuitBreaker<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    // Check circuit breaker state
    if (this.circuitBreakerState === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.circuitBreakerState = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      // Reset on success
      if (this.circuitBreakerState === 'half-open') {
        this.circuitBreakerState = 'closed';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.circuitBreakerState = 'open';
      }
      
      throw error;
    }
  }
}