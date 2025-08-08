/**
 * Framework Infrastructure: Projection Builder
 * 
 * Generic projection builder for creating read models from events.
 */

import type { IEvent, EventHandler } from '../../core/event';
import type { IProjectionBuilder } from '../../core/query';
import type { AggregateId } from '../../core/branded/types';
import { matchEvent } from '../../core/event-utils';

/**
 * Generic projection builder implementation
 */
export class ProjectionBuilder<
  TEvent extends IEvent,
  TProjection
> implements IProjectionBuilder<TEvent, TProjection> {
  
  protected projections = new Map<string, TProjection>();
  protected version = 0;

  constructor(
    private readonly buildProjection: (
      aggregateId: string,
      events: TEvent[]
    ) => TProjection | null,
    private readonly name: string = 'DefaultProjection'
  ) {}

  /**
   * Rebuild all projections from events
   */
  async rebuild(events: TEvent[]): Promise<void> {
    const aggregateEvents = new Map<string, TEvent[]>();

    // Group events by aggregate
    for (const event of events) {
      const aggregateKey = event.aggregateId as string;
      if (!aggregateEvents.has(aggregateKey)) {
        aggregateEvents.set(aggregateKey, []);
      }
      aggregateEvents.get(aggregateKey)!.push(event);
    }

    // Clear existing projections
    this.projections.clear();

    // Rebuild projections for each aggregate
    for (const [aggregateId, aggEvents] of aggregateEvents) {
      const projection = this.buildProjection(aggregateId, aggEvents);
      if (projection) {
        this.projections.set(aggregateId, projection);
      }
    }

    // Update version
    this.version = events.length;
  }

  /**
   * Get projection by ID
   */
  get(id: string): TProjection | null {
    return this.projections.get(id) || null;
  }

  /**
   * Get all projections
   */
  getAll(): TProjection[] {
    return Array.from(this.projections.values());
  }

  /**
   * Search projections with predicate
   */
  search(predicate: (projection: TProjection) => boolean): TProjection[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Additional utility methods
   */

  /**
   * Get projection count
   */
  getCount(): number {
    return this.projections.size;
  }

  /**
   * Check if projection exists
   */
  has(id: string): boolean {
    return this.projections.has(id);
  }

  /**
   * Clear all projections
   */
  clear(): void {
    this.projections.clear();
    this.version = 0;
  }

  /**
   * Get current version
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get projection name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Update single projection from new events
   */
  async updateProjection(
    aggregateId: AggregateId,
    newEvents: TEvent[]
  ): Promise<void> {
    const aggregateKey = aggregateId as string;
    
    // Get existing events for this aggregate
    const existingProjection = this.projections.get(aggregateKey);
    
    // Rebuild projection with all events
    const projection = this.buildProjection(aggregateKey, newEvents);
    
    if (projection) {
      this.projections.set(aggregateKey, projection);
    } else if (existingProjection) {
      // Remove projection if builder returns null
      this.projections.delete(aggregateKey);
    }
  }

  /**
   * Export projections for persistence
   */
  exportProjections(): Map<string, TProjection> {
    return new Map(this.projections);
  }

  /**
   * Import projections from persistence
   */
  importProjections(projections: Map<string, TProjection>): void {
    this.projections = new Map(projections);
  }
}

/**
 * Factory for creating typed projection builders
 */
export function createProjectionBuilder<
  TEvent extends IEvent,
  TProjection
>(
  buildProjection: (aggregateId: string, events: TEvent[]) => TProjection | null,
  name?: string
): ProjectionBuilder<TEvent, TProjection> {
  return new ProjectionBuilder(buildProjection, name);
}

/**
 * Event-driven projection builder with incremental updates
 */
export class EventDrivenProjectionBuilder<
  TEvent extends IEvent,
  TProjection
> extends ProjectionBuilder<TEvent, TProjection> {
  
  private eventHandlers = new Map<string, EventHandler<TEvent>>();
  
  constructor(
    initialState: () => TProjection,
    private readonly reducer: (state: TProjection, event: TEvent) => TProjection,
    name?: string
  ) {
    super((_aggregateId, events) => {
      if (events.length === 0) return null;
      
      let state = initialState();
      for (const event of events) {
        state = this.reducer(state, event);
      }
      return state;
    }, name);
  }
  
  /**
   * Register event handler for specific event type
   */
  on<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: (projection: TProjection, event: TSpecificEvent) => TProjection
  ): this {
    this.eventHandlers.set(eventType, (event) => {
      const projection = this.get(event.aggregateId as string);
      if (projection) {
        const updated = handler(projection, event as TSpecificEvent);
        this.projections.set(event.aggregateId as string, updated);
      }
    });
    return this;
  }
  
  /**
   * Process single event
   */
  async processEvent(event: TEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      await handler(event);
    } else {
      // Fallback to reducer
      const projection = this.get(event.aggregateId as string);
      if (projection) {
        const updated = this.reducer(projection, event);
        this.projections.set(event.aggregateId as string, updated);
      }
    }
  }
}

/**
 * Snapshot-capable projection builder
 */
export class SnapshotProjectionBuilder<
  TEvent extends IEvent,
  TProjection
> extends ProjectionBuilder<TEvent, TProjection> {
  
  private snapshots = new Map<string, {
    projection: TProjection;
    version: number;
    timestamp: Date;
  }>();
  
  /**
   * Create snapshot of current state
   */
  createSnapshot(aggregateId: string): void {
    const projection = this.get(aggregateId);
    if (projection) {
      this.snapshots.set(aggregateId, {
        projection: structuredClone(projection),
        version: this.getVersion(),
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(aggregateId: string): TProjection | null {
    const snapshot = this.snapshots.get(aggregateId);
    if (snapshot) {
      this.projections.set(aggregateId, structuredClone(snapshot.projection));
      return snapshot.projection;
    }
    return null;
  }
  
  /**
   * Get snapshot info
   */
  getSnapshotInfo(aggregateId: string) {
    return this.snapshots.get(aggregateId);
  }
  
  /**
   * Clear old snapshots
   */
  clearOldSnapshots(olderThan: Date): void {
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.timestamp < olderThan) {
        this.snapshots.delete(id);
      }
    }
  }
}

/**
 * Projection builder with indexing support
 */
export class IndexedProjectionBuilder<
  TEvent extends IEvent,
  TProjection extends Record<string, unknown>
> extends ProjectionBuilder<TEvent, TProjection> {
  
  private indexes = new Map<string, Map<unknown, Set<string>>>();
  
  /**
   * Create index on field
   */
  createIndex<K extends keyof TProjection>(field: K): void {
    const indexName = String(field);
    if (!this.indexes.has(indexName)) {
      this.indexes.set(indexName, new Map());
      
      // Build index from existing projections
      for (const [id, projection] of this.projections) {
        const value = projection[field];
        this.addToIndex(indexName, value, id);
      }
    }
  }
  
  /**
   * Find by indexed field
   */
  findByIndex<K extends keyof TProjection>(
    field: K,
    value: TProjection[K]
  ): TProjection[] {
    const indexName = String(field);
    const index = this.indexes.get(indexName);
    
    if (!index) {
      throw new Error(`No index exists for field: ${indexName}`);
    }
    
    const ids = index.get(value) || new Set();
    return Array.from(ids)
      .map(id => this.get(id))
      .filter((p): p is TProjection => p !== null);
  }
  
  /**
   * Update indexes when projection changes
   */
  protected updateIndexes(id: string, projection: TProjection): void {
    for (const [field, index] of this.indexes) {
      const value = projection[field as keyof TProjection];
      this.addToIndex(field, value, id);
    }
  }
  
  /**
   * Add value to index
   */
  private addToIndex(field: string, value: unknown, id: string): void {
    const index = this.indexes.get(field);
    if (index) {
      if (!index.has(value)) {
        index.set(value, new Set());
      }
      index.get(value)!.add(id);
    }
  }
  
  /**
   * Remove from all indexes
   */
  private removeFromIndexes(id: string): void {
    const projection = this.get(id);
    if (!projection) return;
    
    for (const [field, index] of this.indexes) {
      const value = projection[field as keyof TProjection];
      const ids = index.get(value);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          index.delete(value);
        }
      }
    }
  }
}