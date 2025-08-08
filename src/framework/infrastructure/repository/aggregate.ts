/**
 * Framework Infrastructure: Aggregate Repository
 * 
 * Generic repository implementation for aggregates using event sourcing.
 */

import type { AggregateId } from '../../core/branded/types';
import type { IEvent, IEventStore, IEventBus } from '../../core/event';
import type { IAggregateBehavior } from '../../core/aggregate';
import type { IAggregateRepository } from '../../core/repository';

/**
 * Generic aggregate repository with event sourcing
 * @template TAggregate - The aggregate type
 * @template TEvent - The event type for this aggregate
 */
export abstract class AggregateRepository<
  TAggregate extends IAggregateBehavior<unknown, TEvent, AggregateId>,
  TEvent extends IEvent = IEvent
> implements IAggregateRepository<TAggregate, AggregateId> {
  
  private cache = new Map<string, TAggregate>();

  constructor(
    protected readonly eventStore: Pick<
      IEventStore<TEvent>, 
      'append' | 'appendBatch' | 'getEvents'
    >,
    protected readonly cacheEnabled = true,
    protected readonly eventBus?: IEventBus<TEvent>
  ) {}

  /**
   * Abstract method to create new aggregate instance
   */
  abstract createAggregate(id: AggregateId): TAggregate;

  /**
   * Get aggregate by ID
   */
  async get(id: AggregateId): Promise<TAggregate | null> {
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
   * Save aggregate (persist uncommitted events and publish to event bus)
   */
  async save(aggregate: TAggregate): Promise<void> {
    const events = aggregate.uncommittedEvents;
    if (events.length > 0) {
      // First persist events to event store
      await this.eventStore.appendBatch(events);
      
      // Then publish events to event bus for projections (if event bus is configured)
      if (this.eventBus) {
        for (const event of events) {
          await this.eventBus.publish(event);
        }
      }
      
      // Finally mark events as committed (this clears uncommittedEvents)
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
  async exists(id: AggregateId): Promise<boolean> {
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
  evictFromCache(id: AggregateId): void {
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