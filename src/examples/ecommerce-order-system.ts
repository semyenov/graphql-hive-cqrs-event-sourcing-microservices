/**
 * 🛍️ Real-World E-commerce Order System
 *
 * Complete implementation using pipe patterns throughout
 * Demonstrates: Orders, Inventory, Payments, Shipping, Notifications
 */

import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Ref from "effect/Ref";
import * as Queue from "effect/Queue";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
import { pipe } from "effect/Function";
import { match } from "ts-pattern";

import {
  type Aggregate,
  // Primitives
  AggregateId,
  // Services
  CoreServicesLive,
  createAggregate,
  createAggregateId,
  createCausationId,
  createCommandSchema,
  createCorrelationId,
  createEventId,
  // Schema builders
  createEventSchema,
  // Core framework with pipe patterns
  createRepository,
  Email,
  email,
  type EventApplicator,
  EventStore,
  markEventsAsCommitted,
  NonEmptyString,
  nonEmptyString,
  now,
  Version,
  withCache,
  withOptimisticLocking,
} from "@cqrs/framework";

import * as Schema from "@effect/schema/Schema";
import * as Context from "effect/Context";

// Define CommandBus locally to avoid export conflicts
interface CommandBus {
  readonly send: (
    aggregateId: AggregateId,
    command: any,
  ) => Effect.Effect<any, any>;
}
const CommandBus = Context.GenericTag<CommandBus>("CommandBus");

// ============================================================================
// Domain Models
// ============================================================================

// Order Domain
const OrderState = Schema.Struct({
  orderId: NonEmptyString,
  customerId: NonEmptyString,
  items: Schema.Array(Schema.Struct({
    productId: NonEmptyString,
    productName: NonEmptyString,
    quantity: Schema.Number,
    unitPrice: Schema.Number,
  })),
  totalAmount: Schema.Number,
  status: Schema.Literal(
    "pending",
    "confirmed",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
  ),
  shippingAddress: Schema.Struct({
    street: NonEmptyString,
    city: NonEmptyString,
    postalCode: NonEmptyString,
    country: NonEmptyString,
  }),
  paymentId: Schema.optional(NonEmptyString),
  trackingNumber: Schema.optional(NonEmptyString),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
type OrderState = Schema.Schema.Type<typeof OrderState>;

// Inventory Domain
const InventoryState = Schema.Struct({
  productId: NonEmptyString,
  quantity: Schema.Number,
  reserved: Schema.Number,
  reorderLevel: Schema.Number,
  reorderQuantity: Schema.Number,
});
type InventoryState = Schema.Schema.Type<typeof InventoryState>;

// Payment Domain
const PaymentState = Schema.Struct({
  paymentId: NonEmptyString,
  orderId: NonEmptyString,
  amount: Schema.Number,
  currency: NonEmptyString,
  method: Schema.Literal(
    "credit_card",
    "debit_card",
    "paypal",
    "bank_transfer",
  ),
  status: Schema.Literal(
    "pending",
    "authorized",
    "captured",
    "refunded",
    "failed",
  ),
  transactionId: Schema.optional(NonEmptyString),
  createdAt: Schema.Number,
});
type PaymentState = Schema.Schema.Type<typeof PaymentState>;

// ============================================================================
// Events - Schema-First
// ============================================================================

// Order Events
const OrderPlaced = createEventSchema("OrderPlaced", OrderState);
const OrderConfirmed = createEventSchema(
  "OrderConfirmed",
  Schema.Struct({
    confirmedAt: Schema.Number,
  }),
);
const OrderPaid = createEventSchema(
  "OrderPaid",
  Schema.Struct({
    paymentId: NonEmptyString,
    paidAt: Schema.Number,
  }),
);
const OrderShipped = createEventSchema(
  "OrderShipped",
  Schema.Struct({
    trackingNumber: NonEmptyString,
    carrier: NonEmptyString,
    shippedAt: Schema.Number,
  }),
);
const OrderDelivered = createEventSchema(
  "OrderDelivered",
  Schema.Struct({
    deliveredAt: Schema.Number,
    signature: Schema.optional(NonEmptyString),
  }),
);
const OrderCancelled = createEventSchema(
  "OrderCancelled",
  Schema.Struct({
    reason: NonEmptyString,
    cancelledAt: Schema.Number,
  }),
);

type OrderEvent =
  | Schema.Schema.Type<typeof OrderPlaced>
  | Schema.Schema.Type<typeof OrderConfirmed>
  | Schema.Schema.Type<typeof OrderPaid>
  | Schema.Schema.Type<typeof OrderShipped>
  | Schema.Schema.Type<typeof OrderDelivered>
  | Schema.Schema.Type<typeof OrderCancelled>;

// Inventory Events
const InventoryReserved = createEventSchema(
  "InventoryReserved",
  Schema.Struct({
    productId: NonEmptyString,
    quantity: Schema.Number,
    orderId: NonEmptyString,
  }),
);
const InventoryReleased = createEventSchema(
  "InventoryReleased",
  Schema.Struct({
    productId: NonEmptyString,
    quantity: Schema.Number,
    orderId: NonEmptyString,
  }),
);
const InventoryDepleted = createEventSchema(
  "InventoryDepleted",
  Schema.Struct({
    productId: NonEmptyString,
    currentQuantity: Schema.Number,
  }),
);
const InventoryRestocked = createEventSchema(
  "InventoryRestocked",
  Schema.Struct({
    productId: NonEmptyString,
    quantity: Schema.Number,
    supplier: NonEmptyString,
  }),
);

type InventoryEvent =
  | Schema.Schema.Type<typeof InventoryReserved>
  | Schema.Schema.Type<typeof InventoryReleased>
  | Schema.Schema.Type<typeof InventoryDepleted>
  | Schema.Schema.Type<typeof InventoryRestocked>;

// Payment Events
const PaymentAuthorized = createEventSchema(
  "PaymentAuthorized",
  Schema.Struct({
    paymentId: NonEmptyString,
    orderId: NonEmptyString,
    amount: Schema.Number,
    transactionId: NonEmptyString,
  }),
);
const PaymentCaptured = createEventSchema(
  "PaymentCaptured",
  Schema.Struct({
    paymentId: NonEmptyString,
    capturedAt: Schema.Number,
  }),
);
const PaymentRefunded = createEventSchema(
  "PaymentRefunded",
  Schema.Struct({
    paymentId: NonEmptyString,
    amount: Schema.Number,
    reason: NonEmptyString,
  }),
);
const PaymentFailed = createEventSchema(
  "PaymentFailed",
  Schema.Struct({
    paymentId: NonEmptyString,
    reason: NonEmptyString,
    errorCode: Schema.optional(NonEmptyString),
  }),
);

type PaymentEvent =
  | Schema.Schema.Type<typeof PaymentAuthorized>
  | Schema.Schema.Type<typeof PaymentCaptured>
  | Schema.Schema.Type<typeof PaymentRefunded>
  | Schema.Schema.Type<typeof PaymentFailed>;

// ============================================================================
// Commands - Schema-First
// ============================================================================

const PlaceOrder = createCommandSchema(
  "PlaceOrder",
  Schema.Struct({
    customerId: NonEmptyString,
    items: Schema.Array(Schema.Struct({
      productId: NonEmptyString,
      productName: NonEmptyString,
      quantity: Schema.Number,
      unitPrice: Schema.Number,
    })),
    shippingAddress: Schema.Struct({
      street: NonEmptyString,
      city: NonEmptyString,
      postalCode: NonEmptyString,
      country: NonEmptyString,
    }),
  }),
);

const ConfirmOrder = createCommandSchema(
  "ConfirmOrder",
  Schema.Struct({
    orderId: NonEmptyString,
  }),
);

const ProcessPayment = createCommandSchema(
  "ProcessPayment",
  Schema.Struct({
    orderId: NonEmptyString,
    amount: Schema.Number,
    method: Schema.Literal(
      "credit_card",
      "debit_card",
      "paypal",
      "bank_transfer",
    ),
    cardToken: Schema.optional(NonEmptyString),
  }),
);

const ShipOrder = createCommandSchema(
  "ShipOrder",
  Schema.Struct({
    orderId: NonEmptyString,
    carrier: NonEmptyString,
  }),
);

const CancelOrder = createCommandSchema(
  "CancelOrder",
  Schema.Struct({
    orderId: NonEmptyString,
    reason: NonEmptyString,
  }),
);

// ============================================================================
// Domain Errors
// ============================================================================

class InsufficientInventoryError {
  readonly _tag = "InsufficientInventoryError";
  constructor(
    readonly productId: NonEmptyString,
    readonly requested: number,
    readonly available: number,
  ) {}
}

class OrderNotFoundError {
  readonly _tag = "OrderNotFoundError";
  constructor(readonly orderId: NonEmptyString) {}
}

class PaymentFailedError {
  readonly _tag = "PaymentFailedError";
  constructor(readonly reason: string) {}
}

class InvalidOrderStateError {
  readonly _tag = "InvalidOrderStateError";
  constructor(
    readonly currentState: string,
    readonly attemptedTransition: string,
  ) {}
}

type DomainError =
  | InsufficientInventoryError
  | OrderNotFoundError
  | PaymentFailedError
  | InvalidOrderStateError;

// ============================================================================
// Event Applicators - PIPE PATTERN
// ============================================================================

const applyOrderEvent: EventApplicator<OrderState, OrderEvent> = (
  state,
  event,
) =>
  match(event)
    .with({ type: "OrderPlaced" }, (e) => e.data)
    .with({ type: "OrderConfirmed" }, (e) =>
      state
        ? {
          ...state,
          status: "confirmed" as const,
          updatedAt: e.data.confirmedAt,
        }
        : null)
    .with({ type: "OrderPaid" }, (e) =>
      state
        ? {
          ...state,
          status: "paid" as const,
          paymentId: e.data.paymentId,
          updatedAt: e.data.paidAt,
        }
        : null)
    .with({ type: "OrderShipped" }, (e) =>
      state
        ? {
          ...state,
          status: "shipped" as const,
          trackingNumber: e.data.trackingNumber,
          updatedAt: e.data.shippedAt,
        }
        : null)
    .with({ type: "OrderDelivered" }, (e) =>
      state
        ? {
          ...state,
          status: "delivered" as const,
          updatedAt: e.data.deliveredAt,
        }
        : null)
    .with({ type: "OrderCancelled" }, (e) =>
      state
        ? {
          ...state,
          status: "cancelled" as const,
          updatedAt: e.data.cancelledAt,
        }
        : null)
    .exhaustive();

const applyInventoryEvent: EventApplicator<InventoryState, InventoryEvent> = (
  state,
  event,
) =>
  match(event)
    .with({ type: "InventoryReserved" }, (e) =>
      state
        ? {
          ...state,
          quantity: state.quantity - e.data.quantity,
          reserved: state.reserved + e.data.quantity,
        }
        : null)
    .with({ type: "InventoryReleased" }, (e) =>
      state
        ? {
          ...state,
          quantity: state.quantity + e.data.quantity,
          reserved: state.reserved - e.data.quantity,
        }
        : null)
    .with({ type: "InventoryDepleted" }, (e) =>
      state ? { ...state, quantity: e.data.currentQuantity } : null)
    .with({ type: "InventoryRestocked" }, (e) =>
      state ? { ...state, quantity: state.quantity + e.data.quantity } : null)
    .exhaustive();

const applyPaymentEvent: EventApplicator<PaymentState, PaymentEvent> = (
  state,
  event,
) =>
  match(event)
    .with({ type: "PaymentAuthorized" }, (e) => ({
      paymentId: e.data.paymentId,
      orderId: e.data.orderId,
      amount: e.data.amount,
      currency: "USD" as NonEmptyString,
      method: "credit_card" as const,
      status: "authorized" as const,
      transactionId: e.data.transactionId,
      createdAt: e.metadata.timestamp,
    }))
    .with({ type: "PaymentCaptured" }, (e) =>
      state ? { ...state, status: "captured" as const } : null)
    .with({ type: "PaymentRefunded" }, (e) =>
      state ? { ...state, status: "refunded" as const } : null)
    .with({ type: "PaymentFailed" }, (e) =>
      state ? { ...state, status: "failed" as const } : null)
    .exhaustive();

// ============================================================================
// Command Handlers - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Place order handler - PIPE PATTERN
 */
const handlePlaceOrder = (
  aggregate: Aggregate<OrderState | null, OrderEvent>,
  command: Schema.Schema.Type<typeof PlaceOrder>,
): Effect.Effect<ReadonlyArray<OrderEvent>, DomainError> =>
  pipe(
    // Validate order doesn't exist
    aggregate.state !== null
      ? Effect.fail(new InvalidOrderStateError("exists", "place"))
      : Effect.void,
    // Calculate total and create event
    Effect.flatMap(() => {
      const totalAmount = command.payload.items.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice),
        0,
      );

      return Effect.succeed([{
        type: "OrderPlaced" as const,
        data: {
          orderId: aggregate.id as NonEmptyString,
          customerId: command.payload.customerId,
          items: command.payload.items,
          totalAmount,
          status: "pending" as const,
          shippingAddress: command.payload.shippingAddress,
          createdAt: now(),
          updatedAt: now(),
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.id,
          version: (aggregate.version + 1) as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      }]);
    }),
  );

/**
 * 🎯 Process payment handler - PIPE PATTERN
 */
const processPayment = (
  orderId: NonEmptyString,
  amount: number,
  method: string,
): Effect.Effect<PaymentEvent, PaymentFailedError> =>
  pipe(
    // Simulate payment gateway call
    Effect.sleep(Duration.millis(100)),
    Effect.flatMap(() => {
      // 90% success rate simulation
      if (Math.random() > 0.9) {
        return Effect.fail(new PaymentFailedError("Card declined"));
      }

      return Effect.succeed({
        type: "PaymentAuthorized" as const,
        data: {
          paymentId: createEventId(),
          orderId,
          amount,
          transactionId: `txn_${Date.now()}` as NonEmptyString,
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 0 as Version,
          timestamp: now(),
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system" as const },
        },
      });
    }),
  );

// ============================================================================
// Order Processing Saga - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Order processing saga using pipe patterns
 */
const createOrderProcessingSaga = () => {
  interface OrderSagaContext {
    orderId: NonEmptyString;
    customerId: NonEmptyString;
    items: ReadonlyArray<{ productId: string; quantity: number }>;
    totalAmount: number;
    inventoryReserved: boolean;
    paymentProcessed: boolean;
  }

  const processOrder = (
    event: OrderEvent | InventoryEvent | PaymentEvent,
  ): Effect.Effect<void, DomainError, CommandBus | EventStore> =>
    pipe(
      match(event)
        .with({ type: "OrderPlaced" }, (e) =>
          // Reserve inventory for all items
          pipe(
            Effect.forEach(
              e.data.items,
              (item) =>
                pipe(
                  CommandBus,
                  Effect.flatMap((bus) =>
                    bus.send(item.productId as AggregateId, {
                      type: "ReserveInventory",
                      payload: {
                        productId: item.productId,
                        quantity: item.quantity,
                        orderId: e.data.orderId,
                      },
                      metadata: {
                        commandId: createEventId(),
                        aggregateId: item.productId as AggregateId,
                        correlationId: e.metadata.correlationId,
                        causationId: e.metadata.eventId,
                        timestamp: now(),
                        actor: { type: "system" },
                      },
                    })
                  ),
                ),
              { discard: true },
            ),
          ))
        .with({ type: "InventoryReserved" }, (e) =>
          // Process payment after inventory reserved
          pipe(
            CommandBus,
            Effect.flatMap((bus) =>
              bus.send(e.data.orderId as AggregateId, {
                type: "ProcessPayment",
                payload: {
                  orderId: e.data.orderId,
                  amount: 100, // Would come from order aggregate
                  method: "credit_card" as const,
                },
                metadata: {
                  commandId: createEventId(),
                  aggregateId: e.data.orderId as AggregateId,
                  correlationId: e.metadata.correlationId,
                  causationId: e.metadata.eventId,
                  timestamp: now(),
                  actor: { type: "system" },
                },
              })
            ),
          ))
        .with({ type: "PaymentAuthorized" }, (e) =>
          // Ship order after payment
          pipe(
            CommandBus,
            Effect.flatMap((bus) =>
              bus.send(e.data.orderId as AggregateId, {
                type: "ShipOrder",
                payload: {
                  orderId: e.data.orderId,
                  carrier: "FedEx" as NonEmptyString,
                },
                metadata: {
                  commandId: createEventId(),
                  aggregateId: e.data.orderId as AggregateId,
                  correlationId: e.metadata.correlationId,
                  causationId: e.metadata.eventId,
                  timestamp: now(),
                  actor: { type: "system" },
                },
              })
            ),
          ))
        .with({ type: "PaymentFailed" }, (e) =>
          // Release inventory on payment failure
          pipe(
            EventStore,
            Effect.flatMap((store) =>
              // Would load order to get items, then release each
              Effect.log(
                `Payment failed for order ${e.data.orderId}, releasing inventory`,
              )
            ),
          ))
        .otherwise(() => Effect.void),
    );

  return processOrder;
};

// ============================================================================
// Projections - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Order statistics projection
 */
const createOrderStatsProjection = () => {
  interface OrderStats {
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Record<string, number>;
    averageOrderValue: number;
    topProducts: Array<{ productId: string; quantity: number }>;
  }

  const initialState: OrderStats = {
    totalOrders: 0,
    totalRevenue: 0,
    ordersByStatus: {},
    averageOrderValue: 0,
    topProducts: [],
  };

  return (state: OrderStats, event: OrderEvent): OrderStats =>
    match(event)
      .with({ type: "OrderPlaced" }, (e) => ({
        ...state,
        totalOrders: state.totalOrders + 1,
        totalRevenue: state.totalRevenue + e.data.totalAmount,
        ordersByStatus: {
          ...state.ordersByStatus,
          pending: (state.ordersByStatus.pending || 0) + 1,
        },
        averageOrderValue: (state.totalRevenue + e.data.totalAmount) /
          (state.totalOrders + 1),
        topProducts: e.data.items.reduce((products, item) => {
          const existing = products.find((p) => p.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            products.push({
              productId: item.productId,
              quantity: item.quantity,
            });
          }
          return products.sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        }, [...state.topProducts]),
      }))
      .with({ type: "OrderShipped" }, () => ({
        ...state,
        ordersByStatus: {
          ...state.ordersByStatus,
          pending: Math.max(0, (state.ordersByStatus.pending || 0) - 1),
          shipped: (state.ordersByStatus.shipped || 0) + 1,
        },
      }))
      .otherwise(() => state);
};

// ============================================================================
// Complete Order Workflow - PIPE PATTERN
// ============================================================================

/**
 * 🎯 End-to-end order processing using pipe patterns
 */
const processCustomerOrder = (
  customerId: NonEmptyString,
  items: Array<
    {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }
  >,
  shippingAddress: any,
): Effect.Effect<
  { orderId: string; status: string },
  DomainError,
  CommandBus | EventStore
> =>
  pipe(
    // Create order aggregate
    Effect.succeed(
      createAggregate<OrderState, OrderEvent>(createAggregateId()),
    ),
    // Place order
    Effect.flatMap((aggregate) =>
      pipe(
        handlePlaceOrder(aggregate, {
          type: "PlaceOrder",
          payload: {
            customerId,
            items: items.map((item) => ({
              ...item,
              productId: item.productId as NonEmptyString,
              productName: item.productName as NonEmptyString,
            })),
            shippingAddress,
          },
          metadata: {
            commandId: createEventId(),
            aggregateId: aggregate.id,
            correlationId: createCorrelationId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "user", id: customerId as AggregateId },
          },
        }),
        Effect.map((events) => ({
          ...aggregate,
          uncommittedEvents: events,
          state: events.reduce(
            (state, event) => applyOrderEvent(state, event),
            aggregate.state,
          ),
        })),
      )
    ),
    // Save order
    Effect.tap((aggregate) => {
      const repo = createRepository("Order", applyOrderEvent, null);
      return repo.save(aggregate);
    }),
    // Start saga for order processing
    Effect.tap((aggregate) =>
      pipe(
        createOrderProcessingSaga(),
        Effect.flatMap((saga) =>
          Effect.forEach(
            aggregate.uncommittedEvents,
            (event) => saga(event),
            { discard: true },
          )
        ),
      )
    ),
    // Return order info
    Effect.map((aggregate) => ({
      orderId: aggregate.id,
      status: aggregate.state?.status || "pending",
    })),
  );

// ============================================================================
// Demo Execution
// ============================================================================

const runEcommerceDemo = pipe(
  Effect.succeed("🛍️ E-commerce Order System Demo"),
  Effect.tap((title) => Effect.sync(() => console.log(title))),
  Effect.tap(() => Effect.sync(() => console.log("=".repeat(60)))),
  Effect.flatMap(() =>
    processCustomerOrder(
      nonEmptyString("customer-123"),
      [
        {
          productId: "prod-1",
          productName: "Laptop",
          quantity: 1,
          unitPrice: 1299.99,
        },
        {
          productId: "prod-2",
          productName: "Mouse",
          quantity: 2,
          unitPrice: 29.99,
        },
        {
          productId: "prod-3",
          productName: "Keyboard",
          quantity: 1,
          unitPrice: 89.99,
        },
      ],
      {
        street: nonEmptyString("123 Main St"),
        city: nonEmptyString("San Francisco"),
        postalCode: nonEmptyString("94105"),
        country: nonEmptyString("USA"),
      },
    )
  ),
  Effect.tap((order) =>
    Effect.sync(() => {
      console.log("\n✅ Order placed successfully!");
      console.log(`   Order ID: ${order.orderId}`);
      console.log(`   Status: ${order.status}`);
      console.log("\n📦 Order processing pipeline:");
      console.log("   1. Inventory reservation → In progress");
      console.log("   2. Payment processing → Pending");
      console.log("   3. Shipping preparation → Pending");
      console.log("   4. Delivery tracking → Pending");
    })
  ),
  Effect.tap(() =>
    Effect.sync(() => {
      console.log("\n🎯 Pipe Pattern Benefits Demonstrated:");
      console.log("   ✅ Clean order workflow composition");
      console.log("   ✅ Saga orchestration without Effect.gen");
      console.log("   ✅ Event-driven inventory management");
      console.log("   ✅ Payment processing pipeline");
      console.log("   ✅ Projection-based analytics");
      console.log("   ✅ Error compensation handling");
    })
  ),
);

// Execute if run directly
if (import.meta.main) {
  Effect.runPromise(
    Effect.provide(runEcommerceDemo, CoreServicesLive),
  ).then(
    () => console.log("\n✨ E-commerce demo completed successfully!"),
    (error) => console.error("❌ Demo failed:", error),
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  applyInventoryEvent,
  // Event applicators
  applyOrderEvent,
  applyPaymentEvent,
  createOrderProcessingSaga,
  createOrderStatsProjection,
  // Handlers
  handlePlaceOrder,
  type InventoryEvent,
  type InventoryState,
  type OrderEvent,
  // Types
  type OrderState,
  type PaymentEvent,
  type PaymentState,
  // Workflows
  processCustomerOrder,
  processPayment,
  // Demo
  runEcommerceDemo,
};
