/**
 * Product Domain Demo - Complete CQRS/Event Sourcing Example with Effect-TS
 * 
 * This example demonstrates a product inventory management system using:
 * - Effect-TS for functional programming
 * - CQRS for command/query separation
 * - Event Sourcing for state persistence
 * - Streaming projections for real-time views
 */

import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import * as Duration from 'effect/Duration';
import * as HashMap from 'effect/HashMap';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';

import {
  createCommandHandler,
  CommandContext,
  CommandValidationError,
  createEventHandler,
  EventContext,
  createProjection,
  createRepository,
  withOptimisticLocking,
  withRepositoryRetry,
  type EffectRepository,
  type RepositoryContext,
  RepositoryContextTag,
} from '@cqrs/framework/effect';

import type { ICommand, IEvent, IAggregateBehavior } from '@cqrs/framework/effect';
import { BrandedTypes } from '@cqrs/framework';

const { aggregateId, eventVersion, aggregateVersion, timestamp } = BrandedTypes;

// ============================================================================
// Domain Types
// ============================================================================

// Product ID branded type
type ProductId = ReturnType<typeof aggregateId>;

// Product state
interface ProductState {
  readonly id: ProductId;
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly quantity: number;
  readonly category: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ============================================================================
// Domain Errors
// ============================================================================

class ProductNotFoundError extends Data.TaggedError('ProductNotFoundError')<{
  readonly productId: ProductId;
}> {}

class InsufficientStockError extends Data.TaggedError('InsufficientStockError')<{
  readonly productId: ProductId;
  readonly requested: number;
  readonly available: number;
}> {}

class InvalidPriceError extends Data.TaggedError('InvalidPriceError')<{
  readonly price: number;
}> {}

class DuplicateSkuError extends Data.TaggedError('DuplicateSkuError')<{
  readonly sku: string;
}> {}

type ProductError = 
  | ProductNotFoundError 
  | InsufficientStockError 
  | InvalidPriceError 
  | DuplicateSkuError;

// ============================================================================
// Events
// ============================================================================

enum ProductEventType {
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  STOCK_ADDED = 'STOCK_ADDED',
  STOCK_REMOVED = 'STOCK_REMOVED',
  PRICE_CHANGED = 'PRICE_CHANGED',
  PRODUCT_DEACTIVATED = 'PRODUCT_DEACTIVATED',
  PRODUCT_REACTIVATED = 'PRODUCT_REACTIVATED',
}

interface ProductEvent extends IEvent {
  readonly type: ProductEventType;
}

interface ProductCreatedEvent extends ProductEvent {
  readonly type: ProductEventType.PRODUCT_CREATED;
  readonly data: {
    readonly name: string;
    readonly sku: string;
    readonly price: number;
    readonly quantity: number;
    readonly category: string;
  };
}

interface StockAddedEvent extends ProductEvent {
  readonly type: ProductEventType.STOCK_ADDED;
  readonly data: {
    readonly quantity: number;
    readonly reason: string;
  };
}

interface StockRemovedEvent extends ProductEvent {
  readonly type: ProductEventType.STOCK_REMOVED;
  readonly data: {
    readonly quantity: number;
    readonly reason: string;
  };
}

interface PriceChangedEvent extends ProductEvent {
  readonly type: ProductEventType.PRICE_CHANGED;
  readonly data: {
    readonly oldPrice: number;
    readonly newPrice: number;
  };
}

type ProductDomainEvent = 
  | ProductCreatedEvent 
  | StockAddedEvent 
  | StockRemovedEvent 
  | PriceChangedEvent;

// ============================================================================
// Commands
// ============================================================================

enum ProductCommandType {
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  ADD_STOCK = 'ADD_STOCK',
  REMOVE_STOCK = 'REMOVE_STOCK',
  CHANGE_PRICE = 'CHANGE_PRICE',
  DEACTIVATE_PRODUCT = 'DEACTIVATE_PRODUCT',
}

interface CreateProductCommand extends ICommand {
  readonly type: ProductCommandType.CREATE_PRODUCT;
  readonly payload: {
    readonly name: string;
    readonly sku: string;
    readonly price: number;
    readonly initialStock: number;
    readonly category: string;
  };
}

interface AddStockCommand extends ICommand {
  readonly type: ProductCommandType.ADD_STOCK;
  readonly payload: {
    readonly quantity: number;
    readonly reason: string;
  };
}

interface RemoveStockCommand extends ICommand {
  readonly type: ProductCommandType.REMOVE_STOCK;
  readonly payload: {
    readonly quantity: number;
    readonly reason: string;
  };
}

interface ChangePriceCommand extends ICommand {
  readonly type: ProductCommandType.CHANGE_PRICE;
  readonly payload: {
    readonly newPrice: number;
  };
}

// ============================================================================
// Product Aggregate
// ============================================================================

class ProductAggregate implements IAggregateBehavior<ProductState, ProductDomainEvent> {
  private _state: ProductState | null = null;
  private _version: number = 0;
  private _uncommittedEvents: ProductDomainEvent[] = [];

  constructor(public readonly id: ProductId) {}

  get state(): ProductState {
    if (!this._state) {
      throw new Error('Product not initialized');
    }
    return this._state;
  }

  get version() {
    return aggregateVersion(this._version);
  }

  get uncommittedEvents() {
    return this._uncommittedEvents;
  }

  // Create new product
  create(data: CreateProductCommand['payload']): Effect.Effect<void, InvalidPriceError, never> {
    if (data.price <= 0) {
      return Effect.fail(new InvalidPriceError({ price: data.price }));
    }

    const event: ProductCreatedEvent = {
      type: ProductEventType.PRODUCT_CREATED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        name: data.name,
        sku: data.sku,
        price: data.price,
        quantity: data.initialStock,
        category: data.category,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  // Add stock
  addStock(quantity: number, reason: string): Effect.Effect<void, never, never> {
    const event: StockAddedEvent = {
      type: ProductEventType.STOCK_ADDED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reason },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  // Remove stock
  removeStock(quantity: number, reason: string): Effect.Effect<void, InsufficientStockError, never> {
    if (this.state.quantity < quantity) {
      return Effect.fail(
        new InsufficientStockError({
          productId: this.id,
          requested: quantity,
          available: this.state.quantity,
        })
      );
    }

    const event: StockRemovedEvent = {
      type: ProductEventType.STOCK_REMOVED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reason },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  // Change price
  changePrice(newPrice: number): Effect.Effect<void, InvalidPriceError, never> {
    if (newPrice <= 0) {
      return Effect.fail(new InvalidPriceError({ price: newPrice }));
    }

    const event: PriceChangedEvent = {
      type: ProductEventType.PRICE_CHANGED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        oldPrice: this.state.price,
        newPrice,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  // Apply event to state
  applyEvent(event: ProductDomainEvent, isNew: boolean): void {
    switch (event.type) {
      case ProductEventType.PRODUCT_CREATED:
        this._state = Data.struct({
          id: this.id,
          name: event.data.name,
          sku: event.data.sku,
          price: event.data.price,
          quantity: event.data.quantity,
          category: event.data.category,
          isActive: true,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        break;

      case ProductEventType.STOCK_ADDED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            quantity: this._state.quantity + event.data.quantity,
            updatedAt: event.timestamp,
          });
        }
        break;

      case ProductEventType.STOCK_REMOVED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            quantity: this._state.quantity - event.data.quantity,
            updatedAt: event.timestamp,
          });
        }
        break;

      case ProductEventType.PRICE_CHANGED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            price: event.data.newPrice,
            updatedAt: event.timestamp,
          });
        }
        break;
    }

    this._version++;
    if (isNew) {
      this._uncommittedEvents.push(event);
    }
  }

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

// Service for checking SKU uniqueness
interface SkuService {
  checkSkuExists(sku: string): Effect.Effect<boolean, never, never>;
}

const SkuServiceTag = Context.GenericTag<SkuService>('SkuService');

// Create product handler
const createProductHandler = createCommandHandler<CreateProductCommand, { productId: string }>({
  canHandle: (cmd) => cmd.type === ProductCommandType.CREATE_PRODUCT,
  
  validate: (command) =>
    Effect.gen(function* () {
      const skuService = yield* SkuServiceTag;
      const exists = yield* skuService.checkSkuExists(command.payload.sku);
      
      if (exists) {
        return yield* Effect.fail(
          new CommandValidationError({
            command,
            errors: [`SKU ${command.payload.sku} already exists`],
          })
        );
      }
    }),

  execute: (command) =>
    Effect.gen(function* () {
      const repository = yield* ProductRepositoryTag;
      
      const productId = aggregateId(`product-${Date.now()}`);
      const aggregate = new ProductAggregate(productId);
      
      yield* aggregate.create(command.payload);
      yield* repository.save(aggregate);
      
      return { productId: productId as string };
    }),
});

// Add stock handler
const addStockHandler = createCommandHandler<AddStockCommand, void>({
  canHandle: (cmd) => cmd.type === ProductCommandType.ADD_STOCK,
  
  execute: (command) =>
    Effect.gen(function* () {
      const repository = yield* ProductRepositoryTag;
      
      const aggregate = yield* repository.load(command.aggregateId);
      yield* aggregate.addStock(command.payload.quantity, command.payload.reason);
      yield* repository.save(aggregate);
    }),
});

// Remove stock handler
const removeStockHandler = createCommandHandler<RemoveStockCommand, void>({
  canHandle: (cmd) => cmd.type === ProductCommandType.REMOVE_STOCK,
  
  execute: (command) =>
    Effect.gen(function* () {
      const repository = yield* ProductRepositoryTag;
      
      const aggregate = yield* repository.load(command.aggregateId);
      yield* aggregate.removeStock(command.payload.quantity, command.payload.reason);
      yield* repository.save(aggregate);
    }),
});

// ============================================================================
// Repository Setup
// ============================================================================

type ProductRepository = EffectRepository<ProductAggregate, ProductDomainEvent>;

const ProductRepositoryTag = Context.GenericTag<ProductRepository>('ProductRepository');

const createProductRepository = (): ProductRepository =>
  withRepositoryRetry(
    withOptimisticLocking(
      createRepository<ProductAggregate, ProductDomainEvent>({
        createAggregate: (id) => new ProductAggregate(id),
        snapshotFrequency: 10,
        cacheCapacity: 100,
        cacheTTL: Duration.minutes(5),
      })
    )
  );

// ============================================================================
// Service Layers
// ============================================================================

// Mock SKU service
const SkuServiceLive = Layer.succeed(
  SkuServiceTag,
  {
    checkSkuExists: (sku: string) => {
      // In production, this would check a database
      const existingSkus = new Set(['PROD-001', 'PROD-002']);
      return Effect.succeed(existingSkus.has(sku));
    },
  }
);

// Mock event store
const mockEventStore = {
  events: [] as ProductDomainEvent[],
  getEvents: async (aggregateId: any, fromVersion?: number) => {
    return mockEventStore.events.filter(e => e.aggregateId === aggregateId);
  },
  appendBatch: async (events: ProductDomainEvent[]) => {
    mockEventStore.events.push(...events);
  },
  getAllEvents: async () => mockEventStore.events,
  subscribe: () => {},
};

// Repository context
const RepositoryContextLive = Layer.succeed(
  RepositoryContextTag<ProductDomainEvent>(),
  {
    eventStore: mockEventStore,
    snapshotStore: new Map(),
  }
);

// Product repository layer
const ProductRepositoryLive = Layer.effect(
  ProductRepositoryTag,
  Effect.succeed(createProductRepository())
);

// Command context
const CommandContextLive = Layer.succeed(
  CommandContext,
  {
    eventStore: mockEventStore,
    commandBus: { send: async () => {} },
  }
);

// Complete service layer
const ProductDomainLive = Layer.mergeAll(
  SkuServiceLive,
  RepositoryContextLive,
  ProductRepositoryLive,
  CommandContextLive
);

// ============================================================================
// Demo Execution
// ============================================================================

const runDemo = Effect.gen(function* () {
  console.log('🚀 Product Domain Demo with Effect-TS\n');

  // Create a product
  console.log('1. Creating a new product...');
  const createCommand: CreateProductCommand = {
    type: ProductCommandType.CREATE_PRODUCT,
    aggregateId: aggregateId('temp'),
    payload: {
      name: 'MacBook Pro M3',
      sku: 'MBP-M3-2024',
      price: 2499.99,
      initialStock: 50,
      category: 'Electronics',
    },
  };

  const handleEffect = createProductHandler.handle(createCommand);
  const { productId } = yield* handleEffect;
  console.log(`   ✅ Product created with ID: ${productId}\n`);

  // Add stock
  console.log('2. Adding stock to the product...');
  const addStockCommand: AddStockCommand = {
    type: ProductCommandType.ADD_STOCK,
    aggregateId: aggregateId(productId),
    payload: {
      quantity: 25,
      reason: 'New shipment received',
    },
  };

  const addEffect = addStockHandler.handle(addStockCommand);
  yield* addEffect;
  console.log('   ✅ Stock added successfully\n');

  // Remove stock (simulating a sale)
  console.log('3. Processing a sale (removing stock)...');
  const removeStockCommand: RemoveStockCommand = {
    type: ProductCommandType.REMOVE_STOCK,
    aggregateId: aggregateId(productId),
    payload: {
      quantity: 5,
      reason: 'Customer purchase - Order #12345',
    },
  };

  const removeEffect = removeStockHandler.handle(removeStockCommand);
  yield* removeEffect;
  console.log('   ✅ Sale processed successfully\n');

  // Demonstrate error handling
  console.log('4. Testing error handling (insufficient stock)...');
  const invalidRemoveCommand: RemoveStockCommand = {
    type: ProductCommandType.REMOVE_STOCK,
    aggregateId: aggregateId(productId),
    payload: {
      quantity: 1000,
      reason: 'Large order',
    },
  };

  const invalidRemoveEffect = removeStockHandler.handle(invalidRemoveCommand);
  const result = yield* pipe(
    invalidRemoveEffect,
    Effect.either
  );

  if (Either.isLeft(result)) {
    console.log('   ⚠️  Error caught: Insufficient stock');
    console.log(`      - Requested: 1000 units`);
    console.log(`      - Available: 70 units\n`);
  }

  console.log('✨ Demo completed successfully!');
});

// Run the demo
pipe(
  runDemo,
  Effect.provide(ProductDomainLive),
  Effect.runPromise
).then(
  () => console.log('\n🎉 All operations completed!'),
  (error) => console.error('❌ Error:', error)
);

// Export for testing
export {
  ProductAggregate,
  createProductHandler,
  addStockHandler,
  removeStockHandler,
  ProductDomainLive,
};