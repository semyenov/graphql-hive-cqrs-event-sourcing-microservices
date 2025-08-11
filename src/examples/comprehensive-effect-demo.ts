/**
 * Comprehensive Effect Demo
 * 
 * Demonstrates all Phase 2 Effect patterns in action:
 * - Effect operators and combinators
 * - Streaming with backpressure
 * - Advanced error handling and saga patterns
 * - Transactional outbox
 * - OpenTelemetry integration
 * - Context propagation
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Queue from 'effect/Queue';
import * as Fiber from 'effect/Fiber';
import { pipe } from 'effect/Function';
import { randomUUID } from 'crypto';

// Import framework modules
import {
  // Core types
  type ICommand,
  type IEvent,
  type IQuery,
  BrandedTypes,
  
  // Effect modules
  createCommandHandler,
  createEventHandler,
  createRepository,
  
  // Operators
  retryWithBackoff,
  withCircuitBreaker,
  withTimeout,
  mapError,
  fold,
  
  // Streaming
  createEventStream,
  createStreamingProjection,
  
  // Error handling
  DeadLetterQueue,
  CompensatingTransaction,
  ErrorBoundary,
  
  // Outbox pattern
  createTransactionalOutbox,
  createInMemoryPublisher,
  createInMemoryOutboxStore,
  
  // Telemetry
  createCQRSMetricsCollector,
  TracingHelpers,
  withDistributedContext,
  createCorrelationContext,
  createTraceContext,
} from '@cqrs/framework/effect';

// ============================================================================
// Domain: Order Processing System
// ============================================================================

// Commands
interface CreateOrderCommand extends ICommand {
  type: 'CreateOrder';
  payload: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  };
}

interface ProcessPaymentCommand extends ICommand {
  type: 'ProcessPayment';
  payload: {
    orderId: string;
    amount: number;
    paymentMethod: string;
  };
}

interface ShipOrderCommand extends ICommand {
  type: 'ShipOrder';
  payload: {
    orderId: string;
    address: string;
  };
}

// Events
interface OrderCreatedEvent extends IEvent {
  type: 'OrderCreated';
  data: {
    orderId: string;
    customerId: string;
    total: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
  };
}

interface PaymentProcessedEvent extends IEvent {
  type: 'PaymentProcessed';
  data: {
    orderId: string;
    amount: number;
    transactionId: string;
  };
}

interface OrderShippedEvent extends IEvent {
  type: 'OrderShipped';
  data: {
    orderId: string;
    trackingNumber: string;
    estimatedDelivery: Date;
  };
}

interface OrderFailedEvent extends IEvent {
  type: 'OrderFailed';
  data: {
    orderId: string;
    reason: string;
    failedAt: string;
  };
}

type OrderEvent = OrderCreatedEvent | PaymentProcessedEvent | OrderShippedEvent | OrderFailedEvent;

// ============================================================================
// Demo Implementation
// ============================================================================

async function runComprehensiveDemo() {
  console.log('🚀 Comprehensive Effect Demo');
  console.log('=' .repeat(60));
  
  // ============================================================================
  // 1. Setup telemetry and metrics
  // ============================================================================
  console.log('\n📊 Setting up telemetry...');
  
  const program = Effect.gen(function* (_) {
    // Create metrics collector
    const metrics = yield* _(createCQRSMetricsCollector());
    
    // Create distributed context
    const context = {
      trace: createTraceContext(),
      correlation: createCorrelationContext('demo-session'),
    };
    
    // ============================================================================
    // 2. Setup transactional outbox
    // ============================================================================
    console.log('\n📮 Setting up transactional outbox...');
    
    const outboxStore = yield* _(createInMemoryOutboxStore());
    const publisher = yield* _(createInMemoryPublisher());
    const outbox = yield* _(createTransactionalOutbox(
      outboxStore,
      publisher,
      { pollInterval: 1000, batchSize: 10 }
    ));
    
    // Start outbox processor
    yield* _(outbox.processor.start());
    
    // ============================================================================
    // 3. Command handlers with resilience patterns
    // ============================================================================
    console.log('\n⚡ Creating command handlers...');
    
    const createOrderHandler = createCommandHandler({
      canHandle: (cmd): cmd is CreateOrderCommand => cmd.type === 'CreateOrder',
      execute: (cmd) =>
        pipe(
          Effect.gen(function* (_) {
            console.log('  Processing CreateOrder command...');
            
            // Simulate order validation
            yield* _(Effect.sleep(Duration.millis(100)));
            
            const orderId = BrandedTypes.aggregateId(randomUUID());
            const event: OrderCreatedEvent = {
              type: 'OrderCreated',
              id: BrandedTypes.eventId(randomUUID()),
              aggregateId: orderId,
              aggregateVersion: BrandedTypes.aggregateVersion(1),
              timestamp: BrandedTypes.timestamp(),
              data: {
                orderId: orderId,
                customerId: cmd.payload.customerId,
                total: cmd.payload.items.reduce((sum, item) => 
                  sum + item.price * item.quantity, 0),
                items: cmd.payload.items,
              },
            };
            
            // Record metrics
            yield* _(metrics.recordCommand(cmd, 100, true));
            yield* _(metrics.recordEvent(event, false));
            
            return event;
          }),
          // Add resilience patterns
          retryWithBackoff({ maxAttempts: 3, delay: 100 }),
          withTimeout(5000),
          withCircuitBreaker({
            failureThreshold: 3,
            timeout: Duration.seconds(10),
            resetTimeout: Duration.seconds(30),
          })
        ),
    });
    
    // ============================================================================
    // 4. Saga orchestration for order processing
    // ============================================================================
    console.log('\n🎭 Setting up order processing saga...');
    
    const orderProcessingSaga = (orderId: string) =>
      CompensatingTransaction.saga([
        {
          name: 'reserve-inventory',
          action: Effect.gen(function* (_) {
            console.log('  Reserving inventory...');
            yield* _(Effect.sleep(Duration.millis(200)));
            return { reserved: true };
          }),
          compensate: () =>
            Effect.gen(function* (_) {
              console.log('  ⏮️ Releasing inventory reservation...');
              yield* _(Effect.sleep(Duration.millis(100)));
            }),
        },
        {
          name: 'process-payment',
          action: Effect.gen(function* (_) {
            console.log('  Processing payment...');
            yield* _(Effect.sleep(Duration.millis(300)));
            
            // Simulate 30% failure rate
            if (Math.random() < 0.3) {
              throw new Error('Payment declined');
            }
            
            return { transactionId: randomUUID() };
          }),
          compensate: () =>
            Effect.gen(function* (_) {
              console.log('  ⏮️ Refunding payment...');
              yield* _(Effect.sleep(Duration.millis(200)));
            }),
        },
        {
          name: 'ship-order',
          action: Effect.gen(function* (_) {
            console.log('  Arranging shipment...');
            yield* _(Effect.sleep(Duration.millis(150)));
            return { trackingNumber: `TRACK-${Date.now()}` };
          }),
          compensate: () =>
            Effect.gen(function* (_) {
              console.log('  ⏮️ Cancelling shipment...');
              yield* _(Effect.sleep(Duration.millis(100)));
            }),
        },
      ]);
    
    // ============================================================================
    // 5. Event streaming with backpressure
    // ============================================================================
    console.log('\n🌊 Setting up event streaming...');
    
    const eventQueue = yield* _(Queue.bounded<OrderEvent>(100));
    
    const eventStream = createEventStream<OrderEvent>({
      source: 'demo-stream',
      bufferSize: 50,
      backpressureStrategy: 'drop-oldest',
    });
    
    // Create streaming projection
    const orderProjection = createStreamingProjection<
      { totalOrders: number; totalRevenue: number; failedOrders: number },
      OrderEvent
    >({
      name: 'OrderStats',
      initialState: { totalOrders: 0, totalRevenue: 0, failedOrders: 0 },
      handlers: {
        OrderCreated: (state, event) =>
          Effect.succeed({
            ...state,
            totalOrders: state.totalOrders + 1,
            totalRevenue: state.totalRevenue + event.data.total,
          }),
        OrderFailed: (state) =>
          Effect.succeed({
            ...state,
            failedOrders: state.failedOrders + 1,
          }),
      },
      bufferSize: 100,
    });
    
    // ============================================================================
    // 6. Dead letter queue for failed messages
    // ============================================================================
    console.log('\n☠️ Setting up dead letter queue...');
    
    const deadLetterStore: Array<{ error: unknown; message: unknown }> = [];
    
    const processWithDeadLetter = DeadLetterQueue.withDeadLetter(
      3,
      (error, message) =>
        Effect.sync(() => {
          console.log(`  Message sent to dead letter: ${error}`);
          deadLetterStore.push({ error, message });
        })
    );
    
    // ============================================================================
    // 7. Execute demo scenario
    // ============================================================================
    console.log('\n🎬 Executing demo scenario...');
    console.log('-' .repeat(60));
    
    // Process multiple orders
    for (let i = 0; i < 5; i++) {
      console.log(`\n📦 Processing Order ${i + 1}:`);
      
      const createOrderCmd: CreateOrderCommand = {
        type: 'CreateOrder',
        id: BrandedTypes.commandId(randomUUID()),
        aggregateId: BrandedTypes.aggregateId(randomUUID()),
        timestamp: BrandedTypes.timestamp(),
        payload: {
          customerId: `customer-${i}`,
          items: [
            { productId: 'prod-1', quantity: 2, price: 29.99 },
            { productId: 'prod-2', quantity: 1, price: 49.99 },
          ],
        },
      };
      
      // Execute with distributed context
      const orderResult = yield* _(
        pipe(
          createOrderHandler.handle(createOrderCmd),
          withDistributedContext(context),
          TracingHelpers.traceCommand(createOrderCmd, (cmd) =>
            createOrderHandler.handle(cmd)
          ),
          Effect.either
        )
      );
      
      if (orderResult._tag === 'Right') {
        const event = orderResult.right;
        console.log(`  ✅ Order created: ${event.data.orderId}`);
        
        // Process order through saga
        const sagaResult = yield* _(
          pipe(
            orderProcessingSaga(event.data.orderId),
            processWithDeadLetter((saga) => saga),
            Effect.either
          )
        );
        
        if (sagaResult._tag === 'Right') {
          console.log('  ✅ Order processing completed successfully');
        } else {
          console.log(`  ❌ Order processing failed: ${sagaResult.left}`);
          
          // Send failure event
          const failureEvent: OrderFailedEvent = {
            type: 'OrderFailed',
            id: BrandedTypes.eventId(randomUUID()),
            aggregateId: event.aggregateId,
            aggregateVersion: BrandedTypes.aggregateVersion(2),
            timestamp: BrandedTypes.timestamp(),
            data: {
              orderId: event.data.orderId,
              reason: String(sagaResult.left),
              failedAt: 'payment',
            },
          };
          
          yield* _(Queue.offer(eventQueue, failureEvent));
        }
        
        // Add event to queue
        yield* _(Queue.offer(eventQueue, event));
      }
    }
    
    // ============================================================================
    // 8. Display results
    // ============================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('📈 Final Metrics:');
    
    const finalMetrics = yield* _(metrics.getCQRSMetrics());
    console.log('  Commands processed:', finalMetrics.commandsProcessed);
    console.log('  Commands failed:', finalMetrics.commandsFailed);
    console.log('  Events emitted:', finalMetrics.eventsEmitted);
    console.log('  Average command duration:', finalMetrics.averageCommandDuration.toFixed(2), 'ms');
    
    const processorMetrics = yield* _(outbox.processor.getMetrics());
    console.log('\n📮 Outbox Metrics:');
    console.log('  Messages processed:', processorMetrics.messagesProcessed);
    console.log('  Messages published:', processorMetrics.messagesPublished);
    console.log('  Messages failed:', processorMetrics.messagesFailed);
    
    console.log('\n☠️ Dead Letter Queue:');
    console.log('  Messages in DLQ:', deadLetterStore.length);
    
    // Stop outbox processor
    yield* _(outbox.processor.stop());
    
    console.log('\n✅ Demo completed successfully!');
  });
  
  // Run the program
  await Effect.runPromise(program);
}

// ============================================================================
// Run the demo
// ============================================================================
runDemo().catch(console.error);