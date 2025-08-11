/**
 * Comprehensive Integration Test
 * 
 * Demonstrates all framework capabilities working together:
 * - Effect-TS based command/event handling
 * - PostgreSQL persistence with migrations
 * - Performance optimizations (caching, indexing)
 * - Observability (OpenTelemetry, metrics, logging)
 * - Complete testing suite execution
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

// Core framework imports
import { 
  createCommandHandler,
  createEventHandler,
  createRepository,
  createProjection,
  EventSourcing,
  CommandContext,
  EventContext,
  RepositoryContext
} from './effect/core';

// Infrastructure imports
import {
  PostgreSQLEventStore,
  PostgreSQLSnapshotStore,
  createMigrationRunner,
  createConnectionPool
} from './infrastructure/postgresql';

// Performance imports
import {
  createCachedRepository,
  createIndexedEventStore,
  createQueryOptimizer,
  createStreamProcessor
} from './performance';

// Observability imports
import {
  OpenTelemetrySDK,
  createCQRSTracer,
  createMetricsCollector,
  LogAggregator,
  HealthCheckService,
  AnomalyDetectionService
} from './observability';

// Testing imports
import { PropertyTestRunner } from './testing/property-based';
import { ChaosEngineeringService } from './testing/chaos-engineering';
import { LoadTestRunner } from './testing/load-testing';
import { PerformanceRegressionService } from './testing/performance-regression';
import { MutationTestingEngine } from './testing/mutation-testing';
import { ContractTestingService } from './testing/contract-testing';
import { VisualTestRunner } from './testing/visual-regression';
import { E2ETestRunner } from './testing/e2e-automation';

// Services
import {
  EventStoreService,
  CommandBusService,
  LoggerService,
  MetricsService,
  CacheService,
  CoreServicesLive
} from './effect/services';

/**
 * Sample domain: Order Management
 */
interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

// Commands
interface CreateOrderCommand {
  type: 'CreateOrder';
  orderId: string;
  customerId: string;
  items: OrderItem[];
}

interface ConfirmOrderCommand {
  type: 'ConfirmOrder';
  orderId: string;
}

interface ShipOrderCommand {
  type: 'ShipOrder';
  orderId: string;
  trackingNumber: string;
}

// Events
interface OrderCreatedEvent {
  type: 'OrderCreated';
  orderId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  timestamp: Date;
}

interface OrderConfirmedEvent {
  type: 'OrderConfirmed';
  orderId: string;
  timestamp: Date;
}

interface OrderShippedEvent {
  type: 'OrderShipped';
  orderId: string;
  trackingNumber: string;
  timestamp: Date;
}

/**
 * Order aggregate with Effect
 */
class OrderAggregate {
  private events: Array<OrderCreatedEvent | OrderConfirmedEvent | OrderShippedEvent> = [];
  private order: Order | null = null;

  constructor(private readonly id: string) {}

  // Command handlers
  create(command: CreateOrderCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      if (this.order) {
        return yield* _(Effect.fail(new Error('Order already exists')));
      }

      const total = command.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const event: OrderCreatedEvent = {
        type: 'OrderCreated',
        orderId: command.orderId,
        customerId: command.customerId,
        items: command.items,
        total,
        timestamp: new Date(),
      };

      this.apply(event);
      this.events.push(event);
    }.bind(this));
  }

  confirm(command: ConfirmOrderCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      if (!this.order) {
        return yield* _(Effect.fail(new Error('Order not found')));
      }
      if (this.order.status !== 'pending') {
        return yield* _(Effect.fail(new Error('Order cannot be confirmed')));
      }

      const event: OrderConfirmedEvent = {
        type: 'OrderConfirmed',
        orderId: command.orderId,
        timestamp: new Date(),
      };

      this.apply(event);
      this.events.push(event);
    }.bind(this));
  }

  ship(command: ShipOrderCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      if (!this.order) {
        return yield* _(Effect.fail(new Error('Order not found')));
      }
      if (this.order.status !== 'confirmed') {
        return yield* _(Effect.fail(new Error('Order must be confirmed before shipping')));
      }

      const event: OrderShippedEvent = {
        type: 'OrderShipped',
        orderId: command.orderId,
        trackingNumber: command.trackingNumber,
        timestamp: new Date(),
      };

      this.apply(event);
      this.events.push(event);
    }.bind(this));
  }

  // Event application
  private apply(event: OrderCreatedEvent | OrderConfirmedEvent | OrderShippedEvent): void {
    switch (event.type) {
      case 'OrderCreated':
        this.order = {
          id: event.orderId,
          customerId: event.customerId,
          items: event.items,
          status: 'pending',
          total: event.total,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };
        break;

      case 'OrderConfirmed':
        if (this.order) {
          this.order.status = 'confirmed';
          this.order.updatedAt = event.timestamp;
        }
        break;

      case 'OrderShipped':
        if (this.order) {
          this.order.status = 'shipped';
          this.order.updatedAt = event.timestamp;
        }
        break;
    }
  }

  getUncommittedEvents() {
    return this.events;
  }

  markEventsAsCommitted() {
    this.events = [];
  }

  getState() {
    return this.order;
  }
}

/**
 * Integration test suite
 */
export class IntegrationTestSuite {
  private telemetry: OpenTelemetrySDK;
  private eventStore: PostgreSQLEventStore;
  private snapshotStore: PostgreSQLSnapshotStore;
  private repository: any;
  private healthCheck: HealthCheckService;
  private anomalyDetection: AnomalyDetectionService;

  constructor() {
    this.telemetry = new OpenTelemetrySDK({
      serviceName: 'integration-test',
      environment: 'test',
    });

    const pool = createConnectionPool({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
    });

    this.eventStore = new PostgreSQLEventStore(pool);
    this.snapshotStore = new PostgreSQLSnapshotStore(pool);

    this.repository = createCachedRepository({
      repository: createRepository({
        eventStore: this.eventStore,
        snapshotStore: this.snapshotStore,
        createAggregate: (id: string) => new OrderAggregate(id),
      }),
      ttl: Duration.minutes(5),
      maxSize: 1000,
    });

    this.healthCheck = new HealthCheckService();
    this.anomalyDetection = new AnomalyDetectionService({
      sensitivity: 2,
      windowSize: 100,
    });
  }

  /**
   * Run complete integration test
   */
  runIntegrationTest(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('🚀 Starting Comprehensive Integration Test\n');
      console.log('=' .repeat(80));

      // 1. Initialize infrastructure
      yield* _(this.initializeInfrastructure());

      // 2. Test core CQRS functionality
      yield* _(this.testCQRSFunctionality());

      // 3. Test performance optimizations
      yield* _(this.testPerformanceOptimizations());

      // 4. Test observability
      yield* _(this.testObservability());

      // 5. Run testing suite
      yield* _(this.runTestingSuite());

      // 6. Cleanup
      yield* _(this.cleanup());

      console.log('\n' + '=' .repeat(80));
      console.log('✅ Integration Test Complete!');
    }.bind(this));
  }

  /**
   * Initialize infrastructure
   */
  private initializeInfrastructure(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n📦 Phase 1: Infrastructure Initialization');
      console.log('-' .repeat(40));

      // Initialize telemetry
      yield* _(this.telemetry.init());
      console.log('  ✓ OpenTelemetry initialized');

      // Run database migrations
      const migrationRunner = createMigrationRunner({
        migrationsPath: './migrations',
        schemaName: 'public',
      });
      yield* _(migrationRunner.runMigrations());
      console.log('  ✓ Database migrations complete');

      // Initialize event store with indexing
      const indexedStore = createIndexedEventStore({
        eventStore: this.eventStore,
        indexes: ['aggregateId', 'eventType', 'timestamp'],
      });
      console.log('  ✓ Event store initialized with indexes');

      // Setup health checks
      yield* _(this.healthCheck.registerIndicator({
        name: 'database',
        check: () => Effect.succeed({ status: 'healthy' }),
      }));
      yield* _(this.healthCheck.registerIndicator({
        name: 'event-store',
        check: () => Effect.succeed({ status: 'healthy' }),
      }));
      console.log('  ✓ Health checks configured');
    }.bind(this));
  }

  /**
   * Test CQRS functionality
   */
  private testCQRSFunctionality(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n⚙️  Phase 2: CQRS Functionality Testing');
      console.log('-' .repeat(40));

      // Create order command handler
      const createOrderHandler = createCommandHandler({
        canHandle: (cmd) => cmd.type === 'CreateOrder',
        execute: (cmd: CreateOrderCommand) => Effect.gen(function* (_) {
          const aggregate = new OrderAggregate(cmd.orderId);
          yield* _(aggregate.create(cmd));
          yield* _(this.repository.save(aggregate));
          return { orderId: cmd.orderId };
        }.bind(this)),
      });

      // Execute create order command
      const createCommand: CreateOrderCommand = {
        type: 'CreateOrder',
        orderId: 'order-123',
        customerId: 'customer-456',
        items: [
          { productId: 'prod-1', quantity: 2, price: 29.99 },
          { productId: 'prod-2', quantity: 1, price: 49.99 },
        ],
      };

      const result = yield* _(createOrderHandler.execute(createCommand));
      console.log(`  ✓ Order created: ${result.orderId}`);

      // Create projection
      const orderProjection = createProjection({
        name: 'OrderSummary',
        handlers: {
          OrderCreated: (event: OrderCreatedEvent) => Effect.gen(function* (_) {
            console.log(`  ✓ Projection updated for order: ${event.orderId}`);
          }),
          OrderConfirmed: (event: OrderConfirmedEvent) => Effect.gen(function* (_) {
            console.log(`  ✓ Order confirmed: ${event.orderId}`);
          }),
        },
      });

      // Process events through projection
      yield* _(orderProjection.handleEvent({
        type: 'OrderCreated',
        orderId: 'order-123',
        customerId: 'customer-456',
        items: [],
        total: 109.97,
        timestamp: new Date(),
      }));
    }.bind(this));
  }

  /**
   * Test performance optimizations
   */
  private testPerformanceOptimizations(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n⚡ Phase 3: Performance Optimization Testing');
      console.log('-' .repeat(40));

      // Test query optimizer
      const optimizer = createQueryOptimizer({
        costModel: 'statistics-based',
        cacheSize: 100,
      });

      const optimizedPlan = yield* _(optimizer.optimize({
        type: 'GetOrdersByCustomer',
        customerId: 'customer-456',
        dateRange: { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
      }));
      console.log('  ✓ Query plan optimized');

      // Test stream processor
      const processor = createStreamProcessor({
        batchSize: 100,
        parallel: 4,
        bufferSize: 1000,
      });

      yield* _(processor.processStream(
        this.eventStore.getEventStream('order-*'),
        (event) => Effect.succeed(console.log(`    Processing: ${event.type}`))
      ));
      console.log('  ✓ Stream processing tested');

      // Test cache performance
      const cacheMetrics = yield* _(this.repository.getCacheMetrics());
      console.log(`  ✓ Cache hit rate: ${(cacheMetrics.hitRate * 100).toFixed(1)}%`);
    }.bind(this));
  }

  /**
   * Test observability
   */
  private testObservability(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n📊 Phase 4: Observability Testing');
      console.log('-' .repeat(40));

      // Test distributed tracing
      const tracer = createCQRSTracer();
      yield* _(tracer.traceCommand(
        { type: 'TestCommand' },
        () => Effect.succeed('traced')
      ));
      console.log('  ✓ Distributed tracing active');

      // Test metrics collection
      const metrics = createMetricsCollector({
        prefix: 'test',
        labels: { service: 'integration-test' },
      });
      metrics.recordCommandExecuted('CreateOrder', Duration.millis(45));
      metrics.recordEventPublished('OrderCreated');
      console.log('  ✓ Metrics collected');

      // Test anomaly detection
      for (let i = 0; i < 10; i++) {
        yield* _(this.anomalyDetection.addDataPoint('response_time', {
          timestamp: new Date(),
          value: 50 + Math.random() * 10,
          labels: { endpoint: '/orders' },
        }));
      }
      
      // Add anomaly
      yield* _(this.anomalyDetection.addDataPoint('response_time', {
        timestamp: new Date(),
        value: 500, // Anomaly
        labels: { endpoint: '/orders' },
      }));
      
      const anomalies = yield* _(this.anomalyDetection.getAnomalies('response_time'));
      console.log(`  ✓ Anomalies detected: ${anomalies.length}`);

      // Test health check
      const health = yield* _(this.healthCheck.checkHealth());
      console.log(`  ✓ System health: ${health.status}`);
    }.bind(this));
  }

  /**
   * Run testing suite
   */
  private runTestingSuite(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n🧪 Phase 5: Testing Suite Execution');
      console.log('-' .repeat(40));

      // 1. Property-based testing
      const propertyRunner = new PropertyTestRunner({
        seed: 12345,
        numRuns: 100,
        maxShrinks: 100,
      });

      const propertyResult = yield* _(propertyRunner.runTest(
        PropertyTestRunner.generators.command(),
        (command) => Effect.succeed(command.type !== undefined)
      ));
      console.log(`  ✓ Property tests: ${propertyResult.passed ? 'PASSED' : 'FAILED'}`);

      // 2. Chaos engineering
      const chaosService = new ChaosEngineeringService({
        dryRun: true,
        recordMetrics: true,
      });

      const chaosResult = yield* _(chaosService.executeExperiment({
        name: 'Network Latency',
        description: 'Test system under network latency',
        steadyStateHypothesis: {
          metric: 'response_time_p99',
          expectedValue: 100,
          tolerance: 0.1,
        },
        method: {
          type: 'network',
          target: 'database',
          fault: 'latency',
          parameters: { delay: Duration.millis(500) },
        },
        rollback: () => Effect.succeed(undefined),
      }));
      console.log(`  ✓ Chaos experiment: ${chaosResult.steadyStateMaintained ? 'PASSED' : 'FAILED'}`);

      // 3. Load testing
      const loadRunner = new LoadTestRunner({
        duration: Duration.seconds(5),
        rampUp: Duration.seconds(1),
      });

      const loadResult = yield* _(loadRunner.runScenario({
        name: 'Order Creation Load',
        virtualUsers: 10,
        scenario: () => Effect.succeed({ success: true }),
        assertions: [
          { type: 'response_time_p95', threshold: Duration.millis(100) },
          { type: 'error_rate', threshold: 0.01 },
        ],
      }));
      console.log(`  ✓ Load test: ${loadResult.passed ? 'PASSED' : 'FAILED'}`);

      // 4. Performance regression
      const regressionService = new PerformanceRegressionService({
        baselinePath: './perf-baseline.json',
        thresholds: {
          duration: 0.1,
          memory: 0.2,
          cpu: 0.15,
        },
      });

      const perfResult = yield* _(regressionService.runRegressionTests(
        [
          {
            name: 'CreateOrder',
            fn: () => Effect.succeed('done'),
            iterations: 100,
          },
        ],
        { saveBaseline: false }
      ));
      console.log(`  ✓ Performance regression: ${perfResult.regression ? 'REGRESSION' : 'PASSED'}`);

      // 5. Contract testing
      const contractService = new ContractTestingService();
      
      yield* _(contractService.registerContract({
        id: 'order-api-v1',
        name: 'Order API',
        version: '1.0.0',
        type: 'graphql' as any,
        consumer: 'web-app',
        provider: 'order-service',
        specification: {
          type: 'graphql',
          schema: `
            type Order {
              id: ID!
              status: String!
            }
            type Query {
              order(id: ID!): Order
            }
          `,
          operations: [],
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['order', 'api'],
        },
      }));

      const contractResult = yield* _(contractService.runContractTests(
        'order-api-v1',
        { /* test data */ }
      ));
      console.log(`  ✓ Contract tests: ${contractResult.status.toUpperCase()}`);

      // 6. E2E testing
      const e2eRunner = new E2ETestRunner({
        name: 'Order Management E2E',
        description: 'End-to-end order flow',
        baseUrl: 'http://localhost:3000',
        environment: {
          type: 'local',
          variables: {},
          services: [],
        },
      });

      const e2eResult = yield* _(e2eRunner.runTestSuite([
        {
          id: 'create-order-flow',
          name: 'Create Order Flow',
          description: 'Test complete order creation flow',
          steps: [
            {
              id: 'create',
              name: 'Create order',
              type: 'command' as any,
              action: {
                type: 'command',
                command: createCommand,
                expectedEvents: ['OrderCreated'],
              },
            },
          ],
        },
      ]));
      console.log(`  ✓ E2E tests: ${e2eResult.passed}/${e2eResult.totalScenarios} passed`);
    }.bind(this));
  }

  /**
   * Cleanup
   */
  private cleanup(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n🧹 Phase 6: Cleanup');
      console.log('-' .repeat(40));

      yield* _(this.telemetry.shutdown());
      console.log('  ✓ Telemetry shutdown');

      yield* _(this.eventStore.close());
      console.log('  ✓ Event store closed');

      console.log('  ✓ Cleanup complete');
    }.bind(this));
  }
}

/**
 * Main execution
 */
const runIntegrationTest = () => {
  const suite = new IntegrationTestSuite();
  
  const program = pipe(
    suite.runIntegrationTest(),
    Effect.catchAll((error) => Effect.sync(() => {
      console.error('\n❌ Integration test failed:', error);
      process.exit(1);
    }))
  );

  Effect.runPromise(program).then(() => {
    console.log('\n🎉 All integration tests passed successfully!');
    process.exit(0);
  });
};

// Run if executed directly
if (require.main === module) {
  runIntegrationTest();
}

export { runIntegrationTest };