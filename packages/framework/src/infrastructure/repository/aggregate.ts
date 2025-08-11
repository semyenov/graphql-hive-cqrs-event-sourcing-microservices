/**
 * Framework Infrastructure: Aggregate Repository
 * 
 * Generic repository implementation for aggregates using event sourcing.
 */

import type { AggregateId } from '../../core/branded/types';
import type { IEvent, IEventStore, IEventBus } from '../../core/event';
import type { IAggregateBehavior } from '../../core/aggregate';
import type { IAggregateRepository, ISnapshotStore } from '../../core/repository';
import { AggregateNotFoundError } from '../../core/errors';
import { loggers, formatDuration } from '../../core/logger';

const logger = loggers.repository;

/**
 * Generic aggregate repository with event sourcing
 */
export abstract class AggregateRepository<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, string, TAggregateId>
> implements IAggregateRepository<TAggregate, TAggregateId> {
  
  private cache = new Map<string, TAggregate>();
  private readonly SNAPSHOT_THRESHOLD = 10; // Every 10 events

  constructor(
    protected readonly eventStore: Pick<
      IEventStore<TEvent>, 
      'append' | 'appendBatch' | 'getEvents'
    >,
    protected readonly eventBus?: IEventBus<TEvent>,
    protected readonly snapshotStore?: ISnapshotStore<TState, TAggregateId>,
    protected readonly cacheEnabled = true
  ) {}

  /**
   * Abstract method to create new aggregate instance
   */
  abstract createAggregate(id: TAggregateId): TAggregate;

  /**
   * Get aggregate by ID
   */
  async get(id: TAggregateId): Promise<TAggregate | null> {
    const startTime = Date.now();
    const cacheKey = id as string;
    
    // Check cache first
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      logger.debug(`Cache hit for aggregate`, { aggregateId: id });
      return this.cache.get(cacheKey)!;
    }

    logger.debug(`Loading aggregate`, { aggregateId: id });

    // Try to load from snapshot
    const snapshot = await this.snapshotStore?.get(id);
    const aggregate = this.createAggregate(id);

    if (snapshot) {
      logger.debug(`Loading from snapshot`, {
        aggregateId: id,
        snapshotVersion: snapshot.version,
      });
      
      aggregate.loadFromSnapshot(snapshot);
      const events = await this.eventStore.getEvents(id, snapshot.version);
      aggregate.loadFromHistory(events);
      
      logger.info(`Aggregate loaded from snapshot`, {
        aggregateId: id,
        eventsAfterSnapshot: events.length,
        currentVersion: aggregate.version,
        duration: formatDuration(startTime),
      });
    } else {
      // Load all events if no snapshot
      const events = await this.eventStore.getEvents(id);
      if (events.length === 0) {
        logger.debug(`Aggregate not found`, { aggregateId: id });
        return null;
      }
      aggregate.loadFromHistory(events);
      
      logger.info(`Aggregate loaded from events`, {
        aggregateId: id,
        eventCount: events.length,
        currentVersion: aggregate.version,
        duration: formatDuration(startTime),
      });
    }

    // Cache the aggregate
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, aggregate);
      logger.debug(`Aggregate cached`, {
        aggregateId: id,
        cacheSize: this.cache.size,
      });
    }

    return aggregate;
  }

  /**
   * Get aggregate or throw a descriptive error
   */
  async getOrThrow(id: TAggregateId, message?: string): Promise<TAggregate> {
    const aggregate = await this.get(id);
    if (!aggregate) {
      if (message) throw new AggregateNotFoundError(message);
      throw new AggregateNotFoundError(String(id));
    }
    return aggregate;
  }

  /**
   * Save aggregate (persist uncommitted events)
   */
  async save(aggregate: TAggregate): Promise<void> {
    const startTime = Date.now();
    const events = aggregate.uncommittedEvents;
    
    if (events.length === 0) {
      logger.debug(`No uncommitted events to save`, {
        aggregateId: aggregate.id,
      });
      return;
    }
    
    logger.debug(`Saving aggregate`, {
      aggregateId: aggregate.id,
      uncommittedEvents: events.length,
      currentVersion: aggregate.version,
    });

    try {
      // Persist events to event store
      await this.eventStore.appendBatch(events);

      // Publish events to event bus for side effects (projections, notifications, etc.)
      if (this.eventBus) {
        await this.eventBus.publishBatch(events);
      }

      if (this.shouldCreateSnapshot(aggregate)) {
        const snapshot = aggregate.createSnapshot();
        await this.snapshotStore?.save(snapshot);
        
        logger.info(`Snapshot created`, {
          aggregateId: aggregate.id,
          snapshotVersion: snapshot.version,
        });
      }

      aggregate.markEventsAsCommitted();

      // Update cache
      if (this.cacheEnabled) {
        const cacheKey = aggregate.id as string;
        this.cache.set(cacheKey, aggregate);
      }
      
      logger.info(`Aggregate saved successfully`, {
        aggregateId: aggregate.id,
        savedEvents: events.length,
        newVersion: aggregate.version,
        duration: formatDuration(startTime),
      });
    } catch (error) {
      logger.error(`Failed to save aggregate`, {
        aggregateId: aggregate.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if aggregate exists
   */
  async exists(id: TAggregateId): Promise<boolean> {
    // Check cache first
    const cacheKey = id as string;
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return true;
    }

    // Check event store
    const events = await this.eventStore.getEvents(id);
    return events.length > 0;
  }

  private shouldCreateSnapshot(aggregate: TAggregate): boolean {
    if (!this.snapshotStore) {
      return false;
    }
    const uncommittedCount = aggregate.uncommittedEvents.length;
    if (uncommittedCount === 0) {
      return false;
    }
    const lastVersion = aggregate.version - uncommittedCount;
    const newVersion = aggregate.version;
    return Math.floor(lastVersion / this.SNAPSHOT_THRESHOLD) < Math.floor(newVersion / this.SNAPSHOT_THRESHOLD);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove single item from cache
   */
  evictFromCache(id: TAggregateId): void {
    const cacheKey = id as string;
    this.cache.delete(cacheKey);
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}