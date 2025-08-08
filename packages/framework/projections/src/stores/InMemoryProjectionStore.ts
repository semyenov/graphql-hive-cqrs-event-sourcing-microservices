import type { Projection, ProjectionStore, ProjectionFilter, QueryOptions } from '../builders/ProjectionBuilder';

// In-memory projection store implementation
export class InMemoryProjectionStore<TReadModel = unknown> implements ProjectionStore<TReadModel> {
  private readonly projections = new Map<string, Projection<TReadModel>>();
  private readonly indexes = new Map<string, Set<string>>();

  async get(id: string): Promise<Projection<TReadModel> | null> {
    return this.projections.get(id) ?? null;
  }

  async save(projection: Projection<TReadModel>): Promise<void> {
    this.projections.set(projection.id, projection);
    this.updateIndexes(projection);
  }

  async delete(id: string): Promise<void> {
    const projection = this.projections.get(id);
    if (projection) {
      this.projections.delete(id);
      this.removeFromIndexes(projection);
    }
  }

  async query(
    filter?: ProjectionFilter,
    options?: QueryOptions
  ): Promise<Projection<TReadModel>[]> {
    let projections = Array.from(this.projections.values());

    // Apply filters
    if (filter) {
      projections = this.applyFilters(projections, filter);
    }

    // Apply sorting
    if (options?.sortBy) {
      projections = this.applySorting(projections, options.sortBy, options.sortOrder);
    }

    // Apply pagination
    if (options?.offset || options?.limit) {
      const start = options.offset ?? 0;
      const end = options.limit ? start + options.limit : undefined;
      projections = projections.slice(start, end);
    }

    return projections;
  }

  async count(filter?: ProjectionFilter): Promise<number> {
    let projections = Array.from(this.projections.values());

    if (filter) {
      projections = this.applyFilters(projections, filter);
    }

    return projections.length;
  }

  // Batch operations
  async saveBatch(projections: Projection<TReadModel>[]): Promise<void> {
    for (const projection of projections) {
      await this.save(projection);
    }
  }

  async getBatch(ids: string[]): Promise<Map<string, Projection<TReadModel>>> {
    const result = new Map<string, Projection<TReadModel>>();
    
    for (const id of ids) {
      const projection = await this.get(id);
      if (projection) {
        result.set(id, projection);
      }
    }
    
    return result;
  }

  // Clear all projections
  clear(): void {
    this.projections.clear();
    this.indexes.clear();
  }

  // Get store statistics
  getStatistics(): ProjectionStoreStatistics {
    const projections = Array.from(this.projections.values());
    const totalSize = JSON.stringify(projections).length;
    
    const versionStats = projections.length > 0 ? {
      min: Math.min(...projections.map(p => p.version)),
      max: Math.max(...projections.map(p => p.version)),
      avg: projections.reduce((sum, p) => sum + p.version, 0) / projections.length,
    } : { min: 0, max: 0, avg: 0 };

    return {
      totalProjections: projections.length,
      totalSize,
      indexCount: this.indexes.size,
      versionStats,
    };
  }

  // Private helper methods
  private applyFilters(
    projections: Projection<TReadModel>[],
    filter: ProjectionFilter
  ): Projection<TReadModel>[] {
    return projections.filter(projection => {
      // ID filter
      if (filter.ids && !filter.ids.includes(projection.id)) {
        return false;
      }

      // Version range filter
      if (filter.versionRange) {
        if (filter.versionRange.min !== undefined && projection.version < filter.versionRange.min) {
          return false;
        }
        if (filter.versionRange.max !== undefined && projection.version > filter.versionRange.max) {
          return false;
        }
      }

      // Last processed range filter
      if (filter.lastProcessedRange && projection.lastProcessedAt) {
        if (filter.lastProcessedRange.after && projection.lastProcessedAt <= filter.lastProcessedRange.after) {
          return false;
        }
        if (filter.lastProcessedRange.before && projection.lastProcessedAt >= filter.lastProcessedRange.before) {
          return false;
        }
      }

      // Data filter (basic property matching)
      if (filter.dataFilter) {
        for (const [key, value] of Object.entries(filter.dataFilter)) {
          const dataValue = this.getNestedProperty(projection.data, key);
          if (dataValue !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private applySorting(
    projections: Projection<TReadModel>[],
    sortBy: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Projection<TReadModel>[] {
    return projections.sort((a, b) => {
      let valueA: unknown;
      let valueB: unknown;

      // Handle special projection properties
      switch (sortBy) {
        case 'id':
          valueA = a.id;
          valueB = b.id;
          break;
        case 'version':
          valueA = a.version;
          valueB = b.version;
          break;
        case 'lastProcessedAt':
          valueA = a.lastProcessedAt?.getTime() ?? 0;
          valueB = b.lastProcessedAt?.getTime() ?? 0;
          break;
        default:
          // Sort by data property
          valueA = this.getNestedProperty(a.data, sortBy);
          valueB = this.getNestedProperty(b.data, sortBy);
      }

      // Compare values
      let comparison = 0;
      if (valueA != null && valueB != null && valueA < valueB) {
        comparison = -1;
      } else if (valueA != null && valueB != null && valueA > valueB) {
        comparison = 1;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private getNestedProperty(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    return path.split('.').reduce((current: unknown, key) => {
      return current && typeof current === 'object' && current !== null && key in current
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj);
  }

  private updateIndexes(projection: Projection<TReadModel>): void {
    // Create simple indexes for common queries
    // This is a basic implementation - in production you'd want more sophisticated indexing
    
    // Version index
    const versionKey = `version_${projection.version}`;
    if (!this.indexes.has(versionKey)) {
      this.indexes.set(versionKey, new Set());
    }
    this.indexes.get(versionKey)!.add(projection.id);
  }

  private removeFromIndexes(projection: Projection<TReadModel>): void {
    // Remove from all indexes
    for (const [key, ids] of this.indexes.entries()) {
      ids.delete(projection.id);
      if (ids.size === 0) {
        this.indexes.delete(key);
      }
    }
  }
}

// Store statistics interface
export interface ProjectionStoreStatistics {
  readonly totalProjections: number;
  readonly totalSize: number;
  readonly indexCount: number;
  readonly versionStats: {
    readonly min: number;
    readonly max: number;
    readonly avg: number;
  };
}