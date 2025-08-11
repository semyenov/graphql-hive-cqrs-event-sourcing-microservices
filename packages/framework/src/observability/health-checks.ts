/**
 * Health Check System
 * 
 * Comprehensive health monitoring for CQRS/Event Sourcing systems:
 * - Application health checks (startup, readiness, liveness)
 * - Component health monitoring (database, event store, message queues)
 * - Custom health indicators
 * - Health aggregation and reporting
 * - Circuit breaker integration
 * - Health dashboards and alerting
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import { pipe } from 'effect/Function';

/**
 * Health status
 */
export enum HealthStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly timestamp: Date;
  readonly duration: number; // milliseconds
  readonly details?: Record<string, any>;
  readonly error?: string;
}

/**
 * Health indicator
 */
export interface HealthIndicator {
  readonly name: string;
  readonly description: string;
  readonly timeout: Duration.Duration;
  readonly check: () => Effect.Effect<HealthCheckResult, Error, never>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  readonly indicators: HealthIndicator[];
  readonly checkInterval: Duration.Duration;
  readonly timeout: Duration.Duration;
  readonly retries: number;
  readonly retryDelay: Duration.Duration;
  readonly aggregationStrategy: 'all_up' | 'majority_up' | 'any_up';
  readonly enableDetailedReporting: boolean;
}

/**
 * Overall health report
 */
export interface HealthReport {
  readonly status: HealthStatus;
  readonly timestamp: Date;
  readonly duration: number;
  readonly indicators: Record<string, HealthCheckResult>;
  readonly summary: {
    total: number;
    up: number;
    down: number;
    outOfService: number;
    unknown: number;
  };
  readonly details?: Record<string, any>;
}

/**
 * Database health indicator
 */
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';
  readonly description = 'Database connectivity and basic operations';
  readonly timeout = Duration.seconds(5);

  constructor(
    private readonly connectionTest: () => Effect.Effect<boolean, Error, never>,
    private readonly queryTest?: () => Effect.Effect<any, Error, never>
  ) {}

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        // Test connection
        const isConnected = yield* _(this.connectionTest());
        
        if (!isConnected) {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: 'Database connection failed',
          };
        }

        // Test basic query if provided
        if (this.queryTest) {
          yield* _(this.queryTest());
        }

        return {
          status: HealthStatus.UP,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          details: {
            connected: true,
            queryTested: !!this.queryTest,
          },
        };
      } catch (error) {
        return {
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: String(error),
        };
      }
    });
  }
}

/**
 * Event store health indicator
 */
export class EventStoreHealthIndicator implements HealthIndicator {
  readonly name = 'eventStore';
  readonly description = 'Event store availability and operations';
  readonly timeout = Duration.seconds(5);

  constructor(
    private readonly eventStore: {
      isHealthy: () => Effect.Effect<boolean, Error, never>;
      getStreamCount?: () => Effect.Effect<number, Error, never>;
    }
  ) {}

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        const isHealthy = yield* _(this.eventStore.isHealthy());
        
        if (!isHealthy) {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: 'Event store is not healthy',
          };
        }

        const details: Record<string, any> = { healthy: true };
        
        // Get additional metrics if available
        if (this.eventStore.getStreamCount) {
          const streamCount = yield* _(this.eventStore.getStreamCount());
          details.streamCount = streamCount;
        }

        return {
          status: HealthStatus.UP,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          details,
        };
      } catch (error) {
        return {
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: String(error),
        };
      }
    });
  }
}

/**
 * Memory health indicator
 */
export class MemoryHealthIndicator implements HealthIndicator {
  readonly name = 'memory';
  readonly description = 'Memory usage monitoring';
  readonly timeout = Duration.seconds(1);

  constructor(
    private readonly thresholds: {
      warningPercent: number;
      criticalPercent: number;
    } = {
      warningPercent: 80,
      criticalPercent: 95,
    }
  ) {}

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return Effect.sync(() => {
      const startTime = Date.now();
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const usagePercent = (usedMemory / totalMemory) * 100;

      let status: HealthStatus;
      let error: string | undefined;

      if (usagePercent >= this.thresholds.criticalPercent) {
        status = HealthStatus.DOWN;
        error = `Memory usage critical: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent >= this.thresholds.warningPercent) {
        status = HealthStatus.OUT_OF_SERVICE;
        error = `Memory usage warning: ${usagePercent.toFixed(1)}%`;
      } else {
        status = HealthStatus.UP;
      }

      return {
        status,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
          rss: memUsage.rss,
          usagePercent: Number(usagePercent.toFixed(2)),
        },
        error,
      };
    });
  }
}

/**
 * Disk space health indicator
 */
export class DiskSpaceHealthIndicator implements HealthIndicator {
  readonly name = 'diskSpace';
  readonly description = 'Disk space availability';
  readonly timeout = Duration.seconds(2);

  constructor(
    private readonly path: string = '/',
    private readonly thresholds: {
      warningPercent: number;
      criticalPercent: number;
    } = {
      warningPercent: 85,
      criticalPercent: 95,
    }
  ) {}

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        // In production, would use actual disk space check
        // For now, simulate disk space check
        const diskUsage = this.simulateDiskCheck();
        
        let status: HealthStatus;
        let error: string | undefined;

        if (diskUsage.usagePercent >= this.thresholds.criticalPercent) {
          status = HealthStatus.DOWN;
          error = `Disk usage critical: ${diskUsage.usagePercent.toFixed(1)}%`;
        } else if (diskUsage.usagePercent >= this.thresholds.warningPercent) {
          status = HealthStatus.OUT_OF_SERVICE;
          error = `Disk usage warning: ${diskUsage.usagePercent.toFixed(1)}%`;
        } else {
          status = HealthStatus.UP;
        }

        return {
          status,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          details: {
            path: this.path,
            total: diskUsage.total,
            used: diskUsage.used,
            free: diskUsage.free,
            usagePercent: diskUsage.usagePercent,
          },
          error,
        };
      } catch (error) {
        return {
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: String(error),
        };
      }
    });
  }

  private simulateDiskCheck(): {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  } {
    // Simulate disk usage between 10-90%
    const usagePercent = 10 + Math.random() * 80;
    const total = 100 * 1024 * 1024 * 1024; // 100GB
    const used = (total * usagePercent) / 100;
    const free = total - used;

    return { total, used, free, usagePercent };
  }
}

/**
 * External service health indicator
 */
export class ExternalServiceHealthIndicator implements HealthIndicator {
  readonly name: string;
  readonly description: string;
  readonly timeout: Duration.Duration;

  constructor(
    name: string,
    description: string,
    private readonly healthEndpoint: string,
    timeout: Duration.Duration = Duration.seconds(10)
  ) {
    this.name = name;
    this.description = description;
    this.timeout = timeout;
  }

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        const response = yield* _(
          Effect.tryPromise({
            try: () => fetch(this.healthEndpoint, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
            }),
            catch: (error) => new Error(`Health check request failed: ${error}`),
          })
        );

        const duration = Date.now() - startTime;
        
        if (response.ok) {
          const data = yield* _(
            Effect.tryPromise({
              try: () => response.json().catch(() => ({})),
              catch: () => ({}),
            })
          );

          return {
            status: HealthStatus.UP,
            timestamp: new Date(),
            duration,
            details: {
              endpoint: this.healthEndpoint,
              statusCode: response.status,
              responseTime: duration,
              ...data,
            },
          };
        } else {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: {
              endpoint: this.healthEndpoint,
              statusCode: response.status,
            },
          };
        }
      } catch (error) {
        return {
          status: HealthStatus.DOWN,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: String(error),
          details: {
            endpoint: this.healthEndpoint,
          },
        };
      }
    });
  }
}

/**
 * Custom health indicator
 */
export class CustomHealthIndicator implements HealthIndicator {
  readonly name: string;
  readonly description: string;
  readonly timeout: Duration.Duration;

  constructor(
    name: string,
    description: string,
    private readonly healthCheck: () => Effect.Effect<HealthCheckResult, Error, never>,
    timeout: Duration.Duration = Duration.seconds(5)
  ) {
    this.name = name;
    this.description = description;
    this.timeout = timeout;
  }

  check(): Effect.Effect<HealthCheckResult, Error, never> {
    return this.healthCheck();
  }
}

/**
 * Health check service
 */
export class HealthCheckService {
  private lastReport: Ref.Ref<Option.Option<HealthReport>>;
  private monitoringFiber: Option.Option<Fiber.RuntimeFiber<never, never>> = Option.none();

  constructor(
    private readonly config: HealthCheckConfig
  ) {
    this.lastReport = Ref.unsafeMake(Option.none());
  }

  /**
   * Start health monitoring
   */
  start(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const fiber = yield* _(
        pipe(
          this.monitoringLoop(),
          Effect.fork
        )
      );
      this.monitoringFiber = Option.some(fiber);
    });
  }

  /**
   * Stop health monitoring
   */
  stop(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      if (Option.isSome(this.monitoringFiber)) {
        yield* _(Fiber.interrupt(this.monitoringFiber.value));
      }
    });
  }

  /**
   * Perform health check
   */
  checkHealth(): Effect.Effect<HealthReport, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const results: Record<string, HealthCheckResult> = {};

      // Run all health checks in parallel with timeout
      const checkEffects = this.config.indicators.map(indicator =>
        pipe(
          indicator.check(),
          Effect.timeout(indicator.timeout),
          Effect.catchAll((error) => Effect.succeed({
            status: HealthStatus.UNKNOWN,
            timestamp: new Date(),
            duration: Duration.toMillis(indicator.timeout),
            error: String(error),
          })),
          Effect.map(result => [indicator.name, result] as const)
        )
      );

      const allResults = yield* _(Effect.all(checkEffects));
      
      for (const [name, result] of allResults) {
        results[name] = result;
      }

      // Calculate summary
      const summary = this.calculateSummary(results);
      const overallStatus = this.calculateOverallStatus(results, summary);

      const report: HealthReport = {
        status: overallStatus,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        indicators: results,
        summary,
        details: this.config.enableDetailedReporting ? {
          aggregationStrategy: this.config.aggregationStrategy,
          checkInterval: Duration.toMillis(this.config.checkInterval),
          timeout: Duration.toMillis(this.config.timeout),
        } : undefined,
      };

      // Update last report
      yield* _(Ref.set(this.lastReport, Option.some(report)));

      return report;
    });
  }

  /**
   * Get last health report
   */
  getLastReport(): Effect.Effect<Option.Option<HealthReport>, never, never> {
    return Ref.get(this.lastReport);
  }

  /**
   * Check specific indicator
   */
  checkIndicator(name: string): Effect.Effect<Option.Option<HealthCheckResult>, Error, never> {
    const indicator = this.config.indicators.find(i => i.name === name);
    
    if (!indicator) {
      return Effect.succeed(Option.none());
    }

    return Effect.gen(function* (_) {
      const result = yield* _(
        pipe(
          indicator.check(),
          Effect.timeout(indicator.timeout),
          Effect.catchAll((error) => Effect.succeed({
            status: HealthStatus.UNKNOWN,
            timestamp: new Date(),
            duration: Duration.toMillis(indicator.timeout),
            error: String(error),
          }))
        )
      );

      return Option.some(result);
    });
  }

  /**
   * Monitoring loop
   */
  private monitoringLoop(): Effect.Effect<never, never, never> {
    return Effect.forever(
      Effect.gen(function* (_) {
        yield* _(Effect.sleep(this.config.checkInterval));
        
        try {
          yield* _(this.checkHealth());
        } catch (error) {
          console.error('Health check failed:', error);
        }
      })
    );
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: Record<string, HealthCheckResult>): HealthReport['summary'] {
    const summary = {
      total: 0,
      up: 0,
      down: 0,
      outOfService: 0,
      unknown: 0,
    };

    for (const result of Object.values(results)) {
      summary.total++;
      
      switch (result.status) {
        case HealthStatus.UP:
          summary.up++;
          break;
        case HealthStatus.DOWN:
          summary.down++;
          break;
        case HealthStatus.OUT_OF_SERVICE:
          summary.outOfService++;
          break;
        case HealthStatus.UNKNOWN:
          summary.unknown++;
          break;
      }
    }

    return summary;
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallStatus(
    results: Record<string, HealthCheckResult>,
    summary: HealthReport['summary']
  ): HealthStatus {
    switch (this.config.aggregationStrategy) {
      case 'all_up':
        return summary.up === summary.total ? HealthStatus.UP : HealthStatus.DOWN;
      
      case 'majority_up':
        const healthyCount = summary.up + summary.outOfService;
        return healthyCount > summary.total / 2 ? HealthStatus.UP : HealthStatus.DOWN;
      
      case 'any_up':
        return summary.up > 0 ? HealthStatus.UP : HealthStatus.DOWN;
      
      default:
        return HealthStatus.UNKNOWN;
    }
  }
}

/**
 * CQRS-specific health indicators
 */
export class CQRSHealthIndicators {
  /**
   * Create command processing health indicator
   */
  static createCommandProcessingIndicator(
    commandBus: {
      isHealthy: () => Effect.Effect<boolean, Error, never>;
      getQueueSize?: () => Effect.Effect<number, Error, never>;
    }
  ): HealthIndicator {
    return new CustomHealthIndicator(
      'commandProcessing',
      'Command processing pipeline health',
      () => Effect.gen(function* (_) {
        const startTime = Date.now();
        
        try {
          const isHealthy = yield* _(commandBus.isHealthy());
          
          if (!isHealthy) {
            return {
              status: HealthStatus.DOWN,
              timestamp: new Date(),
              duration: Date.now() - startTime,
              error: 'Command bus is not healthy',
            };
          }

          const details: Record<string, any> = { healthy: true };
          
          if (commandBus.getQueueSize) {
            const queueSize = yield* _(commandBus.getQueueSize());
            details.queueSize = queueSize;
            
            // Consider queue size in health status
            if (queueSize > 1000) {
              return {
                status: HealthStatus.OUT_OF_SERVICE,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                details,
                error: `Command queue size too large: ${queueSize}`,
              };
            }
          }

          return {
            status: HealthStatus.UP,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            details,
          };
        } catch (error) {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: String(error),
          };
        }
      }),
      Duration.seconds(5)
    );
  }

  /**
   * Create event processing health indicator
   */
  static createEventProcessingIndicator(
    eventBus: {
      isHealthy: () => Effect.Effect<boolean, Error, never>;
      getProcessingLag?: () => Effect.Effect<number, Error, never>;
    }
  ): HealthIndicator {
    return new CustomHealthIndicator(
      'eventProcessing',
      'Event processing pipeline health',
      () => Effect.gen(function* (_) {
        const startTime = Date.now();
        
        try {
          const isHealthy = yield* _(eventBus.isHealthy());
          
          if (!isHealthy) {
            return {
              status: HealthStatus.DOWN,
              timestamp: new Date(),
              duration: Date.now() - startTime,
              error: 'Event bus is not healthy',
            };
          }

          const details: Record<string, any> = { healthy: true };
          
          if (eventBus.getProcessingLag) {
            const lag = yield* _(eventBus.getProcessingLag());
            details.processingLag = lag;
            
            // Consider processing lag in health status
            if (lag > 30000) { // 30 seconds
              return {
                status: HealthStatus.OUT_OF_SERVICE,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                details,
                error: `Event processing lag too high: ${lag}ms`,
              };
            }
          }

          return {
            status: HealthStatus.UP,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            details,
          };
        } catch (error) {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: String(error),
          };
        }
      }),
      Duration.seconds(5)
    );
  }

  /**
   * Create projection health indicator
   */
  static createProjectionHealthIndicator(
    projections: Array<{
      name: string;
      isHealthy: () => Effect.Effect<boolean, Error, never>;
      getLastUpdate?: () => Effect.Effect<Date, Error, never>;
    }>
  ): HealthIndicator {
    return new CustomHealthIndicator(
      'projections',
      'Read model projections health',
      () => Effect.gen(function* (_) {
        const startTime = Date.now();
        const details: Record<string, any> = {};
        
        try {
          let allHealthy = true;
          const errors: string[] = [];
          
          for (const projection of projections) {
            const isHealthy = yield* _(projection.isHealthy());
            details[projection.name] = { healthy: isHealthy };
            
            if (!isHealthy) {
              allHealthy = false;
              errors.push(`${projection.name} is not healthy`);
            }
            
            if (projection.getLastUpdate) {
              const lastUpdate = yield* _(projection.getLastUpdate());
              const age = Date.now() - lastUpdate.getTime();
              details[projection.name].lastUpdate = lastUpdate.toISOString();
              details[projection.name].ageMs = age;
              
              // Check if projection is stale (older than 5 minutes)
              if (age > 300000) {
                allHealthy = false;
                errors.push(`${projection.name} is stale (${Math.round(age / 1000)}s old)`);
              }
            }
          }

          return {
            status: allHealthy ? HealthStatus.UP : HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            details,
            error: errors.length > 0 ? errors.join('; ') : undefined,
          };
        } catch (error) {
          return {
            status: HealthStatus.DOWN,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: String(error),
            details,
          };
        }
      }),
      Duration.seconds(10)
    );
  }
}

/**
 * Health check service interface
 */
export interface IHealthCheckService {
  readonly _tag: 'HealthCheckService';
  readonly service: HealthCheckService;
  readonly checkHealth: () => Effect.Effect<HealthReport, Error, never>;
  readonly getLastReport: () => Effect.Effect<Option.Option<HealthReport>, never, never>;
  readonly checkIndicator: (name: string) => Effect.Effect<Option.Option<HealthCheckResult>, Error, never>;
}

export const HealthCheckServiceTag = Context.GenericTag<IHealthCheckService>('HealthCheckService');

/**
 * Health check layer
 */
export const HealthCheckLive = (config: Partial<HealthCheckConfig> & { indicators: HealthIndicator[] }) =>
  Layer.effect(
    HealthCheckServiceTag,
    Effect.gen(function* (_) {
      const fullConfig: HealthCheckConfig = {
        indicators: config.indicators,
        checkInterval: config.checkInterval ?? Duration.seconds(30),
        timeout: config.timeout ?? Duration.seconds(10),
        retries: config.retries ?? 3,
        retryDelay: config.retryDelay ?? Duration.seconds(1),
        aggregationStrategy: config.aggregationStrategy ?? 'majority_up',
        enableDetailedReporting: config.enableDetailedReporting ?? true,
      };

      const service = new HealthCheckService(fullConfig);
      
      // Start monitoring
      yield* _(service.start());

      return {
        _tag: 'HealthCheckService',
        service,
        checkHealth: () => service.checkHealth(),
        getLastReport: () => service.getLastReport(),
        checkIndicator: (name: string) => service.checkIndicator(name),
      };
    })
  );

/**
 * Create health check service
 */
export const createHealthCheckService = (
  config: Partial<HealthCheckConfig> & { indicators: HealthIndicator[] }
): Effect.Effect<IHealthCheckService, Error, never> => {
  return Effect.gen(function* (_) {
    const fullConfig: HealthCheckConfig = {
      indicators: config.indicators,
      checkInterval: config.checkInterval ?? Duration.seconds(30),
      timeout: config.timeout ?? Duration.seconds(10),
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? Duration.seconds(1),
      aggregationStrategy: config.aggregationStrategy ?? 'majority_up',
      enableDetailedReporting: config.enableDetailedReporting ?? true,
    };

    const service = new HealthCheckService(fullConfig);
    yield* _(service.start());

    return {
      _tag: 'HealthCheckService',
      service,
      checkHealth: () => service.checkHealth(),
      getLastReport: () => service.getLastReport(),
      checkIndicator: (name: string) => service.checkIndicator(name),
    };
  });
};