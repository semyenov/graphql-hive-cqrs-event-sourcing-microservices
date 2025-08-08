/**
 * Framework Infrastructure: Aggregate Repository
 * 
 * Generic repository implementation for aggregates using event sourcing.
 */

import type { AggregateId } from '../../core/branded/types';
import type { IEvent, IEventStore } from '../../core/event';
import type { IAggregateBehavior } from '../../core/aggregate';
import type { IAggregateRepository } from '../../core/repository';

/**
 * Generic aggregate repository with event sourcing
 */
export abstract class AggregateRepository<
  TState,
  TEvent extends IEvent,
  TAggregateId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TAggregateId>
> implements IAggregateRepository<TAggregate, TAggregateId> {
  
  private cache = new Map<string, TAggregate>();

  constructor(
    protected readonly eventStore: Pick<
      IEventStore<TEvent>, 
      'append' | 'appendBatch' | 'getEvents'
    >,
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
    // Check cache first
    const cacheKey = id as string;
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Load events from store
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      return null;
    }

    // Rebuild aggregate from events
    const aggregate = this.createAggregate(id);
    aggregate.loadFromHistory(events);

    // Cache the aggregate
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, aggregate);
    }

    return aggregate;
  }

  /**
   * Save aggregate (persist uncommitted events)
   */
  async save(aggregate: TAggregate): Promise<void> {
    const events = aggregate.uncommittedEvents;
    if (events.length > 0) {
      await this.eventStore.appendBatch(events);
      aggregate.markEventsAsCommitted();

      // Update cache
      if (this.cacheEnabled) {
        const cacheKey = aggregate.id as string;
        this.cache.set(cacheKey, aggregate);
      }
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