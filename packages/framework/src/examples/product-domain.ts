/**
 * Product Domain Example
 * 
 * E-commerce product domain using ultra-clean architecture
 * Demonstrates advanced patterns: sagas, bulk operations, and complex aggregates
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"

// Import core schemas
import {
  AggregateId,
  NonEmptyString,
  PositiveNumber,
  NonNegativeNumber,
  Timestamp,
  Version,
  Url,
  createAggregateId,
  createEventId,
  createCommandId,
  createCausationId,
  now
} from "../schema/core/primitives"

import {
  createEventSchema,
  createCommandSchema,
  createQuerySchema
} from "../schema/core/messages"

// Import pure functions
import {
  createAggregate,
  createEventApplicator,
  createCommandHandler,
  executeCommand,
  loadFromEvents,
  createProjection,
  type EventSourcedAggregate
} from "../functions/event-sourcing"

// Import Effect services
import {
  EventStore,
  CommandBus,
  QueryBus,
  ProjectionStore,
  type CommandHandler as ServiceCommandHandler,
  type QueryHandler as ServiceQueryHandler
} from "../effects/services"

// Import saga patterns
import {
  createSequentialSaga,
  createParallelSaga,
  createStep
} from "../patterns/saga"

// Import GraphQL
import {
  type FederationEntity
} from "../graphql/federation"

// ============================================================================
// Domain Value Objects
// ============================================================================

/**
 * SKU (Stock Keeping Unit) - Product identifier
 */
export const SKU = pipe(
  Schema.String,
  Schema.pattern(/^[A-Z]{3}-[0-9]{6}$/),
  Schema.brand("SKU"),
  Schema.annotations({
    title: "SKU",
    description: "Product SKU in format XXX-000000"
  })
)
export type SKU = Schema.Schema.Type<typeof SKU>

/**
 * Money value object
 */
export const Money = Schema.Struct({
  amount: PositiveNumber,
  currency: Schema.Literal("USD", "EUR", "GBP")
})
export type Money = Schema.Schema.Type<typeof Money>

/**
 * Product category
 */
export const Category = Schema.Literal(
  "electronics",
  "clothing",
  "books",
  "food",
  "toys",
  "sports",
  "home"
)
export type Category = Schema.Schema.Type<typeof Category>

/**
 * Inventory status
 */
export const InventoryStatus = Schema.Literal(
  "in_stock",
  "low_stock",
  "out_of_stock",
  "discontinued"
)
export type InventoryStatus = Schema.Schema.Type<typeof InventoryStatus>

// ============================================================================
// Domain Schemas
// ============================================================================

/**
 * Product variant (size, color, etc.)
 */
const ProductVariant = Schema.Struct({
  id: AggregateId,
  name: NonEmptyString,
  sku: SKU,
  price: Money,
  stock: NonNegativeNumber,
  attributes: Schema.Record({ key: Schema.String, value: Schema.String })
})
export type ProductVariant = Schema.Schema.Type<typeof ProductVariant>

/**
 * Product state schema
 */
const ProductState = Schema.Struct({
  id: AggregateId,
  name: NonEmptyString,
  description: Schema.String,
  category: Category,
  basePrice: Money,
  variants: Schema.Array(ProductVariant),
  images: Schema.Array(Url),
  tags: Schema.Array(NonEmptyString),
  inventoryStatus: InventoryStatus,
  published: Schema.Boolean,
  featured: Schema.Boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Schema.optional(Timestamp)
})
export type ProductState = Schema.Schema.Type<typeof ProductState>

// ============================================================================
// Product Events
// ============================================================================

export const ProductCreated = createEventSchema(
  "ProductCreated",
  Schema.Struct({
    name: NonEmptyString,
    description: Schema.String,
    category: Category,
    basePrice: Money
  })
)

export const VariantAdded = createEventSchema(
  "VariantAdded",
  Schema.Struct({
    variant: ProductVariant
  })
)

export const PriceChanged = createEventSchema(
  "PriceChanged",
  Schema.Struct({
    variantId: Schema.optional(AggregateId),
    oldPrice: Money,
    newPrice: Money,
    reason: NonEmptyString
  })
)

export const StockAdjusted = createEventSchema(
  "StockAdjusted",
  Schema.Struct({
    variantId: AggregateId,
    adjustment: Schema.Number,
    newStock: NonNegativeNumber,
    reason: NonEmptyString
  })
)

export const ProductPublished = createEventSchema(
  "ProductPublished",
  Schema.Struct({
    publishedAt: Timestamp
  })
)

export const ProductUnpublished = createEventSchema(
  "ProductUnpublished",
  Schema.Struct({
    reason: NonEmptyString
  })
)

export const ProductFeatured = createEventSchema(
  "ProductFeatured",
  Schema.Struct({
    featuredUntil: Schema.optional(Timestamp)
  })
)

export const ProductDiscontinued = createEventSchema(
  "ProductDiscontinued",
  Schema.Struct({
    reason: NonEmptyString,
    clearancePrice: Schema.optional(Money)
  })
)

// Union of all product events
export const ProductEvent = Schema.Union(
  ProductCreated,
  VariantAdded,
  PriceChanged,
  StockAdjusted,
  ProductPublished,
  ProductUnpublished,
  ProductFeatured,
  ProductDiscontinued
)
export type ProductEvent = Schema.Schema.Type<typeof ProductEvent>

// ============================================================================
// Product Commands
// ============================================================================

export const CreateProduct = createCommandSchema(
  "CreateProduct",
  Schema.Struct({
    name: NonEmptyString,
    description: Schema.String,
    category: Category,
    basePrice: Money,
    initialStock: NonNegativeNumber
  })
)

export const AddVariant = createCommandSchema(
  "AddVariant",
  Schema.Struct({
    name: NonEmptyString,
    sku: SKU,
    price: Money,
    stock: NonNegativeNumber,
    attributes: Schema.Record({ key: Schema.String, value: Schema.String })
  })
)

export const ChangePrice = createCommandSchema(
  "ChangePrice",
  Schema.Struct({
    variantId: Schema.optional(AggregateId),
    newPrice: Money,
    reason: NonEmptyString
  })
)

export const AdjustStock = createCommandSchema(
  "AdjustStock",
  Schema.Struct({
    variantId: AggregateId,
    adjustment: Schema.Number,
    reason: NonEmptyString
  })
)

export const PublishProduct = createCommandSchema(
  "PublishProduct",
  Schema.Struct({})
)

export const FeatureProduct = createCommandSchema(
  "FeatureProduct",
  Schema.Struct({
    durationMillis: Schema.optional(Schema.Number)
  })
)

export const BulkPriceUpdate = createCommandSchema(
  "BulkPriceUpdate",
  Schema.Struct({
    percentage: Schema.Number,
    category: Schema.optional(Category),
    reason: NonEmptyString
  })
)

// Union of all product commands
export const ProductCommand = Schema.Union(
  CreateProduct,
  AddVariant,
  ChangePrice,
  AdjustStock,
  PublishProduct,
  FeatureProduct,
  BulkPriceUpdate
)
export type ProductCommand = Schema.Schema.Type<typeof ProductCommand>

// ============================================================================
// Product Queries
// ============================================================================

export const GetProductById = createQuerySchema(
  "GetProductById",
  Schema.Struct({
    productId: AggregateId
  })
)

export const SearchProducts = createQuerySchema(
  "SearchProducts",
  Schema.Struct({
    query: Schema.String,
    category: Schema.optional(Category),
    minPrice: Schema.optional(PositiveNumber),
    maxPrice: Schema.optional(PositiveNumber),
    inStock: Schema.optional(Schema.Boolean),
    featured: Schema.optional(Schema.Boolean)
  })
)

export const GetFeaturedProducts = createQuerySchema(
  "GetFeaturedProducts",
  Schema.Struct({
    limit: Schema.optional(PositiveNumber)
  })
)

export const GetLowStockProducts = createQuerySchema(
  "GetLowStockProducts",
  Schema.Struct({
    threshold: PositiveNumber
  })
)

export const ProductQuery = Schema.Union(
  GetProductById,
  SearchProducts,
  GetFeaturedProducts,
  GetLowStockProducts
)
export type ProductQuery = Schema.Schema.Type<typeof ProductQuery>

// ============================================================================
// Domain Errors
// ============================================================================

export class ProductNotFound {
  readonly _tag = "ProductNotFound"
  constructor(readonly productId: AggregateId) {}
}

export class VariantNotFound {
  readonly _tag = "VariantNotFound"
  constructor(readonly variantId: AggregateId) {}
}

export class InsufficientStock {
  readonly _tag = "InsufficientStock"
  constructor(
    readonly requested: number,
    readonly available: number
  ) {}
}

export class InvalidPriceChange {
  readonly _tag = "InvalidPriceChange"
  constructor(readonly reason: string) {}
}

export class ProductNotPublishable {
  readonly _tag = "ProductNotPublishable"
  constructor(readonly reason: string) {}
}

export type ProductError =
  | ProductNotFound
  | VariantNotFound
  | InsufficientStock
  | InvalidPriceChange
  | ProductNotPublishable

// ============================================================================
// Pure Event Application
// ============================================================================

/**
 * Apply product events to state
 */
export const applyProductEvent = createEventApplicator<ProductState, ProductEvent>({
  ProductCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    name: event.data.name,
    description: event.data.description,
    category: event.data.category,
    basePrice: event.data.basePrice,
    variants: [],
    images: [],
    tags: [],
    inventoryStatus: "in_stock" as const,
    published: false,
    featured: false,
    createdAt: event.metadata.timestamp,
    updatedAt: event.metadata.timestamp
  }),

  VariantAdded: (state, event) =>
    state ? {
      ...state,
      variants: [...state.variants, event.data.variant],
      updatedAt: event.metadata.timestamp
    } : null,

  PriceChanged: (state, event) =>
    state ? {
      ...state,
      basePrice: event.data.variantId ? state.basePrice : event.data.newPrice,
      variants: event.data.variantId
        ? state.variants.map(v =>
            v.id === event.data.variantId
              ? { ...v, price: event.data.newPrice }
              : v
          )
        : state.variants,
      updatedAt: event.metadata.timestamp
    } : null,

  StockAdjusted: (state, event) =>
    state ? {
      ...state,
      variants: state.variants.map(v =>
        v.id === event.data.variantId
          ? { ...v, stock: event.data.newStock }
          : v
      ),
      inventoryStatus: calculateInventoryStatus(state, event.data.variantId, event.data.newStock),
      updatedAt: event.metadata.timestamp
    } : null,

  ProductPublished: (_state, event) =>
    _state ? {
      ..._state,
      published: true,
      publishedAt: event.data.publishedAt,
      updatedAt: event.metadata.timestamp
    } : null,

  ProductUnpublished: (_state, _event) =>
    _state ? {
      ..._state,
      published: false,
      publishedAt: undefined,
      updatedAt: _event.metadata.timestamp
    } : null,

  ProductFeatured: (_state, _event) =>
    state ? {
      ...state,
      featured: true,
      updatedAt: event.metadata.timestamp
    } : null,

  ProductDiscontinued: (state, _event) => null
})

/**
 * Calculate inventory status based on stock levels
 */
const calculateInventoryStatus = (
  state: ProductState,
  variantId: AggregateId,
  newStock: number
): InventoryStatus => {
  const totalStock = state.variants.reduce((sum, v) =>
    sum + (v.id === variantId ? newStock : v.stock), 0
  )
  
  if (totalStock === 0) return "out_of_stock"
  if (totalStock < 10) return "low_stock"
  return "in_stock"
}

// ============================================================================
// Pure Command Handling
// ============================================================================

/**
 * Handle product commands
 */
export const handleProductCommand = createCommandHandler<
  ProductState,
  ProductCommand,
  ProductEvent,
  ProductError
>({
  CreateProduct: (state, command) =>
    Effect.gen(function* () {
      if (state !== null) {
        return {
          type: "failure" as const,
          error: new InvalidPriceChange("Product already exists")
        }
      }

      const event: Schema.Schema.Type<typeof ProductCreated> = {
        type: "ProductCreated" as const,
        data: {
          name: command.payload.name,
          description: command.payload.description,
          category: command.payload.category,
          basePrice: command.payload.basePrice
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 0 as Version,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }

      return {
        type: "success" as const,
        events: [event]
      }
    }),

  AddVariant: (state, command) =>
    Effect.gen(function* () {
      if (!state) {
        return {
          type: "failure" as const,
          error: new ProductNotFound(command.aggregateId)
        }
      }

      const variant: ProductVariant = {
        id: createAggregateId(),
        name: command.payload.name,
        sku: command.payload.sku,
        price: command.payload.price,
        stock: command.payload.stock,
        attributes: command.payload.attributes
      }

      const event: Schema.Schema.Type<typeof VariantAdded> = {
        type: "VariantAdded" as const,
        data: { variant },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any).version + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }

      return {
        type: "success" as const,
        events: [event]
      }
    }),

  AdjustStock: (state, command) =>
    Effect.gen(function* () {
      if (!state) {
        return {
          type: "failure" as const,
          error: new ProductNotFound(command.aggregateId)
        }
      }

      const variant = state.variants.find(v => v.id === command.payload.variantId)
      if (!variant) {
        return {
          type: "failure" as const,
          error: new VariantNotFound(command.payload.variantId)
        }
      }

      const newStock = variant.stock + command.payload.adjustment
      if (newStock < 0) {
        return {
          type: "failure" as const,
          error: new InsufficientStock(
            Math.abs(command.payload.adjustment),
            variant.stock
          )
        }
      }

      const event: Schema.Schema.Type<typeof StockAdjusted> = {
        type: "StockAdjusted" as const,
        data: {
          variantId: command.payload.variantId,
          adjustment: command.payload.adjustment,
          newStock: newStock as NonNegativeNumber,
          reason: command.payload.reason
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any).version + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }

      return {
        type: "success" as const,
        events: [event]
      }
    }),

  PublishProduct: (state, command) =>
    Effect.gen(function* () {
      if (!state) {
        return {
          type: "failure" as const,
          error: new ProductNotFound(command.aggregateId)
        }
      }

      if (state.published) {
        return {
          type: "success" as const,
          events: [] // Already published
        }
      }

      if (state.variants.length === 0) {
        return {
          type: "failure" as const,
          error: new ProductNotPublishable("Product must have at least one variant")
        }
      }

      const event: Schema.Schema.Type<typeof ProductPublished> = {
        type: "ProductPublished" as const,
        data: {
          publishedAt: now()
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any).version + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }

      return {
        type: "success" as const,
        events: [event]
      }
    }),

  ChangePrice: () =>
    Effect.succeed({
      type: "success" as const,
      events: []
    }),

  FeatureProduct: () =>
    Effect.succeed({
      type: "success" as const,
      events: []
    }),

  BulkPriceUpdate: () =>
    Effect.succeed({
      type: "success" as const,
      events: []
    })
})

// ============================================================================
// Product Aggregate
// ============================================================================

export type ProductAggregate = EventSourcedAggregate<ProductState, ProductEvent>

export const createProductAggregate = (
  id: AggregateId = createAggregateId()
): ProductAggregate =>
  createAggregate<ProductState, ProductEvent>({
    id,
    name: "" as NonEmptyString,
    description: "",
    category: "electronics",
    basePrice: { amount: 0 as PositiveNumber, currency: "USD" },
    variants: [],
    images: [],
    tags: [],
    inventoryStatus: "in_stock",
    published: false,
    featured: false,
    createdAt: now(),
    updatedAt: now()
  })

export const loadProductFromEvents = (events: ReadonlyArray<ProductEvent>): ProductAggregate =>
  loadFromEvents(applyProductEvent)(events)

export const executeProductCommand = (
  aggregate: ProductAggregate,
  command: ProductCommand
): Effect.Effect<ProductAggregate, ProductError, never> =>
  executeCommand(handleProductCommand, applyProductEvent)(aggregate, command)

// ============================================================================
// Projections
// ============================================================================

/**
 * Product catalog projection
 */
export const ProductCatalogProjection = createProjection(
  "ProductCatalog",
  [] as Array<{
    id: AggregateId
    name: string
    category: Category
    price: Money
    inventoryStatus: InventoryStatus
    published: boolean
    featured: boolean
  }>,
  {
    ProductCreated: (state, event: any) => [
      ...state,
      {
        id: event.metadata.aggregateId,
        name: event.data.name,
        category: event.data.category,
        price: event.data.basePrice.amount,
        inventoryStatus: "in_stock" as const,
        published: false,
        featured: false
      }
    ],

    PriceChanged: (state, event: any) =>
      state.map(product =>
        product.id === event.metadata.aggregateId && !event.data.variantId
          ? { ...product, price: event.data.newPrice }
          : product
      ),

    ProductPublished: (_state, event: any) =>
      _state.map((product: any) =>
        product.id === event.metadata.aggregateId
          ? { ...product, published: true }
          : product
      ),

    ProductFeatured: (state, event: any) =>
      state.map(product =>
        product.id === event.metadata.aggregateId
          ? { ...product, featured: true }
          : product
      ),

    ProductDiscontinued: (state, event: any) =>
      state.filter(product => product.id !== event.metadata.aggregateId)
  }
)

/**
 * Low stock alert projection
 */
export const LowStockProjection = createProjection(
  "LowStock",
  [] as Array<{
    productId: AggregateId
    variantId: AggregateId
    name: string
    sku: SKU
    currentStock: number
    lastUpdated: Timestamp
  }>,
  {
    StockAdjusted: (state, event: any) => {
      const filtered = state.filter(item =>
        !(item.productId === event.metadata.aggregateId &&
          item.variantId === event.data.variantId)
      )

      if (event.data.newStock < 10 && event.data.newStock > 0) {
        return [
          ...filtered,
          {
            productId: event.metadata.aggregateId,
            variantId: event.data.variantId,
            name: "", // Would need to track this
            sku: "" as SKU, // Would need to track this
            currentStock: event.data.newStock,
            lastUpdated: event.metadata.timestamp
          }
        ]
      }

      return filtered
    }
  }
)

// ============================================================================
// Sagas / Process Managers
// ============================================================================

/**
 * Product launch saga - coordinates product publication
 */
export const ProductLaunchSaga = createSequentialSaga<
  { productId: AggregateId; marketingCampaignId: string },
  { success: boolean; launchedAt: Timestamp }
>("ProductLaunch", [
  createStep({
    name: "ValidateProduct",
    execute: (input) =>
      Effect.gen(function* () {
        // Validate product has all required data
        const queryBus = yield* QueryBus
        const product = yield* queryBus.execute({
          type: "GetProductById",
          params: { productId: input.productId }
        } as any)
        
        if (!product) {
          return yield* Effect.fail("Product not found")
        }
        
        return { ...input, validated: true }
      }),
    canRetry: true
  }),

  createStep({
    name: "PrepareInventory",
    execute: (input) =>
      Effect.gen(function* () {
        // Ensure sufficient inventory
        yield* Effect.log("Preparing inventory for launch")
        return { ...input, inventoryPrepared: true }
      }),
    compensate: (input) =>
      Effect.gen(function* () {
        // Release reserved inventory
        yield* Effect.log("Releasing reserved inventory")
      }),
    timeout: Duration.minutes(5)
  }),

  createStep({
    name: "PublishProduct",
    execute: (input) =>
      Effect.gen(function* () {
        const commandBus = yield* CommandBus
        yield* commandBus.send({
          type: "PublishProduct",
          aggregateId: input.productId,
          payload: {},
          metadata: {
            commandId: createCommandId(),
            correlationId: "launch-saga",
            timestamp: now(),
            actor: { type: "system", service: "product-launch" }
          }
        } as any)
        
        return { ...input, published: true }
      }),
    compensate: (input) =>
      Effect.gen(function* () {
        // Unpublish product
        yield* Effect.log("Unpublishing product")
      })
  }),

  createStep({
    name: "LaunchMarketing",
    execute: (input) =>
      Effect.gen(function* () {
        // Trigger marketing campaign
        yield* Effect.log(`Launching marketing campaign ${input.marketingCampaignId}`)
        return { success: true, launchedAt: now() }
      }),
    compensate: () =>
      Effect.gen(function* () {
        // Cancel marketing campaign
        yield* Effect.log("Cancelling marketing campaign")
      })
  })
])

/**
 * Inventory replenishment saga
 */
export const InventoryReplenishmentSaga = createParallelSaga<
  { products: ReadonlyArray<{ id: AggregateId; quantity: number }> },
  { ordersPlaced: number }
>(
  "InventoryReplenishment",
  [
    createStep({
      name: "AnalyzeStock",
      execute: (input) =>
        Effect.gen(function* () {
          yield* Effect.log(`Analyzing stock for ${input.products.length} products`)
          return { needsReplenishment: true }
        })
    }),
    
    createStep({
      name: "CalculateOptimalOrder",
      execute: (input) =>
        Effect.gen(function* () {
          // Calculate EOQ or other ordering strategy
          return { optimalQuantities: input.products }
        })
    }),
    
    createStep({
      name: "CheckBudget",
      execute: (_input) =>
        Effect.gen(function* () {
          // Verify budget availability
          return { budgetApproved: true }
        })
    })
  ],
  (results) => ({ ordersPlaced: results.length })
)

// ============================================================================
// Service Layer
// ============================================================================

/**
 * Product command handlers for command bus
 */
export const ProductCommandHandlers = {
  CreateProduct: ((command: Schema.Schema.Type<typeof CreateProduct>) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const aggregate = createProductAggregate(command.aggregateId)
      const result = yield* executeProductCommand(aggregate, command)
      
      const streamName = `Product-${command.aggregateId}` as any
      yield* eventStore.append(
        streamName,
        result.uncommittedEvents,
        result.version
      )
      
      return { success: true, productId: command.aggregateId }
    })) as ServiceCommandHandler<any, any>,

  PublishProduct: ((command: Schema.Schema.Type<typeof PublishProduct>) =>
    Effect.gen(function* () {
      // Would load aggregate and execute command
      return { success: true, publishedAt: now() }
    })) as ServiceCommandHandler<any, any>
}

/**
 * Product query handlers for query bus
 */
export const ProductQueryHandlers = {
  GetProductById: ((query: Schema.Schema.Type<typeof GetProductById>) =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore
      const catalog = yield* projectionStore.load<any>("ProductCatalog")
      
      return Option.match(catalog, {
        onNone: () => null,
        onSome: (products) =>
          products.find((p: any) => p.id === query.params.productId) || null
      })
    })) as ServiceQueryHandler<any, any>,

  GetFeaturedProducts: ((query: Schema.Schema.Type<typeof GetFeaturedProducts>) =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore
      const catalog = yield* projectionStore.load<any>("ProductCatalog")
      
      return Option.match(catalog, {
        onNone: () => [],
        onSome: (products) => {
          const featured = products.filter((p: any) => p.featured)
          const limit = query.params.limit || 10
          return featured.slice(0, Number(limit))
        }
      })
    })) as ServiceQueryHandler<any, any>,

  GetLowStockProducts: ((query: Schema.Schema.Type<typeof GetLowStockProducts>) =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore
      const lowStock = yield* projectionStore.load<any>("LowStock")
      
      return Option.match(lowStock, {
        onNone: () => [],
        onSome: (items) =>
          items.filter((item: any) => 
            item.currentStock < Number(query.params.threshold)
          )
      })
    })) as ServiceQueryHandler<any, any>
}

// ============================================================================
// GraphQL Federation Entity
// ============================================================================

export const ProductEntity: FederationEntity<ProductState> = {
  typename: "Product",
  key: "id",
  schema: ProductState,
  
  resolveReference: (reference) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const streamName = `Product-${reference.id}` as any
      
      const events = yield* pipe(
        eventStore.read<ProductEvent>(streamName),
        Effect.map(Array.from),
        Effect.orElseSucceed(() => [])
      )
      
      if (events.length === 0) {
        return yield* Effect.fail(
          new ProductNotFound(reference.id)
        )
      }
      
      const aggregate = loadProductFromEvents(events)
      return aggregate.state
    }),
  
  fields: {
    displayPrice: (product) => {
      const lowestPrice = Math.min(
        product.basePrice.amount,
        ...product.variants.map(v => v.price.amount)
      )
      return `${product.basePrice.currency} ${lowestPrice}`
    },
    
    hasStock: (product) => {
      const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)
      return totalStock > 0
    },
    
    variantCount: (product) => product.variants.length
  }
}

// ============================================================================
// Service Layer Configuration
// ============================================================================

/**
 * Register all product domain handlers
 */
export const registerProductDomain = Effect.gen(function* () {
  const commandBus = yield* CommandBus
  const queryBus = yield* QueryBus
  
  // Register command handlers
  yield* commandBus.register("CreateProduct", ProductCommandHandlers.CreateProduct)
  yield* commandBus.register("PublishProduct", ProductCommandHandlers.PublishProduct)
  
  // Register query handlers
  yield* queryBus.register("GetProductById", ProductQueryHandlers.GetProductById)
  yield* queryBus.register("GetFeaturedProducts", ProductQueryHandlers.GetFeaturedProducts)
  yield* queryBus.register("GetLowStockProducts", ProductQueryHandlers.GetLowStockProducts)
})

/**
 * Product domain layer
 */
export const ProductDomainLive = Layer.effectDiscard(registerProductDomain)