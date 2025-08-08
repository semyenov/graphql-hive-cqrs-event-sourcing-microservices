import type { Event, IEventStore, Snapshot } from '@cqrs-framework/core';
import type { AggregateId, EventVersion, Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Enhanced event store with performance optimizations
export interface OptimizedEventStore<TEvent extends Event> extends Omit<IEventStore<TEvent>, 'subscribe'> {

  // Batch operations for better throughput
  appendBatch(events: TEvent[]): Promise<void>;
  getEventsBatch(aggregateIds: AggregateId[]): Promise<Map<AggregateId, TEvent[]>>;
  
  // Snapshot support for faster aggregate loading
  saveSnapshot<TState>(snapshot: Snapshot<TState, AggregateId>): Promise<void>;
  getSnapshot<TState>(aggregateId: AggregateId): Promise<Snapshot<TState, AggregateId> | null>;
  getEventsFromSnapshot(aggregateId: AggregateId, fromVersion: EventVersion): Promise<TEvent[]>;
  
  // Streaming for large event sets
  streamEvents(
    aggregateId: AggregateId,
    options?: { batchSize?: number; fromVersion?: EventVersion }
  ): AsyncIterable<TEvent>;
  
  // Global event streaming for projections
  streamAllEvents(
    options?: { 
      batchSize?: number; 
      fromVersion?: EventVersion;
      eventTypes?: string[];
    }
  ): AsyncIterable<TEvent>;
  
  // Event subscription for real-time processing (override base interface)
  subscribe(handler: (event: TEvent) => Promise<void>): () => void;
  
  // Performance and monitoring
  getMetrics(): Promise<EventStoreMetrics>;
  compactStorage(): Promise<CompactionResult>;
}

// Event store metrics
export interface EventStoreMetrics {
  readonly totalEvents: number;
  readonly totalAggregates: number;
  readonly averageEventsPerAggregate: number;
  readonly storageSize: number;
  readonly snapshotCount: number;
  readonly indexSize: number;
  readonly subscriptionCount: number;
}

// Compaction result
export interface CompactionResult {
  readonly eventsRemoved: number;
  readonly spaceSaved: number;
  readonly duration: number;
}

// Optimized in-memory event store implementation
export class InMemoryOptimizedEventStore<TEvent extends Event = Event> implements OptimizedEventStore<TEvent> {
  private readonly events = new Map<AggregateId, TEvent[]>();
  private readonly snapshots = new Map<AggregateId, Snapshot<unknown, AggregateId>>();
  private readonly subscribers = new Set<(event: TEvent) => Promise<void>>();
  
  // Performance indexes
  private readonly eventTypeIndex = new Map<string, Set<AggregateId>>();
  private readonly versionIndex = new Map<AggregateId, number>();
  private readonly timestampIndex = new Map<number, TEvent[]>();
  
  // Configuration
  private readonly options: OptimizedEventStoreOptions;
  
  // Metrics
  private metrics: EventStoreMetrics = {
    totalEvents: 0,
    totalAggregates: 0,
    averageEventsPerAggregate: 0,
    storageSize: 0,
    snapshotCount: 0,
    indexSize: 0,
    subscriptionCount: 0,
  };

  constructor(options: Partial<OptimizedEventStoreOptions> = {}) {
    this.options = { ...DEFAULT_OPTIMIZED_OPTIONS, ...options };
  }

  // Core IEventStore implementation
  async append(event: TEvent): Promise<void> {
    await this.appendBatch([event]);
  }

  async getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<TEvent, { aggregateId: TAggregateId }>>> {
    const events = this.events.get(aggregateId) ?? [];
    
    // Try to load from snapshot first
    const snapshot = await this.getSnapshot(aggregateId);
    if (snapshot) {
      const eventsFromSnapshot = await this.getEventsFromSnapshot(
        aggregateId, 
        snapshot.version as EventVersion
      );
      return eventsFromSnapshot as Array<Extract<TEvent, { aggregateId: TAggregateId }>>;
    }
    
    // Filter events if fromVersion is provided
    const filteredEvents = fromVersion !== undefined 
      ? events.filter(event => event.version > fromVersion)
      : events;
    
    return filteredEvents as Array<Extract<TEvent, { aggregateId: TAggregateId }>>;
  }

  // Enhanced batch operations
  async appendBatch(events: TEvent[]): Promise<void> {
    if (events.length === 0) return;

    const startTime = performance.now();
    
    try {
      // Validate events
      for (const event of events) {
        await this.validateEvent(event);
      }

      // Group events by aggregate ID for efficient processing
      const eventsByAggregate = this.groupEventsByAggregate(events);

      // Process each aggregate's events
      for (const [aggregateId, aggregateEvents] of eventsByAggregate) {
        await this.appendEventsForAggregate(aggregateId, aggregateEvents);
      }

      // Update global metrics
      this.updateMetrics(events);

      // Notify subscribers in background
      this.notifySubscribers(events);

    } catch (error) {
      throw new EventStoreError(
        `Batch append failed: ${error}`,
        'BATCH_APPEND_FAILED'
      );
    }

    // Update performance metrics
    const duration = performance.now() - startTime;
    this.recordBatchPerformance(events.length, duration);
  }

  async getEventsBatch(aggregateIds: AggregateId[]): Promise<Map<AggregateId, TEvent[]>> {
    const result = new Map<AggregateId, TEvent[]>();
    
    // Process in batches to avoid memory issues
    const batchSize = this.options.batchSize;
    for (let i = 0; i < aggregateIds.length; i += batchSize) {
      const batch = aggregateIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (id) => ({
        id,
        events: await this.getEvents(id),
      }));
      
      const batchResults = await Promise.all(batchPromises);
      for (const { id, events } of batchResults) {
        result.set(id, events);
      }
    }
    
    return result;
  }

  // Snapshot management
  async saveSnapshot<TState>(snapshot: Snapshot<TState, AggregateId>): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
    this.metrics = {
      ...this.metrics,
      snapshotCount: this.snapshots.size,
    };
  }

  async getSnapshot<TState>(aggregateId: AggregateId): Promise<Snapshot<TState, AggregateId> | null> {
    const snapshot = this.snapshots.get(aggregateId);
    return snapshot as Snapshot<TState, AggregateId> | null;
  }

  async getEventsFromSnapshot(
    aggregateId: AggregateId, 
    fromVersion: EventVersion
  ): Promise<TEvent[]> {
    const allEvents = this.events.get(aggregateId) ?? [];
    return allEvents.filter(event => event.version > fromVersion);
  }

  // Streaming support
  async *streamEvents(
    aggregateId: AggregateId,
    options: { batchSize?: number; fromVersion?: EventVersion } = {}
  ): AsyncIterable<TEvent> {
    const { batchSize = this.options.batchSize, fromVersion = 1 } = options;
    const events = this.events.get(aggregateId) ?? [];
    const filteredEvents = events.filter(event => event.version >= fromVersion);
    
    for (let i = 0; i < filteredEvents.length; i += batchSize) {
      const batch = filteredEvents.slice(i, i + batchSize);
      for (const event of batch) {
        yield event;
      }
      
      // Yield control to avoid blocking
      if (batch.length === batchSize) {
        await this.yield();
      }
    }
  }

  async *streamAllEvents(
    options: { 
      batchSize?: number; 
      fromVersion?: EventVersion;
      eventTypes?: string[];
    } = {}
  ): AsyncIterable<TEvent> {
    const { batchSize = this.options.batchSize, fromVersion = 1, eventTypes } = options;
    
    // Collect all events across aggregates
    const allEvents: TEvent[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    
    // Filter by criteria
    const filteredEvents = allEvents.filter(event => {
      if (event.version < fromVersion) return false;
      if (eventTypes && !eventTypes.includes(event.type)) return false;
      return true;
    });
    
    // Sort by timestamp for consistent ordering
    filteredEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Stream in batches
    for (let i = 0; i < filteredEvents.length; i += batchSize) {
      const batch = filteredEvents.slice(i, i + batchSize);
      for (const event of batch) {
        yield event;
      }
      
      if (batch.length === batchSize) {
        await this.yield();
      }
    }
  }

  // Event subscription (async version)
  subscribeAsync(handler: (event: TEvent) => Promise<void>): () => void {
    this.subscribers.add(handler);
    this.metrics = {
      ...this.metrics,
      subscriptionCount: this.subscribers.size,
    };
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(handler);
      this.metrics = {
        ...this.metrics,
        subscriptionCount: this.subscribers.size,
      };
    };
  }

  // Performance and monitoring
  async getMetrics(): Promise<EventStoreMetrics> {
    return {
      ...this.metrics,
      storageSize: this.calculateStorageSize(),
      indexSize: this.calculateIndexSize(),
    };
  }

  async compactStorage(): Promise<CompactionResult> {
    const startTime = performance.now();
    let eventsRemoved = 0;
    const initialSize = this.calculateStorageSize();
    
    // Remove events that are older than snapshots (if configured)
    if (this.options.compactAfterSnapshot) {
      for (const [aggregateId, snapshot] of this.snapshots) {
        const events = this.events.get(aggregateId) ?? [];
        const eventsToKeep = events.filter(event => event.version > snapshot.version);
        const removedCount = events.length - eventsToKeep.length;
        
        if (removedCount > 0) {
          this.events.set(aggregateId, eventsToKeep);
          eventsRemoved += removedCount;
        }
      }
    }
    
    // Rebuild indexes after compaction
    await this.rebuildIndexes();
    
    const finalSize = this.calculateStorageSize();
    const duration = performance.now() - startTime;
    
    return {
      eventsRemoved,
      spaceSaved: initialSize - finalSize,
      duration,
    };
  }

  // Private helper methods
  private async validateEvent(event: TEvent): Promise<void> {
    if (!event.id || !event.type || !event.aggregateId) {
      throw new EventStoreError(
        'Event missing required fields',
        'INVALID_EVENT'
      );
    }
    
    if (!event.timestamp || !event.version) {
      throw new EventStoreError(
        'Event missing timestamp or version',
        'INVALID_EVENT'
      );
    }
  }

  private groupEventsByAggregate(events: TEvent[]): Map<AggregateId, TEvent[]> {
    const groups = new Map<AggregateId, TEvent[]>();
    
    for (const event of events) {
      const existing = groups.get(event.aggregateId) ?? [];
      existing.push(event);
      groups.set(event.aggregateId, existing);
    }
    
    return groups;
  }

  private async appendEventsForAggregate(
    aggregateId: AggregateId, 
    events: TEvent[]
  ): Promise<void> {
    const existing = this.events.get(aggregateId) ?? [];
    const combined = [...existing, ...events];
    
    // Sort by version to ensure consistency
    combined.sort((a, b) => a.version - b.version);
    
    this.events.set(aggregateId, combined);
    this.versionIndex.set(aggregateId, Math.max(...combined.map(e => e.version)));
    
    // Update indexes
    for (const event of events) {
      this.updateIndexes(event);
    }
  }

  private updateIndexes(event: TEvent): void {
    // Event type index
    if (!this.eventTypeIndex.has(event.type)) {
      this.eventTypeIndex.set(event.type, new Set());
    }
    this.eventTypeIndex.get(event.type)!.add(event.aggregateId);
    
    // Timestamp index
    const timestampKey = Math.floor(event.timestamp.getTime() / 1000); // Second precision
    if (!this.timestampIndex.has(timestampKey)) {
      this.timestampIndex.set(timestampKey, []);
    }
    this.timestampIndex.get(timestampKey)!.push(event);
  }

  private async notifySubscribers(events: TEvent[]): Promise<void> {
    if (this.subscribers.size === 0) return;
    
    // Notify subscribers in background to avoid blocking
    Promise.all(
      events.map(event => 
        Array.from(this.subscribers).map(handler => 
          handler(event).catch(error => {
            console.error('Event subscription handler failed:', error);
          })
        )
      ).flat()
    ).catch(() => {
      // Ignore subscription errors to avoid affecting the main flow
    });
  }

  private updateMetrics(events: TEvent[]): void {
    this.metrics = {
      ...this.metrics,
      totalEvents: this.metrics.totalEvents + events.length,
      totalAggregates: this.events.size,
      averageEventsPerAggregate: this.metrics.totalEvents / Math.max(this.events.size, 1),
    };
  }

  private recordBatchPerformance(eventCount: number, duration: number): void {
    // Could be extended to track detailed performance metrics
  }

  private calculateStorageSize(): number {
    let size = 0;
    for (const events of this.events.values()) {
      size += JSON.stringify(events).length;
    }
    for (const snapshot of this.snapshots.values()) {
      size += JSON.stringify(snapshot).length;
    }
    return size;
  }

  private calculateIndexSize(): number {
    let size = 0;
    size += JSON.stringify(Array.from(this.eventTypeIndex.entries())).length;
    size += JSON.stringify(Array.from(this.versionIndex.entries())).length;
    size += JSON.stringify(Array.from(this.timestampIndex.entries())).length;
    return size;
  }

  private async rebuildIndexes(): Promise<void> {
    this.eventTypeIndex.clear();
    this.versionIndex.clear();
    this.timestampIndex.clear();
    
    for (const [aggregateId, events] of this.events) {
      for (const event of events) {
        this.updateIndexes(event);
      }
      this.versionIndex.set(aggregateId, Math.max(...events.map(e => e.version)));
    }
  }

  private async yield(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  // Missing IEventStore methods
  async getAllEvents(fromPosition?: number): Promise<TEvent[]> {
    const allEvents: TEvent[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    
    // Sort by timestamp for consistent ordering
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (fromPosition !== undefined) {
      return allEvents.slice(fromPosition);
    }
    
    return allEvents;
  }

  async getEventsByType<TType extends TEvent['type']>(
    type: TType
  ): Promise<Array<Extract<TEvent, { type: TType }>>> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.type === type) as Array<Extract<TEvent, { type: TType }>>;
  }

  async getLatestPosition(): Promise<number> {
    const allEvents = await this.getAllEvents();
    return allEvents.length;
  }

  subscribe(callback: (event: TEvent) => void): () => void {
    const asyncCallback = async (event: TEvent) => {
      callback(event);
    };
    this.subscribers.add(asyncCallback);
    this.metrics = {
      ...this.metrics,
      subscriptionCount: this.subscribers.size,
    };
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(asyncCallback);
      this.metrics = {
        ...this.metrics,
        subscriptionCount: this.subscribers.size,
      };
    };
  }
}

// Configuration options
export interface OptimizedEventStoreOptions {
  readonly batchSize: number;
  readonly maxCacheSize: number;
  readonly compactAfterSnapshot: boolean;
  readonly enableIndexes: boolean;
}

export const DEFAULT_OPTIMIZED_OPTIONS: OptimizedEventStoreOptions = {
  batchSize: 100,
  maxCacheSize: 10000,
  compactAfterSnapshot: true,
  enableIndexes: true,
} as const;

// Event store specific error
export class EventStoreError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'EVENT_STORE' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: EventStoreErrorCode
  ) {
    super(message);
    this.name = 'EventStoreError';
    this.code = code as ErrorCode;
  }
}

export type EventStoreErrorCode =
  | 'BATCH_APPEND_FAILED'
  | 'INVALID_EVENT'
  | 'AGGREGATE_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'STORAGE_ERROR';