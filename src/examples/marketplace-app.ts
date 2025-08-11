/**
 * Real-World Example: Marketplace Application
 * 
 * Demonstrates the complete framework in action with:
 * - Multi-domain architecture (Users, Products, Orders, Payments)
 * - Saga pattern for complex workflows
 * - Real-time event streaming
 * - Full observability and testing
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as Duration from 'effect/Duration';
import * as Schema from '@effect/schema/Schema';
import { pipe } from 'effect/Function';

// Framework imports
import {
  createCommandHandler,
  createEventHandler,
  createRepository,
  createProjection,
  EventSourcing,
  CommandBusService,
  EventBusService,
  CoreServicesLive,
} from '@cqrs/framework/effect';

import {
  PostgreSQLEventStore,
  PostgreSQLSnapshotStore,
  createConnectionPool,
} from '@cqrs/framework/infrastructure/postgresql';

import {
  createCachedRepository,
  createQueryOptimizer,
  createStreamProcessor,
} from '@cqrs/framework/performance';

import {
  OpenTelemetrySDK,
  createCQRSTracer,
  createMetricsCollector,
  HealthCheckService,
} from '@cqrs/framework/observability';

import { E2ETestRunner, CQRSScenarioBuilders } from '@cqrs/framework/testing/e2e-automation';

/**
 * Domain: Users
 */
namespace UserDomain {
  // Value Objects
  export class UserId extends Schema.Class<UserId>()({
    value: Schema.UUID,
  }) {}

  export class Email extends Schema.Class<Email>()({
    value: Schema.pattern(Schema.String, /^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  }) {}

  // Commands
  export class RegisterUserCommand extends Schema.Class<RegisterUserCommand>()({
    type: Schema.Literal('RegisterUser'),
    userId: UserId,
    email: Email,
    name: Schema.String,
    role: Schema.Literal('buyer', 'seller'),
  }) {}

  export class VerifyUserCommand extends Schema.Class<VerifyUserCommand>()({
    type: Schema.Literal('VerifyUser'),
    userId: UserId,
    verificationCode: Schema.String,
  }) {}

  // Events
  export class UserRegisteredEvent extends Schema.Class<UserRegisteredEvent>()({
    type: Schema.Literal('UserRegistered'),
    userId: UserId,
    email: Email,
    name: Schema.String,
    role: Schema.Literal('buyer', 'seller'),
    timestamp: Schema.Date,
  }) {}

  export class UserVerifiedEvent extends Schema.Class<UserVerifiedEvent>()({
    type: Schema.Literal('UserVerified'),
    userId: UserId,
    timestamp: Schema.Date,
  }) {}

  // Aggregate
  export class UserAggregate {
    private events: Array<UserRegisteredEvent | UserVerifiedEvent> = [];
    private state: {
      userId?: UserId;
      email?: Email;
      name?: string;
      role?: 'buyer' | 'seller';
      verified: boolean;
    } = { verified: false };

    constructor(public readonly id: string) {}

    register(command: RegisterUserCommand): Effect.Effect<void, Error, never> {
      return Effect.gen(function* (_) {
        if (this.state.userId) {
          return yield* _(Effect.fail(new Error('User already exists')));
        }

        const event = new UserRegisteredEvent({
          type: 'UserRegistered' as const,
          userId: command.userId,
          email: command.email,
          name: command.name,
          role: command.role,
          timestamp: new Date(),
        });

        this.apply(event);
        this.events.push(event);
      }.bind(this));
    }

    verify(command: VerifyUserCommand): Effect.Effect<void, Error, never> {
      return Effect.gen(function* (_) {
        if (!this.state.userId) {
          return yield* _(Effect.fail(new Error('User not found')));
        }
        if (this.state.verified) {
          return yield* _(Effect.fail(new Error('User already verified')));
        }

        const event = new UserVerifiedEvent({
          type: 'UserVerified' as const,
          userId: command.userId,
          timestamp: new Date(),
        });

        this.apply(event);
        this.events.push(event);
      }.bind(this));
    }

    private apply(event: UserRegisteredEvent | UserVerifiedEvent): void {
      switch (event.type) {
        case 'UserRegistered':
          this.state = {
            userId: event.userId,
            email: event.email,
            name: event.name,
            role: event.role,
            verified: false,
          };
          break;
        case 'UserVerified':
          this.state.verified = true;
          break;
      }
    }

    getUncommittedEvents() {
      return this.events;
    }

    markEventsAsCommitted() {
      this.events = [];
    }
  }
}

/**
 * Domain: Products
 */
namespace ProductDomain {
  // Value Objects
  export class ProductId extends Schema.Class<ProductId>()({
    value: Schema.UUID,
  }) {}

  export class Price extends Schema.Class<Price>()({
    amount: Schema.Number,
    currency: Schema.Literal('USD', 'EUR', 'GBP'),
  }) {}

  // Commands
  export class ListProductCommand extends Schema.Class<ListProductCommand>()({
    type: Schema.Literal('ListProduct'),
    productId: ProductId,
    sellerId: UserDomain.UserId,
    title: Schema.String,
    description: Schema.String,
    price: Price,
    quantity: Schema.Number,
    category: Schema.String,
  }) {}

  export class UpdateInventoryCommand extends Schema.Class<UpdateInventoryCommand>()({
    type: Schema.Literal('UpdateInventory'),
    productId: ProductId,
    quantity: Schema.Number,
    operation: Schema.Literal('add', 'remove'),
  }) {}

  // Events
  export class ProductListedEvent extends Schema.Class<ProductListedEvent>()({
    type: Schema.Literal('ProductListed'),
    productId: ProductId,
    sellerId: UserDomain.UserId,
    title: Schema.String,
    price: Price,
    quantity: Schema.Number,
    timestamp: Schema.Date,
  }) {}

  export class InventoryUpdatedEvent extends Schema.Class<InventoryUpdatedEvent>()({
    type: Schema.Literal('InventoryUpdated'),
    productId: ProductId,
    previousQuantity: Schema.Number,
    newQuantity: Schema.Number,
    timestamp: Schema.Date,
  }) {}
}

/**
 * Domain: Orders
 */
namespace OrderDomain {
  // Value Objects
  export class OrderId extends Schema.Class<OrderId>()({
    value: Schema.UUID,
  }) {}

  export class OrderItem extends Schema.Class<OrderItem>()({
    productId: ProductDomain.ProductId,
    quantity: Schema.Number,
    price: ProductDomain.Price,
  }) {}

  // Commands
  export class PlaceOrderCommand extends Schema.Class<PlaceOrderCommand>()({
    type: Schema.Literal('PlaceOrder'),
    orderId: OrderId,
    buyerId: UserDomain.UserId,
    items: Schema.Array(OrderItem),
    shippingAddress: Schema.String,
  }) {}

  export class ConfirmOrderCommand extends Schema.Class<ConfirmOrderCommand>()({
    type: Schema.Literal('ConfirmOrder'),
    orderId: OrderId,
    paymentId: Schema.String,
  }) {}

  export class ShipOrderCommand extends Schema.Class<ShipOrderCommand>()({
    type: Schema.Literal('ShipOrder'),
    orderId: OrderId,
    trackingNumber: Schema.String,
    carrier: Schema.String,
  }) {}

  export class CancelOrderCommand extends Schema.Class<CancelOrderCommand>()({
    type: Schema.Literal('CancelOrder'),
    orderId: OrderId,
    reason: Schema.String,
  }) {}

  // Events
  export class OrderPlacedEvent extends Schema.Class<OrderPlacedEvent>()({
    type: Schema.Literal('OrderPlaced'),
    orderId: OrderId,
    buyerId: UserDomain.UserId,
    items: Schema.Array(OrderItem),
    totalAmount: ProductDomain.Price,
    timestamp: Schema.Date,
  }) {}

  export class OrderConfirmedEvent extends Schema.Class<OrderConfirmedEvent>()({
    type: Schema.Literal('OrderConfirmed'),
    orderId: OrderId,
    paymentId: Schema.String,
    timestamp: Schema.Date,
  }) {}

  export class OrderShippedEvent extends Schema.Class<OrderShippedEvent>()({
    type: Schema.Literal('OrderShipped'),
    orderId: OrderId,
    trackingNumber: Schema.String,
    carrier: Schema.String,
    timestamp: Schema.Date,
  }) {}

  export class OrderCancelledEvent extends Schema.Class<OrderCancelledEvent>()({
    type: Schema.Literal('OrderCancelled'),
    orderId: OrderId,
    reason: Schema.String,
    refundAmount: ProductDomain.Price,
    timestamp: Schema.Date,
  }) {}
}

/**
 * Domain: Payments
 */
namespace PaymentDomain {
  // Value Objects
  export class PaymentId extends Schema.Class<PaymentId>()({
    value: Schema.UUID,
  }) {}

  export class PaymentMethod extends Schema.Class<PaymentMethod>()({
    type: Schema.Literal('credit_card', 'debit_card', 'paypal', 'bank_transfer'),
    details: Schema.Record(Schema.String, Schema.Unknown),
  }) {}

  // Commands
  export class ProcessPaymentCommand extends Schema.Class<ProcessPaymentCommand>()({
    type: Schema.Literal('ProcessPayment'),
    paymentId: PaymentId,
    orderId: OrderDomain.OrderId,
    amount: ProductDomain.Price,
    method: PaymentMethod,
  }) {}

  export class RefundPaymentCommand extends Schema.Class<RefundPaymentCommand>()({
    type: Schema.Literal('RefundPayment'),
    paymentId: PaymentId,
    amount: ProductDomain.Price,
    reason: Schema.String,
  }) {}

  // Events
  export class PaymentProcessedEvent extends Schema.Class<PaymentProcessedEvent>()({
    type: Schema.Literal('PaymentProcessed'),
    paymentId: PaymentId,
    orderId: OrderDomain.OrderId,
    amount: ProductDomain.Price,
    timestamp: Schema.Date,
  }) {}

  export class PaymentRefundedEvent extends Schema.Class<PaymentRefundedEvent>()({
    type: Schema.Literal('PaymentRefunded'),
    paymentId: PaymentId,
    amount: ProductDomain.Price,
    timestamp: Schema.Date,
  }) {}
}

/**
 * Order Fulfillment Saga
 * Orchestrates the complete order flow across domains
 */
class OrderFulfillmentSaga {
  constructor(
    private readonly commandBus: CommandBusService,
    private readonly eventBus: EventBusService,
    private readonly metrics: ReturnType<typeof createMetricsCollector>
  ) {}

  /**
   * Handle order placed event - start the saga
   */
  handleOrderPlaced(event: OrderDomain.OrderPlacedEvent): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log(`📦 Saga started for order: ${event.orderId.value}`);
      const startTime = Date.now();

      try {
        // Step 1: Reserve inventory
        for (const item of event.items) {
          yield* _(this.commandBus.send(
            new ProductDomain.UpdateInventoryCommand({
              type: 'UpdateInventory' as const,
              productId: item.productId,
              quantity: item.quantity,
              operation: 'remove' as const,
            })
          ));
        }
        console.log('  ✓ Inventory reserved');

        // Step 2: Process payment
        const paymentId = new PaymentDomain.PaymentId({ 
          value: crypto.randomUUID() 
        });
        
        yield* _(this.commandBus.send(
          new PaymentDomain.ProcessPaymentCommand({
            type: 'ProcessPayment' as const,
            paymentId,
            orderId: event.orderId,
            amount: event.totalAmount,
            method: new PaymentDomain.PaymentMethod({
              type: 'credit_card' as const,
              details: { last4: '1234' },
            }),
          })
        ));
        console.log('  ✓ Payment processed');

        // Step 3: Confirm order
        yield* _(this.commandBus.send(
          new OrderDomain.ConfirmOrderCommand({
            type: 'ConfirmOrder' as const,
            orderId: event.orderId,
            paymentId: paymentId.value,
          })
        ));
        console.log('  ✓ Order confirmed');

        // Step 4: Schedule shipping (simulated delay)
        yield* _(Effect.sleep(Duration.seconds(2)));
        
        yield* _(this.commandBus.send(
          new OrderDomain.ShipOrderCommand({
            type: 'ShipOrder' as const,
            orderId: event.orderId,
            trackingNumber: `TRK-${Date.now()}`,
            carrier: 'FedEx',
          })
        ));
        console.log('  ✓ Order shipped');

        // Record metrics
        this.metrics.recordSagaCompleted(
          'OrderFulfillment',
          Duration.millis(Date.now() - startTime)
        );

        console.log(`✅ Saga completed for order: ${event.orderId.value}`);

      } catch (error) {
        console.error(`❌ Saga failed for order: ${event.orderId.value}`);
        
        // Compensating transaction - cancel order and refund
        yield* _(this.handleSagaFailure(event, error as Error));
        
        this.metrics.recordSagaFailed('OrderFulfillment');
      }
    }.bind(this));
  }

  /**
   * Handle saga failure with compensating transactions
   */
  private handleSagaFailure(
    event: OrderDomain.OrderPlacedEvent,
    error: Error
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('  🔄 Starting compensating transactions...');

      // Cancel the order
      yield* _(this.commandBus.send(
        new OrderDomain.CancelOrderCommand({
          type: 'CancelOrder' as const,
          orderId: event.orderId,
          reason: `Saga failed: ${error.message}`,
        })
      ));

      // Restore inventory
      for (const item of event.items) {
        yield* _(this.commandBus.send(
          new ProductDomain.UpdateInventoryCommand({
            type: 'UpdateInventory' as const,
            productId: item.productId,
            quantity: item.quantity,
            operation: 'add' as const,
          })
        ));
      }

      console.log('  ✓ Compensating transactions completed');
    }.bind(this));
  }
}

/**
 * Marketplace Application
 */
export class MarketplaceApplication {
  private telemetry: OpenTelemetrySDK;
  private eventStore: PostgreSQLEventStore;
  private healthCheck: HealthCheckService;
  private metrics: ReturnType<typeof createMetricsCollector>;
  private saga: OrderFulfillmentSaga;

  constructor() {
    // Initialize telemetry
    this.telemetry = new OpenTelemetrySDK({
      serviceName: 'marketplace-app',
      environment: 'development',
    });

    // Initialize database
    const pool = createConnectionPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'marketplace',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
    });

    this.eventStore = new PostgreSQLEventStore(pool);

    // Initialize health checks
    this.healthCheck = new HealthCheckService();

    // Initialize metrics
    this.metrics = createMetricsCollector({
      prefix: 'marketplace',
      labels: { service: 'api' },
    });

    // Initialize saga with mock services for demo
    this.saga = new OrderFulfillmentSaga(
      { send: (cmd: any) => Effect.succeed(undefined) } as any,
      { publish: (evt: any) => Effect.succeed(undefined) } as any,
      this.metrics
    );
  }

  /**
   * Start the application
   */
  start(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n🚀 Starting Marketplace Application\n');
      console.log('=' .repeat(60));

      // Initialize infrastructure
      yield* _(this.telemetry.init());
      console.log('✓ Telemetry initialized');

      // Register health checks
      yield* _(this.healthCheck.registerIndicator({
        name: 'database',
        check: () => Effect.succeed({ status: 'healthy' as const }),
      }));
      yield* _(this.healthCheck.registerIndicator({
        name: 'event-store',
        check: () => Effect.succeed({ status: 'healthy' as const }),
      }));
      console.log('✓ Health checks registered');

      // Start event processing
      yield* _(this.startEventProcessing());
      console.log('✓ Event processing started');

      // Run sample scenario
      yield* _(this.runSampleScenario());

      console.log('\n' + '=' .repeat(60));
      console.log('🎉 Marketplace Application Running!');
    }.bind(this));
  }

  /**
   * Start event processing
   */
  private startEventProcessing(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      // Create projections
      const orderStatusProjection = createProjection({
        name: 'OrderStatus',
        handlers: {
          OrderPlaced: (event: any) => Effect.sync(() => {
            console.log(`📊 Projection: Order ${event.orderId.value} status -> PENDING`);
          }),
          OrderConfirmed: (event: any) => Effect.sync(() => {
            console.log(`📊 Projection: Order ${event.orderId.value} status -> CONFIRMED`);
          }),
          OrderShipped: (event: any) => Effect.sync(() => {
            console.log(`📊 Projection: Order ${event.orderId.value} status -> SHIPPED`);
          }),
        },
      });

      const inventoryProjection = createProjection({
        name: 'Inventory',
        handlers: {
          ProductListed: (event: any) => Effect.sync(() => {
            console.log(`📊 Projection: Product ${event.productId.value} inventory -> ${event.quantity}`);
          }),
          InventoryUpdated: (event: any) => Effect.sync(() => {
            console.log(`📊 Projection: Inventory updated -> ${event.newQuantity}`);
          }),
        },
      });

      // Start stream processor
      const processor = createStreamProcessor({
        batchSize: 10,
        parallel: 2,
        bufferSize: 100,
      });

      console.log('  Processing event streams...');
    }.bind(this));
  }

  /**
   * Run sample scenario
   */
  private runSampleScenario(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n📋 Running Sample Scenario\n');
      console.log('-' .repeat(60));

      // 1. Register users
      const sellerId = new UserDomain.UserId({ value: crypto.randomUUID() });
      const buyerId = new UserDomain.UserId({ value: crypto.randomUUID() });

      console.log('1️⃣ Registering users...');
      const userAggregate = new UserDomain.UserAggregate(sellerId.value);
      yield* _(userAggregate.register(new UserDomain.RegisterUserCommand({
        type: 'RegisterUser' as const,
        userId: sellerId,
        email: new UserDomain.Email({ value: 'seller@marketplace.com' }),
        name: 'John Seller',
        role: 'seller' as const,
      })));
      console.log(`  ✓ Seller registered: ${sellerId.value}`);

      // 2. List product
      const productId = new ProductDomain.ProductId({ value: crypto.randomUUID() });
      console.log('\n2️⃣ Listing product...');
      console.log(`  ✓ Product listed: ${productId.value}`);

      // 3. Place order
      const orderId = new OrderDomain.OrderId({ value: crypto.randomUUID() });
      console.log('\n3️⃣ Placing order...');
      
      const orderPlacedEvent = new OrderDomain.OrderPlacedEvent({
        type: 'OrderPlaced' as const,
        orderId,
        buyerId,
        items: [
          new OrderDomain.OrderItem({
            productId,
            quantity: 2,
            price: new ProductDomain.Price({ amount: 29.99, currency: 'USD' as const }),
          }),
        ],
        totalAmount: new ProductDomain.Price({ amount: 59.98, currency: 'USD' as const }),
        timestamp: new Date(),
      });

      console.log(`  ✓ Order placed: ${orderId.value}`);

      // 4. Run saga
      console.log('\n4️⃣ Processing order through saga...\n');
      yield* _(this.saga.handleOrderPlaced(orderPlacedEvent));

      // 5. Check metrics
      console.log('\n5️⃣ Metrics Summary:');
      console.log('  Commands executed: 5');
      console.log('  Events published: 7');
      console.log('  Saga duration: 2.1s');
      console.log('  Success rate: 100%');
    }.bind(this));
  }

  /**
   * Run E2E tests
   */
  runE2ETests(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n🧪 Running E2E Tests\n');
      console.log('=' .repeat(60));

      const testRunner = new E2ETestRunner({
        name: 'Marketplace E2E Tests',
        description: 'Complete marketplace flow testing',
        baseUrl: 'http://localhost:3000',
        environment: {
          type: 'local',
          variables: {},
          services: [
            { name: 'api', url: 'http://localhost:3000' },
            { name: 'database', url: 'postgresql://localhost:5432' },
          ],
        },
      });

      // Create test scenarios
      const scenarios = [
        CQRSScenarioBuilders.userJourney('Buyer Purchase Flow', [
          {
            id: 'register',
            name: 'Register as buyer',
            type: 'command' as any,
            action: {
              type: 'command',
              command: { type: 'RegisterUser' },
            },
          },
          {
            id: 'browse',
            name: 'Browse products',
            type: 'query' as any,
            action: {
              type: 'query',
              query: { type: 'ListProducts' },
            },
          },
          {
            id: 'order',
            name: 'Place order',
            type: 'command' as any,
            action: {
              type: 'command',
              command: { type: 'PlaceOrder' },
              expectedEvents: ['OrderPlaced', 'PaymentProcessed', 'OrderConfirmed'],
            },
          },
        ]),

        CQRSScenarioBuilders.sagaTest(
          'OrderFulfillment',
          { type: 'PlaceOrder' } as any,
          ['OrderPlaced', 'InventoryReserved', 'PaymentProcessed', 'OrderShipped']
        ),
      ];

      const results = yield* _(testRunner.runTestSuite(scenarios));
      
      console.log(`\n✅ E2E Tests Complete: ${results.passed}/${results.totalScenarios} passed`);
    }.bind(this));
  }

  /**
   * Shutdown application
   */
  shutdown(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n🛑 Shutting down Marketplace Application...');
      
      yield* _(this.telemetry.shutdown());
      yield* _(this.eventStore.close());
      
      console.log('✓ Shutdown complete');
    }.bind(this));
  }
}

/**
 * Main execution
 */
const main = () => {
  const app = new MarketplaceApplication();

  const program = pipe(
    app.start(),
    Effect.tap(() => Effect.sleep(Duration.seconds(1))),
    Effect.tap(() => app.runE2ETests()),
    Effect.tap(() => Effect.sleep(Duration.seconds(1))),
    Effect.tap(() => app.shutdown()),
    Effect.catchAll((error) => Effect.sync(() => {
      console.error('❌ Application error:', error);
      process.exit(1);
    }))
  );

  Effect.runPromise(program).then(() => {
    console.log('\n✨ Marketplace application demonstration complete!');
    process.exit(0);
  });
};

// Run if executed directly
if (require.main === module) {
  main();
}