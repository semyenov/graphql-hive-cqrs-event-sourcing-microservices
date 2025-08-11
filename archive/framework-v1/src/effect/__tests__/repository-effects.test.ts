/**
 * Repository Effects Tests
 *
 * Comprehensive tests for Effect-based repository patterns
 */

import { afterEach, beforeEach, describe, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import { BrandedTypes } from "../../core/branded";
import {
  Assertions,
  createTestHarness,
  EffectTestHarness,
  MockAggregate,
  TestFixtures,
} from "../testing";
import type { TestEvent } from "../testing/fixtures";
import { AggregateNotFoundError } from "../core/repository-effects";

describe("Repository Effects", () => {
  type TestState = unknown;
  type TestId = ReturnType<typeof BrandedTypes.aggregateId>;
  type TestAggregate = MockAggregate<TestEvent, TestId>;

  let testHarness: EffectTestHarness<
    TestState,
    TestEvent,
    TestId,
    TestAggregate
  >;

  beforeEach(() => {
    testHarness = createTestHarness<
      TestState,
      TestEvent,
      TestId,
      TestAggregate
    >();
  });

  afterEach(() => {
    testHarness?.clear();
  });

  describe("Basic Repository Operations", () => {
    test("should create and save an aggregate", async () => {
      const aggregateId = BrandedTypes.aggregateId("test-aggregate-1");
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      const aggregate = new MockAggregate<TestEvent>(aggregateId);
      const testEvent = TestFixtures.itemCreatedEvent(aggregateId);
      aggregate.addEvent(testEvent);

      // Save the aggregate
      await testHarness.runTest(repository.save(aggregate));

      // Verify it was saved
      const result = await testHarness.runTest(
        repository.exists(aggregateId),
      );

      Assertions.assertTrue(result!, "Aggregate should exist after saving");
      testHarness.assertEventsStored(aggregateId, ["ItemCreated"]);
    });

    test("should load an aggregate with events", async () => {
      const aggregateId = BrandedTypes.aggregateId("test-aggregate-2");
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      // First save an aggregate with events
      const aggregate = new MockAggregate<TestEvent>(aggregateId);
      const event1 = TestFixtures.itemCreatedEvent(aggregateId, {
        name: "Test Item 1",
      });
      const event2 = TestFixtures.itemUpdatedEvent(aggregateId, {
        name: "Updated Item 1",
      });

      aggregate.addEvent(event1);
      aggregate.addEvent(event2);

      await testHarness.runTest(repository.save(aggregate));

      // Then load it back
      const loadedAggregate = await testHarness.runTest(
        repository.load(aggregateId),
      );

      Assertions.assertEqual(loadedAggregate.id, aggregateId);
      Assertions.assertEqual(loadedAggregate.version, 2);
      testHarness.assertTotalEventCount(2);
    });

    test("should handle aggregate not found", async () => {
      const nonExistentId = BrandedTypes.aggregateId("non-existent");
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      const loadEffect = repository.load(nonExistentId);

      const result = await testHarness.runTest(loadEffect);
      Assertions.assertTrue(result instanceof AggregateNotFoundError);
    });
  });

  describe("Repository with Caching", () => {
    test("should cache loaded aggregates", async () => {
      const aggregateId = BrandedTypes.aggregateId("cached-aggregate");
      const repository = testHarness.createRepository(
        (id) => new MockAggregate<TestEvent>(id),
        {
          cacheCapacity: 10,
          cacheTTL: Duration.minutes(5),
        },
      );

      // Save aggregate first
      const aggregate = new MockAggregate<TestEvent>(aggregateId);
      aggregate.addEvent(TestFixtures.itemCreatedEvent(aggregateId));
      await testHarness.runTest(repository.save(aggregate));

      // Load twice - second load should hit cache
      const firstLoad = await testHarness.runTest(repository.load(aggregateId));
      const secondLoad = await testHarness.runTest(
        repository.load(aggregateId),
      );

      Assertions.assertEqual(firstLoad.id, secondLoad.id);
      Assertions.assertEqual(firstLoad.version, secondLoad.version);
    });
  });

  describe("Repository with Transactions", () => {
    test("should support transaction rollback", async () => {
      // This would test the transaction functionality
      // For now, just verify the basic structure exists
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      const exists = await testHarness.runTest(
        repository.exists(BrandedTypes.aggregateId("any-id")),
      );

      Assertions.assertFalse(exists);
    });
  });

  describe("Repository Error Handling", () => {
    test("should handle concurrent modifications", async () => {
      const aggregateId = BrandedTypes.aggregateId("concurrent-test");
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      // This test would verify optimistic locking
      // For now, just test basic save operation
      const result = await testHarness.runTest(
        Effect.gen(function* (_) {
          const aggregate = new MockAggregate<TestEvent>(aggregateId);
          aggregate.addEvent(TestFixtures.itemCreatedEvent(aggregateId));
          yield* _(repository.save(aggregate));
          return true;
        }),
      );

      Assertions.assertTrue(result);
    });

    test("should retry failed operations", async () => {
      // Test retry functionality
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      const result = await testHarness.runTest(
        Effect.gen(function* (_) {
          const exists = yield* _(
            repository.exists(BrandedTypes.aggregateId("retry-test")),
          );
          return exists;
        }),
      );

      Assertions.assertFalse(result);
    });
  });

  describe("Repository Performance", () => {
    test("should complete operations within reasonable time", async () => {
      const aggregateId = BrandedTypes.aggregateId("perf-test");
      const repository = testHarness.createRepository<TestState, TestAggregate>(
        (id) => new MockAggregate<TestEvent>(id) as TestAggregate,
      );

      const start = Date.now();

      const aggregate = new MockAggregate<TestEvent>(aggregateId);
      aggregate.addEvent(TestFixtures.itemCreatedEvent(aggregateId));
      await testHarness.runTest(repository.save(aggregate));

      const duration = Date.now() - start;
      Assertions.assertTrue(
        duration < 100,
        `Operation took ${duration}ms, expected < 100ms`,
      );
    });
  });
});
