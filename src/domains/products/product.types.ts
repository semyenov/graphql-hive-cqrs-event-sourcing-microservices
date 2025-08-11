/**
 * Product Domain Types
 * 
 * Core types and interfaces for the Product domain using Effect-TS patterns
 */

import { BrandedTypes } from '@cqrs/framework';
import type { ICommand, IEvent } from '@cqrs/framework';

// Product-specific branded types
export const ProductBrandedTypes = {
  productId: (value: string) => BrandedTypes.aggregateId(`product-${value}`),
  categoryId: (value: string) => BrandedTypes.aggregateId(`category-${value}`),
  sku: (value: string) => value as ProductSKU,
  price: (value: number) => value as ProductPrice,
} as const;

export type ProductId = ReturnType<typeof ProductBrandedTypes.productId>;
export type CategoryId = ReturnType<typeof ProductBrandedTypes.categoryId>;
export type ProductSKU = string & { readonly _brand: 'ProductSKU' };
export type ProductPrice = number & { readonly _brand: 'ProductPrice' };

/**
 * Product state and value objects
 */
export interface ProductState {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string;
  readonly sku: ProductSKU;
  readonly price: ProductPrice;
  readonly categoryId: CategoryId;
  readonly inventory: {
    readonly quantity: number;
    readonly reserved: number;
    readonly available: number;
  };
  readonly metadata: {
    readonly tags: readonly string[];
    readonly weight?: number;
    readonly dimensions?: {
      readonly length: number;
      readonly width: number;
      readonly height: number;
    };
  };
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED'
}

/**
 * Product Events
 */
export const ProductEventTypes = {
  PRODUCT_CREATED: 'ProductCreated',
  PRODUCT_UPDATED: 'ProductUpdated',
  PRODUCT_ACTIVATED: 'ProductActivated',
  PRODUCT_DEACTIVATED: 'ProductDeactivated',
  PRODUCT_DISCONTINUED: 'ProductDiscontinued',
  INVENTORY_UPDATED: 'InventoryUpdated',
  INVENTORY_RESERVED: 'InventoryReserved',
  INVENTORY_RELEASED: 'InventoryReleased',
  PRICE_UPDATED: 'PriceUpdated',
} as const;

export interface ProductCreatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRODUCT_CREATED;
  readonly data: {
    readonly name: string;
    readonly description: string;
    readonly sku: ProductSKU;
    readonly price: ProductPrice;
    readonly categoryId: CategoryId;
    readonly initialQuantity: number;
    readonly metadata: ProductState['metadata'];
  };
}

export interface ProductUpdatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRODUCT_UPDATED;
  readonly data: {
    readonly name?: string;
    readonly description?: string;
    readonly categoryId?: CategoryId;
    readonly metadata?: Partial<ProductState['metadata']>;
  };
}

export interface ProductActivatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRODUCT_ACTIVATED;
  readonly data: {};
}

export interface ProductDeactivatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRODUCT_DEACTIVATED;
  readonly data: {
    readonly reason: string;
  };
}

export interface ProductDiscontinuedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRODUCT_DISCONTINUED;
  readonly data: {
    readonly reason: string;
    readonly replacementProductId?: ProductId;
  };
}

export interface InventoryUpdatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.INVENTORY_UPDATED;
  readonly data: {
    readonly previousQuantity: number;
    readonly newQuantity: number;
    readonly reason: 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGE' | 'RETURN';
  };
}

export interface InventoryReservedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.INVENTORY_RESERVED;
  readonly data: {
    readonly quantity: number;
    readonly reservationId: string;
    readonly reason: string;
  };
}

export interface InventoryReleasedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.INVENTORY_RELEASED;
  readonly data: {
    readonly quantity: number;
    readonly reservationId: string;
    readonly reason: 'CANCELLED' | 'EXPIRED' | 'FULFILLED';
  };
}

export interface PriceUpdatedEvent extends IEvent {
  readonly type: typeof ProductEventTypes.PRICE_UPDATED;
  readonly data: {
    readonly previousPrice: ProductPrice;
    readonly newPrice: ProductPrice;
    readonly effectiveDate: string;
    readonly reason: string;
  };
}

export type ProductEvent = 
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductActivatedEvent
  | ProductDeactivatedEvent
  | ProductDiscontinuedEvent
  | InventoryUpdatedEvent
  | InventoryReservedEvent
  | InventoryReleasedEvent
  | PriceUpdatedEvent;

/**
 * Product Commands
 */
export const ProductCommandTypes = {
  CREATE_PRODUCT: 'CreateProduct',
  UPDATE_PRODUCT: 'UpdateProduct',
  ACTIVATE_PRODUCT: 'ActivateProduct',
  DEACTIVATE_PRODUCT: 'DeactivateProduct',
  DISCONTINUE_PRODUCT: 'DiscontinueProduct',
  UPDATE_INVENTORY: 'UpdateInventory',
  RESERVE_INVENTORY: 'ReserveInventory',
  RELEASE_INVENTORY: 'ReleaseInventory',
  UPDATE_PRICE: 'UpdatePrice',
} as const;

export interface CreateProductCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.CREATE_PRODUCT;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly name: string;
    readonly description: string;
    readonly sku: ProductSKU;
    readonly price: ProductPrice;
    readonly categoryId: CategoryId;
    readonly initialQuantity: number;
    readonly metadata?: ProductState['metadata'];
  };
}

export interface UpdateProductCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.UPDATE_PRODUCT;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly name?: string;
    readonly description?: string;
    readonly categoryId?: CategoryId;
    readonly metadata?: Partial<ProductState['metadata']>;
  };
}

export interface ActivateProductCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.ACTIVATE_PRODUCT;
  readonly aggregateId: ProductId;
  readonly payload: {};
}

export interface DeactivateProductCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.DEACTIVATE_PRODUCT;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly reason: string;
  };
}

export interface DiscontinueProductCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.DISCONTINUE_PRODUCT;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly reason: string;
    readonly replacementProductId?: ProductId;
  };
}

export interface UpdateInventoryCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.UPDATE_INVENTORY;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly quantity: number;
    readonly reason: InventoryUpdatedEvent['data']['reason'];
  };
}

export interface ReserveInventoryCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.RESERVE_INVENTORY;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly quantity: number;
    readonly reservationId: string;
    readonly reason: string;
  };
}

export interface ReleaseInventoryCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.RELEASE_INVENTORY;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly quantity: number;
    readonly reservationId: string;
    readonly reason: InventoryReleasedEvent['data']['reason'];
  };
}

export interface UpdatePriceCommand extends ICommand {
  readonly type: typeof ProductCommandTypes.UPDATE_PRICE;
  readonly aggregateId: ProductId;
  readonly payload: {
    readonly newPrice: ProductPrice;
    readonly effectiveDate?: string;
    readonly reason: string;
  };
}

export type ProductCommand = 
  | CreateProductCommand
  | UpdateProductCommand
  | ActivateProductCommand
  | DeactivateProductCommand
  | DiscontinueProductCommand
  | UpdateInventoryCommand
  | ReserveInventoryCommand
  | ReleaseInventoryCommand
  | UpdatePriceCommand;

/**
 * Domain Errors
 */
export class ProductNotFoundError extends Error {
  readonly _tag = 'ProductNotFoundError';
  constructor(productId: ProductId) {
    super(`Product not found: ${productId}`);
  }
}

export class InsufficientInventoryError extends Error {
  readonly _tag = 'InsufficientInventoryError';
  constructor(productId: ProductId, requested: number, available: number) {
    super(`Insufficient inventory for product ${productId}: requested ${requested}, available ${available}`);
  }
}

export class InvalidProductStatusError extends Error {
  readonly _tag = 'InvalidProductStatusError';
  constructor(productId: ProductId, currentStatus: ProductStatus, requiredStatus: ProductStatus) {
    super(`Invalid product status for ${productId}: current ${currentStatus}, required ${requiredStatus}`);
  }
}

export class DuplicateSKUError extends Error {
  readonly _tag = 'DuplicateSKUError';
  constructor(sku: ProductSKU) {
    super(`Product SKU already exists: ${sku}`);
  }
}

export type ProductDomainError = 
  | ProductNotFoundError
  | InsufficientInventoryError
  | InvalidProductStatusError
  | DuplicateSKUError;