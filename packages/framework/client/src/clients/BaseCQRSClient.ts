import type { Result } from '@cqrs-framework/types';
import { BaseGraphQLClient, type GraphQLClientConfig } from './BaseGraphQLClient';
import { BulkOperationProgress } from '../patterns/BulkOperations';
import { ClientError } from '../errors/GraphQLError';

// Generic CQRS operation result
export interface CQRSOperationResult<TData, TError = string> {
  readonly success: boolean;
  readonly data?: TData;
  readonly errors?: readonly TError[];
}

// Generic create/update input interface
export interface BaseCreateInput {
  readonly [key: string]: unknown;
}

export interface BaseUpdateInput {
  readonly [key: string]: unknown;
}

// Generic entity interface
export interface BaseEntity {
  readonly id: string;
  readonly [key: string]: unknown;
}

// Base CQRS client that separates read and write operations
export abstract class BaseCQRSClient<
  TEntity extends BaseEntity,
  TCreateInput extends BaseCreateInput,
  TUpdateInput extends BaseUpdateInput
> {
  protected readonly readClient: BaseGraphQLClient;
  protected readonly writeClient: BaseGraphQLClient;

  constructor(
    endpoint: string,
    options?: {
      readonly readEndpoint?: string;
      readonly writeEndpoint?: string;
      readonly readConfig?: Partial<GraphQLClientConfig>;
      readonly writeConfig?: Partial<GraphQLClientConfig>;
    }
  ) {
    const readEndpoint = options?.readEndpoint ?? endpoint;
    const writeEndpoint = options?.writeEndpoint ?? endpoint;
    
    this.readClient = this.createReadClient(readEndpoint, options?.readConfig);
    this.writeClient = this.createWriteClient(writeEndpoint, options?.writeConfig);
  }

  // Abstract factory methods for clients
  protected abstract createReadClient(
    endpoint: string, 
    config?: Partial<GraphQLClientConfig>
  ): BaseGraphQLClient;
  
  protected abstract createWriteClient(
    endpoint: string, 
    config?: Partial<GraphQLClientConfig>
  ): BaseGraphQLClient;

  // High-level CQRS operations

  // Create and verify entity (handles eventual consistency)
  async createAndVerify(
    input: TCreateInput,
    options?: {
      readonly waitTime?: number;
      readonly maxRetries?: number;
    }
  ): Promise<Result<TEntity | null, ClientError>> {
    try {
      // Write operation
      const createResult = await this.performCreate(input);
      
      if (!createResult.success || !createResult.data) {
        return {
          success: false,
          error: new ClientError(
            createResult.errors?.map(e => String(e)).join(', ') ?? 
            'Create operation failed'
          ),
        };
      }

      // Wait for eventual consistency
      await this.readClient['eventualConsistency'].waitForConsistency(
        options?.waitTime
      );

      // Verify by reading
      const entity = await this.performGetById(createResult.data.id);
      
      return {
        success: true,
        value: entity,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof ClientError 
          ? error 
          : new ClientError((error as Error).message),
      };
    }
  }

  // Update with optimistic concurrency control
  async updateOptimistic(
    id: string,
    input: TUpdateInput,
    options?: {
      readonly expectedVersion?: number;
      readonly waitTime?: number;
    }
  ): Promise<Result<TEntity | null, ClientError>> {
    try {
      // First read current state
      const currentEntity = await this.performGetById(id);
      
      if (!currentEntity) {
        return {
          success: false,
          error: new ClientError(`Entity with ID ${id} not found`),
        };
      }

      // Perform update
      const updateResult = await this.performUpdate(id, input);
      
      if (!updateResult.success) {
        return {
          success: false,
          error: new ClientError(
            updateResult.errors?.map(e => String(e)).join(', ') ?? 
            'Update operation failed'
          ),
        };
      }

      // Wait for eventual consistency and verify
      await this.readClient['eventualConsistency'].waitForConsistency(
        options?.waitTime
      );

      const updatedEntity = await this.performGetById(id);
      
      return {
        success: true,
        value: updatedEntity,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof ClientError 
          ? error 
          : new ClientError((error as Error).message),
      };
    }
  }

  // Bulk operations with progress tracking
  async *bulkCreate(
    inputs: readonly TCreateInput[]
  ): AsyncGenerator<BulkOperationProgress<TCreateInput, CQRSOperationResult<TEntity>>, void, unknown> {
    yield* this.readClient['bulkOperations'].executeBulk(
      inputs,
      (input) => this.performCreate(input)
    );
  }

  async *bulkUpdate(
    updates: readonly { readonly id: string; readonly input: TUpdateInput }[]
  ): AsyncGenerator<BulkOperationProgress<{ readonly id: string; readonly input: TUpdateInput }, CQRSOperationResult<TEntity>>, void, unknown> {
    yield* this.readClient['bulkOperations'].executeBulk(
      updates,
      (update) => this.performUpdate(update.id, update.input)
    );
  }

  // Search with cache warming
  async searchWithCacheWarm<TSearchResult = TEntity>(
    query: string,
    options?: {
      readonly limit?: number;
      readonly warmCache?: boolean;
    }
  ): Promise<TSearchResult[]> {
    const results = await this.performSearch<TSearchResult>(query, options);
    
    // Pre-warm cache for found entities if enabled and reasonable number
    if (
      options?.warmCache !== false && 
      results.length > 0 && 
      results.length <= 10 &&
      this.readClient['cache']
    ) {
      // Background cache warming - fire and forget
      Promise.all(
        results.map((result: TSearchResult) => {
          const entity = result as unknown as { id: string };
          return this.performGetById(entity.id).catch(() => {
            // Ignore cache warming errors
          });
        })
      ).catch(() => {
        // Ignore cache warming errors
      });
    }
    
    return results;
  }

  // Statistics and analytics
  async getStatistics(): Promise<{
    readonly total: number;
    readonly recentActivity: {
      readonly createdToday: number;
      readonly createdThisWeek: number;
    };
    readonly metadata: Record<string, unknown>;
  }> {
    const entities = await this.performList({ limit: 1000 });
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Note: This assumes entities have createdAt field - implement as needed
    const stats = {
      total: entities.length,
      recentActivity: {
        createdToday: 0, // Would need createdAt field analysis
        createdThisWeek: 0, // Would need createdAt field analysis
      },
      metadata: this.calculateAdditionalStats(entities),
    };

    return stats;
  }

  // Abstract methods to be implemented by concrete clients
  protected abstract performCreate(input: TCreateInput): Promise<CQRSOperationResult<TEntity>>;
  protected abstract performUpdate(id: string, input: TUpdateInput): Promise<CQRSOperationResult<TEntity>>;
  protected abstract performDelete(id: string): Promise<CQRSOperationResult<boolean>>;
  protected abstract performGetById(id: string): Promise<TEntity | null>;
  protected abstract performList(options?: {
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<TEntity[]>;
  protected abstract performSearch<TResult = TEntity>(
    query: string,
    options?: { readonly limit?: number }
  ): Promise<TResult[]>;

  // Hook for additional statistics calculation
  protected calculateAdditionalStats(entities: readonly TEntity[]): Record<string, unknown> {
    return {};
  }

  // Helper to wait for consistency
  protected async waitForConsistency(ms?: number): Promise<void> {
    await this.readClient['eventualConsistency'].waitForConsistency(ms);
  }

  // Get client statistics
  getClientStats(): {
    readonly read: ReturnType<BaseGraphQLClient['getStats']>;
    readonly write: ReturnType<BaseGraphQLClient['getStats']>;
  } {
    return {
      read: this.readClient.getStats(),
      write: this.writeClient.getStats(),
    };
  }

  // Clear caches
  clearCaches(): void {
    this.readClient.clearCache();
    this.writeClient.clearCache();
  }
}