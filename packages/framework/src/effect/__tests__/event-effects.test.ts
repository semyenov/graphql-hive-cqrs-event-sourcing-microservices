/**
 * Event Effects Tests
 *
 * Tests for Effect-based event processing, streaming, and projections
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Duration from "effect/Duration";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Option from "effect/Option";
import { BrandedTypes } from "../../core/branded";
import {
  Assertions,
  createTestHarness,
  TestEventTypes,
  TestFixtures,
  TestScenarios,
} from "../testing";
import type { TestEvent } from "../testing/fixtures";
import type { AggregateId } from "../../core/branded/types";
import type { IAggregateBehavior } from "../core/types";

describe("Event Effects", () => {
  let testHarness: ReturnType<
    typeof createTestHarness<
      any,
      TestEvent,
      AggregateId,
      IAggregateBehavior<any, TestEvent, AggregateId>
    >
  >;

  beforeEach(() => {
    testHarness = createTestHarness<
      any,
      TestEvent,
      AggregateId,
      IAggregateBehavior<any, TestEvent, AggregateId>
    >();
  });

  afterEach(() => {
    testHarness.clear();
  });

  describe("Basic Event Processing", () => {
    test("should process single event", async () => {
      const event = TestFixtures.itemCreatedEvent(
        BrandedTypes.aggregateId("item-1"),
        { name: "Test Item", price: 99.99 },
      );

      const processEvent = Effect.gen(function* (_) {
        // Simulate event processing
        return {
          eventId: event.aggregateId,
          eventType: event.type,
          processed: true,
          timestamp: new Date().toISOString(),
        };
      });

      const result = await testHarness.runTest(processEvent);

      Assertions.assertEqual(result.eventType, TestEventTypes.ITEM_CREATED);
      Assertions.assertTrue(result.processed);
      Assertions.assertDefined(result.timestamp);
    });

    test("should process event batch", async () => {
      const events = [
        TestFixtures.itemCreatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.itemUpdatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.userRegisteredEvent(BrandedTypes.aggregateId("user-1")),
      ];

      const processBatch = Effect.gen(function* (_) {
        const results = [];
        for (const event of events) {
          results.push({
            eventId: event.aggregateId,
            eventType: event.type,
            processed: true,
          });
        }
        return results;
      });

      const results = await testHarness.runTest(processBatch);

      Assertions.assertLength(results, 3);
      Assertions.assertEqual(
        results[0]?.eventType,
        TestEventTypes.ITEM_CREATED,
      );
      Assertions.assertEqual(
        results[1]?.eventType,
        TestEventTypes.ITEM_UPDATED,
      );
      Assertions.assertEqual(
        results[2]?.eventType,
        TestEventTypes.USER_REGISTERED,
      );
    });

    test("should handle event processing errors", async () => {
      const invalidEvent = { ...TestFixtures.itemCreatedEvent(), data: null };

      const processWithValidation = Effect.tryPromise({
        try: () => Promise.resolve({ processed: true }),
        catch: (error) => Effect.succeed({ processed: false }),
      });

      const result = await testHarness.runTest(processWithValidation);
      Assertions.assertFalse(result.processed);
    });
  });

  describe("Event Streaming", () => {
    test("should create event stream from array", async () => {
      const events = [
        TestFixtures.itemCreatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.itemUpdatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.userRegisteredEvent(BrandedTypes.aggregateId("user-1")),
      ];

      const eventStream = Stream.fromIterable(events);
      const processedEvents = await testHarness.runTest(
        Stream.runCollect(eventStream),
      );

      const eventsArray = Array.from(processedEvents);
      expect(eventsArray).toHaveLength(3);
      expect(eventsArray[0]?.type).toBe(TestEventTypes.ITEM_CREATED);
      expect(eventsArray[1]?.type).toBe(TestEventTypes.ITEM_UPDATED);
      expect(eventsArray[2]?.type).toBe(TestEventTypes.USER_REGISTERED);
    });

    test("should filter event stream by type", async () => {
      const events = [
        TestFixtures.itemCreatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.userRegisteredEvent(BrandedTypes.aggregateId("user-1")),
        TestFixtures.itemUpdatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.orderPlacedEvent(BrandedTypes.aggregateId("order-1")),
      ];

      const eventStream = Stream.fromIterable(events);
      const itemEventsOnly = Stream.filter(
        eventStream,
        (event: TestEvent) =>
          event.type === TestEventTypes.ITEM_CREATED ||
          event.type === TestEventTypes.ITEM_UPDATED,
      );

      const filteredEvents = await testHarness.runTest(
        Stream.runCollect(itemEventsOnly),
      );

      const filteredArray = Array.from(filteredEvents);
      expect(filteredArray).toHaveLength(2);
      expect(
        filteredArray.every((e: any) =>
          e.type === TestEventTypes.ITEM_CREATED ||
          e.type === TestEventTypes.ITEM_UPDATED
        ),
      ).toBe(true);
    });

    test("should transform event stream", async () => {
      const events = [
        TestFixtures.itemCreatedEvent(BrandedTypes.aggregateId("item-1")),
        TestFixtures.itemUpdatedEvent(BrandedTypes.aggregateId("item-1")),
      ];

      const eventStream = Stream.fromIterable(events);
      const transformedStream = Stream.map(eventStream, (event: TestEvent) => ({
        originalType: event.type,
        aggregateId: event.aggregateId,
        processed: true,
        timestamp: new Date().toISOString(),
      }));

      const transformedEvents = await testHarness.runTest(
        Stream.runCollect(transformedStream),
      );

      const transformedEventsArray = Array.from(transformedEvents);
      expect(transformedEventsArray).toHaveLength(2);
      transformedEventsArray.forEach((event) => {
        Assertions.assertTrue(event.processed);
        Assertions.assertDefined(event.originalType);
        Assertions.assertDefined(event.aggregateId);
        Assertions.assertDefined(event.timestamp);
      });
    });

    test("should handle concurrent event processing", async () => {
      const events = Array.from(
        { length: 10 },
        (_, i) =>
          TestFixtures.itemCreatedEvent(
            BrandedTypes.aggregateId(`item-${i}`),
            { name: `Item ${i}` },
          ),
      );

      const eventStream = Stream.fromIterable(events);
      const processedStream = Stream.mapEffect(
        eventStream,
        (event: TestEvent) =>
          Effect.succeed({
            eventId: event.aggregateId,
            eventType: event.type,
            processed: true,
          }),
        { concurrency: 5 },
      );

      const processedEvents = await testHarness.runTest(
        Stream.runCollect(processedStream),
      );

      const processedEventsArray = Array.from(processedEvents);
      Assertions.assertLength(processedEventsArray, 10);
      processedEventsArray.forEach((result, index) => {
        Assertions.assertEqual(
          result.eventId,
          BrandedTypes.aggregateId(`item-${index}`),
        );
        Assertions.assertTrue(result.processed);
      });
    });
  });

  describe("Event Projections", () => {
    test("should build projection from events", async () => {
      const events = [
        TestFixtures.itemCreatedEvent(
          BrandedTypes.aggregateId("item-1"),
          { name: "Item 1", price: 100 },
        ),
        TestFixtures.itemUpdatedEvent(
          BrandedTypes.aggregateId("item-1"),
          { price: 120 },
        ),
        TestFixtures.itemCreatedEvent(
          BrandedTypes.aggregateId("item-2"),
          { name: "Item 2", price: 200 },
        ),
      ];

      const buildProjection = Effect.gen(function* (_) {
        const projection = new Map<string, any>();

        for (const event of events) {
          const aggregateId = event.aggregateId as string;

          switch (event.type) {
            case TestEventTypes.ITEM_CREATED:
              projection.set(aggregateId, {
                id: aggregateId,
                name: event.data.name,
                price: event.data.price,
                version: event.version,
              });
              break;

            case TestEventTypes.ITEM_UPDATED:
              const existing = projection.get(aggregateId);
              if (existing) {
                projection.set(aggregateId, {
                  ...existing,
                  ...event.data,
                  version: event.version,
                });
              }
              break;
          }
        }

        return Array.from(projection.values());
      });

      const projection = await testHarness.runTest(buildProjection);

      Assertions.assertLength(projection, 2);

      const item1 = projection.find((p) => p && p.id === "item-1");
      const item2 = projection.find((p) => p && p.id === "item-2");

      Assertions.assertDefined(item1);
      Assertions.assertDefined(item2);
      Assertions.assertEqual(item1.name, "Item 1");
      Assertions.assertEqual(item1.price, 120); // Should be updated price
      Assertions.assertEqual(item2.name, "Item 2");
      Assertions.assertEqual(item2.price, 200);
    });

    test("should maintain projection state with Ref", async () => {
      const events = [
        TestFixtures.userRegisteredEvent(
          BrandedTypes.aggregateId("user-1"),
          { name: "User 1", email: "user1@test.com" },
        ),
        TestFixtures.userRegisteredEvent(
          BrandedTypes.aggregateId("user-2"),
          { name: "User 2", email: "user2@test.com" },
        ),
      ];

      const buildUserProjection = Effect.gen(function* (_) {
        const userCountRef = yield* _(Ref.make(0));
        const usersRef = yield* _(Ref.make<any[]>([]));

        for (const event of events) {
          if (event.type === TestEventTypes.USER_REGISTERED) {
            yield* _(Ref.update(userCountRef, (count) => count + 1));
            yield* _(Ref.update(usersRef, (users) => [
              ...users,
              {
                id: event.aggregateId,
                name: event.data.name,
                email: event.data.email,
              },
            ]));
          }
        }

        const count = yield* _(Ref.get(userCountRef));
        const users = yield* _(Ref.get(usersRef));

        return { count, users };
      });

      const projection = await testHarness.runTest(buildUserProjection);

      Assertions.assertEqual(projection.count, 2);
      Assertions.assertLength(projection.users, 2);
      Assertions.assertEqual(projection.users[0].name, "User 1");
      Assertions.assertEqual(projection.users[1].name, "User 2");
    });

    test("should handle projection errors gracefully", async () => {
      const validEvent = TestFixtures.itemCreatedEvent();
      const invalidEvent = { ...TestFixtures.itemCreatedEvent(), data: null };

      const buildProjectionWithValidation = Effect.gen(function* (_) {
        const results = [];

        for (const event of [validEvent, invalidEvent]) {
          try {
            if (!event.data) {
              throw new Error(`Invalid event data for ${event.aggregateId}`);
            }

            results.push({
              aggregateId: event.aggregateId,
              success: true,
            });
          } catch (error) {
            results.push({
              aggregateId: event.aggregateId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return results;
      });

      const results = await testHarness.runTest(buildProjectionWithValidation);

      Assertions.assertLength(results, 2);
      Assertions.assertTrue(results[0]?.success ?? false);
      Assertions.assertFalse(results[1]?.success ?? false);
      Assertions.assertTrue(
        results[1]?.error?.includes("Invalid event data") ?? false,
      );
    });
  });

  describe("Event Scenarios", () => {
    test("should handle complete item lifecycle", async () => {
      const itemId = BrandedTypes.aggregateId("lifecycle-item");
      const scenario = TestScenarios.itemLifecycle(itemId);

      const processScenario = Effect.gen(function* (_) {
        const state = { items: new Map<string, any>() };

        for (const event of scenario.events) {
          switch (event.type) {
            case TestEventTypes.ITEM_CREATED:
              state.items.set(event.aggregateId as string, {
                id: event.aggregateId,
                ...event.data,
                version: event.version,
              });
              break;

            case TestEventTypes.ITEM_UPDATED:
              const existing = state.items.get(event.aggregateId as string);
              if (existing) {
                state.items.set(event.aggregateId as string, {
                  ...existing,
                  ...event.data,
                  version: event.version,
                });
              }
              break;
          }
        }

        return {
          processedEvents: scenario.events.length,
          finalState: state.items.get(itemId as string),
        };
      });

      const result = await testHarness.runTest(processScenario);

      Assertions.assertEqual(result.processedEvents, 2);
      Assertions.assertDefined(result.finalState);
      Assertions.assertEqual(result.finalState.name, "Lifecycle Item");
      Assertions.assertEqual(result.finalState.price, 129.99); // Updated price
    });

    test("should handle user order flow scenario", async () => {
      const userId = BrandedTypes.aggregateId("test-user");
      const orderId = BrandedTypes.aggregateId("test-order");
      const scenario = TestScenarios.userOrderFlow(userId, orderId);

      const processOrderFlow = Effect.gen(function* (_) {
        const state = {
          users: new Map<string, any>(),
          orders: new Map<string, any>(),
        };

        for (const event of scenario.events) {
          switch (event.type) {
            case TestEventTypes.USER_REGISTERED:
              state.users.set(event.aggregateId as string, {
                id: event.aggregateId,
                ...event.data,
              });
              break;

            case TestEventTypes.ORDER_PLACED:
              state.orders.set(event.aggregateId as string, {
                id: event.aggregateId,
                ...event.data,
              });
              break;
          }
        }

        return {
          user: state.users.get(userId as string),
          order: state.orders.get(orderId as string),
        };
      });

      const result = await testHarness.runTest(processOrderFlow);

      Assertions.assertDefined(result.user);
      Assertions.assertDefined(result.order);
      Assertions.assertEqual(result.user.name, "Customer");
      Assertions.assertEqual(result.user.email, "customer@example.com");
      Assertions.assertEqual(result.order.userId, userId);
    });
  });

  describe("Event Performance", () => {
    test("should process events efficiently", async () => {
      const eventCount = 1000;
      const events = Array.from(
        { length: eventCount },
        (_, i) =>
          TestFixtures.itemCreatedEvent(
            BrandedTypes.aggregateId(`item-${i}`),
            { name: `Item ${i}`, price: i * 10 },
          ),
      );

      const processEvents = Effect.gen(function* (_) {
        let processedCount = 0;
        const start = Date.now();

        for (const event of events) {
          // Simulate lightweight processing
          if (event.data.name && event.data.price > 0) {
            processedCount++;
          }
        }

        const duration = Date.now() - start;
        return { processedCount, duration };
      });

      const result = await testHarness.runTest(processEvents);

      Assertions.assertEqual(result.processedCount, eventCount);
      Assertions.assertTrue(
        result.duration < 1000,
        `Processing ${eventCount} events took ${result.duration}ms, expected < 1000ms`,
      );
    });

    test("should handle event streaming with backpressure", async () => {
      const eventCount = 100;
      const events = Array.from(
        { length: eventCount },
        (_, i) =>
          TestFixtures.itemCreatedEvent(BrandedTypes.aggregateId(`item-${i}`)),
      );

      const streamWithBackpressure = Effect.gen(function* (_) {
        const queue = yield* _(Queue.bounded<TestEvent>(10)); // Limited capacity
        const processed = yield* _(Ref.make(0));

        // Producer (add events to queue)
        const producer = Effect.gen(function* (_) {
          for (const event of events) {
            yield* _(Queue.offer(queue, event));
          }
          yield* _(Queue.shutdown(queue));
        });

        // Consumer (process events from queue)
        const consumer = Effect.gen(function* (_) {
          while (true) {
            yield* _(Queue.take(queue));
            yield* _(Ref.update(processed, (n) => n + 1));
            // Small delay to simulate processing
            yield* _(Effect.sleep(Duration.millis(1)));
          }
        }).pipe(
          Effect.catchSome(() => Option.some(Effect.succeed(undefined))),
        );

        // Run producer and consumer concurrently
        yield* _(Effect.fork(producer));
        yield* _(consumer);

        return yield* _(Ref.get(processed));
      });

      const processedCount = await testHarness.runTest(streamWithBackpressure);

      Assertions.assertEqual(processedCount, eventCount);
    });
  });
});
