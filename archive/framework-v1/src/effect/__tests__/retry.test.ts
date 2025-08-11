/**
 * Retry Effects Tests
 *
 * Tests for Effect-based retry policies and patterns
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";
import { type AggregateId, BrandedTypes } from "../../core/branded";
import {
  Assertions,
  createTestHarness,
  EffectTestHarness,
  TestEventTypes,
  TestFixtures,
} from "../testing";
import type { TestEvent } from "../testing/fixtures";
import type { IAggregateBehavior } from "../core/types";
import { withRetry } from "../core/command-effects";
import { retry } from "../patterns/retry";

describe("Retry Effects", () => {
  let testHarness: EffectTestHarness<
    unknown,
    TestEvent,
    AggregateId,
    IAggregateBehavior<unknown, TestEvent, AggregateId>
  >;

  beforeEach(() => {
    testHarness = createTestHarness();
  });

  afterEach(() => {
    testHarness.clear();
  });

  describe("Basic Retry", () => {
    test("should retry failing operation until success", async () => {
      const result = await Effect.runPromise(
        pipe(
          Effect.sync(() => {
            let attempts = 0;
            if (attempts < 4) {
              return { success: false, attempts };
            }
            return { success: true, attempts };
          }),
          Effect.catchAll((error) => Effect.fail(error)),
        ),
      );

      Assertions.assertEqual(result.success, true);
      Assertions.assertEqual(result.attempts, 4);
    });
    test("should retry failing operation until success", async () => {
      let attempts = 0;
      const flakyOperation = retry(
        Effect.sync(() => {
          attempts++;
          if (attempts < 3) {
            return { success: false, attempts };
          } else {
            return { success: true, attempts };
          }
        }),
        {
          maxAttempts: 5,
          initialDelay: Duration.millis(100),
          factor: 2,
        },
      );

      const result = await testHarness.runTest(flakyOperation);

      Assertions.assertTrue(result.success);
      Assertions.assertEqual(result.attempts, 3);
    });

    test("should fail after maximum retry attempts", async () => {
      let attempts = 0;
      const alwaysFailingOperation = pipe(
        Effect.sync(() => {
          attempts++;
          throw new Error(`Attempt ${attempts} failed`);
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          alwaysFailingOperation,
          Effect.retry(Schedule.recurs(2)),
          Effect.catchAll((error: Error) =>
            Effect.succeed({ success: false, error: error.message })
          ),
        ),
      );

      Assertions.assertFalse(result.success);
      Assertions.assertEqual(result.error, "failed");
      Assertions.assertEqual(attempts, 2);
    });

    test("should succeed immediately without retry", async () => {
      let attempts = 0;
      const successfulOperation = Effect.sync(() => {
        attempts++;
        return { success: true, attempts };
      });

      const result = await testHarness.runTest(successfulOperation);

      Assertions.assertTrue(result.success);
      Assertions.assertEqual(result.attempts, 1);
    });
  });

  describe("Retry Schedules", () => {
    test("should use exponential backoff", async () => {
      let attempts = 0;
      const timestamps: number[] = [];

      const operationWithTimestamp = pipe(
        Effect.sync(() => {
          timestamps.push(Date.now());
          attempts++;
          if (attempts < 4) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return { success: true, attempts };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          operationWithTimestamp,
          Effect.retry(Schedule.exponential(Duration.millis(10))),
        ),
      );

      Assertions.assertTrue(result.success);
      Assertions.assertEqual(result.attempts, 4);

      // Check that delays are increasing
      if (timestamps.length > 2) {
        const delay1 = (timestamps[1] ?? 0) - (timestamps[0] ?? 0);
        const delay2 = (timestamps[2] ?? 0) - (timestamps[1] ?? 0);
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    });

    test("should use fixed delay between retries", async () => {
      let attempts = 0;
      const timestamps: number[] = [];

      const operationWithFixedDelay = pipe(
        Effect.sync(() => {
          timestamps.push(Date.now());
          attempts++;
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return { success: true, attempts };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          operationWithFixedDelay,
          Effect.retry(Schedule.spaced(Duration.millis(50))),
        ),
      );

      Assertions.assertTrue(result.success);
      Assertions.assertEqual(result.attempts, 3);
    });

    test("should use custom retry policy", async () => {
      let attempts = 0;
      const customErrors = ["RETRY", "RETRY_AGAIN"];

      const operationWithCustomErrors = pipe(
        Effect.sync(() => {
          attempts++;
          if (attempts === 1) {
            throw new Error("RETRY");
          } else if (attempts === 2) {
            throw new Error("RETRY_AGAIN");
          } else if (attempts === 3) {
            throw new Error("STOP");
          }
          return { success: true, attempts };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          operationWithCustomErrors,
          Effect.retry({
            while: (error: Error) => customErrors.includes(error.message),
            schedule: Schedule.spaced(Duration.millis(10)),
          }),
          Effect.catchAll((error: Error) =>
            Effect.succeed({ success: false, error: error.message })
          ),
        ),
      );

      Assertions.assertFalse(result.success);
      Assertions.assertEqual("error" in result ? result.error : "", "STOP");
      Assertions.assertEqual(attempts, 3);
    });

    test("should combine multiple schedules", async () => {
      let attempts = 0;
      const operationWithCombinedSchedule = pipe(
        Effect.sync(() => {
          attempts++;
          if (attempts < 5) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return { success: true, attempts };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const combinedSchedule = pipe(
        Schedule.exponential(Duration.millis(10)),
        Schedule.intersect(Schedule.recurs(10)),
      );

      const result = await testHarness.runTest(
        pipe(
          operationWithCombinedSchedule,
          Effect.retry(combinedSchedule),
        ),
      );

      Assertions.assertTrue(result.success);
      Assertions.assertEqual(result.attempts, 5);
    });
  });

  describe("Domain-Specific Retry", () => {
    test("should handle command with retry", async () => {
      let commandAttempts = 0;
      const unreliableCommand = pipe(
        Effect.sync(() => {
          commandAttempts++;
          if (commandAttempts < 3) {
            throw new Error("Temporary failure");
          }
          return { commandId: "cmd-123", result: "success" };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          unreliableCommand,
          Effect.retry(Schedule.recurs(5)),
        ),
      );

      Assertions.assertEqual(result.commandId, "cmd-123");
      Assertions.assertEqual(result.result, "success");
      Assertions.assertEqual(commandAttempts, 3);
    });

    test("should apply retry to repository operations", async () => {
      let repoAttempts = 0;
      const flakyRepository = {
        save: pipe(
          Effect.sync(() => {
            repoAttempts++;
            if (repoAttempts < 2) {
              throw new Error("Repository unavailable");
            }
            return { id: "entity-123", version: 1 };
          }),
          Effect.catchAll((error) => Effect.fail(error)),
        ),
      };

      const result = await Effect.runPromise(
        pipe(
          flakyRepository.save,
          Effect.retry(Schedule.recurs(3)),
        ),
      );

      Assertions.assertEqual(result.id, "entity-123");
      Assertions.assertEqual(result.version, 1);
      Assertions.assertEqual(repoAttempts, 2);
    });

    test("should handle event processing with retry", async () => {
      let eventProcessingAttempts = 0;
      const processEvent = (event: TestEvent) =>
        pipe(
          Effect.sync(() => {
            eventProcessingAttempts++;
            if (eventProcessingAttempts < 2) {
              throw new Error("Processing failed");
            }
            return {
              eventId: event.aggregateId,
              eventType: event.type,
              processed: true,
            };
          }),
          Effect.catchAll((error) => Effect.fail(error)),
        );

      const event = TestFixtures.itemCreatedEvent(
        BrandedTypes.aggregateId("item-1"),
      );

      const result = await testHarness.runTest(
        pipe(
          processEvent(event),
          Effect.retry(Schedule.recurs(3)),
        ),
      );

      Assertions.assertTrue(result.processed);
      Assertions.assertEqual(result.eventType, TestEventTypes.ITEM_CREATED);
      Assertions.assertEqual(eventProcessingAttempts, 2);
    });
  });

  describe("Retry with Circuit Breaker", () => {
    test("should combine retry with circuit breaker", async () => {
      let serviceAttempts = 0;
      let circuitState: "closed" | "open" | "half-open" = "closed";

      const serviceWithCircuitBreaker = pipe(
        Effect.sync(() => {
          if (circuitState === "open") {
            throw new Error("Circuit breaker is open");
          }

          serviceAttempts++;
          if (serviceAttempts < 3) {
            // Simulate failures that should open the circuit
            if (serviceAttempts === 2) {
              circuitState = "open";
            }
            throw new Error("Service error");
          }

          circuitState = "closed";
          return { success: true, attempts: serviceAttempts };
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const result = await testHarness.runTest(
        pipe(
          serviceWithCircuitBreaker,
          Effect.retry({
            while: (error: Error) => !error.message.includes("Circuit breaker"),
            schedule: Schedule.spaced(Duration.millis(10)),
          }),
          Effect.catchAll((error: Error) =>
            Effect.succeed({
              success: false,
              error: error.message,
              attempts: serviceAttempts,
            })
          ),
        ),
      );

      expect(result.success).toBe(false);
      expect("error" in result ? result.error : "").toContain(
        "Circuit breaker",
      );
    });
  });

  describe("Retry Scenarios", () => {
    test("should handle complete item lifecycle with retries", async () => {
      const itemId = BrandedTypes.aggregateId("retry-item");
      let createAttempts = 0;
      let updateAttempts = 0;

      const createItem = pipe(
        Effect.sync(() => {
          createAttempts++;
          if (createAttempts < 2) {
            throw new Error("Create failed");
          }
          return TestFixtures.itemCreatedEvent(itemId);
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const updateItem = pipe(
        Effect.sync(() => {
          updateAttempts++;
          if (updateAttempts < 2) {
            throw new Error("Update failed");
          }
          return TestFixtures.itemUpdatedEvent(itemId, { price: 150 });
        }),
        Effect.catchAll((error) => Effect.fail(error)),
      );

      const scenario = await testHarness.runTest(
        pipe(
          createItem,
          Effect.retry(Schedule.recurs(3)),
          Effect.flatMap(() =>
            pipe(
              updateItem,
              Effect.retry(Schedule.recurs(3)),
            )
          ),
          Effect.map((updateEvent) => ({
            created: createAttempts === 2,
            updated: updateAttempts === 2,
            finalPrice: updateEvent.data.price,
          })),
        ),
      );

      Assertions.assertTrue(scenario.created);
      Assertions.assertTrue(scenario.updated);
      Assertions.assertEqual(scenario.finalPrice, 150);
    });
  });
});
