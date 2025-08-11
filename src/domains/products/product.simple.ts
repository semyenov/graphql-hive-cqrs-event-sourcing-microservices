/**
 * Simple Product Implementation for Testing
 * 
 * Simplified version without Effect.gen complexity for testing
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
  ProductEventTypes,
  ProductNotFoundError,
  InvalidProductStatusError
} from './product.types';

/**
 * Simplified Product Aggregate for testing
 */
export class SimpleProductAggregate {
  private _state: ProductState | null = null;
  private _uncommittedEvents: ProductEvent[] = [];
  private _version: number = 0;

  constructor(private readonly _id: ProductId) {}

  static create(id: ProductId): SimpleProductAggregate {
    return new SimpleProductAggregate(id);
  }

  get id(): ProductId { return this._id; }
  get state(): ProductState | null { return this._state; }
  get version(): number { return this._version; }
  get uncommittedEvents(): readonly ProductEvent[] { return [...this._uncommittedEvents]; }

  /**
   * Create a new product - simplified version
   */
  createProduct(data: {
    name: string;
    description: string;
    sku: ProductSKU;
    price: ProductPrice;
    categoryId: CategoryId;
    initialQuantity: number;
    metadata?: ProductState['metadata'];
  }): void {
    if (this._state !== null) {
      throw new Error(`Product already exists: ${this._id}`);
    }

    const event: ProductEvent = {
      type: 'ProductCreated' as any,
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
    } as ProductEvent;

    this.applyEvent(event, true);
  }

  /**
   * Activate product
   */
  activateProduct(): void {
    if (!this._state) {
      throw new Error(`Product not found: ${this._id}`);
    }

    if (this._state.status !== 'DRAFT' && this._state.status !== 'INACTIVE') {
      throw new Error(`Invalid status transition from ${this._state.status} to ACTIVE`);
    }

    const event: ProductEvent = {
      type: 'ProductActivated' as any,
      aggregateId: this._id,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {}
    } as ProductEvent;

    this.applyEvent(event, true);
  }

  /**
   * Update inventory
   */
  updateInventory(quantity: number, reason: string): void {
    if (!this._state) {
      throw new Error(`Product not found: ${this._id}`);
    }

    const event: ProductEvent = {
      type: 'InventoryUpdated' as any,
      aggregateId: this._id,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        previousQuantity: this._state.inventory.quantity,
        newQuantity: quantity,
        reason: reason as any
      }
    } as ProductEvent;

    this.applyEvent(event, true);
  }

  /**
   * Reserve inventory
   */
  reserveInventory(quantity: number, reservationId: string, reason: string): void {
    if (!this._state) {
      throw new Error(`Product not found: ${this._id}`);
    }

    if (this._state.status !== 'ACTIVE') {
      throw new Error(`Cannot reserve inventory for inactive product: ${this._id}`);
    }

    if (this._state.inventory.available < quantity) {
      throw new Error(`Insufficient inventory for product ${this._id}: requested ${quantity}, available ${this._state.inventory.available}`);
    }

    const event: ProductEvent = {
      type: 'InventoryReserved' as any,
      aggregateId: this._id,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reservationId, reason }
    } as ProductEvent;

    this.applyEvent(event, true);
  }

  /**
   * Release inventory
   */
  releaseInventory(quantity: number, reservationId: string, reason: string): void {
    if (!this._state) {
      throw new Error(`Product not found: ${this._id}`);
    }

    const event: ProductEvent = {
      type: 'InventoryReleased' as any,
      aggregateId: this._id,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reservationId, reason: reason as any }
    } as ProductEvent;

    this.applyEvent(event, true);
  }

  /**
   * Apply event to aggregate state
   */
  private applyEvent(event: ProductEvent, isNew: boolean): void {
    this._state = this.applyEventToState(this._state, event);
    this._version = typeof event.version === 'number' ? event.version : this._version + 1;
    
    if (isNew) {
      this._uncommittedEvents.push(event);
    }
  }

  /**
   * Pure function to apply event to state
   */
  private applyEventToState(currentState: ProductState | null, event: ProductEvent): ProductState {
    switch (event.type) {
      case 'ProductCreated':
        return {
          id: this._id,
          name: (event.data as any).name,
          description: (event.data as any).description,
          sku: (event.data as any).sku,
          price: (event.data as any).price,
          categoryId: (event.data as any).categoryId,
          inventory: {
            quantity: (event.data as any).initialQuantity,
            reserved: 0,
            available: (event.data as any).initialQuantity
          },
          metadata: (event.data as any).metadata,
          status: 'DRAFT' as any,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : 1
        };

      case 'ProductActivated':
        if (!currentState) throw new Error('Cannot activate non-existent product');
        return {
          ...currentState,
          status: 'ACTIVE' as any,
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case 'InventoryUpdated':
        if (!currentState) throw new Error('Cannot update inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: (event.data as any).newQuantity,
            reserved: currentState.inventory.reserved,
            available: (event.data as any).newQuantity - currentState.inventory.reserved
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case 'InventoryReserved':
        if (!currentState) throw new Error('Cannot reserve inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: currentState.inventory.quantity,
            reserved: currentState.inventory.reserved + (event.data as any).quantity,
            available: currentState.inventory.available - (event.data as any).quantity
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      case 'InventoryReleased':
        if (!currentState) throw new Error('Cannot release inventory of non-existent product');
        return {
          ...currentState,
          inventory: {
            quantity: currentState.inventory.quantity,
            reserved: Math.max(0, currentState.inventory.reserved - (event.data as any).quantity),
            available: Math.min(currentState.inventory.quantity, currentState.inventory.available + (event.data as any).quantity)
          },
          updatedAt: event.timestamp,
          version: typeof event.version === 'number' ? event.version : currentState.version + 1
        };

      default:
        throw new Error(`Unknown event type: ${(event as any).type}`);
    }
  }

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }
}