/**
 * Effect Test Fixtures
 * 
 * Pre-built test data and scenarios for Effect-based testing
 */

import type { IEvent, ICommand } from '../core/types';
import type { AggregateId, EventVersion } from '../../core/branded/types';
import { BrandedTypes } from '../../core/branded';

/**
 * Test event types
 */
export const TestEventTypes = {
  ITEM_CREATED: 'ItemCreated',
  ITEM_UPDATED: 'ItemUpdated',  
  ITEM_DELETED: 'ItemDeleted',
  USER_REGISTERED: 'UserRegistered',
  USER_ACTIVATED: 'UserActivated',
  ORDER_PLACED: 'OrderPlaced',
  ORDER_CONFIRMED: 'OrderConfirmed',
  PAYMENT_PROCESSED: 'PaymentProcessed'
} as const;

/**
 * Test command types
 */
export const TestCommandTypes = {
  CREATE_ITEM: 'CreateItem',
  UPDATE_ITEM: 'UpdateItem',
  DELETE_ITEM: 'DeleteItem',
  REGISTER_USER: 'RegisterUser',
  ACTIVATE_USER: 'ActivateUser',
  PLACE_ORDER: 'PlaceOrder',
  CONFIRM_ORDER: 'ConfirmOrder',
  PROCESS_PAYMENT: 'ProcessPayment'
} as const;

/**
 * Test aggregate IDs
 */
export const TestAggregateIds = {
  USER_1: BrandedTypes.aggregateId('user-1'),
  USER_2: BrandedTypes.aggregateId('user-2'),
  ORDER_1: BrandedTypes.aggregateId('order-1'),
  ORDER_2: BrandedTypes.aggregateId('order-2'),
  ITEM_1: BrandedTypes.aggregateId('item-1'),
  ITEM_2: BrandedTypes.aggregateId('item-2')
} as const;

/**
 * Test event interfaces
 */
export interface TestItemCreatedEvent extends IEvent {
  readonly type: typeof TestEventTypes.ITEM_CREATED;
  readonly data: {
    readonly name: string;
    readonly description: string;
    readonly price: number;
  };
}

export interface TestItemUpdatedEvent extends IEvent {
  readonly type: typeof TestEventTypes.ITEM_UPDATED;
  readonly data: {
    readonly name?: string;
    readonly description?: string;
    readonly price?: number;
  };
}

export interface TestUserRegisteredEvent extends IEvent {
  readonly type: typeof TestEventTypes.USER_REGISTERED;
  readonly data: {
    readonly email: string;
    readonly name: string;
  };
}

export interface TestOrderPlacedEvent extends IEvent {
  readonly type: typeof TestEventTypes.ORDER_PLACED;
  readonly data: {
    readonly userId: AggregateId;
    readonly items: Array<{
      readonly itemId: AggregateId;
      readonly quantity: number;
      readonly price: number;
    }>;
    readonly total: number;
  };
}

/**
 * Test command interfaces
 */
export interface TestCreateItemCommand extends ICommand {
  readonly type: typeof TestCommandTypes.CREATE_ITEM;
  readonly payload: {
    readonly name: string;
    readonly description: string;
    readonly price: number;
  };
}

export interface TestUpdateItemCommand extends ICommand {
  readonly type: typeof TestCommandTypes.UPDATE_ITEM;
  readonly payload: {
    readonly name?: string;
    readonly description?: string;
    readonly price?: number;
  };
}

export interface TestRegisterUserCommand extends ICommand {
  readonly type: typeof TestCommandTypes.REGISTER_USER;
  readonly payload: {
    readonly email: string;
    readonly name: string;
  };
}

export interface TestPlaceOrderCommand extends ICommand {
  readonly type: typeof TestCommandTypes.PLACE_ORDER;
  readonly payload: {
    readonly userId: AggregateId;
    readonly items: Array<{
      readonly itemId: AggregateId;
      readonly quantity: number;
    }>;
  };
}

/**
 * Union types for test events and commands
 */
export type TestEvent = 
  | TestItemCreatedEvent
  | TestItemUpdatedEvent  
  | TestUserRegisteredEvent
  | TestOrderPlacedEvent;

export type TestCommand =
  | TestCreateItemCommand
  | TestUpdateItemCommand
  | TestRegisterUserCommand
  | TestPlaceOrderCommand;

/**
 * Fixture factory functions
 */
export const TestFixtures = {
  /**
   * Create a test item created event
   */
  itemCreatedEvent: (
    aggregateId: AggregateId = TestAggregateIds.ITEM_1,
    overrides?: Partial<TestItemCreatedEvent['data']>
  ): TestItemCreatedEvent => ({
    type: TestEventTypes.ITEM_CREATED,
    aggregateId,
    version: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(new Date()),
    data: {
      name: 'Test Item',
      description: 'A test item for testing',
      price: 99.99,
      ...overrides
    }
  }),

  /**
   * Create a test item updated event
   */
  itemUpdatedEvent: (
    aggregateId: AggregateId = TestAggregateIds.ITEM_1,
    overrides?: Partial<TestItemUpdatedEvent['data']>
  ): TestItemUpdatedEvent => ({
    type: TestEventTypes.ITEM_UPDATED,
    aggregateId,
    version: BrandedTypes.aggregateVersion(2),
    timestamp: BrandedTypes.timestamp(new Date()),
    data: {
      name: 'Updated Test Item',
      ...overrides
    }
  }),

  /**
   * Create a test user registered event
   */
  userRegisteredEvent: (
    aggregateId: AggregateId = TestAggregateIds.USER_1,
    overrides?: Partial<TestUserRegisteredEvent['data']>
  ): TestUserRegisteredEvent => ({
    type: TestEventTypes.USER_REGISTERED,
    aggregateId,
    version: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(new Date()),
    data: {
      email: 'test@example.com',
      name: 'Test User',
      ...overrides
    }
  }),

  /**
   * Create a test order placed event
   */
  orderPlacedEvent: (
    aggregateId: AggregateId = TestAggregateIds.ORDER_1,
    overrides?: Partial<TestOrderPlacedEvent['data']>
  ): TestOrderPlacedEvent => ({
    type: TestEventTypes.ORDER_PLACED,
    aggregateId,
    version: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(new Date()),
    data: {
      userId: TestAggregateIds.USER_1,
      items: [
        {
          itemId: TestAggregateIds.ITEM_1,
          quantity: 2,
          price: 99.99
        }
      ],
      total: 199.98,
      ...overrides
    }
  }),

  /**
   * Create a test create item command
   */
  createItemCommand: (
    aggregateId: AggregateId = TestAggregateIds.ITEM_1,
    overrides?: Partial<TestCreateItemCommand['payload']>
  ): TestCreateItemCommand => ({
    type: TestCommandTypes.CREATE_ITEM,
    aggregateId,
    payload: {
      name: 'Test Item',
      description: 'A test item for testing',
      price: 99.99,
      ...overrides
    }
  }),

  /**
   * Create a test update item command
   */
  updateItemCommand: (
    aggregateId: AggregateId = TestAggregateIds.ITEM_1,
    overrides?: Partial<TestUpdateItemCommand['payload']>
  ): TestUpdateItemCommand => ({
    type: TestCommandTypes.UPDATE_ITEM,
    aggregateId,
    payload: {
      name: 'Updated Test Item',
      ...overrides
    }
  }),

  /**
   * Create a test register user command
   */
  registerUserCommand: (
    aggregateId: AggregateId = TestAggregateIds.USER_1,
    overrides?: Partial<TestRegisterUserCommand['payload']>
  ): TestRegisterUserCommand => ({
    type: TestCommandTypes.REGISTER_USER,
    aggregateId,
    payload: {
      email: 'test@example.com',
      name: 'Test User',
      ...overrides
    }
  }),

  /**
   * Create a test place order command
   */
  placeOrderCommand: (
    aggregateId: AggregateId = TestAggregateIds.ORDER_1,
    overrides?: Partial<TestPlaceOrderCommand['payload']>
  ): TestPlaceOrderCommand => ({
    type: TestCommandTypes.PLACE_ORDER,
    aggregateId,
    payload: {
      userId: TestAggregateIds.USER_1,
      items: [
        {
          itemId: TestAggregateIds.ITEM_1,
          quantity: 2
        }
      ],
      ...overrides
    }
  })
};

/**
 * Test scenarios - collections of related events/commands for testing workflows
 */
export const TestScenarios = {
  /**
   * Complete item lifecycle scenario
   */
  itemLifecycle: (itemId: AggregateId = TestAggregateIds.ITEM_1) => ({
    commands: [
      TestFixtures.createItemCommand(itemId, { name: 'Lifecycle Item', price: 149.99 }),
      TestFixtures.updateItemCommand(itemId, { price: 129.99 })
    ],
    events: [
      TestFixtures.itemCreatedEvent(itemId, { name: 'Lifecycle Item', price: 149.99 }),
      TestFixtures.itemUpdatedEvent(itemId, { price: 129.99 })
    ]
  }),

  /**
   * User registration and order scenario
   */
  userOrderFlow: (
    userId: AggregateId = TestAggregateIds.USER_1,
    orderId: AggregateId = TestAggregateIds.ORDER_1
  ) => ({
    commands: [
      TestFixtures.registerUserCommand(userId, { email: 'customer@example.com', name: 'Customer' }),
      TestFixtures.placeOrderCommand(orderId, { userId })
    ],
    events: [
      TestFixtures.userRegisteredEvent(userId, { email: 'customer@example.com', name: 'Customer' }),
      TestFixtures.orderPlacedEvent(orderId, { userId })
    ]
  }),

  /**
   * Multi-item order scenario
   */
  multiItemOrder: (orderId: AggregateId = TestAggregateIds.ORDER_1) => ({
    events: [
      TestFixtures.orderPlacedEvent(orderId, {
        items: [
          { itemId: TestAggregateIds.ITEM_1, quantity: 2, price: 99.99 },
          { itemId: TestAggregateIds.ITEM_2, quantity: 1, price: 149.99 }
        ],
        total: 349.97
      })
    ]
  })
};