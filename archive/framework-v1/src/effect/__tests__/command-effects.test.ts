/**
 * Tests for Effect-based Command Handling
 */

import { describe, expect, it } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Either from "effect/Either";
import * as Schedule from "effect/Schedule";
import { pipe } from "effect/Function";

import {
  batchCommands,
  CommandContext,
  CommandExecutionError,
  commandPipeline,
  commandSaga,
  CommandValidationError,
  createCommandHandler,
  withRetry,
  withTimeout,
} from "../core/command-effects";
import type { ICommand, ICommandBus, IEvent, IEventStore } from "../core/types";
import { aggregateId } from "../../core/branded/factories";
import type { AggregateId } from "../../core/branded/types";

// Mock implementations
const mockEventStore: IEventStore<IEvent, AggregateId> = {
  getEvents: async () => [],
  appendBatch: async () => {},
  getAllEvents: async () => [],
  subscribe: () => {},
};

const mockCommandBus: ICommandBus = {
  send: async () => {},
};

const TestContextLive = Layer.succeed(
  CommandContext,
  {
    eventStore: mockEventStore,
    commandBus: mockCommandBus,
  },
);

// Test command
interface TestCommand extends ICommand {
  type: "TEST_COMMAND";
  payload: {
    value: string;
    shouldFail?: boolean;
  };
}

describe("Command Effects", () => {
  describe("createCommandHandler", () => {
    it("should create and execute a command handler", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) => Effect.succeed(`Processed: ${cmd.payload.value}`),
      });

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      const result = await pipe(
        handler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(result).toBe("Processed: test");
    });

    it("should handle validation errors", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        validate: (cmd) =>
          cmd.payload.value === "invalid"
            ? Effect.fail(
              new CommandValidationError({
                command: cmd,
                errors: ["Invalid value"],
              }),
            )
            : Effect.succeed(undefined),
        execute: (cmd) => Effect.succeed(`Processed: ${cmd.payload.value}`),
      });

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "invalid" },
      };

      const exit = await pipe(
        handler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromiseExit,
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should execute success callback", async () => {
      let callbackExecuted = false;

      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) => Effect.succeed(`Processed: ${cmd.payload.value}`),
        onSuccess: (_result) =>
          Effect.sync(() => {
            callbackExecuted = true;
          }),
      });

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      await pipe(
        handler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(callbackExecuted).toBe(true);
    });

    it("should execute error callback", async () => {
      let errorCallbackExecuted = false;

      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) =>
          Effect.fail(
            new CommandExecutionError({
              command: cmd,
              cause: new Error("Test error"),
            }),
          ),
        onError: (_error) =>
          Effect.sync(() => {
            errorCallbackExecuted = true;
          }),
      });

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      await pipe(
        handler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromiseExit,
      );

      expect(errorCallbackExecuted).toBe(true);
    });
  });

  describe("withTimeout", () => {
    it("should timeout long-running commands", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (_cmd) =>
          pipe(
            Effect.sleep(Duration.seconds(2)),
            Effect.flatMap(() => Effect.succeed("Should not reach here")),
          ),
      });

      const timeoutHandler = withTimeout(handler, Duration.millis(100));

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      const exit = await pipe(
        timeoutHandler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromiseExit,
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should complete before timeout", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (_cmd) => Effect.succeed("Success"),
      });

      const timeoutHandler = withTimeout(handler, Duration.seconds(1));

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      const result = await pipe(
        timeoutHandler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(result).toBe("Success");
    });
  });

  describe("withRetry", () => {
    it("should retry failed commands", async () => {
      let attempts = 0;

      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) => {
          attempts++;
          if (attempts < 3) {
            return Effect.fail(
              new CommandExecutionError({
                command: cmd,
                cause: new Error("Temporary failure"),
              }),
            );
          }
          return Effect.succeed("Success after retries");
        },
      });

      const retryHandler = withRetry(
        handler,
        Schedule.recurs(2), // Allow 3 total attempts (initial + 2 retries)
      );

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      const result = await pipe(
        retryHandler.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(result).toBe("Success after retries");
      expect(attempts).toBe(3);
    });
  });

  describe("batchCommands", () => {
    it("should execute multiple commands in batch", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) => Effect.succeed(`Processed: ${cmd.payload.value}`),
      });

      const commands: TestCommand[] = [
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-1"),
          payload: { value: "first" },
        },
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-2"),
          payload: { value: "second" },
        },
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-3"),
          payload: { value: "third" },
        },
      ];

      const results = await pipe(
        batchCommands(commands, handler, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(results).toHaveLength(3);
      expect(Either.isRight(results[0]!)).toBe(true);
      expect(Either.isRight(results[1]!)).toBe(true);
      expect(Either.isRight(results[2]!)).toBe(true);
    });

    it("should handle mixed success and failure in batch", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) =>
          cmd.payload.shouldFail
            ? Effect.fail(
              new CommandExecutionError({
                command: cmd,
                cause: new Error("Intentional failure"),
              }),
            )
            : Effect.succeed(`Processed: ${cmd.payload.value}`),
      });

      const commands: TestCommand[] = [
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-1"),
          payload: { value: "success" },
        },
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-2"),
          payload: { value: "fail", shouldFail: true },
        },
        {
          type: "TEST_COMMAND",
          aggregateId: aggregateId("test-3"),
          payload: { value: "success" },
        },
      ];

      const results = await pipe(
        batchCommands(commands, handler, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(results).toHaveLength(3);
      expect(Either.isRight(results[0]!)).toBe(true);
      expect(Either.isLeft(results[1]!)).toBe(true);
      expect(Either.isRight(results[2]!)).toBe(true);
    });
  });

  describe("commandPipeline", () => {
    it("should compose multiple patterns", async () => {
      const handler = createCommandHandler<TestCommand, string>({
        canHandle: (cmd) => cmd.type === "TEST_COMMAND",
        execute: (cmd) => Effect.succeed(`Processed: ${cmd.payload.value}`),
      });

      const pipeline = commandPipeline(handler)
        .retry(Schedule.recurs(2))
        .timeout(Duration.seconds(1))
        .build();

      const command: TestCommand = {
        type: "TEST_COMMAND",
        aggregateId: aggregateId("test-123"),
        payload: { value: "test" },
      };

      const result = await pipe(
        pipeline.handle(command, {
          eventStore: mockEventStore,
          commandBus: mockCommandBus,
        }),
        Effect.provide(TestContextLive),
        Effect.runPromise,
      );

      expect(result).toBe("Processed: test");
    });
  });

  describe("commandSaga", () => {
    it("should execute saga steps in sequence", async () => {
      const executionOrder: string[] = [];

      const step1Handler = createCommandHandler<TestCommand, string>({
        canHandle: () => true,
        execute: (_cmd) =>
          Effect.sync(() => {
            executionOrder.push("step1");
            return "Step 1 result";
          }),
      });

      const step2Handler = createCommandHandler<TestCommand, string>({
        canHandle: () => true,
        execute: (_cmd) =>
          Effect.sync(() => {
            executionOrder.push("step2");
            return "Step 2 result";
          }),
      });

      const saga = commandSaga<string>([
        {
          command: {
            type: "TEST_COMMAND",
            aggregateId: aggregateId("test-1"),
            payload: { value: "step1" },
          } as TestCommand,
          handler: step1Handler,
        },
        {
          command: {
            type: "TEST_COMMAND",
            aggregateId: aggregateId("test-2"),
            payload: { value: "step2" },
          } as TestCommand,
          handler: step2Handler,
        },
      ], { eventStore: mockEventStore, commandBus: mockCommandBus });

      await pipe(saga, Effect.provide(TestContextLive), Effect.runPromise);

      expect(executionOrder).toEqual(["step1", "step2"]);
    });

    it("should run compensations on failure", async () => {
      const compensations: string[] = [];

      const step1Handler = createCommandHandler<TestCommand, string>({
        canHandle: () => true,
        execute: () => Effect.succeed("Step 1"),
      });

      const step2Handler = createCommandHandler<TestCommand, string>({
        canHandle: () => true,
        execute: () =>
          Effect.fail(
            new CommandExecutionError({
              command: {} as any,
              cause: new Error("Step 2 failed"),
            }),
          ),
      });

      const saga = commandSaga<string>([
        {
          command: {
            type: "TEST_COMMAND",
            aggregateId: aggregateId("test-1"),
            payload: { value: "step1" },
          } as TestCommand,
          handler: step1Handler,
          compensate: () =>
            Effect.sync(() => {
              compensations.push("compensate-step1");
            }),
        },
        {
          command: {
            type: "TEST_COMMAND",
            aggregateId: aggregateId("test-2"),
            payload: { value: "step2" },
          } as TestCommand,
          handler: step2Handler,
        },
      ], { eventStore: mockEventStore, commandBus: mockCommandBus });

      await pipe(saga, Effect.provide(TestContextLive), Effect.runPromiseExit);

      expect(compensations).toEqual(["compensate-step1"]);
    });
  });
});
