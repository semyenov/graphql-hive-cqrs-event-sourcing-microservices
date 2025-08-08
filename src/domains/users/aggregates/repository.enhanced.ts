/**
 * User Domain: Enhanced Repository with Lifecycle Management
 * 
 * Demonstrates the enhanced repository with lifecycle hooks, caching, 
 * metrics, and auto-management features.
 */

import { 
  createRepositoryBuilder,
  RepositoryHooks,
  type IRepositoryConfig,
  type LifecycleAwareRepository,
} from '../../../framework/core/repository-lifecycle';
import { AggregateRepository } from '../../../framework/infrastructure/repository/aggregate';
import type { IEventStore, IEventBus } from '../../../framework/core';
import { UserAggregate } from './user';
import type { UserEvent } from '../events/types';

/**
 * User repository type
 */
export type UserRepository = LifecycleAwareRepository<UserAggregate>;

/**
 * Enhanced user repository configuration
 */
const USER_REPO_CONFIG: IRepositoryConfig = {
  enableSnapshots: true,
  snapshotFrequency: 5, // Snapshot every 5 events for users
  enableCache: true,
  cacheTTL: 600000, // 10 minutes cache for user data
  enableMetrics: true,
  enableAutoCleanup: true,
  cleanupThreshold: 1800000, // 30 minutes cleanup threshold
  enableOptimisticConcurrency: true,
};

/**
 * Create enhanced user repository with lifecycle management
 */
export function createEnhancedUserRepository(
  eventStore: IEventStore<UserEvent>,
  eventBus?: IEventBus<UserEvent>
): UserRepository {
  // Create base repository
  const baseRepository = new AggregateRepository(
    () => new UserAggregate(),
    eventStore,
    eventBus
  );

  // Build enhanced repository with lifecycle features
  const repository = createRepositoryBuilder(baseRepository)
    .configure(USER_REPO_CONFIG)
    .withCaching(600000) // 10 minutes
    .withSnapshots(5) // Every 5 events
    .withMetrics()
    .withAutoCleanup(1800000) // 30 minutes
    .withLogging((message, context) => {
      console.log(`[UserRepo] ${message}`, context?.timestamp ? new Date(context.timestamp).toISOString() : '');
    })
    .withPerformanceMonitoring((metric) => {
      if (metric.duration > 100) { // Log slow operations (>100ms)
        console.warn(`[UserRepo Performance] Slow ${metric.operation}: ${metric.duration.toFixed(2)}ms for ${metric.aggregateId}`);
      }
    })
    .withAuditTrail((event) => {
      console.log(`[UserRepo Audit] ${event.operation} for user ${event.aggregateId} at ${new Date(event.timestamp).toISOString()}`);
    })
    .withHook('onError', RepositoryHooks.errorTracking((error, context) => {
      console.error(`[UserRepo Error] ${context.operationType} failed for ${context.aggregateId}:`, error.message);
    }))
    .withHook('beforeSave', RepositoryHooks.validation(async (user) => {
      // Custom user validation before save
      const state = user.getUser();
      if (!state.profile.name) {
        throw new Error('User name is required');
      }
      if (!state.profile.email) {
        throw new Error('User email is required');
      }
    }))
    .withHook('afterLoad', async (context) => {
      // Custom hook: Update last accessed time
      if (context.aggregate) {
        console.log(`[UserRepo] User ${context.aggregateId} accessed at ${new Date(context.timestamp).toISOString()}`);
      }
    })
    .withHook('beforeSnapshot', async (context) => {
      // Custom hook: Log snapshot creation
      console.log(`[UserRepo] Creating snapshot for user ${context.aggregateId}`);
    })
    .build();

  return repository;
}

/**
 * Repository monitoring and management utilities
 */
export class UserRepositoryManager {
  constructor(private readonly repository: UserRepository) {}

  /**
   * Get comprehensive repository status
   */
  getStatus(): {
    metrics: any;
    cache: any;
    config: IRepositoryConfig;
    health: 'healthy' | 'warning' | 'error';
  } {
    const metrics = this.repository.getMetrics();
    const cache = this.repository.getCacheStats();
    const config = this.repository.getConfig();

    // Determine health status
    let health: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (metrics.errors > 10) {
      health = 'error';
    } else if (cache.hitRate < 0.5 || metrics.avgLoadTime > 200) {
      health = 'warning';
    }

    return { metrics, cache, config, health };
  }

  /**
   * Optimize repository performance
   */
  optimize(): {
    actions: string[];
    recommendations: string[];
  } {
    const status = this.getStatus();
    const actions: string[] = [];
    const recommendations: string[] = [];

    // Clear cache if hit rate is very low
    if (status.cache.hitRate < 0.2 && status.cache.size > 10) {
      this.repository.clearCache();
      actions.push('Cleared inefficient cache');
    }

    // Recommendations based on metrics
    if (status.metrics.avgLoadTime > 100) {
      recommendations.push('Consider increasing cache TTL or optimizing event store queries');
    }

    if (status.cache.hitRate < 0.5) {
      recommendations.push('Consider increasing cache TTL or reviewing cache usage patterns');
    }

    if (status.metrics.errors > 5) {
      recommendations.push('Review error logs and improve error handling');
    }

    if (status.metrics.saves > status.metrics.snapshots * 10) {
      recommendations.push('Consider reducing snapshot frequency for better performance');
    }

    return { actions, recommendations };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const status = this.getStatus();
    const { actions, recommendations } = this.optimize();

    return `
User Repository Performance Report
Generated: ${new Date().toISOString()}

📊 METRICS:
  Loads: ${status.metrics.loads}
  Saves: ${status.metrics.saves}
  Creates: ${status.metrics.creates}
  Snapshots: ${status.metrics.snapshots}
  Errors: ${status.metrics.errors}
  Avg Load Time: ${status.metrics.avgLoadTime.toFixed(2)}ms
  Avg Save Time: ${status.metrics.avgSaveTime.toFixed(2)}ms
  Total Aggregates: ${status.metrics.totalAggregates}
  Active Aggregates: ${status.metrics.activeAggregates}

💾 CACHE STATUS:
  Size: ${status.cache.size} entries
  Hit Rate: ${(status.cache.hitRate * 100).toFixed(1)}%
  Cache Hits: ${status.metrics.cacheHits}
  Cache Misses: ${status.metrics.cacheMisses}

⚙️ CONFIGURATION:
  Snapshots: ${status.config.enableSnapshots ? `Enabled (every ${status.config.snapshotFrequency} events)` : 'Disabled'}
  Cache: ${status.config.enableCache ? `Enabled (TTL: ${status.config.cacheTTL}ms)` : 'Disabled'}
  Auto Cleanup: ${status.config.enableAutoCleanup ? `Enabled (${status.config.cleanupThreshold}ms threshold)` : 'Disabled'}
  Optimistic Concurrency: ${status.config.enableOptimisticConcurrency ? 'Enabled' : 'Disabled'}

🏥 HEALTH STATUS: ${status.health.toUpperCase()}

${actions.length > 0 ? `🔧 ACTIONS TAKEN:\n${actions.map(a => `  • ${a}`).join('\n')}\n` : ''}

${recommendations.length > 0 ? `💡 RECOMMENDATIONS:\n${recommendations.map(r => `  • ${r}`).join('\n')}` : '✅ No recommendations - repository is performing well'}
    `;
  }

  /**
   * Reset repository metrics
   */
  resetMetrics(): void {
    this.repository.resetMetrics();
    console.log('[UserRepo] Metrics reset');
  }

  /**
   * Force cache cleanup
   */
  cleanupCache(): void {
    this.repository.clearCache();
    console.log('[UserRepo] Cache cleared');
  }
}

/**
 * Factory function with different configuration presets
 */
export const UserRepositoryFactory = {
  /**
   * High-performance repository (aggressive caching, frequent snapshots)
   */
  highPerformance(eventStore: IEventStore<UserEvent>, eventBus?: IEventBus<UserEvent>): UserRepository {
    const baseRepository = new AggregateRepository(() => new UserAggregate(), eventStore, eventBus);
    
    return createRepositoryBuilder(baseRepository)
      .configure({
        enableSnapshots: true,
        snapshotFrequency: 3, // Very frequent snapshots
        enableCache: true,
        cacheTTL: 900000, // 15 minutes cache
        enableMetrics: true,
        enableAutoCleanup: false, // Disable cleanup for max performance
        enableOptimisticConcurrency: false, // Disable for speed
      })
      .withCaching(900000)
      .withSnapshots(3)
      .withMetrics()
      .build();
  },

  /**
   * Memory-efficient repository (minimal caching, infrequent snapshots)
   */
  memoryEfficient(eventStore: IEventStore<UserEvent>, eventBus?: IEventBus<UserEvent>): UserRepository {
    const baseRepository = new AggregateRepository(() => new UserAggregate(), eventStore, eventBus);
    
    return createRepositoryBuilder(baseRepository)
      .configure({
        enableSnapshots: true,
        snapshotFrequency: 20, // Less frequent snapshots
        enableCache: true,
        cacheTTL: 60000, // 1 minute cache only
        enableMetrics: false, // Minimal metrics overhead
        enableAutoCleanup: true,
        cleanupThreshold: 300000, // 5 minutes aggressive cleanup
        enableOptimisticConcurrency: true,
      })
      .withCaching(60000)
      .withSnapshots(20)
      .withAutoCleanup(300000)
      .build();
  },

  /**
   * Development/debugging repository (extensive logging, monitoring)
   */
  development(eventStore: IEventStore<UserEvent>, eventBus?: IEventBus<UserEvent>): UserRepository {
    const baseRepository = new AggregateRepository(() => new UserAggregate(), eventStore, eventBus);
    
    return createRepositoryBuilder(baseRepository)
      .configure({
        enableSnapshots: true,
        snapshotFrequency: 5,
        enableCache: true,
        cacheTTL: 300000, // 5 minutes
        enableMetrics: true,
        enableAutoCleanup: false, // Disable for debugging
        enableOptimisticConcurrency: true,
      })
      .withCaching(300000)
      .withSnapshots(5)
      .withMetrics()
      .withLogging(console.log) // Verbose logging
      .withPerformanceMonitoring(console.log) // Log all performance metrics
      .withAuditTrail(console.log) // Log all operations
      .withHook('onError', RepositoryHooks.errorTracking(console.error))
      .build();
  },

  /**
   * Production repository (balanced configuration with error handling)
   */
  production(eventStore: IEventStore<UserEvent>, eventBus?: IEventBus<UserEvent>): UserRepository {
    const baseRepository = new AggregateRepository(() => new UserAggregate(), eventStore, eventBus);
    
    return createRepositoryBuilder(baseRepository)
      .configure({
        enableSnapshots: true,
        snapshotFrequency: 10,
        enableCache: true,
        cacheTTL: 600000, // 10 minutes
        enableMetrics: true,
        enableAutoCleanup: true,
        cleanupThreshold: 3600000, // 1 hour
        enableOptimisticConcurrency: true,
      })
      .withCaching(600000)
      .withSnapshots(10)
      .withMetrics()
      .withAutoCleanup(3600000)
      .withHook('onError', RepositoryHooks.errorTracking((error, context) => {
        // In production, send to error tracking service
        console.error(`Production error in ${context.operationType}:`, error);
      }))
      .build();
  },
};

/**
 * Backward compatibility - use enhanced repository as default
 */
export function createUserRepository(
  eventStore: IEventStore<UserEvent>,
  eventBus?: IEventBus<UserEvent>
): UserRepository {
  return createEnhancedUserRepository(eventStore, eventBus);
}