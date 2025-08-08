// Snapshot system for Event Sourcing performance optimization
import type { AggregateId, EventVersion, Timestamp } from '../types/branded';
import { BrandedTypes } from '../types/branded';

// ============================================================================
// Snapshot System for Performance
// ============================================================================

// Snapshot interface for event sourcing optimization
export interface Snapshot<TState = unknown, TAggregateId extends AggregateId = AggregateId> {
  aggregateId: TAggregateId;
  version: EventVersion;
  state: TState;
  timestamp: Timestamp;
  checksum?: string;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

// Snapshot strategy
export type SnapshotStrategy = 
  | { type: 'frequency'; interval: number }
  | { type: 'count'; threshold: number }
  | { type: 'size'; maxBytes: number }
  | { type: 'time'; intervalMs: number };

// Snapshot store interface
export interface ISnapshotStore<TState, TAggregateId extends AggregateId = AggregateId> {
  save(snapshot: Snapshot<TState, TAggregateId>): Promise<void>;
  get(aggregateId: TAggregateId): Promise<Snapshot<TState, TAggregateId> | null>;
  delete(aggregateId: TAggregateId): Promise<void>;
  getLatestBefore(aggregateId: TAggregateId, version: EventVersion): Promise<Snapshot<TState, TAggregateId> | null>;
}

// ============================================================================
// Snapshot Factory
// ============================================================================

export const createSnapshot = <TState, TAggregateId extends AggregateId = AggregateId>(
  aggregateId: TAggregateId,
  version: number,
  state: TState,
  metadata?: Record<string, unknown>
): Snapshot<TState, TAggregateId> => ({
  aggregateId,
  version: BrandedTypes.eventVersion(version),
  state,
  timestamp: BrandedTypes.timestamp(),
  ...(metadata && { metadata }),
});

// ============================================================================
// Snapshot Manager
// ============================================================================

export class SnapshotManager<TState, TAggregateId extends AggregateId = AggregateId> {
  private snapshots = new Map<string, Snapshot<TState, TAggregateId>>();
  private snapshotCounts = new Map<string, number>();
  
  constructor(
    private strategy: SnapshotStrategy,
    private store?: ISnapshotStore<TState, TAggregateId>
  ) {}
  
  async shouldSnapshot(
    aggregateId: TAggregateId,
    version: number,
    eventCount?: number
  ): Promise<boolean> {
    const key = String(aggregateId);
    
    switch (this.strategy.type) {
      case 'frequency':
        return version % this.strategy.interval === 0;
        
      case 'count':
        const count = this.snapshotCounts.get(key) || 0;
        if (count >= this.strategy.threshold) {
          this.snapshotCounts.set(key, 0);
          return true;
        }
        this.snapshotCounts.set(key, count + 1);
        return false;
        
      case 'size':
        // This would need actual size calculation
        return false;
        
      case 'time':
        const lastSnapshot = this.snapshots.get(key);
        if (!lastSnapshot) return true;
        return Date.now() - lastSnapshot.timestamp.getTime() > this.strategy.intervalMs;
        
      default:
        return false;
    }
  }
  
  async saveSnapshot(snapshot: Snapshot<TState, TAggregateId>): Promise<void> {
    const key = String(snapshot.aggregateId);
    this.snapshots.set(key, snapshot);
    
    if (this.store) {
      await this.store.save(snapshot);
    }
  }
  
  async getSnapshot(aggregateId: TAggregateId): Promise<Snapshot<TState, TAggregateId> | null> {
    const key = String(aggregateId);
    
    // Try memory cache first
    const cached = this.snapshots.get(key);
    if (cached) return cached;
    
    // Try persistent store
    if (this.store) {
      const snapshot = await this.store.get(aggregateId);
      if (snapshot) {
        this.snapshots.set(key, snapshot);
        return snapshot;
      }
    }
    
    return null;
  }
  
  async getLatestSnapshotBefore(
    aggregateId: TAggregateId,
    version: EventVersion
  ): Promise<Snapshot<TState, TAggregateId> | null> {
    const key = String(aggregateId);
    const cached = this.snapshots.get(key);
    
    if (cached && cached.version <= version) {
      return cached;
    }
    
    if (this.store) {
      return await this.store.getLatestBefore(aggregateId, version);
    }
    
    return null;
  }
  
  clearCache(): void {
    this.snapshots.clear();
    this.snapshotCounts.clear();
  }
}

// ============================================================================
// In-Memory Snapshot Store
// ============================================================================

export class InMemorySnapshotStore<TState, TAggregateId extends AggregateId = AggregateId> 
  implements ISnapshotStore<TState, TAggregateId> {
  
  private snapshots = new Map<string, Snapshot<TState, TAggregateId>[]>();
  
  async save(snapshot: Snapshot<TState, TAggregateId>): Promise<void> {
    const key = String(snapshot.aggregateId);
    const existing = this.snapshots.get(key) || [];
    
    // Remove older snapshots of the same version
    const filtered = existing.filter(s => s.version !== snapshot.version);
    filtered.push(snapshot);
    
    // Keep only last N snapshots
    const maxSnapshots = 5;
    if (filtered.length > maxSnapshots) {
      filtered.splice(0, filtered.length - maxSnapshots);
    }
    
    this.snapshots.set(key, filtered);
  }
  
  async get(aggregateId: TAggregateId): Promise<Snapshot<TState, TAggregateId> | null> {
    const key = String(aggregateId);
    const snapshots = this.snapshots.get(key);
    
    if (!snapshots || snapshots.length === 0) {
      return null;
    }
    
    // Return the latest snapshot
    return snapshots[snapshots.length - 1] || null;
  }
  
  async delete(aggregateId: TAggregateId): Promise<void> {
    const key = String(aggregateId);
    this.snapshots.delete(key);
  }
  
  async getLatestBefore(
    aggregateId: TAggregateId,
    version: EventVersion
  ): Promise<Snapshot<TState, TAggregateId> | null> {
    const key = String(aggregateId);
    const snapshots = this.snapshots.get(key);
    
    if (!snapshots || snapshots.length === 0) {
      return null;
    }
    
    // Find the latest snapshot before the given version
    const versionNum = typeof version === 'number' ? version : (version as unknown as number);
    
    for (let i = snapshots.length - 1; i >= 0; i--) {
      const snapshot = snapshots[i];
      if (!snapshot) continue;
      
      const snapshotVersion = typeof snapshot.version === 'number' 
        ? snapshot.version 
        : (snapshot.version as unknown as number);
      
      if (snapshotVersion <= versionNum) {
        return snapshot;
      }
    }
    
    return null;
  }
  
  // Additional utility methods
  async getAllSnapshots(aggregateId: TAggregateId): Promise<Snapshot<TState, TAggregateId>[]> {
    const key = String(aggregateId);
    return this.snapshots.get(key) || [];
  }
  
  async clear(): Promise<void> {
    this.snapshots.clear();
  }
}

// ============================================================================
// Snapshot Compression Utilities
// ============================================================================

export const compressSnapshot = <TState>(state: TState): string => {
  // Simple JSON compression (in production, use a proper compression library)
  return JSON.stringify(state);
};

export const decompressSnapshot = <TState>(compressed: string): TState => {
  // Simple JSON decompression
  return JSON.parse(compressed);
};

// Calculate checksum for snapshot integrity
export const calculateChecksum = <TState>(state: TState): string => {
  const str = JSON.stringify(state);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
};