/**
 * Working Product Domain Demo - Fixed Functional Approach
 * 
 * Demonstrates:
 * - ✅ NO "this" keyword issues in Effect.gen
 * - ✅ Pure functional approach with correct imports  
 * - ✅ Proper CQRS/Event Sourcing patterns
 * - ✅ Effect-TS integration that actually works
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

// ✅ CORRECT imports from @cqrs/framework (not @cqrs/framework/effect)
import {
  // Types and interfaces
  type Aggregate,
  type EventApplicator,

  // Core functions
  createAggregate,
  applyEvent,
  markEventsAsCommitted,
  createCommandHandler,
  createRepository,

  // Schema builders
  createEventSchema,
  createCommandSchema,

  // Primitives
  AggregateId,
  Version,
  NonEmptyString,
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
  nonEmptyString,

  // Services
  CoreServicesLive,
  EventStore,
  createCommandId,
} from "@cqrs/framework"
import type { UserId } from "../domains/users/core/types"

// ============================================================================
// Domain Model - Product Inventory System
// ============================================================================

/**
 * Product state - pure data structure
 */
const ProductState = Schema.Struct({
  name: NonEmptyString,
  sku: NonEmptyString,
  price: Schema.Number,
  quantity: Schema.Number,
  category: NonEmptyString,
  isActive: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
type ProductState = Schema.Schema.Type<typeof ProductState>

/**
 * Product aggregate - NO classes, just type alias
 */
type ProductAggregate = Aggregate<ProductState | null, ProductEvent>

// ============================================================================
// Events - Schema-First Approach
// ============================================================================

const ProductCreated = createEventSchema(
  "ProductCreated",
  Schema.Struct({
    name: NonEmptyString,
    sku: NonEmptyString,
    price: Schema.Number,
    quantity: Schema.Number,
    category: NonEmptyString,
  })
)

const StockAdded = createEventSchema(
  "StockAdded",
  Schema.Struct({
    quantity: Schema.Number,
    reason: Schema.String,
  })
)

const StockRemoved = createEventSchema(
  "StockRemoved",
  Schema.Struct({
    quantity: Schema.Number,
    reason: Schema.String,
  })
)

const PriceChanged = createEventSchema(
  "PriceChanged",
  Schema.Struct({
    oldPrice: Schema.Number,
    newPrice: Schema.Number,
  })
)

const ProductDeactivated = createEventSchema(
  "ProductDeactivated",
  Schema.Struct({
    reason: Schema.String,
  })
)

type ProductEvent =
  | Schema.Schema.Type<typeof ProductCreated>
  | Schema.Schema.Type<typeof StockAdded>
  | Schema.Schema.Type<typeof StockRemoved>
  | Schema.Schema.Type<typeof PriceChanged>
  | Schema.Schema.Type<typeof ProductDeactivated>

// ============================================================================
// Commands - Schema-First Approach  
// ============================================================================

const CreateProduct = createCommandSchema(
  "CreateProduct",
  Schema.Struct({
    name: NonEmptyString,
    sku: NonEmptyString,
    price: Schema.Number,
    initialStock: Schema.Number,
    category: NonEmptyString,
  })
)

const AddStock = createCommandSchema(
  "AddStock",
  Schema.Struct({
    quantity: Schema.Number,
    reason: Schema.String,
  })
)

const RemoveStock = createCommandSchema(
  "RemoveStock",
  Schema.Struct({
    quantity: Schema.Number,
    reason: Schema.String,
  })
)

const ChangePrice = createCommandSchema(
  "ChangePrice",
  Schema.Struct({
    newPrice: Schema.Number,
  })
)

const DeactivateProduct = createCommandSchema(
  "DeactivateProduct",
  Schema.Struct({
    reason: Schema.String,
  })
)

type ProductCommand =
  | Schema.Schema.Type<typeof CreateProduct>
  | Schema.Schema.Type<typeof AddStock>
  | Schema.Schema.Type<typeof RemoveStock>
  | Schema.Schema.Type<typeof ChangePrice>
  | Schema.Schema.Type<typeof DeactivateProduct>

// ============================================================================
// Domain Errors
// ============================================================================

class ProductAlreadyExistsError {
  readonly _tag = "ProductAlreadyExistsError"
  constructor(readonly sku: NonEmptyString) { }
}

class ProductNotFoundError {
  readonly _tag = "ProductNotFoundError"
  constructor(readonly id: AggregateId) { }
}

class InsufficientStockError {
  readonly _tag = "InsufficientStockError"
  constructor(readonly requested: number, readonly available: number) { }
}

class InvalidPriceError {
  readonly _tag = "InvalidPriceError"
  constructor(readonly price: number) { }
}

class ProductInactiveError {
  readonly _tag = "ProductInactiveError"
  constructor(readonly id: AggregateId) { }
}

type ProductError =
  | ProductAlreadyExistsError
  | ProductNotFoundError
  | InsufficientStockError
  | InvalidPriceError
  | ProductInactiveError

// ============================================================================
// Pure Event Applicator - NO "this" keyword
// ============================================================================

/**
 * ✅ Pure function that applies events to state
 * NO classes, NO "this" keyword, NO context issues
 */
const applyProductEvent: EventApplicator<ProductState, ProductEvent> = (state, event) =>
  match(event)
    .with({ type: "ProductCreated" }, (e) => ({
      name: e.data.name,
      sku: e.data.sku,
      price: e.data.price,
      quantity: e.data.quantity,
      category: e.data.category,
      isActive: true,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
    }))
    .with({ type: "StockAdded" }, (e) =>
      state ? { ...state, quantity: state.quantity + e.data.quantity, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "StockRemoved" }, (e) =>
      state ? { ...state, quantity: state.quantity - e.data.quantity, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "PriceChanged" }, (e) =>
      state ? { ...state, price: e.data.newPrice, updatedAt: e.metadata.timestamp } : null
    )
    .with({ type: "ProductDeactivated" }, (e) =>
      state ? { ...state, isActive: false, updatedAt: e.metadata.timestamp } : null
    )
    .exhaustive()

// ============================================================================
// Command Handlers - Pure Functions with Effect.gen (NO "this" issues)
// ============================================================================

/**
 * ✅ Create product handler - functional approach
 * Uses Effect.gen with NO "this" keyword - context is safe
 */
const createProductHandler = createCommandHandler<
  ProductState | null,
  Schema.Schema.Type<typeof CreateProduct>,
  ProductEvent,
  ProductError
>({
  name: "CreateProduct",
  commandType: "CreateProduct",

  validate: (command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword here - pure validation
      if (command.payload.price <= 0) {
        return yield* Effect.fail(new InvalidPriceError(command.payload.price))
      }
    }),

  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword - just pure function parameters

      // Check if product already exists
      if (aggregate.state !== null) {
        return yield* Effect.fail(new ProductAlreadyExistsError(command.payload.sku))
      }

      // Create the event
      const event: Schema.Schema.Type<typeof ProductCreated> = {
        type: "ProductCreated",
        data: {
          name: command.payload.name,
          sku: command.payload.sku,
          price: command.payload.price,
          quantity: command.payload.initialStock,
          category: command.payload.category,
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
      }

      return [event]
    }),

  applicator: applyProductEvent,
})

/**
 * ✅ Add stock handler - functional approach
 */
const addStockHandler = createCommandHandler<
  ProductState | null,
  Schema.Schema.Type<typeof AddStock>,
  ProductEvent,
  ProductError
>({
  name: "AddStock",
  commandType: "AddStock",

  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword issues here

      if (aggregate.state === null) {
        return yield* Effect.fail(new ProductNotFoundError(aggregate.id))
      }

      if (!aggregate.state.isActive) {
        return yield* Effect.fail(new ProductInactiveError(aggregate.id))
      }

      const event: Schema.Schema.Type<typeof StockAdded> = {
        type: "StockAdded",
        data: {
          quantity: command.payload.quantity,
          reason: command.payload.reason,
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
      }

      return [event]
    }),

  applicator: applyProductEvent,
})

/**
 * ✅ Remove stock handler - functional approach
 */
const removeStockHandler = createCommandHandler<
  ProductState | null,
  Schema.Schema.Type<typeof RemoveStock>,
  ProductEvent,
  ProductError
>({
  name: "RemoveStock",
  commandType: "RemoveStock",

  execute: (aggregate, command) =>
    Effect.gen(function* () {
      // ✅ NO "this" keyword - pure function approach

      if (aggregate.state === null) {
        return yield* Effect.fail(new ProductNotFoundError(aggregate.id))
      }

      if (!aggregate.state.isActive) {
        return yield* Effect.fail(new ProductInactiveError(aggregate.id))
      }

      if (aggregate.state.quantity < command.payload.quantity) {
        return yield* Effect.fail(
          new InsufficientStockError(command.payload.quantity, aggregate.state.quantity)
        )
      }

      const event: Schema.Schema.Type<typeof StockRemoved> = {
        type: "StockRemoved",
        data: {
          quantity: command.payload.quantity,
          reason: command.payload.reason,
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
      }

      return [event]
    }),

  applicator: applyProductEvent,
})

// ============================================================================
// Repository - Functional Pattern
// ============================================================================

/**
 * ✅ Create product repository - functional approach
 */
const createProductRepository = () =>
  createRepository("Product", applyProductEvent, null)

// ============================================================================
// Demo - Pure Functional Workflow
// ============================================================================

/**
 * ✅ Demonstrate functional approach without "this" issues
 */
const runProductDemo = Effect.gen(function* () {
  console.log("🚀 Working Product Domain Demo\\n")
  console.log("✅ Using pure functions - NO 'this' keyword issues!\\n")

  // Create repository
  const repository = createProductRepository()

  // Create new product
  const productId = createAggregateId()
  console.log(`📦 Creating product with ID: ${productId}`)

  // Start with empty aggregate
  let productAggregate = createAggregate<ProductState, ProductEvent>(productId)

  // Create product command
  const createCommand: Schema.Schema.Type<typeof CreateProduct> = {
    type: "CreateProduct",
    payload: {
      name: nonEmptyString("Gaming Laptop"),
      sku: nonEmptyString("LAPTOP-001"),
      price: 1299.99,
      initialStock: 50,
      category: nonEmptyString("Electronics"),
    },
    metadata: {
      commandId: createCommandId(),
      aggregateId: productId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", id: "admin" as UserId },
    },
  }

  // ✅ Handle command - NO "this" issues
  productAggregate = yield* createProductHandler(productAggregate, createCommand)
  console.log("✅ Product created:", productAggregate.state)

  // Save and commit
  yield* repository.save(productAggregate)
  productAggregate = markEventsAsCommitted(productAggregate)
  console.log("💾 Product saved to repository")

  // Add stock
  const addStockCommand: Schema.Schema.Type<typeof AddStock> = {
    type: "AddStock",
    payload: {
      quantity: 25,
      reason: "Received new shipment",
    },
    metadata: {
      commandId: createEventId(),
      aggregateId: productId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", userId: "warehouse" as AggregateId },
    },
  }

  productAggregate = yield* addStockHandler(productAggregate, addStockCommand)
  console.log("✅ Stock added:", productAggregate.state)

  // Remove some stock
  const removeStockCommand: Schema.Schema.Type<typeof RemoveStock> = {
    type: "RemoveStock",
    payload: {
      quantity: 5,
      reason: "Customer purchase",
    },
    metadata: {
      commandId: createEventId(),
      aggregateId: productId,
      correlationId: createCorrelationId(),
      causationId: createCausationId(),
      timestamp: now(),
      actor: { type: "user", userId: "sales" as AggregateId },
    },
  }

  productAggregate = yield* removeStockHandler(productAggregate, removeStockCommand)
  console.log("✅ Stock removed:", productAggregate.state)

  // Save final state
  yield* repository.save(productAggregate)
  productAggregate = markEventsAsCommitted(productAggregate)
  console.log("💾 Final state saved")

  // Load from repository to verify
  const loadedAggregate = yield* repository.load(productId)
  console.log("\\n📖 Loaded from repository:")
  console.log("   State:", loadedAggregate.state)
  console.log("   Version:", loadedAggregate.version)
  console.log("   Uncommitted events:", loadedAggregate.uncommittedEvents.length)

  console.log("\\n🎉 Pure functional approach benefits:")
  console.log("   ✅ NO 'this' context issues in Effect.gen")
  console.log("   ✅ Pure functions are easy to test and reason about")
  console.log("   ✅ Clear separation of concerns")
  console.log("   ✅ Type-safe throughout")
  console.log("   ✅ Functional composition works perfectly")
})

// ============================================================================
// Run the Demo
// ============================================================================

if (import.meta.main) {
  pipe(
    runProductDemo,
    Effect.provide(CoreServicesLive),
    Effect.runPromise
  ).then(
    () => console.log("\\n✨ Demo completed successfully!"),
    (error) => console.error("❌ Demo failed:", error)
  )
}

export {
  // Types
  type ProductState,
  type ProductAggregate,
  type ProductEvent,
  type ProductCommand,
  type ProductError,

  // Event schemas
  ProductCreated,
  StockAdded,
  StockRemoved,
  PriceChanged,
  ProductDeactivated,

  // Command schemas
  CreateProduct,
  AddStock,
  RemoveStock,
  ChangePrice,
  DeactivateProduct,

  // Pure functions
  applyProductEvent,
  createProductHandler,
  addStockHandler,
  removeStockHandler,
  createProductRepository,

  // Demo
  runProductDemo,
}