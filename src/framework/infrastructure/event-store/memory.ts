/**
 * Framework Infrastructure: In-Memory Event Store
 * 
 * A generic in-memory implementation of the event store.
 * Suitable for development and testing, not for production.
 */

import type { IEvent, IEventStore, EventHandler } from '../../core/event';
import type { AggregateId } from '../../../shared/branded/types';

/**
 * In-memory event store implementation
 */
export class InMemoryEventStore<TEvent extends IEvent = IEvent> 
  implements IEventStore<TEvent> {
  
  private events: TEvent[] = [];
  private eventsByAggregate = new Map<string, TEvent[]>();
  private eventsByType = new Map<TEvent['type'], TEvent[]>();
  private subscribers = new Set<EventHandler<TEvent>>();

  async append(event: TEvent): Promise<void> {
    this.validateEvent(event);

    // Store event
    this.events.push(event);

    // Index by aggregate
    const aggregateKey = event.aggregateId as string;
    if (!this.eventsByAggregate.has(aggregateKey)) {
      this.eventsByAggregate.set(aggregateKey, []);
    }
    this.eventsByAggregate.get(aggregateKey)!.push(event);

    // Index by type
    if (!this.eventsByType.has(event.type)) {
      this.eventsByType.set(event.type, []);
    }
    this.eventsByType.get(event.type)!.push(event);

    // Notify subscribers
    await this.notifySubscribers(event);
  }

  async appendBatch(events: readonly TEvent[]): Promise<void> {
    for (const event of events) {
      await this.append(event);
    }
  }

  async getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<TEvent, { aggregateId: TAggregateId }>>> {
    const aggregateKey = aggregateId as string;
    const events = this.eventsByAggregate.get(aggregateKey) || [];

    if (fromVersion !== undefined) {
      return events.filter(e => e.version > fromVersion) as Array<
        Extract<TEvent, { aggregateId: TAggregateId }>
      >;
    }

    return events as Array<Extract<TEvent, { aggregateId: TAggregateId }>>;
  }

  async getAllEvents(fromPosition?: number): Promise<TEvent[]> {
    if (fromPosition !== undefined) {
      return this.events.slice(fromPosition);
    }
    return [...this.events];
  }

  async getEventsByType<TType extends TEvent['type']>(
    type: TType
  ): Promise<Array<Extract<TEvent, { type: TType }>>> {
    return (this.eventsByType.get(type) || []) as Array<
      Extract<TEvent, { type: TType }>
    >;
  }

  subscribe(handler: EventHandler<TEvent>): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  /**
   * Additional utility methods
   */
  
  getEventCount(): number {
    return this.events.length;
  }

  getAggregateCount(): number {
    return this.eventsByAggregate.size;
  }

  async aggregateExists(aggregateId: AggregateId): Promise<boolean> {
    return this.eventsByAggregate.has(aggregateId as string);
  }

  async getLatestEvent<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId
  ): Promise<Extract<TEvent, { aggregateId: TAggregateId }> | null> {
    const events = await this.getEvents(aggregateId);
    return events[events.length - 1] || null;
  }

  async getAggregateVersion(aggregateId: AggregateId): Promise<number> {
    const latestEvent = await this.getLatestEvent(aggregateId);
    return latestEvent?.version || 0;
  }

  clear(): void {
    this.events = [];
    this.eventsByAggregate.clear();
    this.eventsByType.clear();
  }

  /**
   * Private methods
   */
  
  private validateEvent(event: TEvent): void {
    if (!event.aggregateId) {
      throw new Error('Event must have an aggregateId');
    }
    if (!event.type) {
      throw new Error('Event must have a type');
    }
    if (typeof event.version !== 'number' || event.version < 1) {
      throw new Error('Event must have a valid version number');
    }
    if (!(event.timestamp instanceof Date)) {
      throw new Error('Event must have a valid timestamp');
    }

    // Check version consistency
    const aggregateKey = event.aggregateId as string;
    const existingEvents = this.eventsByAggregate.get(aggregateKey) || [];
    const expectedVersion = existingEvents.length + 1;

    if (event.version !== expectedVersion) {
      throw new Error(
        `Version mismatch: expected ${expectedVersion}, got ${event.version}`
      );
    }
  }

  private async notifySubscribers(event: TEvent): Promise<void> {
    const promises = Array.from(this.subscribers).map(subscriber =>
      Promise.resolve(subscriber(event)).catch(error =>
        console.error('Subscriber error:', error)
      )
    );
    await Promise.all(promises);
  }

  /**
   * Export/Import for backup and restore
   */
  
  exportEvents(): TEvent[] {
    return [...this.events];
  }

  async importEvents(events: TEvent[], validateVersions = true): Promise<void> {
    this.clear();

    if (validateVersions) {
      for (const event of events) {
        await this.append(event);
      }
    } else {
      // Bulk import without validation
      this.events = [...events];

      // Rebuild indexes
      for (const event of events) {
        const aggregateKey = event.aggregateId.toString();
        if (!this.eventsByAggregate.has(aggregateKey)) {
          this.eventsByAggregate.set(aggregateKey, []);
        }
        this.eventsByAggregate.get(aggregateKey)!.push(event);

        if (!this.eventsByType.has(event.type)) {
          this.eventsByType.set(event.type, []);
        }
        this.eventsByType.get(event.type)!.push(event);
      }
    }
  }
}

/**
 * Factory function for creating typed event stores
 */
export function createEventStore<TEvent extends IEvent>(): InMemoryEventStore<TEvent> {
  return new InMemoryEventStore<TEvent>();
}

/**
 * Type helper to infer event type from event store
 */
export type InferEventType<T> = T extends InMemoryEventStore<infer E> ? E : never;