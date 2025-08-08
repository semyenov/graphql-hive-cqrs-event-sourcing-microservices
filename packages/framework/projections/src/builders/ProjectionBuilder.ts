import type { Event, IEventStore } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode, AggregateId } from '@cqrs-framework/types';

// Generic projection interface
export interface Projection<TReadModel = unknown> {
  readonly id: string;
  readonly version: number;
  readonly lastProcessedEventId?: string;
  readonly lastProcessedAt?: Date;
  readonly data: TReadModel;
}

// Projection handler interface
export interface ProjectionHandler<TEvent extends Event, TReadModel> {
  readonly eventType: string;
  readonly priority?: number;
  
  handle(
    event: TEvent, 
    currentProjection: Projection<TReadModel> | null
  ): Promise<Result<Projection<TReadModel>, ProjectionError>>;
  
  // Optional: Handle event deletion/rollback
  rollback?(
    event: TEvent,
    currentProjection: Projection<TReadModel> | null
  ): Promise<Result<Projection<TReadModel> | null, ProjectionError>>;
}

// Projection store interface
export interface ProjectionStore<TReadModel = unknown> {
  get(id: string): Promise<Projection<TReadModel> | null>;
  save(projection: Projection<TReadModel>): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Query operations
  query(
    filter?: ProjectionFilter,
    options?: QueryOptions
  ): Promise<Projection<TReadModel>[]>;
  
  count(filter?: ProjectionFilter): Promise<number>;
}

// Filter and query interfaces
export interface ProjectionFilter {
  readonly ids?: string[];
  readonly versionRange?: { min?: number; max?: number };
  readonly lastProcessedRange?: { after?: Date; before?: Date };
  readonly dataFilter?: Record<string, unknown>;
}

export interface QueryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

// Projection builder for creating read models from events
export class ProjectionBuilder<TEvent extends Event = Event, TReadModel = unknown> {
  private readonly handlers = new Map<string, ProjectionHandler<TEvent, TReadModel>>();
  private readonly middleware: ProjectionMiddleware<TEvent, TReadModel>[] = [];
  private initializer?: () => TReadModel;
  private idExtractor?: (event: TEvent) => string;

  constructor(
    private readonly projectionStore: ProjectionStore<TReadModel>,
    private readonly eventStore: IEventStore<TEvent>
  ) {}

  // Set projection ID extractor
  withIdExtractor(extractor: (event: TEvent) => string): this {
    this.idExtractor = extractor;
    return this;
  }

  // Set initial read model factory
  withInitializer(initializer: () => TReadModel): this {
    this.initializer = initializer;
    return this;
  }

  // Register event handler
  on(
    eventType: string,
    handler: (
      event: Extract<TEvent, { type: typeof eventType }>,
      currentData: TReadModel | null
    ) => Promise<TReadModel> | TReadModel
  ): this {
    const projectionHandler: ProjectionHandler<TEvent, TReadModel> = {
      eventType,
      handle: async (event, currentProjection) => {
        try {
          const currentData = currentProjection?.data ?? null;
          const newData = await handler(
            event as Extract<TEvent, { type: typeof eventType }>,
            currentData
          );

          const projection: Projection<TReadModel> = {
            id: this.extractProjectionId(event),
            version: (currentProjection?.version ?? 0) + 1,
            lastProcessedEventId: event.id,
            lastProcessedAt: new Date(),
            data: newData,
          };

          return {
            success: true,
            value: projection,
          };
        } catch (error) {
          return {
            success: false,
            error: new ProjectionError(
              `Failed to handle event ${eventType}: ${error}`,
              'HANDLER_EXECUTION_FAILED',
              eventType
            ),
          };
        }
      },
    };

    this.handlers.set(eventType, projectionHandler);
    return this;
  }

  // Register middleware
  use(middleware: ProjectionMiddleware<TEvent, TReadModel>): this {
    this.middleware.push(middleware);
    // Sort by priority (higher first)
    this.middleware.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Process single event
  async processEvent(event: TEvent): Promise<Result<Projection<TReadModel> | null, ProjectionError>> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      // No handler for this event type - return success with no changes
      return {
        success: true,
        value: null,
      };
    }

    try {
      // Get current projection
      const projectionId = this.extractProjectionId(event);
      const currentProjection = await this.projectionStore.get(projectionId);

      // Execute handler with middleware
      const result = await this.executeWithMiddleware(event, handler, currentProjection);
      
      if (!result.success) {
        return result;
      }

      // Save updated projection
      await this.projectionStore.save(result.value);

      return {
        success: true,
        value: result.value,
      };
    } catch (error) {
      return {
        success: false,
        error: new ProjectionError(
          `Failed to process event: ${error}`,
          'EVENT_PROCESSING_FAILED',
          event.type
        ),
      };
    }
  }

  // Process multiple events in order
  async processEvents(events: TEvent[]): Promise<Result<ProjectionProcessingResult<TReadModel>, ProjectionError>> {
    const results: Projection<TReadModel>[] = [];
    const errors: ProjectionError[] = [];

    for (const event of events) {
      const result = await this.processEvent(event);
      
      if (result.success && result.value) {
        results.push(result.value);
      } else if (!result.success) {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: new ProjectionError(
          `${errors.length} events failed to process`,
          'BATCH_PROCESSING_FAILED',
          undefined,
          { errors }
        ),
      };
    }

    return {
      success: true,
      value: {
        processedCount: events.length,
        projections: results,
        errors: [],
      },
    };
  }

  // Rebuild projection from scratch
  async rebuild(
    projectionId: string,
    options?: {
      fromVersion?: number;
      upToEventId?: string;
    }
  ): Promise<Result<Projection<TReadModel>, ProjectionError>> {
    try {
      // Delete existing projection
      await this.projectionStore.delete(projectionId);

      // Get all events for this projection
      const allEvents = await this.eventStore.getAllEvents(options?.fromVersion);
      
      // Filter events for this projection
      const relevantEvents = allEvents.filter(event => 
        this.extractProjectionId(event) === projectionId &&
        (!options?.upToEventId || event.id <= options.upToEventId)
      );

      // Process events in order
      const result = await this.processEvents(relevantEvents);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Return the final projection state
      const finalProjection = await this.projectionStore.get(projectionId);
      if (!finalProjection) {
        throw new Error('Projection not found after rebuild');
      }

      return {
        success: true,
        value: finalProjection,
      };
    } catch (error) {
      return {
        success: false,
        error: new ProjectionError(
          `Failed to rebuild projection ${projectionId}: ${error}`,
          'REBUILD_FAILED',
          undefined,
          { projectionId }
        ),
      };
    }
  }

  // Get projection statistics
  async getStatistics(): Promise<ProjectionStatistics> {
    const allProjections = await this.projectionStore.query();
    const now = Date.now();

    const stats = {
      totalProjections: allProjections.length,
      averageVersion: 0,
      oldestProjection: null as Date | null,
      newestProjection: null as Date | null,
      handlerCount: this.handlers.size,
      middlewareCount: this.middleware.length,
    };

    if (allProjections.length > 0) {
      stats.averageVersion = allProjections.reduce((sum, p) => sum + p.version, 0) / allProjections.length;
      
      const timestamps = allProjections
        .map(p => p.lastProcessedAt)
        .filter((date): date is Date => date !== undefined);
      
      if (timestamps.length > 0) {
        stats.oldestProjection = new Date(Math.min(...timestamps.map(d => d.getTime())));
        stats.newestProjection = new Date(Math.max(...timestamps.map(d => d.getTime())));
      }
    }

    return stats;
  }

  // Private helper methods
  private extractProjectionId(event: TEvent): string {
    if (this.idExtractor) {
      return this.idExtractor(event);
    }
    
    // Default: use aggregate ID
    return event.aggregateId;
  }

  private async executeWithMiddleware(
    event: TEvent,
    handler: ProjectionHandler<TEvent, TReadModel>,
    currentProjection: Projection<TReadModel> | null
  ): Promise<Result<Projection<TReadModel>, ProjectionError>> {
    let index = 0;

    const executeNext = async (): Promise<Result<Projection<TReadModel>, ProjectionError>> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        if (middleware) {
          return await middleware.execute(event, currentProjection, handler, executeNext);
        }
      }

      // Execute the actual handler
      return await handler.handle(event, currentProjection);
    };

    return await executeNext();
  }
}

// Projection middleware interface
export interface ProjectionMiddleware<TEvent extends Event, TReadModel> {
  readonly name: string;
  readonly priority?: number;
  
  execute(
    event: TEvent,
    currentProjection: Projection<TReadModel> | null,
    handler: ProjectionHandler<TEvent, TReadModel>,
    next: () => Promise<Result<Projection<TReadModel>, ProjectionError>>
  ): Promise<Result<Projection<TReadModel>, ProjectionError>>;
}

// Projection processing result
export interface ProjectionProcessingResult<TReadModel> {
  readonly processedCount: number;
  readonly projections: Projection<TReadModel>[];
  readonly errors: ProjectionError[];
}

// Projection statistics
export interface ProjectionStatistics {
  readonly totalProjections: number;
  readonly averageVersion: number;
  readonly oldestProjection: Date | null;
  readonly newestProjection: Date | null;
  readonly handlerCount: number;
  readonly middlewareCount: number;
}

// Projection-specific error class
export class ProjectionError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'PROJECTION' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: ProjectionErrorCode,
    public readonly eventType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProjectionError';
    this.code = code as ErrorCode;
  }
}

export type ProjectionErrorCode =
  | 'HANDLER_EXECUTION_FAILED'
  | 'EVENT_PROCESSING_FAILED'
  | 'BATCH_PROCESSING_FAILED'
  | 'REBUILD_FAILED'
  | 'STORE_OPERATION_FAILED';