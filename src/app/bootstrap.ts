/**
 * Application Bootstrap
 * 
 * Main application initialization using IDomainModule and DomainRegistry patterns.
 */

import type { 
  IDomainModule, 
  IDomainRegistry,
  IFrameworkConfig 
} from '../framework/core/types';
import {
  createEventStore,
  createCommandBus,
  createQueryBus,
  createEventBus,
} from '../framework';
import { UserDomainModule, initializeUserDomain } from '../domains/users';
import { 
  createCommandLoggingMiddleware, 
  createQueryLoggingMiddleware,
  ConsoleLogger 
} from '../framework/infrastructure/middleware/logging';
import { 
  createCommandMetricsMiddleware, 
  createQueryMetricsMiddleware,
  createPerformanceMiddleware,
  InMemoryMetricsCollector 
} from '../framework/infrastructure/middleware/metrics';

/**
 * Domain Registry implementation
 */
class DomainRegistry implements IDomainRegistry {
  private domains = new Map<string, IDomainModule>();
  
  register(module: IDomainModule): void {
    if (this.domains.has(module.name)) {
      throw new Error(`Domain "${module.name}" is already registered`);
    }
    this.domains.set(module.name, module);
    console.log(`✅ Registered domain: ${module.name} v${module.version}`);
  }
  
  get(name: string): IDomainModule | null {
    return this.domains.get(name) || null;
  }
  
  getAll(): IDomainModule[] {
    return Array.from(this.domains.values());
  }
  
  async initialize(): Promise<void> {
    console.log('\n🚀 Initializing domains...');
    for (const domain of this.domains.values()) {
      if (domain.initialize) {
        await domain.initialize();
        console.log(`   ✓ ${domain.name} initialized`);
      }
    }
    console.log('✅ All domains initialized\n');
  }
  
  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down domains...');
    for (const domain of this.domains.values()) {
      if (domain.shutdown) {
        await domain.shutdown();
        console.log(`   ✓ ${domain.name} shut down`);
      }
    }
    console.log('✅ All domains shut down\n');
  }
}

/**
 * Application context with all infrastructure
 */
export interface ApplicationContext {
  registry: IDomainRegistry;
  config: IFrameworkConfig;
  domains: Map<string, ReturnType<typeof initializeUserDomain>>;
}

/**
 * Bootstrap the application with all domains
 */
export async function bootstrapApplication(
  config: IFrameworkConfig = {}
): Promise<ApplicationContext> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏗️  CQRS/Event Sourcing Framework');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Create domain registry
  const registry = new DomainRegistry();
  
  // Register domains
  registry.register(UserDomainModule);
  
  // Initialize domains
  await registry.initialize();
  
  // Initialize domain infrastructure
  const domains = new Map();
  
  // Create shared metrics collector
  const metricsCollector = new InMemoryMetricsCollector();
  
  // Initialize user domain with enhanced configuration
  const userDomain = initializeUserDomain({
    enableCache: config.queryBus?.cache !== false,
    enableValidation: true,
    enableProjections: true,
    enableEventReplay: true,
    enableSnapshotting: true,
  });
  
  // Add logging middleware for commands (QueryBus doesn't support middleware)
  if (config.monitoring?.enabled) {
    const commandLogger = new ConsoleLogger('[Command]');
    
    userDomain.commandBus.use(
      createCommandLoggingMiddleware(
        {
          enabled: true,
          logLevel: 'info',
          includePayload: process.env.NODE_ENV !== 'production',
          includeResult: false,
        },
        commandLogger
      ) as any
    );
  }
  
  // Add metrics middleware for commands
  userDomain.commandBus.use(createCommandMetricsMiddleware(metricsCollector) as any);
  
  // Add performance monitoring for commands
  if (process.env.NODE_ENV !== 'production') {
    userDomain.commandBus.use(
      createPerformanceMiddleware(
        Number(process.env.SLOW_OPERATION_THRESHOLD) || 1000,
        (operation, duration) => {
          console.warn(`⚠️ Slow command detected: ${operation.type} took ${duration}ms`);
        }
      ) as any
    );
  }
  
  domains.set('users', userDomain);
  
  // Store metrics collector for access
  (domains as any).metricsCollector = metricsCollector;
  
  // Log framework configuration
  console.log('📋 Framework Configuration:');
  console.log(`   Event Store: ${config.eventStore?.type || 'memory'}`);
  console.log(`   Command Bus: ${config.commandBus?.middleware?.length || 0} middleware`);
  console.log(`   Query Cache: ${config.queryBus?.cache !== false ? 'enabled' : 'disabled'}`);
  console.log(`   GraphQL: ${config.graphql?.playground !== false ? 'playground enabled' : 'production mode'}`);
  console.log(`   Monitoring: ${config.monitoring?.enabled ? config.monitoring.provider : 'disabled'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Set up graceful shutdown
  setupGracefulShutdown(registry);
  
  return {
    registry,
    config,
    domains,
  };
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown(registry: IDomainRegistry): void {
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
    
    try {
      await registry.shutdown();
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

/**
 * Load configuration from environment
 */
export function loadFrameworkConfig(): IFrameworkConfig {
  return {
    eventStore: {
      type: (process.env.EVENT_STORE_TYPE as 'memory' | 'postgres' | 'mongodb') || 'memory',
      connectionString: process.env.EVENT_STORE_CONNECTION_STRING,
    },
    commandBus: {
      middleware: process.env.COMMAND_MIDDLEWARE?.split(',') || [],
      timeout: Number(process.env.COMMAND_TIMEOUT) || 30000,
    },
    queryBus: {
      cache: process.env.QUERY_CACHE !== 'false',
      cacheTimeout: Number(process.env.QUERY_CACHE_TIMEOUT) || 60000,
    },
    graphql: {
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.GRAPHQL_INTROSPECTION !== 'false',
      tracing: process.env.GRAPHQL_TRACING === 'true',
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED === 'true',
      provider: (process.env.MONITORING_PROVIDER as 'hive' | 'datadog' | 'prometheus') || 'hive',
    },
  };
}

/**
 * Health check endpoint data
 */
export function getHealthStatus(context: ApplicationContext): Record<string, unknown> {
  const domains = context.registry.getAll();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    framework: {
      version: '1.0.0',
      domains: domains.map(d => ({
        name: d.name,
        version: d.version,
      })),
    },
    infrastructure: {
      eventStore: context.config.eventStore?.type || 'memory',
      commandBus: 'active',
      queryBus: 'active',
      eventBus: 'active',
    },
    environment: {
      node: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  };
}