import type { IEvent } from '../../core/types';
import type { IEventStore } from '../../domain/interfaces';
import type { AggregateId } from '../../core/branded';

// Generic in-memory event store implementation
export class InMemoryEventStore<TEvent extends IEvent = IEvent> implements IEventStore<TEvent> {
  private events: TEvent[] = [];
  private eventsByAggregate = new Map<string, TEvent[]>();
  private eventsByType = new Map<TEvent['type'], TEvent[]>();
  private subscribers = new Set<(event: TEvent) => void | Promise<void>>();

  async append(event: TEvent): Promise<void> {
    // Validate event
    this.validateEvent(event);

    // Store event
    this.events.push(event);

    // Index by aggregate
    if (!this.eventsByAggregate.has(event.aggregateId)) {
      this.eventsByAggregate.set(event.aggregateId, []);
    }
    this.eventsByAggregate.get(event.aggregateId)!.push(event);

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
    const events = this.eventsByAggregate.get(aggregateId) || [];

    if (fromVersion !== undefined) {
      return events.filter(e => e.version > fromVersion) as Array<Extract<TEvent, { aggregateId: TAggregateId }>>;
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
    return (this.eventsByType.get(type) || []) as Array<Extract<TEvent, { type: TType }>>;
  }

  // Subscribe to events
  subscribe(handler: (event: TEvent) => void | Promise<void>): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  // Get event count
  getEventCount(): number {
    return this.events.length;
  }

  // Get aggregate count
  getAggregateCount(): number {
    return this.eventsByAggregate.size;
  }

  // Check if aggregate exists
  async aggregateExists(aggregateId: AggregateId): Promise<boolean> {
    return this.eventsByAggregate.has(aggregateId);
  }

  // Get latest event for aggregate
  async getLatestEvent<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId
  ): Promise<Extract<TEvent, { aggregateId: TAggregateId }> | null> {
    const events = await this.getEvents(aggregateId);
    return events[events.length - 1] || null;
  }

  // Get aggregate version
  async getAggregateVersion(aggregateId: AggregateId): Promise<number> {
    const latestEvent = await this.getLatestEvent(aggregateId);
    return latestEvent?.version || 0;
  }

  // Clear all events (useful for testing)
  clear(): void {
    this.events = [];
    this.eventsByAggregate.clear();
    this.eventsByType.clear();
  }

  // Validate event consistency
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
    const existingEvents = this.eventsByAggregate.get(event.aggregateId) || [];
    const expectedVersion = existingEvents.length + 1;

    if (event.version !== expectedVersion) {
      throw new Error(
        `Version mismatch: expected ${expectedVersion}, got ${event.version}`
      );
    }
  }

  // Notify all subscribers
  private async notifySubscribers(event: TEvent): Promise<void> {
    const promises = Array.from(this.subscribers).map(subscriber =>
      Promise.resolve(subscriber(event)).catch(error =>
        console.error('Subscriber error:', error)
      )
    );
    await Promise.all(promises);
  }

  // Export events for backup/restore
  exportEvents(): TEvent[] {
    return [...this.events];
  }

  // Import events (useful for testing or restore)
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
        if (!this.eventsByAggregate.has(event.aggregateId)) {
          this.eventsByAggregate.set(event.aggregateId, []);
        }
        this.eventsByAggregate.get(event.aggregateId)!.push(event);

        if (!this.eventsByType.has(event.type)) {
          this.eventsByType.set(event.type, []);
        }
        this.eventsByType.get(event.type)!.push(event);
      }
    }
  }
}

// Factory function for creating typed event stores
export const createEventStore = <TEvent extends Event>(): InMemoryEventStore<TEvent> => {
  return new InMemoryEventStore<TEvent>();
};

// Type helper to infer event type from event store
export type InferEventType<T> = T extends InMemoryEventStore<infer E> ? E : never;