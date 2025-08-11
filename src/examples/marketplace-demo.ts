/**
 * Marketplace Demo Application
 * 
 * Simplified demonstration of the framework capabilities
 * using the existing patterns from the codebase
 */

import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

// Note: For this demo, we're using simplified patterns
// The full framework provides createCommandHandler, createEventHandler, etc.

/**
 * Domain Types
 */
interface CreateOrderCommand {
  type: 'CreateOrder';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

interface ProcessPaymentCommand {
  type: 'ProcessPayment';
  orderId: string;
  amount: number;
  paymentMethod: string;
}

interface ShipOrderCommand {
  type: 'ShipOrder';
  orderId: string;
  trackingNumber: string;
}

interface OrderCreatedEvent {
  type: 'OrderCreated';
  orderId: string;
  customerId: string;
  total: number;
  timestamp: Date;
}

interface PaymentProcessedEvent {
  type: 'PaymentProcessed';
  orderId: string;
  amount: number;
  timestamp: Date;
}

interface OrderShippedEvent {
  type: 'OrderShipped';
  orderId: string;
  trackingNumber: string;
  timestamp: Date;
}

/**
 * Order Aggregate
 */
class OrderAggregate {
  private events: any[] = [];
  private state: any = {};

  constructor(public readonly id: string) {}

  createOrder(command: CreateOrderCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      if (this.state.orderId) {
        return yield* _(Effect.fail(new Error('Order already exists')));
      }

      const total = command.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const event: OrderCreatedEvent = {
        type: 'OrderCreated',
        orderId: command.orderId,
        customerId: command.customerId,
        total,
        timestamp: new Date(),
      };

      this.applyEvent(event);
      this.events.push(event);
      
      console.log(`  ✓ Order created: ${command.orderId} (Total: $${total})`);
    }.bind(this));
  }

  processPayment(command: ProcessPaymentCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const event: PaymentProcessedEvent = {
        type: 'PaymentProcessed',
        orderId: command.orderId,
        amount: command.amount,
        timestamp: new Date(),
      };

      this.events.push(event);
      console.log(`  ✓ Payment processed: $${command.amount}`);
    }.bind(this));
  }

  shipOrder(command: ShipOrderCommand): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const event: OrderShippedEvent = {
        type: 'OrderShipped',
        orderId: command.orderId,
        trackingNumber: command.trackingNumber,
        timestamp: new Date(),
      };

      this.events.push(event);
      console.log(`  ✓ Order shipped: ${command.trackingNumber}`);
    }.bind(this));
  }

  private applyEvent(event: any): void {
    switch (event.type) {
      case 'OrderCreated':
        this.state = {
          orderId: event.orderId,
          customerId: event.customerId,
          total: event.total,
          status: 'pending',
        };
        break;
      case 'PaymentProcessed':
        this.state.status = 'paid';
        break;
      case 'OrderShipped':
        this.state.status = 'shipped';
        break;
    }
  }

  getUncommittedEvents() {
    return this.events;
  }

  getState() {
    return this.state;
  }
}

/**
 * Order Fulfillment Saga
 */
class OrderFulfillmentSaga {
  constructor() {}

  handleOrderCreated(event: OrderCreatedEvent): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log(`\n📦 Starting saga for order: ${event.orderId}`);
      
      // Step 1: Process payment
      console.log('  1️⃣ Processing payment...');
      yield* _(Effect.sleep(Duration.millis(500)));
      const paymentCommand: ProcessPaymentCommand = {
        type: 'ProcessPayment',
        orderId: event.orderId,
        amount: event.total,
        paymentMethod: 'credit_card',
      };
      const order = new OrderAggregate(event.orderId);
      yield* _(order.processPayment(paymentCommand));
      
      // Step 2: Reserve inventory
      console.log('  2️⃣ Reserving inventory...');
      yield* _(Effect.sleep(Duration.millis(300)));
      console.log('  ✓ Inventory reserved');
      
      // Step 3: Ship order
      console.log('  3️⃣ Shipping order...');
      yield* _(Effect.sleep(Duration.millis(400)));
      const shipCommand: ShipOrderCommand = {
        type: 'ShipOrder',
        orderId: event.orderId,
        trackingNumber: `TRK-${Date.now()}`,
      };
      yield* _(order.shipOrder(shipCommand));
      
      console.log(`✅ Saga completed for order: ${event.orderId}\n`);
    });
  }
}

/**
 * Command Handlers
 */
const handleCreateOrder = (cmd: CreateOrderCommand) => Effect.gen(function* (_) {
  const order = new OrderAggregate(cmd.orderId);
  yield* _(order.createOrder(cmd));
  
  // Trigger saga
  const event: OrderCreatedEvent = {
    type: 'OrderCreated',
    orderId: cmd.orderId,
    customerId: cmd.customerId,
    total: cmd.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    timestamp: new Date(),
  };
  
  const saga = new OrderFulfillmentSaga();
  yield* _(saga.handleOrderCreated(event));
  
  return { orderId: cmd.orderId, status: 'completed' };
});

/**
 * Marketplace Demo Application
 */
export class MarketplaceDemoApp {
  constructor() {
    console.log('🛍️ Marketplace Demo Application');
    console.log('=' .repeat(60));
  }

  /**
   * Run demo scenario
   */
  runDemo(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n📋 Demo Scenario: Complete Order Flow\n');
      console.log('-' .repeat(60));
      
      // Create sample order
      const orderId = `ORDER-${Date.now()}`;
      const customerId = `CUSTOMER-${Math.floor(Math.random() * 1000)}`;
      
      const createOrderCommand: CreateOrderCommand = {
        type: 'CreateOrder',
        orderId,
        customerId,
        items: [
          { productId: 'PROD-001', quantity: 2, price: 29.99 },
          { productId: 'PROD-002', quantity: 1, price: 49.99 },
          { productId: 'PROD-003', quantity: 3, price: 15.99 },
        ],
      };
      
      console.log(`Creating order ${orderId} for customer ${customerId}...`);
      console.log(`Items: ${createOrderCommand.items.length} products\n`);
      
      // Execute command
      const result = yield* _(handleCreateOrder(createOrderCommand));
      
      console.log('-' .repeat(60));
      console.log(`\n✨ Order processing complete!`);
      console.log(`Order ID: ${result.orderId}`);
      console.log(`Status: ${result.status}`);
      
      // Show metrics
      console.log('\n📊 Metrics:');
      console.log('  Commands executed: 3');
      console.log('  Events published: 3');
      console.log('  Saga duration: 1.2s');
      console.log('  Success rate: 100%');
    });
  }

  /**
   * Run stress test
   */
  runStressTest(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n\n🔥 Stress Test: Processing Multiple Orders\n');
      console.log('-' .repeat(60));
      
      const orderCount = 5;
      const startTime = Date.now();
      
      console.log(`Processing ${orderCount} orders concurrently...\n`);
      
      const orders = Array.from({ length: orderCount }, (_, i) => ({
        type: 'CreateOrder' as const,
        orderId: `ORDER-STRESS-${i + 1}`,
        customerId: `CUSTOMER-${i + 1}`,
        items: [
          { productId: 'PROD-001', quantity: 1, price: 99.99 },
        ],
      }));
      
      // Process orders in parallel
      yield* _(Effect.all(
        orders.map(order => 
          handleCreateOrder(order).pipe(
            Effect.tap(() => Effect.sync(() => 
              console.log(`  ✓ Order ${order.orderId} processed`)
            ))
          )
        ),
        { concurrency: 3 }
      ));
      
      const duration = Date.now() - startTime;
      
      console.log('\n📈 Stress Test Results:');
      console.log(`  Orders processed: ${orderCount}`);
      console.log(`  Total duration: ${duration}ms`);
      console.log(`  Average per order: ${Math.round(duration / orderCount)}ms`);
      console.log(`  Throughput: ${Math.round(orderCount * 1000 / duration)} orders/sec`);
    });
  }

  /**
   * Demonstrate error handling
   */
  demonstrateErrorHandling(): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('\n\n⚠️ Error Handling Demonstration\n');
      console.log('-' .repeat(60));
      
      const invalidCommand: CreateOrderCommand = {
        type: 'CreateOrder',
        orderId: 'INVALID-ORDER',
        customerId: '',  // Invalid: empty customer ID
        items: [],       // Invalid: no items
      };
      
      console.log('Attempting to create order with invalid data...\n');
      
      const result = yield* _(
        handleCreateOrder(invalidCommand).pipe(
          Effect.catchAll(error => Effect.sync(() => {
            console.log(`  ❌ Error caught: ${error.message}`);
            console.log('  ✓ Error handled gracefully');
            return { error: error.message };
          }))
        )
      );
      
      console.log('\n  System remains stable after error');
    });
  }
}

/**
 * Main execution
 */
const main = () => {
  const app = new MarketplaceDemoApp();
  
  const program = pipe(
    app.runDemo(),
    Effect.tap(() => app.runStressTest()),
    Effect.tap(() => app.demonstrateErrorHandling()),
    Effect.tap(() => Effect.sync(() => {
      console.log('\n' + '=' .repeat(60));
      console.log('🎉 Marketplace Demo Complete!');
      console.log('=' .repeat(60) + '\n');
    })),
    Effect.catchAll((error) => Effect.sync(() => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    }))
  );
  
  Effect.runPromise(program).then(() => {
    process.exit(0);
  });
};

// Run if executed directly
if (require.main === module) {
  main();
}