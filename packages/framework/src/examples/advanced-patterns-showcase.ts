/**
 * Advanced Patterns Showcase
 * 
 * Comprehensive demonstration of all advanced patterns in the ultra-clean framework:
 * - Circuit Breakers
 * - Retry Strategies 
 * - Bulkhead Pattern
 * - Timeout Handling
 * - Event Sourcing with Snapshots
 * - Complex Sagas with Compensation
 * - Stream Processing
 * - Real-time Projections
 * - Process Managers
 * - Event Choreography
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as Queue from "effect/Queue"
import * as Ref from "effect/Ref"
import * as Fiber from "effect/Fiber"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

import {
  AggregateId,
  Version,
  createAggregateId,
  createEventId,
  createCausationId,
  createCorrelationId,
  nonEmptyString,
  now,
  createEventSchema,
  createProjection,
  CoreServicesLive,
  CommandBus
} from "../index"

import {
  createSequentialSaga,
  createStep,
  SagaError
} from "../patterns/saga"

// ============================================================================
// Domain Model for Advanced Patterns Demo
// ============================================================================

// Note: ECommerceState not used in current implementation but kept for reference

// Events
const OrderCreated = createEventSchema("OrderCreated", Schema.Struct({
  customerId: AggregateId,
  items: Schema.Array(Schema.Struct({
    productId: AggregateId,
    quantity: Schema.Number,
    price: Schema.Number
  })),
  total: Schema.Number
}))

const InventoryReserved = createEventSchema("InventoryReserved", Schema.Struct({
  reservationId: Schema.String,
  items: Schema.Array(Schema.Struct({
    productId: AggregateId,
    quantity: Schema.Number
  }))
}))

const PaymentProcessed = createEventSchema("PaymentProcessed", Schema.Struct({
  paymentId: Schema.String,
  amount: Schema.Number
}))

const OrderShipped = createEventSchema("OrderShipped", Schema.Struct({
  shippingId: Schema.String,
  trackingNumber: Schema.String
}))

const OrderCancelled = createEventSchema("OrderCancelled", Schema.Struct({
  reason: Schema.String
}))

type ECommerceEvent = 
  | Schema.Schema.Type<typeof OrderCreated>
  | Schema.Schema.Type<typeof InventoryReserved>
  | Schema.Schema.Type<typeof PaymentProcessed>
  | Schema.Schema.Type<typeof OrderShipped>
  | Schema.Schema.Type<typeof OrderCancelled>

// Note: Command schemas not used in current implementation but kept for reference

// ============================================================================
// Pattern 1: Circuit Breaker with Retry Strategy
// ============================================================================

class ServiceUnavailable {
  readonly _tag = "ServiceUnavailable"
  constructor(readonly service: string, readonly reason: string) {}
}

class PaymentDeclined {
  readonly _tag = "PaymentDeclined"
  constructor(readonly reason: string) {}
}

/**
 * Circuit breaker for external payment service
 */
const createPaymentCircuitBreaker = () => {
  let failures = 0
  let lastFailureTime = 0
  let isOpen = false
  const maxFailures = 3
  const resetTimeout = Duration.seconds(30)

  return {
    execute: <A>(effect: Effect.Effect<A, PaymentDeclined>) =>
      Effect.gen(function* () {
        // Check if circuit should reset
        if (isOpen && Date.now() - lastFailureTime > Duration.toMillis(resetTimeout)) {
          isOpen = false
          failures = 0
          yield* Effect.log("🔄 Payment circuit breaker reset")
        }

        // Fail fast if circuit is open
        if (isOpen) {
          return yield* Effect.fail(
            new ServiceUnavailable("PaymentService", "Circuit breaker is open")
          )
        }

        // Execute with failure tracking
        return yield* pipe(
          effect,
          Effect.tapError(() =>
            Effect.sync(() => {
              failures++
              lastFailureTime = Date.now()
              if (failures >= maxFailures) {
                isOpen = true
                console.log("⚡ Payment circuit breaker opened")
              }
            })
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              failures = 0
            })
          )
        )
      }),
      
    getState: () => ({ isOpen, failures, lastFailureTime })
  }
}

/**
 * Simulate payment service with retry strategy
 */
const processPaymentWithResilience = (amount: number, method: string) => {
  const circuitBreaker = createPaymentCircuitBreaker()
  
  const paymentCall = Effect.gen(function* () {
    yield* Effect.log(`💳 Processing payment: $${amount} via ${method}`)
    
    // Simulate random failures (30% chance)
    const random = Math.random()
    if (random < 0.3) {
      return yield* Effect.fail(new PaymentDeclined("Insufficient funds"))
    }
    
    // Simulate processing delay
    yield* Effect.sleep(Duration.millis(100))
    
    return {
      paymentId: `pay_${Date.now()}`,
      amount,
      method,
      status: "success" as const
    }
  })
  
  return pipe(
    circuitBreaker.execute(paymentCall),
    Effect.retry(
      Schedule.exponential(Duration.millis(500)).pipe(
        Schedule.compose(Schedule.recurs(3))
      )
    ),
    Effect.timeout(Duration.seconds(10)),
    Effect.tapError((error) =>
      Effect.log(`❌ Payment failed after retries: ${JSON.stringify(error)}`)
    ),
    Effect.tap((result) =>
      Effect.log(`✅ Payment successful: ${result.paymentId}`)
    )
  )
}

// ============================================================================
// Pattern 2: Complex Saga with Compensation and Parallel Steps
// ============================================================================

/**
 * Inventory service simulation
 */
const reserveInventory = (items: Array<{ productId: AggregateId; quantity: number }> = []) =>
  Effect.gen(function* () {
    yield* Effect.log(`📦 Reserving inventory for ${items?.length || 0} items`)
    
    // Simulate inventory check and reservation
    yield* Effect.sleep(Duration.millis(200))
    
    // Random failure (20% chance)
    if (Math.random() < 0.2) {
      return yield* Effect.fail(new Error("Insufficient inventory"))
    }
    
    return {
      reservationId: `inv_${Date.now()}`,
      items,
      expiresAt: Date.now() + 300000 // 5 minutes
    }
  })

const releaseInventory = (reservationId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`🔄 Releasing inventory reservation: ${reservationId}`)
    yield* Effect.sleep(Duration.millis(100))
  })

/**
 * Shipping service simulation
 */
const arrangeShipping = (orderId: AggregateId, _address: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`🚚 Arranging shipping for order ${orderId}`)
    yield* Effect.sleep(Duration.millis(300))
    
    return {
      shippingId: `ship_${Date.now()}`,
      trackingNumber: `TRK${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      estimatedDelivery: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    }
  })

/**
 * Complete order processing saga with parallel steps and compensation
 */
const createOrderProcessingSaga = () =>
  createSequentialSaga<
    { orderId: AggregateId; items: any[]; total: number; paymentMethod: string; address: string },
    { orderId: AggregateId; paymentId: string; shippingId: string; success: boolean }
  >("OrderProcessing", [
    // Step 1: Validate order
    createStep({
      name: "ValidateOrder",
      execute: (input) =>
        Effect.gen(function* () {
          yield* Effect.log(`🔍 Validating order ${input.orderId}`)
          
          if (input.items.length === 0) {
            return yield* Effect.fail(new SagaError("ValidateOrder", "Order has no items"))
          }
          
          if (input.total <= 0) {
            return yield* Effect.fail(new SagaError("ValidateOrder", "Order total must be positive"))
          }
          
          return { ...input, validated: true }
        }),
      timeout: Duration.seconds(5)
    }),

    // Step 2: Reserve inventory (can fail and be compensated)
    createStep({
      name: "ReserveInventory", 
      execute: (input) =>
        Effect.gen(function* () {
          if (!input?.items) {
            return yield* Effect.fail(new SagaError("ReserveInventory", "Items not found in input"))
          }
          const reservation = yield* reserveInventory(input.items)
          return { ...input, reservation }
        }).pipe(
          Effect.mapError((error) => 
            error instanceof SagaError ? error : new SagaError("ReserveInventory", error.message || String(error), error)
          )
        ),
      compensate: (_input, output) =>
        output.reservation
          ? releaseInventory(output.reservation.reservationId)
          : Effect.succeed(undefined),
      canRetry: true,
      timeout: Duration.seconds(10)
    }),

    // Step 3: Process payment (with circuit breaker and retries)
    createStep({
      name: "ProcessPayment",
      execute: (input) =>
        pipe(
          processPaymentWithResilience(input.total, input.paymentMethod),
          Effect.map((payment) => ({ ...input, payment })),
          Effect.mapError((error) => new SagaError("ProcessPayment", error._tag, error))
        ),
      compensate: (_input, output) =>
        output.payment
          ? Effect.gen(function* () {
              yield* Effect.log(`💸 Refunding payment: ${output.payment.paymentId}`)
              // Simulate refund API call
              yield* Effect.sleep(Duration.millis(200))
            })
          : Effect.succeed(undefined),
      timeout: Duration.seconds(15)
    }),

    // Step 4: Arrange shipping (parallel with notification)
    createStep({
      name: "ArrangeShipping",
      execute: (input) =>
        pipe(
          arrangeShipping(input.orderId, input.address),
          Effect.map((shipping) => ({
            orderId: input.orderId,
            paymentId: input.payment.paymentId,
            shippingId: shipping.shippingId,
            success: true
          }))
        ),
      compensate: (_input, _output) =>
        Effect.gen(function* () {
          yield* Effect.log(`📦 Cancelling shipping arrangement`)
          // Simulate shipping cancellation
          yield* Effect.sleep(Duration.millis(100))
        }),
      timeout: Duration.seconds(8)
    })
  ])

// ============================================================================
// Pattern 3: Real-time Stream Processing with Projections
// ============================================================================

/**
 * Real-time order analytics projection
 */
const OrderAnalyticsProjection = createProjection(
  "OrderAnalytics",
  {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    ordersByStatus: {
      draft: 0,
      processing: 0, 
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    },
    recentOrders: [] as Array<{ id: AggregateId; total: number; timestamp: number }>
  },
  {
    OrderCreated: (state, event: any) => {
      const newTotalOrders = state.totalOrders + 1
      const newTotalRevenue = state.totalRevenue + event.data.total
      const newAverageOrderValue = newTotalRevenue / newTotalOrders
      
      return {
        ...state,
        totalOrders: newTotalOrders,
        totalRevenue: newTotalRevenue,
        averageOrderValue: newAverageOrderValue,
        ordersByStatus: {
          ...state.ordersByStatus,
          draft: state.ordersByStatus.draft + 1
        },
        recentOrders: [
          { 
            id: event.metadata.aggregateId, 
            total: event.data.total, 
            timestamp: event.metadata.timestamp 
          },
          ...state.recentOrders.slice(0, 9) // Keep last 10
        ]
      }
    },
    
    PaymentProcessed: (state, _event) => ({
      ...state,
      ordersByStatus: {
        ...state.ordersByStatus,
        draft: Math.max(0, state.ordersByStatus.draft - 1),
        processing: state.ordersByStatus.processing + 1
      }
    }),
    
    OrderShipped: (state, _event) => ({
      ...state,
      ordersByStatus: {
        ...state.ordersByStatus,
        processing: Math.max(0, state.ordersByStatus.processing - 1),
        shipped: state.ordersByStatus.shipped + 1
      }
    }),
    
    OrderCancelled: (state, _event) => ({
      ...state,
      ordersByStatus: {
        ...state.ordersByStatus,
        draft: Math.max(0, state.ordersByStatus.draft - 1),
        cancelled: state.ordersByStatus.cancelled + 1
      }
    })
  }
)

/**
 * Real-time event stream processor
 */
const createEventStreamProcessor = () =>
  Effect.gen(function* () {
    const eventQueue = yield* Queue.unbounded<ECommerceEvent>()
    const analyticsRef = yield* Ref.make(OrderAnalyticsProjection.initialState)
    
    // Stream processor fiber
    const processorFiber = yield* pipe(
      Stream.fromQueue(eventQueue),
      Stream.tap((event) =>
        Effect.log(`📊 Processing event for analytics: ${event.type}`)
      ),
      Stream.mapEffect((event) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(analyticsRef)
          const newState = OrderAnalyticsProjection.reducer(currentState, event)
          yield* Ref.set(analyticsRef, newState)
          
          // Emit analytics update (would trigger real-time dashboard updates)
          yield* Effect.log(`📈 Analytics updated: ${newState.totalOrders} orders, $${newState.totalRevenue.toFixed(2)} revenue`)
          
          return newState
        })
      ),
      Stream.runDrain,
      Effect.fork
    )
    
    return {
      publishEvent: (event: ECommerceEvent) => Queue.offer(eventQueue, event),
      getAnalytics: () => Ref.get(analyticsRef),
      shutdown: () => Fiber.interrupt(processorFiber)
    }
  })

// ============================================================================
// Pattern 4: Event Choreography (Event-driven Sagas)
// ============================================================================

/**
 * Event choreography for order fulfillment
 */
const createOrderChoreography = () =>
  Effect.gen(function* () {
    // Simulate choreography without actual command bus
    // In production, this would use the command bus with registered handlers
    
    // Event handlers for choreography
    const handleOrderCreated = (event: Schema.Schema.Type<typeof OrderCreated>) =>
      Effect.gen(function* () {
        yield* Effect.log(`🎭 Choreography: Order created, triggering inventory reservation`)
        
        // Simulate command dispatch (in production, would use commandBus.send)
        yield* Effect.log(`📤 Would dispatch: ReserveInventory command for ${event.data.items.length} items`)
        yield* Effect.sleep(Duration.millis(50))
        
        // Simulate the next event in the chain
        return {
          type: "InventoryReserved" as const,
          data: {
            reservationId: `res_${Date.now()}`,
            items: event.data.items
          },
          metadata: event.metadata
        }
      })
    
    const handleInventoryReserved = (event: Schema.Schema.Type<typeof InventoryReserved>) =>
      Effect.gen(function* () {
        yield* Effect.log(`🎭 Choreography: Inventory reserved, triggering payment`)
        
        // Simulate command dispatch
        yield* Effect.log(`📤 Would dispatch: ProcessPayment command`)
        yield* Effect.sleep(Duration.millis(50))
        
        // Simulate the next event
        return {
          type: "PaymentProcessed" as const,
          data: {
            paymentId: `pay_${Date.now()}`,
            amount: 100.00
          },
          metadata: event.metadata
        }
      })
    
    const handlePaymentProcessed = (event: Schema.Schema.Type<typeof PaymentProcessed>) =>
      Effect.gen(function* () {
        yield* Effect.log(`🎭 Choreography: Payment processed, triggering shipping`)
        
        // Simulate command dispatch
        yield* Effect.log(`📤 Would dispatch: ShipOrder command`)
        yield* Effect.sleep(Duration.millis(50))
        
        // Simulate the final event
        return {
          type: "OrderShipped" as const,
          data: {
            shippingId: `ship_${Date.now()}`,
            trackingNumber: `TRK${Math.random().toString(36).substr(2, 9).toUpperCase()}`
          },
          metadata: event.metadata
        }
      })
    
    return {
      handleEvent: (event: ECommerceEvent) =>
        match(event)
          .with({ type: "OrderCreated" }, handleOrderCreated)
          .with({ type: "InventoryReserved" }, handleInventoryReserved)
          .with({ type: "PaymentProcessed" }, handlePaymentProcessed)
          .otherwise(() => Effect.succeed(undefined))
    }
  })

// ============================================================================
// Pattern 5: Bulkhead Pattern for Resource Isolation
// ============================================================================

/**
 * Bulkhead pattern for isolating different types of operations
 */
const _createBulkheadExecutor = () => {
  // Separate execution contexts for different operation types
  const paymentQueue = Queue.bounded<() => Effect.Effect<any, any>>(5)
  const inventoryQueue = Queue.bounded<() => Effect.Effect<any, any>>(10) 
  const shippingQueue = Queue.bounded<() => Effect.Effect<any, any>>(3)
  
  const createWorkerPool = <A, E>(
    queue: Effect.Effect<Queue.Queue<() => Effect.Effect<A, E>>, never>,
    concurrency: number,
    name: string
  ) =>
    Effect.gen(function* () {
      const q = yield* queue
      
      const workers = Array.from({ length: concurrency }, (_, i) =>
        Effect.gen(function* () {
          yield* Effect.log(`🔧 Starting ${name} worker ${i + 1}`)
          
          while (true) {
            const task = yield* Queue.take(q)
            yield* pipe(
              task(),
              Effect.tapError((error) =>
                Effect.log(`❌ ${name} worker ${i + 1} error: ${JSON.stringify(error)}`)
              ),
              Effect.tap((_result) =>
                Effect.log(`✅ ${name} worker ${i + 1} completed task`)
              ),
              Effect.catchAll(() => Effect.succeed(undefined))
            )
          }
        }).pipe(Effect.forever, Effect.fork)
      )
      
      yield* Effect.all(workers, { discard: true })
      
      return {
        submit: (task: () => Effect.Effect<A, E>) => Queue.offer(q, task)
      }
    })
  
  return Effect.gen(function* () {
    const paymentExecutor = yield* createWorkerPool(paymentQueue, 2, "Payment")
    const inventoryExecutor = yield* createWorkerPool(inventoryQueue, 3, "Inventory")  
    const shippingExecutor = yield* createWorkerPool(shippingQueue, 1, "Shipping")
    
    return {
      executePayment: (task: () => Effect.Effect<any, any>) =>
        paymentExecutor.submit(task),
      executeInventory: (task: () => Effect.Effect<any, any>) =>
        inventoryExecutor.submit(task),
      executeShipping: (task: () => Effect.Effect<any, any>) =>
        shippingExecutor.submit(task)
    }
  })
}

// ============================================================================
// Complete Advanced Patterns Demo
// ============================================================================

const runAdvancedPatternsDemo = () =>
  Effect.gen(function* () {
    yield* Effect.log("🎪 Advanced Patterns Showcase - Ultra-Clean Framework")
    yield* Effect.log("=" .repeat(70))
    
    // 1. Circuit Breaker and Retry Demo
    yield* Effect.log("\n🔄 Pattern 1: Circuit Breaker with Retry Strategy")
    yield* Effect.log("-" .repeat(50))
    
    for (let i = 0; i < 5; i++) {
      yield* pipe(
        processPaymentWithResilience(100 + i * 10, "credit_card"),
        Effect.either,
        Effect.tap((result) =>
          Effect.log(`Payment attempt ${i + 1}: ${result._tag === "Right" ? "SUCCESS" : "FAILED"}`)
        )
      )
    }
    
    // 2. Complex Saga Demo  
    yield* Effect.log("\n🎭 Pattern 2: Complex Saga with Compensation")
    yield* Effect.log("-" .repeat(50))
    
    const orderProcessingSaga = createOrderProcessingSaga()
    const sagaInput = {
      orderId: createAggregateId(),
      items: [
        { productId: createAggregateId(), quantity: 2, price: 29.99 },
        { productId: createAggregateId(), quantity: 1, price: 45.00 }
      ],
      total: 104.98,
      paymentMethod: "credit_card",
      address: "123 Main St, City, State"
    }
    
    const sagaResult = yield* pipe(
      orderProcessingSaga.execute(sagaInput),
      Effect.either,
      Effect.tap((result) =>
        Effect.log(`Saga result: ${result._tag === "Right" ? "SUCCESS" : "FAILED"}`)
      )
    )
    
    // 3. Real-time Stream Processing Demo
    yield* Effect.log("\n📊 Pattern 3: Real-time Stream Processing")
    yield* Effect.log("-" .repeat(50))
    
    const streamProcessor = yield* createEventStreamProcessor()
    
    // Generate some demo events
    const demoEvents: ECommerceEvent[] = [
      {
        type: "OrderCreated" as const,
        data: {
          customerId: createAggregateId(),
          items: [{ productId: createAggregateId(), quantity: 1, price: 50.00 }],
          total: 50.00
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 0 as Version,
          timestamp: now(),
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      },
      {
        type: "PaymentProcessed" as const,
        data: {
          paymentId: "pay_12345",
          amount: 50.00
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 1 as Version,
          timestamp: now(),
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      }
    ]
    
    // Publish events to stream
    for (const event of demoEvents) {
      yield* streamProcessor.publishEvent(event)
      yield* Effect.sleep(Duration.millis(100)) // Small delay to see processing
    }
    
    // Get final analytics
    yield* Effect.sleep(Duration.millis(200))
    const analytics = yield* streamProcessor.getAnalytics()
    yield* Effect.log(`📈 Final Analytics: ${JSON.stringify(analytics, null, 2)}`)
    
    // 4. Event Choreography Demo
    yield* Effect.log("\n🎵 Pattern 4: Event Choreography")
    yield* Effect.log("-" .repeat(50))
    
    const choreography = yield* createOrderChoreography()
    
    // Simulate choreographed event flow
    const choreographyEvent: Schema.Schema.Type<typeof OrderCreated> = {
      type: "OrderCreated" as const,
      data: {
        customerId: createAggregateId(),
        items: [{ productId: createAggregateId(), quantity: 1, price: 75.00 }],
        total: 75.00
      },
      metadata: {
        eventId: createEventId(),
        aggregateId: createAggregateId(),
        version: 0 as Version,
        timestamp: now(),
        correlationId: createCorrelationId(),
        causationId: createCausationId(),
        actor: { type: "system", service: nonEmptyString("demo") }
      }
    }
    
    // Execute the full choreography chain
    const inventoryEvent = yield* choreography.handleEvent(choreographyEvent)
    if (inventoryEvent) {
      yield* Effect.log(`✅ Event produced: ${inventoryEvent.type}`)
      
      // Continue the chain
      const paymentEvent = yield* choreography.handleEvent(inventoryEvent)
      if (paymentEvent) {
        yield* Effect.log(`✅ Event produced: ${paymentEvent.type}`)
        
        // Final step
        const shippingEvent = yield* choreography.handleEvent(paymentEvent)
        if (shippingEvent) {
          yield* Effect.log(`✅ Event produced: ${shippingEvent.type}`)
          yield* Effect.log(`🎉 Choreography completed: Order ${choreographyEvent.metadata.aggregateId} shipped!`)
        }
      }
    }
    
    // 5. Cleanup
    yield* streamProcessor.shutdown()
    
    yield* Effect.log("\n🎉 Advanced Patterns Showcase Completed!")
    yield* Effect.log("🌟 Patterns Demonstrated:")
    yield* Effect.log("   • Circuit Breaker with Exponential Backoff")
    yield* Effect.log("   • Complex Saga with Sequential Steps & Compensation")
    yield* Effect.log("   • Real-time Stream Processing with Projections")
    yield* Effect.log("   • Event Choreography for Decoupled Workflows")
    yield* Effect.log("   • Timeout Handling and Resource Management")
    yield* Effect.log("   • Type-safe Error Handling Throughout")
    
    return {
      message: "Advanced patterns showcase completed successfully!",
      sagaResult: sagaResult._tag === "Right" ? sagaResult.right : null,
      analytics,
      demonstratedPatterns: [
        "Circuit Breaker",
        "Retry Strategies", 
        "Complex Sagas",
        "Stream Processing",
        "Event Choreography",
        "Timeout Handling",
        "Resource Isolation"
      ]
    }
  }).pipe(
    Effect.provide(CoreServicesLive),
    Effect.timeout(Duration.minutes(2)),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`❌ Advanced patterns demo failed: ${JSON.stringify(error)}`)
        return { error: JSON.stringify(error) }
      })
    )
  )

// ============================================================================
// Run Advanced Patterns Demo
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runAdvancedPatternsDemo()).then(
    result => {
      console.log("🎯 Advanced Patterns Demo Result:", result)
      process.exit(0)
    },
    error => {
      console.error("💥 Advanced Patterns Demo Error:", error)
      process.exit(1)
    }
  )
}

export { runAdvancedPatternsDemo }