import type { ISnapshotStore } from '../../core/repository';
import type { AggregateId } from '../../core/branded/types';
import type { ISnapshot } from '../../core/aggregate';

export class InMemorySnapshotStore<TState> implements ISnapshotStore<TState> {
  private snapshots = new Map<string, ISnapshot<TState>>();

  async save(snapshot: ISnapshot<TState>): Promise<void> {
    this.snapshots.set(snapshot.aggregateId as string, snapshot);
  }

  async get(aggregateId: AggregateId): Promise<ISnapshot<TState> | null> {
    return this.snapshots.get(aggregateId as string) || null;
  }

  clear(): void {
    this.snapshots.clear();
  }
}

export function createSnapshotStore<TState>(): InMemorySnapshotStore<TState> {
  return new InMemorySnapshotStore<TState>();
} 