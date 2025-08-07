// Optimized Event Store implementation with performance enhancements
// This addresses event sourcing performance bottlenecks identified in the architecture

import type {
  Event,
  AllEvents,
  UserEvent,
  Snapshot,
  SnapshotStrategy,
  EventIndex,
  AggregateIndex,
  CompoundIndex,
} from './generic-types';

import type { AggregateId, EventVersion } from '../types/branded';
import { BrandedTypes } from '../types/branded';
import type { IEventStore } from './interfaces';

// ============================================================================
// Performance-Optimized Event Store
// ============================================================================

export interface OptimizedEventStore<TEvent extends Event> extends IEventStore<TEvent> {
  // Batch operations for better throughput
  appendBatch(events: TEvent[]): Promise<void>;
  getEventsBatch(aggregateIds: AggregateId[]): Promise<Map<AggregateId, TEvent[]>>;
  
  // Snapshot support for faster aggregate loading
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getSnapshot(aggregateId: AggregateId): Promise<Snapshot | null>;
  getEventsFromSnapshot(aggregateId: AggregateId, fromVersion: EventVersion): Promise<TEvent[]>;
  
  // Streaming for large event sets
  streamEvents(
    aggregateId: AggregateId,
    options?: { batchSize?: number; fromVersion?: EventVersion }
  ): AsyncIterable<TEvent>;
  
  // Projection support
  getAllEventsFromVersion(fromVersion: EventVersion): Promise<TEvent[]>;
  subscribeToEvents(handler: (event: TEvent) => Promise<void>): () => void;
  
  // Performance metrics
  getStats(): Promise<{
    totalEvents: number;
    totalAggregates: number;
    averageEventsPerAggregate: number;
    storageSize: number;
  }>;
}

// ============================================================================
// In-Memory Optimized Implementation (for development/testing)
// ============================================================================

export class InMemoryOptimizedEventStore implements OptimizedEventStore<AllEvents> {
  private events = new Map<AggregateId, AllEvents[]>();
  private snapshots = new Map<AggregateId, Snapshot>();
  private subscribers = new Set<(event: AllEvents) => Promise<void>>();
  
  // Performance indexes
  private eventTypeIndex: EventIndex<AllEvents> = new Map();
  private aggregateIndex: AggregateIndex<AllEvents> = new Map();
  private compoundIndex: CompoundIndex<AllEvents> = new Map();
  
  // Snapshot strategy
  private snapshotStrategy: SnapshotStrategy = { type: 'count', threshold: 20 };

  async append(event: AllEvents): Promise<void> {
    await this.appendBatch([event]);
  }

  async appendBatch(events: AllEvents[]): Promise<void> {
    for (const event of events) {
      // Store event
      const existing = this.events.get(event.aggregateId) || [];
      existing.push(event);
      this.events.set(event.aggregateId, existing);
      
      // Update indexes
      this.updateIndexes(event);
      
      // Check if snapshot is needed
      await this.checkSnapshotNeeded(event.aggregateId);
      
      // Notify subscribers
      await this.notifySubscribers(event);
    }
  }

  async getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<AllEvents, { aggregateId: TAggregateId }>>> {
    const allEvents = this.events.get(aggregateId) || [];
    
    if (fromVersion !== undefined) {
      return allEvents.filter(e => e.version > fromVersion) as Array<Extract<AllEvents, { aggregateId: TAggregateId }>>;
    }
    
    const snapshot = await this.getSnapshot(aggregateId);
    
    if (snapshot) {
      // Load events from snapshot version
      const eventsFromSnapshot = await this.getEventsFromSnapshot(
        aggregateId,
        snapshot.version
      );
      return eventsFromSnapshot as Array<Extract<AllEvents, { aggregateId: TAggregateId }>>;
    }
    
    return allEvents as Array<Extract<AllEvents, { aggregateId: TAggregateId }>>;
  }

  async getEventsBatch(aggregateIds: AggregateId[]): Promise<Map<AggregateId, AllEvents[]>> {
    const result = new Map<AggregateId, AllEvents[]>();
    
    for (const aggregateId of aggregateIds) {
      const events = await this.getEvents(aggregateId);
      result.set(aggregateId, events);
    }
    
    return result;
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
  }

  async getSnapshot(aggregateId: AggregateId): Promise<Snapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  async getEventsFromSnapshot(
    aggregateId: AggregateId,
    fromVersion: EventVersion
  ): Promise<AllEvents[]> {
    const allEvents = this.events.get(aggregateId) || [];
    return allEvents.filter(event => event.version > fromVersion);
  }

  async *streamEvents(
    aggregateId: AggregateId,
    options: { batchSize?: number; fromVersion?: EventVersion } = {}
  ): AsyncIterable<AllEvents> {
    const { batchSize = 100, fromVersion = 1 } = options;
    const events = this.events.get(aggregateId) || [];
    const filteredEvents = events.filter(event => event.version >= fromVersion);
    
    for (let i = 0; i < filteredEvents.length; i += batchSize) {
      const batch = filteredEvents.slice(i, i + batchSize);
      for (const event of batch) {
        yield event;
      }
      
      // Yield control to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  async getAllEventsFromVersion(fromVersion: EventVersion): Promise<AllEvents[]> {
    const allEvents: AllEvents[] = [];
    
    for (const [, events] of this.events) {
      const filteredEvents = events.filter(event => event.version >= fromVersion);
      allEvents.push(...filteredEvents);
    }
    
    // Sort by timestamp for consistent ordering
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  subscribeToEvents(handler: (event: AllEvents) => Promise<void>): () => void {
    this.subscribers.add(handler);
    
    return () => {
      this.subscribers.delete(handler);
    };
  }

  async getStats(): Promise<{
    totalEvents: number;
    totalAggregates: number;
    averageEventsPerAggregate: number;
    storageSize: number;
  }> {
    let totalEvents = 0;
    let storageSize = 0;
    
    for (const [, events] of this.events) {
      totalEvents += events.length;
      storageSize += JSON.stringify(events).length; // Rough approximation
    }
    
    const totalAggregates = this.events.size;
    const averageEventsPerAggregate = totalAggregates > 0 ? totalEvents / totalAggregates : 0;
    
    return {
      totalEvents,
      totalAggregates,
      averageEventsPerAggregate,
      storageSize,
    };
  }

  async getAllEvents(fromPosition?: number): Promise<AllEvents[]> {
    const allEvents: AllEvents[] = [];
    
    for (const [, events] of this.events) {
      allEvents.push(...events);
    }
    
    // Sort by timestamp for consistent ordering
    const sorted = allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (fromPosition !== undefined) {
      return sorted.slice(fromPosition);
    }
    
    return sorted;
  }

  async getEventsByType<TType extends AllEvents['type']>(
    type: TType
  ): Promise<Array<Extract<AllEvents, { type: TType }>>> {
    return (this.eventTypeIndex.get(type) || []) as Array<Extract<AllEvents, { type: TType }>>;
  }

  subscribe(callback: (event: AllEvents) => void): () => void {
    const asyncWrapper = async (event: AllEvents) => {
      try {
        await Promise.resolve(callback(event));
      } catch (error) {
        console.error('Subscriber error:', error);
      }
    };
    
    this.subscribers.add(asyncWrapper);
    return () => this.subscribers.delete(asyncWrapper);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private updateIndexes(event: AllEvents): void {
    // Update type index
    const typeEvents = this.eventTypeIndex.get(event.type) || [];
    typeEvents.push(event);
    this.eventTypeIndex.set(event.type, typeEvents);
    
    // Update aggregate index
    const aggEvents = this.aggregateIndex.get(event.aggregateId) || [];
    aggEvents.push(event);
    this.aggregateIndex.set(event.aggregateId, aggEvents);
    
    // Update compound index
    const compoundKey = `${event.aggregateId}:${event.version}` as const;
    this.compoundIndex.set(compoundKey, event);
  }

  private async checkSnapshotNeeded(aggregateId: AggregateId): Promise<void> {
    const events = this.events.get(aggregateId) || [];
    
    const shouldSnapshot = this.evaluateSnapshotStrategy(events);
    if (shouldSnapshot) {
      await this.createSnapshot(aggregateId, events);
    }
  }

  private evaluateSnapshotStrategy(events: AllEvents[]): boolean {
    switch (this.snapshotStrategy.type) {
      case 'count':
        return events.length >= this.snapshotStrategy.threshold;
      case 'frequency':
        const latestEvent = events[events.length - 1];
        return latestEvent !== undefined && (latestEvent.version % this.snapshotStrategy.interval) === 0;
      case 'size':
        const eventsSize = JSON.stringify(events).length;
        return eventsSize >= this.snapshotStrategy.maxBytes;
      case 'time':
        const oldestEvent = events[0];
        if (!oldestEvent) return false;
        const age = Date.now() - oldestEvent.timestamp.getTime();
        return age >= this.snapshotStrategy.intervalMs;
      default:
        return false;
    }
  }

  private async createSnapshot(aggregateId: AggregateId, events: AllEvents[]): Promise<void> {
    if (events.length === 0) return;
    
    const latestEvent = events[events.length - 1];
    if (!latestEvent) return;
    
    // This is a simplified snapshot - in real implementation,
    // you'd reconstruct the aggregate state from events
    const snapshot: Snapshot = {
      aggregateId,
      version: latestEvent.version,
      state: { /* aggregate state would go here */ },
      timestamp: BrandedTypes.timestamp(),
      checksum: this.calculateChecksum(events),
    };
    
    await this.saveSnapshot(snapshot);
  }

  private calculateChecksum(events: AllEvents[]): string {
    // Simple checksum calculation - use a proper hash in production
    return events.map(e => `${e.type}:${e.version}`).join('|');
  }

  private async notifySubscribers(event: AllEvents): Promise<void> {
    const notifications = Array.from(this.subscribers).map(handler => handler(event));
    await Promise.all(notifications);
  }
  
  // ============================================================================
  // Query Methods for Performance Analysis
  // ============================================================================
  
  // Get events for multiple aggregates efficiently
  getEventsByAggregates(aggregateIds: AggregateId[]): Map<AggregateId, AllEvents[]> {
    const result = new Map<AggregateId, AllEvents[]>();
    
    for (const aggregateId of aggregateIds) {
      const events = this.aggregateIndex.get(aggregateId) || [];
      result.set(aggregateId, events);
    }
    
    return result;
  }
  
  // Get specific event by compound key
  getEventByAggregateVersion(aggregateId: AggregateId, version: EventVersion): AllEvents | null {
    const compoundKey = `${aggregateId}:${version}` as const;
    return this.compoundIndex.get(compoundKey) || null;
  }
}

// ============================================================================
// Caching Layer for Read Models
// ============================================================================

export class CachedProjectionStore<TState> {
  private cache = new Map<string, { state: TState; lastUpdated: Date; version: number }>();
  private ttl: number;

  constructor(ttlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.ttl = ttlMs;
  }

  async get(key: string): Promise<TState | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check TTL
    if (Date.now() - cached.lastUpdated.getTime() > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.state;
  }

  async set(key: string, state: TState, version: number): Promise<void> {
    this.cache.set(key, {
      state,
      lastUpdated: new Date(),
      version,
    });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): { entries: number; memoryUsage: number } {
    const entries = this.cache.size;
    const memoryUsage = JSON.stringify([...this.cache.values()]).length;
    
    return { entries, memoryUsage };
  }
}