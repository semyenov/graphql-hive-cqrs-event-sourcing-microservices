/**
 * Order Domain Types
 * 
 * Complex workflow types for order processing with Effect-TS patterns
 */

import { BrandedTypes } from '@cqrs/framework';
import type { ICommand, IEvent } from '@cqrs/framework';

// Order-specific branded types
export const OrderBrandedTypes = {
  orderId: (value: string) => BrandedTypes.aggregateId(`order-${value}`),
  customerId: (value: string) => BrandedTypes.aggregateId(`customer-${value}`),
  productId: (value: string) => BrandedTypes.aggregateId(`product-${value}`),
  orderNumber: (value: string) => value as OrderNumber,
  amount: (value: number) => value as OrderAmount,
  discountAmount: (value: number) => value as DiscountAmount,
} as const;

export type OrderId = ReturnType<typeof OrderBrandedTypes.orderId>;
export type CustomerId = ReturnType<typeof OrderBrandedTypes.customerId>;
export type ProductId = ReturnType<typeof OrderBrandedTypes.productId>;
export type OrderNumber = string & { readonly _brand: 'OrderNumber' };
export type OrderAmount = number & { readonly _brand: 'OrderAmount' };
export type DiscountAmount = number & { readonly _brand: 'DiscountAmount' };

/**
 * Order state and value objects
 */
export interface OrderState {
  readonly id: OrderId;
  readonly orderNumber: OrderNumber;
  readonly customerId: CustomerId;
  readonly items: readonly OrderItem[];
  readonly pricing: OrderPricing;
  readonly shipping: ShippingDetails;
  readonly payment: PaymentDetails | null;
  readonly status: OrderStatus;
  readonly workflow: WorkflowState;
  readonly timestamps: OrderTimestamps;
  readonly metadata: OrderMetadata;
  readonly version: number;
}

export interface OrderItem {
  readonly productId: ProductId;
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: OrderAmount;
  readonly totalPrice: OrderAmount;
  readonly reservationId: string;
}

export interface OrderPricing {
  readonly subtotal: OrderAmount;
  readonly discounts: readonly OrderDiscount[];
  readonly totalDiscount: DiscountAmount;
  readonly taxes: readonly OrderTax[];
  readonly totalTax: OrderAmount;
  readonly shippingCost: OrderAmount;
  readonly total: OrderAmount;
}

export interface OrderDiscount {
  readonly type: 'PERCENTAGE' | 'FIXED' | 'COUPON';
  readonly code?: string;
  readonly amount: DiscountAmount;
  readonly description: string;
}

export interface OrderTax {
  readonly type: 'SALES' | 'VAT' | 'GST';
  readonly rate: number;
  readonly amount: OrderAmount;
  readonly jurisdiction: string;
}

export interface ShippingDetails {
  readonly method: ShippingMethod;
  readonly address: ShippingAddress;
  readonly cost: OrderAmount;
  readonly estimatedDelivery?: string;
  readonly trackingNumber?: string;
}

export interface ShippingMethod {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly deliveryTime: string;
}

export interface ShippingAddress {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly isResidential: boolean;
}

export interface PaymentDetails {
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly transactionId?: string;
  readonly amount: OrderAmount;
  readonly currency: string;
  readonly processedAt?: string;
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export interface WorkflowState {
  readonly currentStep: WorkflowStep;
  readonly completedSteps: readonly WorkflowStep[];
  readonly failedSteps: readonly FailedStep[];
  readonly retryCount: number;
  readonly isBlocked: boolean;
  readonly blockingReason?: string;
}

export enum WorkflowStep {
  INVENTORY_RESERVED = 'INVENTORY_RESERVED',
  PAYMENT_AUTHORIZED = 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  FULFILLMENT_STARTED = 'FULFILLMENT_STARTED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED'
}

export interface FailedStep {
  readonly step: WorkflowStep;
  readonly error: string;
  readonly timestamp: string;
  readonly retryable: boolean;
}

export interface OrderTimestamps {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly confirmedAt?: string;
  readonly paidAt?: string;
  readonly shippedAt?: string;
  readonly deliveredAt?: string;
  readonly cancelledAt?: string;
}

export interface OrderMetadata {
  readonly source: 'WEB' | 'MOBILE' | 'API' | 'ADMIN';
  readonly channel: string;
  readonly campaign?: string;
  readonly notes?: string;
  readonly tags: readonly string[];
}

/**
 * Order Events
 */
export const OrderEventTypes = {
  ORDER_CREATED: 'OrderCreated',
  ITEM_ADDED: 'OrderItemAdded',
  ITEM_REMOVED: 'OrderItemRemoved',
  ITEM_UPDATED: 'OrderItemUpdated',
  DISCOUNT_APPLIED: 'DiscountApplied',
  DISCOUNT_REMOVED: 'DiscountRemoved',
  SHIPPING_SET: 'ShippingDetailsSet',
  ORDER_CONFIRMED: 'OrderConfirmed',
  INVENTORY_RESERVED: 'InventoryReserved',
  INVENTORY_RESERVATION_FAILED: 'InventoryReservationFailed',
  PAYMENT_INITIATED: 'PaymentInitiated',
  PAYMENT_AUTHORIZED: 'PaymentAuthorized',
  PAYMENT_CAPTURED: 'PaymentCaptured',
  PAYMENT_FAILED: 'PaymentFailed',
  ORDER_SHIPPED: 'OrderShipped',
  ORDER_DELIVERED: 'OrderDelivered',
  ORDER_CANCELLED: 'OrderCancelled',
  REFUND_INITIATED: 'RefundInitiated',
  REFUND_COMPLETED: 'RefundCompleted',
  WORKFLOW_STEP_COMPLETED: 'WorkflowStepCompleted',
  WORKFLOW_STEP_FAILED: 'WorkflowStepFailed',
} as const;

export interface OrderCreatedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ORDER_CREATED;
  readonly data: {
    readonly orderNumber: OrderNumber;
    readonly customerId: CustomerId;
    readonly items: readonly OrderItem[];
    readonly shipping: ShippingDetails;
    readonly metadata: OrderMetadata;
  };
}

export interface OrderItemAddedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ITEM_ADDED;
  readonly data: {
    readonly item: OrderItem;
  };
}

export interface OrderItemRemovedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ITEM_REMOVED;
  readonly data: {
    readonly productId: ProductId;
    readonly quantity: number;
  };
}

export interface DiscountAppliedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.DISCOUNT_APPLIED;
  readonly data: {
    readonly discount: OrderDiscount;
    readonly newTotal: OrderAmount;
  };
}

export interface OrderConfirmedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ORDER_CONFIRMED;
  readonly data: {
    readonly finalTotal: OrderAmount;
    readonly confirmedAt: string;
  };
}

export interface InventoryReservedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.INVENTORY_RESERVED;
  readonly data: {
    readonly reservations: readonly {
      readonly productId: ProductId;
      readonly quantity: number;
      readonly reservationId: string;
    }[];
  };
}

export interface InventoryReservationFailedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.INVENTORY_RESERVATION_FAILED;
  readonly data: {
    readonly productId: ProductId;
    readonly requestedQuantity: number;
    readonly availableQuantity: number;
    readonly reason: string;
  };
}

export interface PaymentAuthorizedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.PAYMENT_AUTHORIZED;
  readonly data: {
    readonly paymentDetails: PaymentDetails;
    readonly authorizationId: string;
  };
}

export interface PaymentCapturedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.PAYMENT_CAPTURED;
  readonly data: {
    readonly transactionId: string;
    readonly amount: OrderAmount;
    readonly capturedAt: string;
  };
}

export interface PaymentFailedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.PAYMENT_FAILED;
  readonly data: {
    readonly reason: string;
    readonly errorCode: string;
    readonly retryable: boolean;
  };
}

export interface OrderShippedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ORDER_SHIPPED;
  readonly data: {
    readonly trackingNumber: string;
    readonly carrier: string;
    readonly shippedAt: string;
    readonly estimatedDelivery: string;
  };
}

export interface OrderDeliveredEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ORDER_DELIVERED;
  readonly data: {
    readonly deliveredAt: string;
    readonly receivedBy?: string;
  };
}

export interface OrderCancelledEvent extends IEvent {
  readonly type: typeof OrderEventTypes.ORDER_CANCELLED;
  readonly data: {
    readonly reason: string;
    readonly cancelledBy: string;
    readonly refundAmount?: OrderAmount;
  };
}

export interface WorkflowStepCompletedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.WORKFLOW_STEP_COMPLETED;
  readonly data: {
    readonly step: WorkflowStep;
    readonly completedAt: string;
    readonly nextStep?: WorkflowStep;
  };
}

export interface WorkflowStepFailedEvent extends IEvent {
  readonly type: typeof OrderEventTypes.WORKFLOW_STEP_FAILED;
  readonly data: {
    readonly step: WorkflowStep;
    readonly error: string;
    readonly retryable: boolean;
    readonly retryCount: number;
  };
}

export type OrderEvent = 
  | OrderCreatedEvent
  | OrderItemAddedEvent
  | OrderItemRemovedEvent
  | DiscountAppliedEvent
  | OrderConfirmedEvent
  | InventoryReservedEvent
  | InventoryReservationFailedEvent
  | PaymentAuthorizedEvent
  | PaymentCapturedEvent
  | PaymentFailedEvent
  | OrderShippedEvent
  | OrderDeliveredEvent
  | OrderCancelledEvent
  | WorkflowStepCompletedEvent
  | WorkflowStepFailedEvent;

/**
 * Order Commands
 */
export const OrderCommandTypes = {
  CREATE_ORDER: 'CreateOrder',
  ADD_ITEM: 'AddOrderItem',
  REMOVE_ITEM: 'RemoveOrderItem',
  UPDATE_ITEM: 'UpdateOrderItem',
  APPLY_DISCOUNT: 'ApplyDiscount',
  REMOVE_DISCOUNT: 'RemoveDiscount',
  SET_SHIPPING: 'SetShippingDetails',
  CONFIRM_ORDER: 'ConfirmOrder',
  RESERVE_INVENTORY: 'ReserveInventory',
  AUTHORIZE_PAYMENT: 'AuthorizePayment',
  CAPTURE_PAYMENT: 'CapturePayment',
  SHIP_ORDER: 'ShipOrder',
  DELIVER_ORDER: 'DeliverOrder',
  CANCEL_ORDER: 'CancelOrder',
  INITIATE_REFUND: 'InitiateRefund',
  RETRY_WORKFLOW_STEP: 'RetryWorkflowStep',
} as const;

export interface CreateOrderCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.CREATE_ORDER;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly customerId: CustomerId;
    readonly items: readonly Omit<OrderItem, 'reservationId'>[];
    readonly shipping: ShippingDetails;
    readonly metadata?: Partial<OrderMetadata>;
  };
}

export interface AddOrderItemCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.ADD_ITEM;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly item: Omit<OrderItem, 'reservationId'>;
  };
}

export interface RemoveOrderItemCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.REMOVE_ITEM;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly productId: ProductId;
    readonly quantity: number;
  };
}

export interface ApplyDiscountCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.APPLY_DISCOUNT;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly discount: OrderDiscount;
  };
}

export interface ConfirmOrderCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.CONFIRM_ORDER;
  readonly aggregateId: OrderId;
  readonly payload: {};
}

export interface AuthorizePaymentCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.AUTHORIZE_PAYMENT;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly paymentMethod: PaymentMethod;
    readonly paymentDetails: Record<string, unknown>;
  };
}

export interface CapturePaymentCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.CAPTURE_PAYMENT;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly authorizationId: string;
    readonly amount?: OrderAmount;
  };
}

export interface ShipOrderCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.SHIP_ORDER;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly trackingNumber: string;
    readonly carrier: string;
    readonly estimatedDelivery: string;
  };
}

export interface CancelOrderCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.CANCEL_ORDER;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly reason: string;
    readonly cancelledBy: string;
  };
}

export interface RetryWorkflowStepCommand extends ICommand {
  readonly type: typeof OrderCommandTypes.RETRY_WORKFLOW_STEP;
  readonly aggregateId: OrderId;
  readonly payload: {
    readonly step: WorkflowStep;
    readonly maxRetries: number;
  };
}

export type OrderCommand = 
  | CreateOrderCommand
  | AddOrderItemCommand
  | RemoveOrderItemCommand
  | ApplyDiscountCommand
  | ConfirmOrderCommand
  | AuthorizePaymentCommand
  | CapturePaymentCommand
  | ShipOrderCommand
  | CancelOrderCommand
  | RetryWorkflowStepCommand;

/**
 * Domain Errors
 */
export class OrderNotFoundError extends Error {
  readonly _tag = 'OrderNotFoundError';
  constructor(orderId: OrderId) {
    super(`Order not found: ${orderId}`);
  }
}

export class OrderAlreadyConfirmedError extends Error {
  readonly _tag = 'OrderAlreadyConfirmedError';
  constructor(orderId: OrderId) {
    super(`Order already confirmed: ${orderId}`);
  }
}

export class InvalidOrderStatusError extends Error {
  readonly _tag = 'InvalidOrderStatusError';
  constructor(orderId: OrderId, currentStatus: OrderStatus, requiredStatus: OrderStatus) {
    super(`Invalid order status for ${orderId}: current ${currentStatus}, required ${requiredStatus}`);
  }
}

export class InsufficientInventoryError extends Error {
  readonly _tag = 'InsufficientInventoryError';
  constructor(productId: ProductId, requested: number, available: number) {
    super(`Insufficient inventory for product ${productId}: requested ${requested}, available ${available}`);
  }
}

export class PaymentAuthorizationFailedError extends Error {
  readonly _tag = 'PaymentAuthorizationFailedError';
  constructor(orderId: OrderId, reason: string) {
    super(`Payment authorization failed for order ${orderId}: ${reason}`);
  }
}

export class WorkflowStepFailedError extends Error {
  readonly _tag = 'WorkflowStepFailedError';
  constructor(orderId: OrderId, step: WorkflowStep, reason: string) {
    super(`Workflow step ${step} failed for order ${orderId}: ${reason}`);
  }
}

export class OrderCancellationNotAllowedError extends Error {
  readonly _tag = 'OrderCancellationNotAllowedError';
  constructor(orderId: OrderId, currentStatus: OrderStatus) {
    super(`Order cancellation not allowed for ${orderId} in status ${currentStatus}`);
  }
}

export type OrderDomainError = 
  | OrderNotFoundError
  | OrderAlreadyConfirmedError
  | InvalidOrderStatusError
  | InsufficientInventoryError
  | PaymentAuthorizationFailedError
  | WorkflowStepFailedError
  | OrderCancellationNotAllowedError;