/**
 * Framework Infrastructure: Projection Builder
 * 
 * Generic projection builder for creating read models from events.
 */

import type { IEvent } from '../../core/event';
import type { IProjectionBuilder } from '../../core/query';
import type { AggregateId } from '../../core/branded/types';

/**
 * Generic projection builder implementation
 */
export class ProjectionBuilder<
  TEvent extends IEvent,
  TProjection
> implements IProjectionBuilder<TEvent, TProjection> {
  
  private projections = new Map<string, TProjection>();
  private eventsByAggregate = new Map<string, TEvent[]>();
  private version = 0;

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

    // Clear existing projections and events
    this.projections.clear();
    this.eventsByAggregate.clear();

    // Store events and rebuild projections for each aggregate
    for (const [aggregateId, aggEvents] of aggregateEvents) {
      this.eventsByAggregate.set(aggregateId, aggEvents);
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
   * Get projection or throw a descriptive error
   */
  getOrThrow(id: string, message?: string): TProjection {
    const result = this.get(id);
    if (result == null) {
      throw new Error(message ?? `Projection '${this.name}' does not contain id '${id}'.`);
    }
    return result;
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
    this.eventsByAggregate.clear();
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
    const existingEvents = this.eventsByAggregate.get(aggregateKey) || [];
    
    // Combine existing and new events
    const allEvents = [...existingEvents, ...newEvents];
    
    // Store the updated event list
    this.eventsByAggregate.set(aggregateKey, allEvents);
    
    // Rebuild projection with all events
    const projection = this.buildProjection(aggregateKey, allEvents);
    
    if (projection) {
      this.projections.set(aggregateKey, projection);
    } else {
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
  name: string,
  buildProjection: (aggregateId: string, events: TEvent[]) => TProjection | null
): ProjectionBuilder<TEvent, TProjection> {
  return new ProjectionBuilder(buildProjection, name);
}