// Universal In-Memory Event Store for CQRS framework
import type { Event, IEventStore } from '../event-sourcing/interfaces';
import type { AggregateId } from '../types/branded';
import { OptimisticConcurrencyError, validateEvent } from '../event-sourcing/types';

// Generic in-memory event store implementation with optimistic concurrency control
export class InMemoryEventStore<TEvent extends Event = Event> implements IEventStore<TEvent> {
  private events: TEvent[] = [];
  private eventsByAggregate = new Map<string, TEvent[]>();
  private eventsByType = new Map<TEvent['type'], TEvent[]>();
  private subscribers = new Set<(event: TEvent) => void | Promise<void>>();
  private position = 0;

  async append(event: TEvent): Promise<void> {
    // Validate event structure
    const validationResult = validateEvent(event);
    if (!validationResult.success) {
      throw new Error(`Event validation failed: ${validationResult.error.message}`);
    }

    // Optimistic concurrency control
    const existingEvents = this.eventsByAggregate.get(event.aggregateId) || [];
    const expectedVersion = existingEvents.length + 1;
    
    if (event.version !== expectedVersion) {
      throw new OptimisticConcurrencyError(
        event.aggregateId,
        expectedVersion,
        event.version
      );
    }

    // Store event
    this.events.push(event);
    this.position++;

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

  async appendBatch(events: TEvent[]): Promise<void> {
    // Sort events by aggregate ID and version to maintain consistency
    const sortedEvents = [...events].sort((a, b) => {
      if (a.aggregateId !== b.aggregateId) {
        return a.aggregateId.localeCompare(b.aggregateId);
      }
      return a.version - b.version;
    });

    for (const event of sortedEvents) {
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

  async getLatestPosition(): Promise<number> {
    return this.position;
  }

  // Subscribe to events with type safety
  subscribe(handler: (event: TEvent) => void | Promise<void>): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  // Enhanced query methods
  async getEventCount(): Promise<number> {
    return this.events.length;
  }

  async getAggregateCount(): Promise<number> {
    return this.eventsByAggregate.size;
  }

  async aggregateExists(aggregateId: AggregateId): Promise<boolean> {
    return this.eventsByAggregate.has(aggregateId);
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

  // Performance metrics
  async getMetrics(): Promise<{
    totalEvents: number;
    totalStreams: number;
    eventsPerSecond: number;
    averageLatency: number;
  }> {
    const totalEvents = this.events.length;
    const totalStreams = this.eventsByAggregate.size;
    
    // Simple metrics calculation
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentEvents = this.events.filter(e => e.timestamp.getTime() > oneSecondAgo);
    
    return {
      eventsPerSecond: recentEvents.length,
      averageLatency: 0, // Not applicable for in-memory store
      totalEvents,
      totalStreams,
    };
  }

  // Event stream queries with filters
  async getEventsInTimeRange(
    startTime: Date,
    endTime: Date
  ): Promise<TEvent[]> {
    return this.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  async getEventsByAggregateType(
    aggregateType: string
  ): Promise<TEvent[]> {
    return this.events.filter(event => 
      event.aggregateId.startsWith(aggregateType)
    );
  }

  // Maintenance operations
  clear(): void {
    this.events = [];
    this.eventsByAggregate.clear();
    this.eventsByType.clear();
    this.position = 0;
  }

  // Export/Import for backup and testing
  exportEvents(): TEvent[] {
    return [...this.events];
  }

  async importEvents(events: TEvent[], validateVersions = true): Promise<void> {
    this.clear();
    
    if (validateVersions) {
      // Import with validation
      const sortedEvents = [...events].sort((a, b) => {
        if (a.aggregateId !== b.aggregateId) {
          return a.aggregateId.localeCompare(b.aggregateId);
        }
        return a.version - b.version;
      });
      
      for (const event of sortedEvents) {
        await this.append(event);
      }
    } else {
      // Bulk import without validation (faster for large datasets)
      this.events = [...events];
      this.position = events.length;
      
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

  // Transaction-like batch operations
  async transaction<TResult>(
    operation: (store: InMemoryEventStore<TEvent>) => Promise<TResult>
  ): Promise<TResult> {
    // Create a backup of current state
    const backup = {
      events: [...this.events],
      eventsByAggregate: new Map(
        Array.from(this.eventsByAggregate.entries()).map(([k, v]) => [k, [...v]])
      ),
      eventsByType: new Map(
        Array.from(this.eventsByType.entries()).map(([k, v]) => [k, [...v]])
      ),
      position: this.position,
    };

    try {
      return await operation(this);
    } catch (error) {
      // Restore from backup on error
      this.events = backup.events;
      this.eventsByAggregate = backup.eventsByAggregate;
      this.eventsByType = backup.eventsByType;
      this.position = backup.position;
      throw error;
    }
  }

  // Private helper methods
  private async notifySubscribers(event: TEvent): Promise<void> {
    const promises = Array.from(this.subscribers).map(subscriber => 
      Promise.resolve(subscriber(event)).catch(error => 
        console.error('Event subscriber error:', error)
      )
    );
    await Promise.all(promises);
  }
}

// Factory function for creating typed event stores
export const createEventStore = <TEvent extends Event>(): InMemoryEventStore<TEvent> => {
  return new InMemoryEventStore<TEvent>();
};

// Type helper to infer event type from event store
export type InferEventType<T> = T extends InMemoryEventStore<infer E> ? E : never;

// Event store configuration interface
export interface InMemoryEventStoreConfig {
  enableOptimisticConcurrency?: boolean;
  maxEventCount?: number;
  enableMetrics?: boolean;
}

// Configurable in-memory event store
export class ConfigurableInMemoryEventStore<TEvent extends Event = Event> 
  extends InMemoryEventStore<TEvent> {
  
  constructor(private config: InMemoryEventStoreConfig = {}) {
    super();
  }

  override async append(event: TEvent): Promise<void> {
    // Check max event count if configured
    if (this.config.maxEventCount && await this.getEventCount() >= this.config.maxEventCount) {
      throw new Error(`Maximum event count reached: ${this.config.maxEventCount}`);
    }

    await super.append(event);
  }
}