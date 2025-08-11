/**
 * Order Aggregate - Effect-TS Implementation
 * 
 * Manages order lifecycle with CQRS/Event Sourcing patterns using Effect-TS
 * for functional error handling and composition.
 */

import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import * as Option from 'effect/Option';
import * as ReadonlyArray from 'effect/ReadonlyArray';
import { pipe } from 'effect/Function';

import type { IAggregateBehavior, IEvent } from '@cqrs/framework/effect';
import { BrandedTypes } from '@cqrs/framework';

const { aggregateId, eventVersion, aggregateVersion, timestamp } = BrandedTypes;

// ============================================================================
// Types
// ============================================================================

export type OrderId = ReturnType<typeof aggregateId>;
export type CustomerId = ReturnType<typeof aggregateId>;
export type ProductId = ReturnType<typeof aggregateId>;

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface OrderItem {
  readonly productId: ProductId;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
}

export interface ShippingAddress {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface PaymentInfo {
  readonly method: 'CREDIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER';
  readonly transactionId?: string;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly processedAt?: string;
}

export interface OrderState {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly items: ReadonlyArray<OrderItem>;
  readonly status: OrderStatus;
  readonly totalAmount: number;
  readonly shippingAddress: ShippingAddress;
  readonly payment: PaymentInfo;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly confirmedAt?: string;
  readonly shippedAt?: string;
  readonly deliveredAt?: string;
  readonly cancelledAt?: string;
}

// ============================================================================
// Domain Errors
// ============================================================================

export class OrderNotFoundError extends Data.TaggedError('OrderNotFoundError')<{
  readonly orderId: OrderId;
}> {}

export class InvalidOrderStateError extends Data.TaggedError('InvalidOrderStateError')<{
  readonly orderId: OrderId;
  readonly currentStatus: OrderStatus;
  readonly attemptedAction: string;
}> {}

export class InsufficientStockError extends Data.TaggedError('InsufficientStockError')<{
  readonly productId: ProductId;
  readonly requested: number;
  readonly available: number;
}> {}

export class PaymentFailedError extends Data.TaggedError('PaymentFailedError')<{
  readonly orderId: OrderId;
  readonly reason: string;
}> {}

export class EmptyOrderError extends Data.TaggedError('EmptyOrderError')<{
  readonly customerId: CustomerId;
}> {}

export type OrderError = 
  | OrderNotFoundError 
  | InvalidOrderStateError 
  | InsufficientStockError 
  | PaymentFailedError
  | EmptyOrderError;

// ============================================================================
// Events
// ============================================================================

export enum OrderEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_REFUNDED = 'ORDER_REFUNDED',
  ITEM_ADDED = 'ITEM_ADDED',
  ITEM_REMOVED = 'ITEM_REMOVED',
}

export interface OrderEvent extends IEvent {
  readonly type: OrderEventType;
}

export interface OrderCreatedEvent extends OrderEvent {
  readonly type: OrderEventType.ORDER_CREATED;
  readonly data: {
    readonly customerId: CustomerId;
    readonly items: ReadonlyArray<OrderItem>;
    readonly shippingAddress: ShippingAddress;
    readonly totalAmount: number;
    readonly notes?: string;
  };
}

export interface OrderConfirmedEvent extends OrderEvent {
  readonly type: OrderEventType.ORDER_CONFIRMED;
  readonly data: {
    readonly confirmedAt: string;
  };
}

export interface PaymentProcessedEvent extends OrderEvent {
  readonly type: OrderEventType.PAYMENT_PROCESSED;
  readonly data: {
    readonly payment: PaymentInfo;
  };
}

export interface OrderShippedEvent extends OrderEvent {
  readonly type: OrderEventType.ORDER_SHIPPED;
  readonly data: {
    readonly shippedAt: string;
    readonly trackingNumber: string;
    readonly carrier: string;
  };
}

export interface OrderDeliveredEvent extends OrderEvent {
  readonly type: OrderEventType.ORDER_DELIVERED;
  readonly data: {
    readonly deliveredAt: string;
    readonly signature?: string;
  };
}

export interface OrderCancelledEvent extends OrderEvent {
  readonly type: OrderEventType.ORDER_CANCELLED;
  readonly data: {
    readonly cancelledAt: string;
    readonly reason: string;
  };
}

export type OrderDomainEvent = 
  | OrderCreatedEvent 
  | OrderConfirmedEvent 
  | PaymentProcessedEvent 
  | OrderShippedEvent
  | OrderDeliveredEvent
  | OrderCancelledEvent;

// ============================================================================
// Order Aggregate
// ============================================================================

export class OrderAggregate implements IAggregateBehavior<OrderState, OrderDomainEvent> {
  private _state: OrderState | null = null;
  private _version: number = 0;
  private _uncommittedEvents: OrderDomainEvent[] = [];

  constructor(public readonly id: OrderId) {}

  get state(): OrderState {
    if (!this._state) {
      throw new Error('Order not initialized');
    }
    return this._state;
  }

  get version() {
    return aggregateVersion(this._version);
  }

  get uncommittedEvents() {
    return this._uncommittedEvents;
  }

  /**
   * Create a new order
   */
  create(data: {
    customerId: CustomerId;
    items: ReadonlyArray<OrderItem>;
    shippingAddress: ShippingAddress;
    notes?: string;
  }): Effect.Effect<void, EmptyOrderError, never> {
    if (data.items.length === 0) {
      return Effect.fail(new EmptyOrderError({ customerId: data.customerId }));
    }

    const totalAmount = pipe(
      data.items,
      ReadonlyArray.reduce(0, (sum, item) => sum + item.totalPrice)
    );

    const event: OrderCreatedEvent = {
      type: OrderEventType.ORDER_CREATED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        customerId: data.customerId,
        items: data.items,
        shippingAddress: data.shippingAddress,
        totalAmount,
        notes: data.notes,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Confirm the order
   */
  confirm(): Effect.Effect<void, InvalidOrderStateError, never> {
    if (this.state.status !== OrderStatus.PENDING) {
      return Effect.fail(
        new InvalidOrderStateError({
          orderId: this.id,
          currentStatus: this.state.status,
          attemptedAction: 'confirm',
        })
      );
    }

    const event: OrderConfirmedEvent = {
      type: OrderEventType.ORDER_CONFIRMED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        confirmedAt: new Date().toISOString(),
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Process payment for the order
   */
  processPayment(paymentInfo: PaymentInfo): Effect.Effect<void, InvalidOrderStateError | PaymentFailedError, never> {
    if (this.state.status !== OrderStatus.CONFIRMED) {
      return Effect.fail(
        new InvalidOrderStateError({
          orderId: this.id,
          currentStatus: this.state.status,
          attemptedAction: 'process payment',
        })
      );
    }

    if (paymentInfo.status === PaymentStatus.FAILED) {
      return Effect.fail(
        new PaymentFailedError({
          orderId: this.id,
          reason: 'Payment processing failed',
        })
      );
    }

    const event: PaymentProcessedEvent = {
      type: OrderEventType.PAYMENT_PROCESSED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        payment: paymentInfo,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Ship the order
   */
  ship(trackingInfo: { trackingNumber: string; carrier: string }): Effect.Effect<void, InvalidOrderStateError, never> {
    if (this.state.status !== OrderStatus.PROCESSING) {
      return Effect.fail(
        new InvalidOrderStateError({
          orderId: this.id,
          currentStatus: this.state.status,
          attemptedAction: 'ship',
        })
      );
    }

    const event: OrderShippedEvent = {
      type: OrderEventType.ORDER_SHIPPED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        shippedAt: new Date().toISOString(),
        trackingNumber: trackingInfo.trackingNumber,
        carrier: trackingInfo.carrier,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Mark order as delivered
   */
  deliver(signature?: string): Effect.Effect<void, InvalidOrderStateError, never> {
    if (this.state.status !== OrderStatus.SHIPPED) {
      return Effect.fail(
        new InvalidOrderStateError({
          orderId: this.id,
          currentStatus: this.state.status,
          attemptedAction: 'deliver',
        })
      );
    }

    const event: OrderDeliveredEvent = {
      type: OrderEventType.ORDER_DELIVERED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        deliveredAt: new Date().toISOString(),
        signature,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Cancel the order
   */
  cancel(reason: string): Effect.Effect<void, InvalidOrderStateError, never> {
    const nonCancellableStatuses = [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ];

    if (nonCancellableStatuses.includes(this.state.status)) {
      return Effect.fail(
        new InvalidOrderStateError({
          orderId: this.id,
          currentStatus: this.state.status,
          attemptedAction: 'cancel',
        })
      );
    }

    const event: OrderCancelledEvent = {
      type: OrderEventType.ORDER_CANCELLED,
      aggregateId: this.id,
      version: AggregateVersion(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        cancelledAt: new Date().toISOString(),
        reason,
      },
    };

    this.applyEvent(event, true);
    return Effect.succeed(undefined);
  }

  /**
   * Apply event to state
   */
  applyEvent(event: OrderDomainEvent, isNew: boolean): void {
    switch (event.type) {
      case OrderEventType.ORDER_CREATED:
        this._state = Data.struct({
          id: this.id,
          customerId: event.data.customerId,
          items: event.data.items,
          status: OrderStatus.PENDING,
          totalAmount: event.data.totalAmount,
          shippingAddress: event.data.shippingAddress,
          payment: Data.struct({
            method: 'CREDIT_CARD',
            status: PaymentStatus.PENDING,
            amount: event.data.totalAmount,
          }),
          notes: event.data.notes,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        break;

      case OrderEventType.ORDER_CONFIRMED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            status: OrderStatus.CONFIRMED,
            confirmedAt: event.data.confirmedAt,
            updatedAt: event.timestamp,
          });
        }
        break;

      case OrderEventType.PAYMENT_PROCESSED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            status: OrderStatus.PROCESSING,
            payment: event.data.payment,
            updatedAt: event.timestamp,
          });
        }
        break;

      case OrderEventType.ORDER_SHIPPED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            status: OrderStatus.SHIPPED,
            shippedAt: event.data.shippedAt,
            updatedAt: event.timestamp,
          });
        }
        break;

      case OrderEventType.ORDER_DELIVERED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            status: OrderStatus.DELIVERED,
            deliveredAt: event.data.deliveredAt,
            updatedAt: event.timestamp,
          });
        }
        break;

      case OrderEventType.ORDER_CANCELLED:
        if (this._state) {
          this._state = Data.struct({
            ...this._state,
            status: OrderStatus.CANCELLED,
            cancelledAt: event.data.cancelledAt,
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

  /**
   * Check if order can be modified
   */
  canModify(): boolean {
    return this.state.status === OrderStatus.PENDING;
  }

  /**
   * Check if order can be cancelled
   */
  canCancel(): boolean {
    const nonCancellableStatuses = [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ];
    return !nonCancellableStatuses.includes(this.state.status);
  }

  /**
   * Calculate order total
   */
  calculateTotal(): number {
    return pipe(
      this.state.items,
      ReadonlyArray.reduce(0, (sum, item) => sum + item.totalPrice)
    );
  }
}