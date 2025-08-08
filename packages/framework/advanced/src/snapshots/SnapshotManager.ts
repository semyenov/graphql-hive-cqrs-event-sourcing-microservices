import type { Event, Snapshot, IEventStore } from '@cqrs-framework/core';
import { BrandedTypes } from '@cqrs-framework/core';
import type { AggregateId, EventVersion, Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Snapshot strategy interface
export interface SnapshotStrategy {
  shouldCreateSnapshot(
    aggregateId: AggregateId,
    eventCount: number,
    lastSnapshotVersion: number,
    currentVersion: number
  ): boolean;
}

// Snapshot store interface
export interface SnapshotStore {
  save<TState>(snapshot: Snapshot<TState, AggregateId>): Promise<void>;
  load<TState>(aggregateId: AggregateId): Promise<Snapshot<TState, AggregateId> | null>;
  delete(aggregateId: AggregateId): Promise<void>;
  list(options?: {
    limit?: number;
    offset?: number;
    olderThan?: Date;
  }): Promise<SnapshotMetadata[]>;
  cleanup(olderThan: Date): Promise<number>;
}

// Snapshot metadata
export interface SnapshotMetadata {
  readonly aggregateId: AggregateId;
  readonly version: EventVersion;
  readonly timestamp: Date;
  readonly size: number;
}

// Snapshot manager
export class SnapshotManager<TEvent extends Event = Event> {
  private readonly strategies: SnapshotStrategy[] = [];
  private readonly snapshotCounts = new Map<AggregateId, number>();

  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly eventStore: IEventStore<TEvent>,
    private readonly options: SnapshotManagerOptions = DEFAULT_SNAPSHOT_OPTIONS
  ) {
    // Add default strategies
    this.addStrategy(new CountBasedStrategy(options.eventCountThreshold));
    if (options.timeBasedThreshold) {
      this.addStrategy(new TimeBasedStrategy(options.timeBasedThreshold));
    }
  }

  // Add custom snapshot strategy
  addStrategy(strategy: SnapshotStrategy): void {
    this.strategies.push(strategy);
  }

  // Check if snapshot should be created
  async shouldCreateSnapshot(
    aggregateId: AggregateId,
    currentVersion: number
  ): Promise<boolean> {
    const eventCount = await this.getEventCount(aggregateId);
    const lastSnapshot = await this.snapshotStore.load(aggregateId);
    const lastSnapshotVersion = lastSnapshot?.version ?? 0;

    return this.strategies.some(strategy =>
      strategy.shouldCreateSnapshot(
        aggregateId,
        eventCount,
        lastSnapshotVersion,
        currentVersion
      )
    );
  }

  // Create snapshot for aggregate
  async createSnapshot<TState>(
    aggregateId: AggregateId,
    state: TState,
    version: EventVersion,
    metadata?: Record<string, unknown>
  ): Promise<Result<Snapshot<TState, AggregateId>, SnapshotError>> {
    try {
      const snapshot: Snapshot<TState, AggregateId> = {
        aggregateId,
        version,
        state: this.serializeState(state),
        timestamp: BrandedTypes.timestamp(),
      };

      await this.snapshotStore.save(snapshot);
      this.updateSnapshotCount(aggregateId);

      return {
        success: true,
        value: snapshot,
      };
    } catch (error) {
      return {
        success: false,
        error: new SnapshotError(
          `Failed to create snapshot: ${error}`,
          'SNAPSHOT_CREATION_FAILED',
          aggregateId
        ),
      };
    }
  }

  // Load aggregate from snapshot
  async loadFromSnapshot<TState>(
    aggregateId: AggregateId
  ): Promise<Result<{
    snapshot: Snapshot<TState, AggregateId>;
    events: TEvent[];
  } | null, SnapshotError>> {
    try {
      const snapshot = await this.snapshotStore.load<TState>(aggregateId);
      
      if (!snapshot) {
        return {
          success: true,
          value: null,
        };
      }

      // Load events since snapshot
      const events = await this.eventStore.getEvents(aggregateId);
      const eventsAfterSnapshot = events.filter(
        event => event.version > snapshot.version
      );

      return {
        success: true,
        value: {
          snapshot,
          events: eventsAfterSnapshot,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new SnapshotError(
          `Failed to load from snapshot: ${error}`,
          'SNAPSHOT_LOAD_FAILED',
          aggregateId
        ),
      };
    }
  }

  // Delete snapshot
  async deleteSnapshot(aggregateId: AggregateId): Promise<Result<void, SnapshotError>> {
    try {
      await this.snapshotStore.delete(aggregateId);
      this.snapshotCounts.delete(aggregateId);
      
      return {
        success: true,
        value: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: new SnapshotError(
          `Failed to delete snapshot: ${error}`,
          'SNAPSHOT_DELETE_FAILED',
          aggregateId
        ),
      };
    }
  }

  // Cleanup old snapshots
  async cleanup(olderThan: Date): Promise<Result<number, SnapshotError>> {
    try {
      const deletedCount = await this.snapshotStore.cleanup(olderThan);
      return {
        success: true,
        value: deletedCount,
      };
    } catch (error) {
      return {
        success: false,
        error: new SnapshotError(
          `Failed to cleanup snapshots: ${error}`,
          'SNAPSHOT_CLEANUP_FAILED'
        ),
      };
    }
  }

  // Get snapshot statistics
  async getStatistics(): Promise<SnapshotStatistics> {
    const snapshots = await this.snapshotStore.list();
    const now = Date.now();
    
    let totalSize = 0;
    let snapshotsLast24h = 0;
    let snapshotsLastWeek = 0;

    for (const snapshot of snapshots) {
      totalSize += snapshot.size;
      
      const ageHours = (now - snapshot.timestamp.getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) snapshotsLast24h++;
      if (ageHours < 24 * 7) snapshotsLastWeek++;
    }

    const averageSize = snapshots.length > 0 ? totalSize / snapshots.length : 0;

    const statistics: SnapshotStatistics = {
      totalCount: snapshots.length,
      totalSize,
      snapshotsLast24h,
      snapshotsLastWeek,
      averageSize,
    };

    return statistics;
  }

  // Private helper methods
  private async getEventCount(aggregateId: AggregateId): Promise<number> {
    const events = await this.eventStore.getEvents(aggregateId);
    return events.length;
  }

  private serializeState<TState>(state: TState): TState {
    // Deep clone to ensure snapshot isolation
    return structuredClone(state);
  }

  private updateSnapshotCount(aggregateId: AggregateId): void {
    const current = this.snapshotCounts.get(aggregateId) ?? 0;
    this.snapshotCounts.set(aggregateId, current + 1);
  }

  private getActiveStrategies(): string[] {
    return this.strategies.map(strategy => strategy.constructor.name);
  }
}

// Built-in snapshot strategies

// Count-based snapshot strategy
export class CountBasedStrategy implements SnapshotStrategy {
  constructor(private readonly threshold: number = 50) {}

  shouldCreateSnapshot(
    aggregateId: AggregateId,
    eventCount: number,
    lastSnapshotVersion: number,
    currentVersion: number
  ): boolean {
    return (currentVersion - lastSnapshotVersion) >= this.threshold;
  }
}

// Time-based snapshot strategy
export class TimeBasedStrategy implements SnapshotStrategy {
  constructor(private readonly maxAgeMs: number) {}

  shouldCreateSnapshot(
    aggregateId: AggregateId,
    eventCount: number,
    lastSnapshotVersion: number,
    currentVersion: number
  ): boolean {
    // This would need timestamp tracking - simplified for demo
    return false; // Implementation depends on timestamp tracking
  }
}

// Size-based snapshot strategy
export class SizeBasedStrategy implements SnapshotStrategy {
  constructor(private readonly maxSizeBytes: number) {}

  shouldCreateSnapshot(
    aggregateId: AggregateId,
    eventCount: number,
    lastSnapshotVersion: number,
    currentVersion: number
  ): boolean {
    // This would need size tracking - simplified for demo
    return eventCount > (this.maxSizeBytes / 1000); // Rough estimation
  }
}

// In-memory snapshot store implementation
export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots = new Map<AggregateId, Snapshot<unknown, AggregateId>>();

  async save<TState>(snapshot: Snapshot<TState, AggregateId>): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
  }

  async load<TState>(aggregateId: AggregateId): Promise<Snapshot<TState, AggregateId> | null> {
    const snapshot = this.snapshots.get(aggregateId);
    return snapshot as Snapshot<TState, AggregateId> | null;
  }

  async delete(aggregateId: AggregateId): Promise<void> {
    this.snapshots.delete(aggregateId);
  }

  async list(options: {
    limit?: number;
    offset?: number;
    olderThan?: Date;
  } = {}): Promise<SnapshotMetadata[]> {
    const { limit, offset = 0, olderThan } = options;
    
    let snapshots = Array.from(this.snapshots.values());
    
    if (olderThan) {
      snapshots = snapshots.filter(s => s.timestamp < olderThan);
    }
    
    const metadata: SnapshotMetadata[] = snapshots.map(snapshot => ({
      aggregateId: snapshot.aggregateId,
      version: snapshot.version as EventVersion,
      timestamp: snapshot.timestamp,
      size: JSON.stringify(snapshot).length,
    }));
    
    const start = offset;
    const end = limit ? start + limit : undefined;
    
    return metadata.slice(start, end);
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    
    for (const [aggregateId, snapshot] of this.snapshots) {
      if (snapshot.timestamp < olderThan) {
        this.snapshots.delete(aggregateId);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}

// Configuration and types
export interface SnapshotManagerOptions {
  readonly eventCountThreshold: number;
  readonly timeBasedThreshold?: number;
  readonly enableCompression?: boolean;
  readonly maxSnapshotsPerAggregate?: number;
}

export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotManagerOptions = {
  eventCountThreshold: 50,
  timeBasedThreshold: 24 * 60 * 60 * 1000, // 24 hours
  enableCompression: false,
  maxSnapshotsPerAggregate: 3,
} as const;

export interface SnapshotStatistics {
  readonly totalCount: number;
  readonly totalSize: number;
  readonly averageSize: number;
  readonly snapshotsLast24h: number;
  readonly snapshotsLastWeek: number;
}

// Snapshot-specific error class
export class SnapshotError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'SNAPSHOT' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: SnapshotErrorCode,
    public readonly aggregateId?: AggregateId
  ) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code as ErrorCode;
  }
}

export type SnapshotErrorCode =
  | 'SNAPSHOT_CREATION_FAILED'
  | 'SNAPSHOT_LOAD_FAILED'
  | 'SNAPSHOT_DELETE_FAILED'
  | 'SNAPSHOT_CLEANUP_FAILED'
  | 'SNAPSHOT_STORE_ERROR';