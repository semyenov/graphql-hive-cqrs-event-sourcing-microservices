/**
 * Product Aggregate
 * 
 * Effect-based aggregate implementing product business logic
 */

import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import { BrandedTypes } from '@cqrs/framework';
import type { 
  ProductState, 
  ProductEvent, 
  ProductId, 
  ProductSKU,
  ProductPrice,
  CategoryId,
  ProductStatus,
  ProductDomainError,
  ProductNotFoundError,
  InsufficientInventoryError,
  InvalidProductStatusError,
  ProductEventTypes
} from './product.types';

/**
 * Product Aggregate implementing business rules with Effect-TS
 */
export class ProductAggregate {
  private constructor(
    private readonly _id: ProductId,
    private _state: ProductState | null = null,
    private _uncommittedEvents: ProductEvent[] = [],
    private _version: number = 0
  ) {}

  /**
   * Factory method to create a new aggregate instance
   */
  static create(id: ProductId): ProductAggregate {
    return new ProductAggregate(id);
  }

  /**
   * Factory method to reconstitute from events
   */
  static fromHistory(id: ProductId, events: ProductEvent[]): Effect.Effect<ProductAggregate, never, never> {
    return Effect.gen(function* (_) {
      const aggregate = new ProductAggregate(id);
      
      for (const event of events) {
        yield* _(aggregate.applyEventInternal(event, false));
      }
      
      return aggregate;
    });
  }

  // Getters
  get id(): ProductId { return this._id; }
  get state(): ProductState | null { return this._state; }
  get version(): number { return this._version; }
  get uncommittedEvents(): readonly ProductEvent[] { return [...this._uncommittedEvents]; }

  /**
   * Create a new product
   */
  createProduct(data: {
    name: string;
    description: string;
    sku: ProductSKU;
    price: ProductPrice;
    categoryId: CategoryId;
    initialQuantity: number;
    metadata?: ProductState['metadata'];
  }): Effect.Effect<void, InvalidProductStatusError, never> {
    if (this._state !== null) {
      return Effect.fail(
        new InvalidProductStatusError(this._id, this._state.status, ProductStatus.DRAFT)
      );
    }

    const event = Data.struct({
      type: ProductEventTypes.PRODUCT_CREATED,
      aggregateId: this._id,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        categoryId: data.categoryId,
        initialQuantity: data.initialQuantity,
        metadata: data.metadata || { tags: [] }
      }
    }) as ProductEvent;

    return this.applyEventInternal(event, true);
  }

  /**
   * Update product information
   */
  updateProduct = (data: {
    name?: string;
    description?: string;
    categoryId?: CategoryId;
    metadata?: Partial<ProductState['metadata']>;
  }): Effect.Effect<void, ProductNotFoundError | InvalidProductStatusError, never> => {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      if (this._state.status === ProductStatus.DISCONTINUED) {
        yield* _(Effect.fail(
          new InvalidProductStatusError(this._id, this._state.status, ProductStatus.ACTIVE)
        ));
      }

      const event = Data.struct({
        type: ProductEventTypes.PRODUCT_UPDATED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Activate product for sale
   */
  activateProduct(): Effect.Effect<void, ProductNotFoundError | InvalidProductStatusError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      if (this._state.status !== ProductStatus.DRAFT && this._state.status !== ProductStatus.INACTIVE) {
        yield* _(Effect.fail(
          new InvalidProductStatusError(this._id, this._state.status, ProductStatus.DRAFT)
        ));
      }

      const event = Data.struct({
        type: ProductEventTypes.PRODUCT_ACTIVATED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: {}
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Deactivate product
   */
  deactivateProduct(reason: string): Effect.Effect<void, ProductNotFoundError | InvalidProductStatusError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      if (this._state.status !== ProductStatus.ACTIVE) {
        yield* _(Effect.fail(
          new InvalidProductStatusError(this._id, this._state.status, ProductStatus.ACTIVE)
        ));
      }

      const event = Data.struct({
        type: ProductEventTypes.PRODUCT_DEACTIVATED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: { reason }
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Update inventory quantity
   */
  updateInventory(
    quantity: number, 
    reason: 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGE' | 'RETURN'
  ): Effect.Effect<void, ProductNotFoundError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      const event = Data.struct({
        type: ProductEventTypes.INVENTORY_UPDATED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: {
          previousQuantity: this._state.inventory.quantity,
          newQuantity: quantity,
          reason
        }
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Reserve inventory for an order
   */
  reserveInventory(
    quantity: number, 
    reservationId: string, 
    reason: string
  ): Effect.Effect<void, ProductNotFoundError | InsufficientInventoryError | InvalidProductStatusError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      if (this._state.status !== ProductStatus.ACTIVE) {
        yield* _(Effect.fail(
          new InvalidProductStatusError(this._id, this._state.status, ProductStatus.ACTIVE)
        ));
      }

      if (this._state.inventory.available < quantity) {
        yield* _(Effect.fail(
          new InsufficientInventoryError(this._id, quantity, this._state.inventory.available)
        ));
      }

      const event = Data.struct({
        type: ProductEventTypes.INVENTORY_RESERVED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: { quantity, reservationId, reason }
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Release reserved inventory
   */
  releaseInventory(
    quantity: number, 
    reservationId: string, 
    reason: 'CANCELLED' | 'EXPIRED' | 'FULFILLED'
  ): Effect.Effect<void, ProductNotFoundError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      const event = Data.struct({
        type: ProductEventTypes.INVENTORY_RELEASED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: { quantity, reservationId, reason }
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Update product price
   */
  updatePrice(
    newPrice: ProductPrice, 
    effectiveDate: string = new Date().toISOString(), 
    reason: string
  ): Effect.Effect<void, ProductNotFoundError, never> {
    return Effect.gen(function* (_) {
      if (!this._state) {
        yield* _(Effect.fail(new ProductNotFoundError(this._id)));
      }

      const event = Data.struct({
        type: ProductEventTypes.PRICE_UPDATED,
        aggregateId: this._id,
        version: BrandedTypes.eventVersion(this._version + 1),
        timestamp: new Date().toISOString(),
        data: {
          previousPrice: this._state.price,
          newPrice,
          effectiveDate,
          reason
        }
      }) as ProductEvent;

      yield* _(this.applyEventInternal(event, true));
    });
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Apply event to aggregate state
   */
  private applyEventInternal(event: ProductEvent, isNew: boolean): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      // Apply event to state
      this._state = this.applyEvent(this._state, event);
      this._version = typeof event.version === 'number' ? event.version : this._version + 1;
      
      // Add to uncommitted events if new
      if (isNew) {
        this._uncommittedEvents.push(event);
      }
    });
  }

  /**
   * Pure function to apply event to state (for testing and replay)
   */
  private applyEvent(currentState: ProductState | null, event: ProductEvent): ProductState {
    switch (event.type) {
      case ProductEventTypes.PRODUCT_CREATED:
        return {
          id: this._id,
          name: event.data.name,
          description: event.data.description,
          sku: event.data.sku,
          price: event.data.price,
          categoryId: event.data.categoryId,
          inventory: {
            quantity: event.data.initialQuantity,
            reserved: 0,
            available: event.data.initialQuantity
          },
          metadata: event.data.metadata,
          status: ProductStatus.DRAFT,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : 1
        };

      case ProductEventTypes.PRODUCT_UPDATED:
        if (!currentState) throw new Error('Cannot update non-existent product');
        return {
          ...currentState,
          name: event.data.name ?? currentState.name,
          description: event.data.description ?? currentState.description,
          categoryId: event.data.categoryId ?? currentState.categoryId,
          metadata: event.data.metadata ? { ...currentState.metadata, ...event.data.metadata } : currentState.metadata,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.PRODUCT_ACTIVATED:
        if (!currentState) throw new Error('Cannot activate non-existent product');
        return {
          ...currentState,
          status: ProductStatus.ACTIVE,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.PRODUCT_DEACTIVATED:
        if (!currentState) throw new Error('Cannot deactivate non-existent product');
        return {
          ...currentState,
          status: ProductStatus.INACTIVE,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.PRODUCT_DISCONTINUED:
        if (!currentState) throw new Error('Cannot discontinue non-existent product');
        return {
          ...currentState,
          status: ProductStatus.DISCONTINUED,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.INVENTORY_UPDATED:
        if (!currentState) throw new Error('Cannot update inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: event.data.newQuantity,
            reserved: currentState.inventory.reserved,
            available: event.data.newQuantity - currentState.inventory.reserved
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.INVENTORY_RESERVED:
        if (!currentState) throw new Error('Cannot reserve inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: currentState.inventory.quantity,
            reserved: currentState.inventory.reserved + event.data.quantity,
            available: currentState.inventory.available - event.data.quantity
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.INVENTORY_RELEASED:
        if (!currentState) throw new Error('Cannot release inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: currentState.inventory.quantity,
            reserved: Math.max(0, currentState.inventory.reserved - event.data.quantity),
            available: Math.min(currentState.inventory.quantity, currentState.inventory.available + event.data.quantity)
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case ProductEventTypes.PRICE_UPDATED:
        if (!currentState) throw new Error('Cannot update price of non-existent product');
        return {
          ...currentState,
          price: event.data.newPrice,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      default:
        // Type exhaustiveness check
        const _exhaustive: never = event;
        throw new Error(`Unknown event type: ${(_exhaustive as any).type}`);
    }
  }
}