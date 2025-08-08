/**
 * Framework Core: Repository Lifecycle Management
 * 
 * Advanced repository with lifecycle hooks, auto-management, and enhanced features.
 */

import type { IEvent } from './event';
import type { IAggregate } from './aggregate';
import type { IAggregateRepository } from './repository';
import type { AggregateId, EventVersion } from './branded';

/**
 * Repository lifecycle events
 */
export type RepositoryLifecycleEvent = 
  | 'beforeLoad'
  | 'afterLoad'
  | 'beforeSave'
  | 'afterSave'
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeSnapshot'
  | 'afterSnapshot'
  | 'onError'
  | 'onCacheHit'
  | 'onCacheMiss';

/**
 * Lifecycle hook context
 */
export interface ILifecycleContext<TAggregate extends IAggregate<any, any, any>> {
  aggregateId: AggregateId;
  aggregate?: TAggregate;
  events?: IEvent[];
  error?: Error;
  metadata?: Record<string, unknown>;
  timestamp: number;
  operationType: 'load' | 'save' | 'create' | 'snapshot';
}

/**
 * Lifecycle hook function
 */
export type LifecycleHook<TAggregate extends IAggregate<any, any, any>> = (
  context: ILifecycleContext<TAggregate>
) => Promise<void> | void;

/**
 * Repository configuration
 */
export interface IRepositoryConfig {
  /** Enable automatic snapshots */
  enableSnapshots?: boolean;
  /** Snapshot frequency (number of events) */
  snapshotFrequency?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Enable automatic cleanup */
  enableAutoCleanup?: boolean;
  /** Cleanup threshold (unused aggregates older than) */
  cleanupThreshold?: number;
  /** Enable optimistic concurrency control */
  enableOptimisticConcurrency?: boolean;
}

/**
 * Repository metrics
 */
export interface IRepositoryMetrics {
  loads: number;
  saves: number;
  creates: number;
  snapshots: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgLoadTime: number;
  avgSaveTime: number;
  totalAggregates: number;
  activeAggregates: number;
}

/**
 * Aggregate cache entry
 */
interface ICacheEntry<TAggregate extends IAggregate<any, any, any>> {
  aggregate: TAggregate;
  timestamp: number;
  lastAccessed: number;
  version: EventVersion;
}

/**
 * Enhanced repository with lifecycle management
 */
export class LifecycleAwareRepository<TAggregate extends IAggregate<any, any, any>> {
  
  private hooks: Map<RepositoryLifecycleEvent, LifecycleHook<TAggregate>[]> = new Map();
  private cache: Map<string, ICacheEntry<TAggregate>> = new Map();
  private metrics: IRepositoryMetrics = {
    loads: 0,
    saves: 0,
    creates: 0,
    snapshots: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    avgLoadTime: 0,
    avgSaveTime: 0,
    totalAggregates: 0,
    activeAggregates: 0,
  };
  
  constructor(
    private readonly baseRepository: IAggregateRepository<TAggregate, AggregateId>,
    private config: IRepositoryConfig = {}
  ) {
    // Set default configuration
    this.config = {
      enableSnapshots: true,
      snapshotFrequency: 10,
      enableCache: true,
      cacheTTL: 300000, // 5 minutes
      enableMetrics: true,
      enableAutoCleanup: false,
      cleanupThreshold: 3600000, // 1 hour
      enableOptimisticConcurrency: true,
      ...config,
    };

    // Start background tasks
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Add lifecycle hook
   */
  addHook(event: RepositoryLifecycleEvent, hook: LifecycleHook<TAggregate>): this {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(hook);
    return this;
  }

  /**
   * Remove lifecycle hook
   */
  removeHook(event: RepositoryLifecycleEvent, hook: LifecycleHook<TAggregate>): this {
    const hooks = this.hooks.get(event);
    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index >= 0) {
        hooks.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Execute lifecycle hooks
   */
  private async executeHooks(
    event: RepositoryLifecycleEvent,
    context: ILifecycleContext<TAggregate>
  ): Promise<void> {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      try {
        await hook(context);
      } catch (error) {
        console.error(`Lifecycle hook error for ${event}:`, error);
        // Execute error hooks if this isn't already an error hook
        if (event !== 'onError') {
          await this.executeHooks('onError', { 
            ...context, 
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }
    }
  }

  /**
   * Load aggregate with lifecycle management
   */
  async get(aggregateId: AggregateId): Promise<TAggregate | null> {
    const startTime = performance.now();
    const context: ILifecycleContext<TAggregate> = {
      aggregateId,
      timestamp: Date.now(),
      operationType: 'load',
    };

    try {
      // Execute before load hooks
      await this.executeHooks('beforeLoad', context);

      // Check cache first
      if (this.config.enableCache) {
        const cached = await this.getFromCache(aggregateId);
        if (cached) {
          this.metrics.cacheHits++;
          await this.executeHooks('onCacheHit', { ...context, aggregate: cached });
          await this.executeHooks('afterLoad', { ...context, aggregate: cached });
          return cached;
        }
        this.metrics.cacheMisses++;
        await this.executeHooks('onCacheMiss', context);
      }

      // Load from base repository
      const aggregate = await this.baseRepository.get(aggregateId);
      context.aggregate = aggregate || undefined;

      if (aggregate) {
        // Update cache
        if (this.config.enableCache) {
          await this.addToCache(aggregateId, aggregate);
        }

        // Update metrics
        this.metrics.loads++;
        const loadTime = performance.now() - startTime;
        this.metrics.avgLoadTime = (this.metrics.avgLoadTime + loadTime) / 2;
      }

      // Execute after load hooks
      await this.executeHooks('afterLoad', context);

      return aggregate;
    } catch (error) {
      this.metrics.errors++;
      await this.executeHooks('onError', { 
        ...context, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Save aggregate with lifecycle management
   */
  async save(aggregate: TAggregate): Promise<void> {
    const startTime = performance.now();
    const context: ILifecycleContext<TAggregate> = {
      aggregateId: aggregate.id,
      aggregate,
      events: aggregate.uncommittedEvents,
      timestamp: Date.now(),
      operationType: 'save',
    };

    try {
      // Execute before save hooks
      await this.executeHooks('beforeSave', context);

      // Optimistic concurrency check
      if (this.config.enableOptimisticConcurrency) {
        await this.checkConcurrency(aggregate);
      }

      // Save to base repository
      await this.baseRepository.save(aggregate);

      // Update cache
      if (this.config.enableCache) {
        await this.addToCache(aggregate.id, aggregate);
      }

      // Check if snapshot is needed
      if (this.shouldCreateSnapshot(aggregate)) {
        await this.createSnapshot(aggregate);
      }

      // Update metrics
      this.metrics.saves++;
      const saveTime = performance.now() - startTime;
      this.metrics.avgSaveTime = (this.metrics.avgSaveTime + saveTime) / 2;

      // Execute after save hooks
      await this.executeHooks('afterSave', context);
    } catch (error) {
      this.metrics.errors++;
      await this.executeHooks('onError', { 
        ...context, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Create new aggregate with lifecycle management
   */
  createAggregate(aggregateId: AggregateId): TAggregate {
    const context: ILifecycleContext<TAggregate> = {
      aggregateId,
      timestamp: Date.now(),
      operationType: 'create',
    };

    try {
      // Execute before create hooks
      this.executeHooks('beforeCreate', context).catch(console.error);

      // Create aggregate (simulate base repository functionality)
      const aggregate = new (this.baseRepository.constructor as any)(aggregateId) as TAggregate;
      context.aggregate = aggregate;

      // Update metrics
      this.metrics.creates++;
      this.metrics.totalAggregates++;
      this.metrics.activeAggregates++;

      // Execute after create hooks
      this.executeHooks('afterCreate', context).catch(console.error);

      return aggregate;
    } catch (error) {
      this.metrics.errors++;
      this.executeHooks('onError', { 
        ...context, 
        error: error instanceof Error ? error : new Error(String(error))
      }).catch(console.error);
      throw error;
    }
  }

  /**
   * Get from cache
   */
  private async getFromCache(aggregateId: AggregateId): Promise<TAggregate | null> {
    const entry = this.cache.get(aggregateId as string);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp > (this.config.cacheTTL || 300000);
    
    if (isExpired) {
      this.cache.delete(aggregateId as string);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = now;
    return entry.aggregate;
  }

  /**
   * Add to cache
   */
  private async addToCache(aggregateId: AggregateId, aggregate: TAggregate): Promise<void> {
    const now = Date.now();
    this.cache.set(aggregateId as string, {
      aggregate,
      timestamp: now,
      lastAccessed: now,
      version: aggregate.version,
    });
  }

  /**
   * Check optimistic concurrency
   */
  private async checkConcurrency(aggregate: TAggregate): Promise<void> {
    const cached = this.cache.get(aggregate.id as string);
    if (cached && cached.version !== aggregate.version) {
      throw new Error(`Concurrency conflict: Expected version ${cached.version}, got ${aggregate.version}`);
    }
  }

  /**
   * Check if snapshot should be created
   */
  private shouldCreateSnapshot(aggregate: TAggregate): boolean {
    if (!this.config.enableSnapshots) return false;
    
    const eventCount = aggregate.uncommittedEvents.length;
    const frequency = this.config.snapshotFrequency || 10;
    
    return eventCount >= frequency;
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(aggregate: TAggregate): Promise<void> {
    const context: ILifecycleContext<TAggregate> = {
      aggregateId: aggregate.id,
      aggregate,
      timestamp: Date.now(),
      operationType: 'snapshot',
    };

    try {
      await this.executeHooks('beforeSnapshot', context);
      
      // Create snapshot (implementation depends on base repository)
      if ('createSnapshot' in this.baseRepository) {
        await (this.baseRepository as any).createSnapshot(aggregate);
      }
      
      this.metrics.snapshots++;
      await this.executeHooks('afterSnapshot', context);
    } catch (error) {
      await this.executeHooks('onError', { 
        ...context, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  /**
   * Start automatic cleanup background task
   */
  private startAutoCleanup(): void {
    const cleanupInterval = Math.min(this.config.cleanupThreshold || 3600000, 300000); // Max 5 minutes
    
    setInterval(() => {
      this.performCleanup().catch(console.error);
    }, cleanupInterval);
  }

  /**
   * Perform cleanup of unused cached aggregates
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const threshold = this.config.cleanupThreshold || 3600000;
    let cleanedUp = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > threshold) {
        this.cache.delete(id);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      console.log(`Repository cleanup: Removed ${cleanedUp} cached aggregates`);
      this.metrics.activeAggregates = Math.max(0, this.metrics.activeAggregates - cleanedUp);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
  }

  /**
   * Get repository metrics
   */
  getMetrics(): IRepositoryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ id: string; lastAccessed: number; version: EventVersion }>;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0;

    return {
      size: this.cache.size,
      hitRate,
      entries: Array.from(this.cache.entries()).map(([id, entry]) => ({
        id,
        lastAccessed: entry.lastAccessed,
        version: entry.version,
      })),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      loads: 0,
      saves: 0,
      creates: 0,
      snapshots: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      avgLoadTime: 0,
      avgSaveTime: 0,
      totalAggregates: 0,
      activeAggregates: this.cache.size,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): IRepositoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<IRepositoryConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Repository lifecycle hook presets
 */
export const RepositoryHooks = {
  /**
   * Logging hook
   */
  logging<TAggregate extends IAggregate<any, any, any>>(
    logger: (message: string, context?: any) => void = console.log
  ): LifecycleHook<TAggregate> {
    return (context) => {
      const { operationType, aggregateId, timestamp } = context;
      logger(`Repository ${operationType}: ${aggregateId}`, { timestamp, context });
    };
  },

  /**
   * Performance monitoring hook
   */
  performance<TAggregate extends IAggregate<unknown, unknown, unknown>>(
    onMetric: (metric: { operation: string; duration: number; aggregateId: string }) => void
  ): LifecycleHook<TAggregate> {
    const startTimes = new Map<string, number>();
    
    return (context) => {
      const key = `${context.operationType}-${context.aggregateId}`;
      
      if (context.operationType === 'beforeLoad' || context.operationType === 'beforeSave') {
        startTimes.set(key, performance.now());
      } else if (context.operationType === 'afterLoad' || context.operationType === 'afterSave') {
        const startTime = startTimes.get(key);
        if (startTime) {
          const duration = performance.now() - startTime;
          onMetric({
            operation: context.operationType.replace('after', ''),
            duration,
            aggregateId: context.aggregateId as string,
          });
          startTimes.delete(key);
        }
      }
    };
  },

  /**
   * Audit trail hook
   */
  audit<TAggregate extends IAggregate<unknown, unknown, unknown>>(
    auditLogger: (event: {
      operation: string;
      aggregateId: string;
      timestamp: number;
      eventCount?: number;
      metadata?: Record<string, unknown>;
    }) => void
  ): LifecycleHook<TAggregate> {
    return (context) => {
      if (context.operationType === 'afterSave' || context.operationType === 'afterCreate') {
        auditLogger({
          operation: context.operationType,
          aggregateId: context.aggregateId as string,
          timestamp: context.timestamp,
          eventCount: context.events?.length,
          metadata: context.metadata,
        });
      }
    };
  },

  /**
   * Error tracking hook
   */
  errorTracking<TAggregate extends IAggregate<unknown, unknown, unknown>>(
    errorTracker: (error: Error, context: ILifecycleContext<TAggregate>) => void
  ): LifecycleHook<TAggregate> {
    return (context) => {
      if (context.error) {
        errorTracker(context.error, context);
      }
    };
  },

  /**
   * Validation hook
   */
  validation<TAggregate extends IAggregate<unknown, unknown, unknown>>(
    validator: (aggregate: TAggregate) => Promise<void> | void
  ): LifecycleHook<TAggregate> {
    return async (context) => {
      if (context.aggregate && (context.operationType === 'beforeSave' || context.operationType === 'afterLoad')) {
        await validator(context.aggregate);
      }
    };
  },
};

/**
 * Create lifecycle-aware repository
 */
export function createLifecycleRepository<TAggregate extends IAggregate<unknown, unknown, unknown>>(
  baseRepository: IAggregateRepository<TAggregate, AggregateId>,
  config?: IRepositoryConfig
): LifecycleAwareRepository<TAggregate> {
  return new LifecycleAwareRepository(baseRepository, config);
}

/**
 * Repository builder for fluent configuration
 */
export class RepositoryBuilder<TAggregate extends IAggregate<unknown, unknown, unknown>> {
  private config: IRepositoryConfig = {};
  private hooks: Array<{ event: RepositoryLifecycleEvent; hook: LifecycleHook<TAggregate> }> = [];

  constructor(private readonly baseRepository: IAggregateRepository<TAggregate, AggregateId>) {}

  /**
   * Configure repository
   */
  configure(config: Partial<IRepositoryConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Enable caching
   */
  withCaching(ttl: number = 300000): this {
    this.config.enableCache = true;
    this.config.cacheTTL = ttl;
    return this;
  }

  /**
   * Enable snapshots
   */
  withSnapshots(frequency: number = 10): this {
    this.config.enableSnapshots = true;
    this.config.snapshotFrequency = frequency;
    return this;
  }

  /**
   * Enable metrics
   */
  withMetrics(): this {
    this.config.enableMetrics = true;
    return this;
  }

  /**
   * Enable auto cleanup
   */
  withAutoCleanup(threshold: number = 3600000): this {
    this.config.enableAutoCleanup = true;
    this.config.cleanupThreshold = threshold;
    return this;
  }

  /**
   * Add lifecycle hook
   */
  withHook(event: RepositoryLifecycleEvent, hook: LifecycleHook<TAggregate>): this {
    this.hooks.push({ event, hook });
    return this;
  }

  /**
   * Add logging
   */
  withLogging(logger?: (message: string, context?: any) => void): this {
    return this.withHook('beforeLoad', RepositoryHooks.logging(logger))
               .withHook('afterLoad', RepositoryHooks.logging(logger))
               .withHook('beforeSave', RepositoryHooks.logging(logger))
               .withHook('afterSave', RepositoryHooks.logging(logger));
  }

  /**
   * Add performance monitoring
   */
  withPerformanceMonitoring(onMetric: (metric: any) => void): this {
    return this.withHook('beforeLoad', RepositoryHooks.performance(onMetric))
               .withHook('afterLoad', RepositoryHooks.performance(onMetric))
               .withHook('beforeSave', RepositoryHooks.performance(onMetric))
               .withHook('afterSave', RepositoryHooks.performance(onMetric));
  }

  /**
   * Add audit trail
   */
  withAuditTrail(auditLogger: (event: any) => void): this {
    return this.withHook('afterSave', RepositoryHooks.audit(auditLogger))
               .withHook('afterCreate', RepositoryHooks.audit(auditLogger));
  }

  /**
   * Build repository
   */
  build(): LifecycleAwareRepository<TAggregate> {
    const repository = new LifecycleAwareRepository(this.baseRepository, this.config);
    
    // Add all hooks
    for (const { event, hook } of this.hooks) {
      repository.addHook(event, hook);
    }

    return repository;
  }
}

/**
 * Create repository builder
 */
export function createRepositoryBuilder<TAggregate extends IAggregate<unknown, unknown, unknown>>(
  baseRepository: IAggregateRepository<TAggregate, AggregateId>
): RepositoryBuilder<TAggregate> {
  return new RepositoryBuilder(baseRepository);
}