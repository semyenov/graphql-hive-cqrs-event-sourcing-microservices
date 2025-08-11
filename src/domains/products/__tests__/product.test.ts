/**
 * Product Domain Tests
 * 
 * Comprehensive tests demonstrating Effect-based CQRS patterns
 */

import { describe, it, expect, beforeEach, afterEach, test } from 'bun:test';
import * as Effect from 'effect/Effect';
import { createTestHarness } from '@cqrs/framework/effect/testing';
import { SimpleProductAggregate } from '../product.simple';
import { 
  ProductCommandDispatcher,
  CreateProductHandler,
  UpdateInventoryHandler,
  ReserveInventoryHandler,
} from '../product.handlers';
import {
  ProductBrandedTypes,
  ProductEventTypes,
  ProductCommandTypes,
  ProductStatus,
  type ProductEvent,
  type CreateProductCommand,
  type UpdateInventoryCommand,
  type ReserveInventoryCommand,
  InsufficientInventoryError,
  InvalidProductStatusError
} from '../product.types';

describe('Product Domain', () => {
  let testHarness: ReturnType<typeof createTestHarness<ProductEvent>>;

  beforeEach(() => {
    testHarness = createTestHarness<ProductEvent>();
  });

  afterEach(() => {
    testHarness.clear();
  });

  describe('Product Aggregate', () => {
    test('should create a new product', () => {
      const productId = ProductBrandedTypes.productId('laptop-001');
      const aggregate = SimpleProductAggregate.create(productId);

      aggregate.createProduct({
        name: 'Gaming Laptop',
        description: 'High-performance gaming laptop',
        sku: ProductBrandedTypes.sku('LAPTOP-001'),
        price: ProductBrandedTypes.price(1299.99),
        categoryId: ProductBrandedTypes.categoryId('electronics'),
        initialQuantity: 10,
        metadata: {
          tags: ['gaming', 'laptop', 'electronics'],
          weight: 2.5,
          dimensions: { length: 35, width: 25, height: 2.5 }
        }
      });

      // Verify aggregate state
      expect(aggregate.state).toBeTruthy();
      expect(aggregate.state?.name).toBe('Gaming Laptop');
      expect(aggregate.state?.status).toBe(ProductStatus.DRAFT);
      expect(aggregate.state?.inventory.quantity).toBe(10);
      expect(aggregate.state?.inventory.available).toBe(10);
      expect(aggregate.state?.inventory.reserved).toBe(0);

      // Verify events
      const events = aggregate.uncommittedEvents;
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe(ProductEventTypes.PRODUCT_CREATED);
    });

    test('should activate a product', async () => {
      const productId = ProductBrandedTypes.productId('laptop-002');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          yield* _(aggregate.createProduct({
            name: 'Office Laptop',
            description: 'Business laptop',
            sku: ProductBrandedTypes.sku('LAPTOP-002'),
            price: ProductBrandedTypes.price(899.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 5
          }));

          yield* _(aggregate.activateProduct());
        })
      );

      expect(aggregate.state?.status).toBe(ProductStatus.ACTIVE);
      
      const events = aggregate.uncommittedEvents;
      expect(events).toHaveLength(2);
      expect(events[1]?.type).toBe(ProductEventTypes.PRODUCT_ACTIVATED);
    });

    test('should update inventory', async () => {
      const productId = ProductBrandedTypes.productId('laptop-003');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          yield* _(aggregate.createProduct({
            name: 'Student Laptop',
            description: 'Budget-friendly laptop',
            sku: ProductBrandedTypes.sku('LAPTOP-003'),
            price: ProductBrandedTypes.price(599.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 15
          }));

          yield* _(aggregate.updateInventory(25, 'RESTOCK'));
        })
      );

      expect(aggregate.state?.inventory.quantity).toBe(25);
      expect(aggregate.state?.inventory.available).toBe(25);
      
      const events = aggregate.uncommittedEvents;
      expect(events).toHaveLength(2);
      expect(events[1]?.type).toBe(ProductEventTypes.INVENTORY_UPDATED);
      expect((events[1] as any).data.newQuantity).toBe(25);
      expect((events[1] as any).data.reason).toBe('RESTOCK');
    });

    test('should reserve and release inventory', async () => {
      const productId = ProductBrandedTypes.productId('laptop-004');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          // Create and activate product
          yield* _(aggregate.createProduct({
            name: 'Pro Laptop',
            description: 'Professional laptop',
            sku: ProductBrandedTypes.sku('LAPTOP-004'),
            price: ProductBrandedTypes.price(1799.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 20
          }));

          yield* _(aggregate.activateProduct());

          // Reserve inventory
          yield* _(aggregate.reserveInventory(5, 'order-123', 'Customer order'));

          // Check state after reservation
          expect(aggregate.state?.inventory.quantity).toBe(20);
          expect(aggregate.state?.inventory.reserved).toBe(5);
          expect(aggregate.state?.inventory.available).toBe(15);

          // Release some inventory
          yield* _(aggregate.releaseInventory(2, 'order-123', 'CANCELLED'));
        })
      );

      // Check final state
      expect(aggregate.state?.inventory.quantity).toBe(20);
      expect(aggregate.state?.inventory.reserved).toBe(3);
      expect(aggregate.state?.inventory.available).toBe(17);

      const events = aggregate.uncommittedEvents;
      expect(events).toHaveLength(4);
      expect(events[2]?.type).toBe(ProductEventTypes.INVENTORY_RESERVED);
      expect(events[3]?.type).toBe(ProductEventTypes.INVENTORY_RELEASED);
    });

    test('should handle insufficient inventory error', async () => {
      const productId = ProductBrandedTypes.productId('laptop-005');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          yield* _(aggregate.createProduct({
            name: 'Limited Laptop',
            description: 'Limited stock laptop',
            sku: ProductBrandedTypes.sku('LAPTOP-005'),
            price: ProductBrandedTypes.price(999.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 3
          }));

          yield* _(aggregate.activateProduct());
        })
      );

      // Try to reserve more than available
      const reserveEffect = aggregate.reserveInventory(5, 'order-456', 'Large order');

      await expect(testHarness.runTest(reserveEffect))
        .rejects.toThrow('Insufficient inventory');
    });

    test('should handle invalid status transitions', async () => {
      const productId = ProductBrandedTypes.productId('laptop-006');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        aggregate.createProduct({
          name: 'Test Laptop',
          description: 'Test laptop',
          sku: ProductBrandedTypes.sku('LAPTOP-006'),
          price: ProductBrandedTypes.price(799.99),
          categoryId: ProductBrandedTypes.categoryId('electronics'),
          initialQuantity: 10
        })
      );

      // Try to reserve inventory on inactive product
      const reserveEffect = aggregate.reserveInventory(2, 'order-789', 'Test order');

      await expect(testHarness.runTest(reserveEffect))
        .rejects.toThrow('Invalid product status');
    });
  });

  describe('Product Command Handlers', () => {
    test('should handle create product command', async () => {
      const command: CreateProductCommand = {
        type: ProductCommandTypes.CREATE_PRODUCT,
        aggregateId: ProductBrandedTypes.productId('cmd-laptop-001'),
        payload: {
          name: 'Command Test Laptop',
          description: 'Laptop created via command',
          sku: ProductBrandedTypes.sku('CMD-LAPTOP-001'),
          price: ProductBrandedTypes.price(1099.99),
          categoryId: ProductBrandedTypes.categoryId('electronics'),
          initialQuantity: 8,
          metadata: {
            tags: ['test', 'laptop'],
            weight: 2.2
          }
        }
      };

      const handler = new CreateProductHandler();
      const repository = testHarness.createRepository(
        (id) => ProductAggregate.create(id)
      );

      const result = await testHarness.runTest(
        handler.handle(command).pipe(
          Effect.provideService({} as any, { productRepository: repository })
        )
      );

      expect(result.productId).toBe(command.aggregateId);
      
      // Verify event was stored
      testHarness.assertEventsStored(command.aggregateId, [ProductEventTypes.PRODUCT_CREATED]);
    });

    test('should handle update inventory command', async () => {
      const productId = ProductBrandedTypes.productId('cmd-laptop-002');
      
      // First create a product
      const createCommand: CreateProductCommand = {
        type: ProductCommandTypes.CREATE_PRODUCT,
        aggregateId: productId,
        payload: {
          name: 'Inventory Test Laptop',
          description: 'For inventory testing',
          sku: ProductBrandedTypes.sku('INV-LAPTOP-001'),
          price: ProductBrandedTypes.price(899.99),
          categoryId: ProductBrandedTypes.categoryId('electronics'),
          initialQuantity: 12
        }
      };

      const updateCommand: UpdateInventoryCommand = {
        type: ProductCommandTypes.UPDATE_INVENTORY,
        aggregateId: productId,
        payload: {
          quantity: 20,
          reason: 'RESTOCK'
        }
      };

      const repository = testHarness.createRepository(
        (id) => ProductAggregate.create(id)
      );

      const serviceContext = { productRepository: repository };

      await testHarness.runTest(
        Effect.gen(function* (_) {
          // Create product first
          const createHandler = new CreateProductHandler();
          yield* _(createHandler.handle(createCommand).pipe(
            Effect.provideService({} as any, serviceContext)
          ));

          // Update inventory
          const updateHandler = new UpdateInventoryHandler();
          const result = yield* _(updateHandler.handle(updateCommand).pipe(
            Effect.provideService({} as any, serviceContext)
          ));

          return result;
        })
      );

      // Verify both events were stored
      testHarness.assertEventsStored(productId, [
        ProductEventTypes.PRODUCT_CREATED,
        ProductEventTypes.INVENTORY_UPDATED
      ]);
    });

    test('should handle reserve inventory command with business rule validation', async () => {
      const productId = ProductBrandedTypes.productId('cmd-laptop-003');
      
      const createCommand: CreateProductCommand = {
        type: ProductCommandTypes.CREATE_PRODUCT,
        aggregateId: productId,
        payload: {
          name: 'Reserve Test Laptop',
          description: 'For reservation testing',
          sku: ProductBrandedTypes.sku('RES-LAPTOP-001'),
          price: ProductBrandedTypes.price(1199.99),
          categoryId: ProductBrandedTypes.categoryId('electronics'),
          initialQuantity: 5
        }
      };

      const reserveCommand: ReserveInventoryCommand = {
        type: ProductCommandTypes.RESERVE_INVENTORY,
        aggregateId: productId,
        payload: {
          quantity: 10, // More than available
          reservationId: 'res-001',
          reason: 'Large order test'
        }
      };

      const repository = testHarness.createRepository(
        (id) => ProductAggregate.create(id)
      );

      const serviceContext = { productRepository: repository };

      // Should fail because product is not activated and quantity is too high
      const testEffect = Effect.gen(function* (_) {
        const createHandler = new CreateProductHandler();
        yield* _(createHandler.handle(createCommand).pipe(
          Effect.provideService({} as any, serviceContext)
        ));

        const reserveHandler = new ReserveInventoryHandler();
        yield* _(reserveHandler.handle(reserveCommand).pipe(
          Effect.provideService({} as any, serviceContext)
        ));
      });

      await expect(testHarness.runTest(testEffect))
        .rejects.toThrow('Invalid product status');
    });
  });

  describe('Product Event Sourcing', () => {
    test('should reconstitute aggregate from event history', async () => {
      const productId = ProductBrandedTypes.productId('event-laptop-001');
      
      // Create events manually
      const events: ProductEvent[] = [
        {
          type: ProductEventTypes.PRODUCT_CREATED,
          aggregateId: productId,
          version: 1 as any,
          timestamp: '2024-01-01T10:00:00.000Z',
          data: {
            name: 'Event Source Laptop',
            description: 'Laptop from events',
            sku: ProductBrandedTypes.sku('EVENT-LAPTOP-001'),
            price: ProductBrandedTypes.price(1399.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 15,
            metadata: { tags: ['event', 'sourcing'] }
          }
        } as ProductEvent,
        {
          type: ProductEventTypes.PRODUCT_ACTIVATED,
          aggregateId: productId,
          version: 2 as any,
          timestamp: '2024-01-01T11:00:00.000Z',
          data: {}
        } as ProductEvent,
        {
          type: ProductEventTypes.INVENTORY_RESERVED,
          aggregateId: productId,
          version: 3 as any,
          timestamp: '2024-01-01T12:00:00.000Z',
          data: {
            quantity: 3,
            reservationId: 'res-history-001',
            reason: 'Historical order'
          }
        } as ProductEvent
      ];

      const aggregate = await testHarness.runTest(
        ProductAggregate.fromHistory(productId, events)
      );

      // Verify reconstituted state
      expect(aggregate.state?.name).toBe('Event Source Laptop');
      expect(aggregate.state?.status).toBe(ProductStatus.ACTIVE);
      expect(aggregate.state?.inventory.quantity).toBe(15);
      expect(aggregate.state?.inventory.reserved).toBe(3);
      expect(aggregate.state?.inventory.available).toBe(12);
      expect(aggregate.version).toBe(3);
      expect(aggregate.uncommittedEvents).toHaveLength(0);
    });

    test('should maintain version consistency', async () => {
      const productId = ProductBrandedTypes.productId('version-laptop-001');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          yield* _(aggregate.createProduct({
            name: 'Version Test Laptop',
            description: 'For version testing',
            sku: ProductBrandedTypes.sku('VER-LAPTOP-001'),
            price: ProductBrandedTypes.price(999.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 10
          }));

          yield* _(aggregate.activateProduct());
          yield* _(aggregate.updateInventory(15, 'RESTOCK'));
        })
      );

      expect(aggregate.version).toBe(3);
      expect(aggregate.uncommittedEvents).toHaveLength(3);
      
      // Check event versions
      const events = aggregate.uncommittedEvents;
      expect((events[0] as any).version).toBe(1);
      expect((events[1] as any).version).toBe(2);
      expect((events[2] as any).version).toBe(3);
    });
  });

  describe('Product Business Rules', () => {
    test('should enforce product lifecycle transitions', async () => {
      const productId = ProductBrandedTypes.productId('lifecycle-laptop-001');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          // Create -> Draft
          yield* _(aggregate.createProduct({
            name: 'Lifecycle Laptop',
            description: 'For lifecycle testing',
            sku: ProductBrandedTypes.sku('LIFE-LAPTOP-001'),
            price: ProductBrandedTypes.price(1099.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 8
          }));

          // Draft -> Active
          yield* _(aggregate.activateProduct());

          // Active -> Inactive
          yield* _(aggregate.deactivateProduct('Temporarily unavailable'));
        })
      );

      expect(aggregate.state?.status).toBe(ProductStatus.INACTIVE);
      
      // Should be able to reactivate
      await testHarness.runTest(aggregate.activateProduct());
      expect(aggregate.state?.status).toBe(ProductStatus.ACTIVE);
    });

    test('should calculate inventory correctly with multiple reservations', async () => {
      const productId = ProductBrandedTypes.productId('multi-res-laptop-001');
      const aggregate = ProductAggregate.create(productId);

      await testHarness.runTest(
        Effect.gen(function* (_) {
          yield* _(aggregate.createProduct({
            name: 'Multi Reserve Laptop',
            description: 'For multiple reservation testing',
            sku: ProductBrandedTypes.sku('MULTI-LAPTOP-001'),
            price: ProductBrandedTypes.price(1299.99),
            categoryId: ProductBrandedTypes.categoryId('electronics'),
            initialQuantity: 20
          }));

          yield* _(aggregate.activateProduct());

          // Multiple reservations
          yield* _(aggregate.reserveInventory(5, 'order-001', 'First order'));
          yield* _(aggregate.reserveInventory(3, 'order-002', 'Second order'));
          yield* _(aggregate.reserveInventory(2, 'order-003', 'Third order'));

          // Partial release
          yield* _(aggregate.releaseInventory(3, 'order-002', 'CANCELLED'));
        })
      );

      // Final state: 20 total, 7 reserved (5+2), 13 available
      expect(aggregate.state?.inventory.quantity).toBe(20);
      expect(aggregate.state?.inventory.reserved).toBe(7);
      expect(aggregate.state?.inventory.available).toBe(13);
    });
  });
});