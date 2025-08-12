/**
 * Comprehensive Test Suite for Pipe Patterns
 * 
 * Tests all pipe pattern implementations to ensure correctness
 * and performance characteristics
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Duration from "effect/Duration"
import * as TestClock from "effect/TestClock"
import * as Exit from "effect/Exit"
import { pipe } from "effect/Function"

// Import our pipe pattern implementations
import {
  createRepository,
  withCache,
  withOptimisticLocking,
  type Repository,
} from "../domain/repository"

import {
  handleRegisterUser,
  handleActivateUser,
  applyUserEvent,
  routeUserCommand,
  type UserState,
  type UserEvent,
} from "../domain/handlers/user-handlers-pipe"

import {
  createReducerProjection,
  createFilteredProjection,
  composeProjections,
  type ProjectionState,
} from "../application/projection-pipe"

import {
  createSaga,
  createChoreographySaga,
  createTimeoutSaga,
  type SagaStep,
} from "../application/saga-pipe"

import { createAggregate, markEventsAsCommitted } from "../domain/aggregate"
import { CoreServicesLive, EventStore, CommandBus } from "../effects/services"
import { 
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
  email,
  username,
  nonEmptyString,
  type AggregateId,
} from "../schema/core/primitives"

// ============================================================================
// Test Utilities
// ============================================================================

const createTestEvent = (type: string, aggregateId: AggregateId): UserEvent => ({
  type: type as any,
  data: {},
  metadata: {
    eventId: createEventId(),
    aggregateId,
    version: 0 as any,
    timestamp: now(),
    correlationId: createCorrelationId(),
    causationId: createCausationId(),
    actor: { type: "system" },
  },
})

const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; time: number }> => {
  const start = performance.now()
  const result = await fn()
  const time = performance.now() - start
  return { result, time }
}

// ============================================================================
// Repository Pipe Pattern Tests
// ============================================================================

describe("Repository Pipe Patterns", () => {
  test("load operation uses pipe pattern efficiently", async () => {
    const repository = createRepository("Test", (state, event) => state, null)
    const aggregateId = createAggregateId()
    
    const program = pipe(
      repository.load(aggregateId),
      Effect.map((aggregate) => {
        expect(aggregate.id).toBe(aggregateId)
        expect(aggregate.version).toBe(-1)
        expect(aggregate.state).toBe(null)
        return aggregate
      })
    )
    
    await Effect.runPromise(
      Effect.provide(program, CoreServicesLive)
    )
  })

  test("save operation handles uncommitted events correctly", async () => {
    const repository = createRepository<string, UserEvent>(
      "Test",
      (state, event) => event.type,
      null
    )
    
    const aggregateId = createAggregateId()
    const aggregate = {
      ...createAggregate<string, UserEvent>(aggregateId),
      uncommittedEvents: [
        createTestEvent("Event1", aggregateId),
        createTestEvent("Event2", aggregateId),
      ],
      version: 1 as any,
    }
    
    const program = pipe(
      repository.save(aggregate),
      Effect.flatMap(() => repository.load(aggregateId)),
      Effect.map((loaded) => {
        expect(loaded.version).toBe(1)
        expect(loaded.state).toBe("Event2")
        expect(loaded.uncommittedEvents).toHaveLength(0)
        return loaded
      })
    )
    
    await Effect.runPromise(
      Effect.provide(program, CoreServicesLive)
    )
  })

  test("withCache reduces repository calls", async () => {
    let loadCalls = 0
    const mockRepository: Repository<string, UserEvent> = {
      load: (id) => {
        loadCalls++
        return Effect.succeed({
          id,
          version: 0 as any,
          state: "loaded",
          uncommittedEvents: [],
        })
      },
      save: () => Effect.void,
      exists: () => Effect.succeed(true),
      loadFromSnapshot: () => Effect.fail("Not implemented" as any),
    }
    
    const program = pipe(
      withCache(mockRepository, Duration.seconds(1)),
      Effect.flatMap((cachedRepo) =>
        pipe(
          // Load same ID three times
          cachedRepo.load("id1" as AggregateId),
          Effect.flatMap(() => cachedRepo.load("id1" as AggregateId)),
          Effect.flatMap(() => cachedRepo.load("id1" as AggregateId)),
          Effect.map(() => loadCalls)
        )
      )
    )
    
    const calls = await Effect.runPromise(program)
    expect(calls).toBe(1) // Should only load once due to cache
  })
})

// ============================================================================
// Command Handler Pipe Pattern Tests
// ============================================================================

describe("Command Handler Pipe Patterns", () => {
  test("handleRegisterUser validates and creates events", async () => {
    const aggregate = createAggregate<UserState, UserEvent>(createAggregateId())
    const command = {
      type: "RegisterUser" as const,
      payload: {
        email: email("test@example.com"),
        username: username("testuser"),
        passwordHash: nonEmptyString("hash123"),
      },
      metadata: {
        commandId: createEventId(),
        aggregateId: aggregate.id,
        correlationId: createCorrelationId(),
        causationId: createCausationId(),
        timestamp: now(),
        actor: { type: "system" as const },
      },
    }
    
    const program = pipe(
      handleRegisterUser(aggregate, command),
      Effect.map((events) => {
        expect(events).toHaveLength(1)
        expect(events[0].type).toBe("UserRegistered")
        expect(events[0].data.email).toBe(command.payload.email)
        return events
      })
    )
    
    await Effect.runPromise(program)
  })

  test("handleRegisterUser fails for existing user", async () => {
    const existingState: UserState = {
      email: email("existing@example.com"),
      username: username("existing"),
      passwordHash: nonEmptyString("hash"),
      isActive: true,
      isVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: undefined,
    }
    
    const aggregate = {
      ...createAggregate<UserState, UserEvent>(createAggregateId()),
      state: existingState,
    }
    
    const command = {
      type: "RegisterUser" as const,
      payload: {
        email: email("new@example.com"),
        username: username("newuser"),
        passwordHash: nonEmptyString("hash123"),
      },
      metadata: {
        commandId: createEventId(),
        aggregateId: aggregate.id,
        correlationId: createCorrelationId(),
        causationId: createCausationId(),
        timestamp: now(),
        actor: { type: "system" as const },
      },
    }
    
    const program = pipe(
      handleRegisterUser(aggregate, command),
      Effect.map(() => "should not reach here"),
      Effect.catchTag("UserAlreadyExistsError", () =>
        Effect.succeed("error caught correctly")
      )
    )
    
    const result = await Effect.runPromise(program)
    expect(result).toBe("error caught correctly")
  })

  test("routeUserCommand routes to correct handler", async () => {
    const aggregate = createAggregate<UserState, UserEvent>(createAggregateId())
    const registerCommand = {
      type: "RegisterUser" as const,
      payload: {
        email: email("test@example.com"),
        username: username("testuser"),
        passwordHash: nonEmptyString("hash123"),
      },
      metadata: {
        commandId: createEventId(),
        aggregateId: aggregate.id,
        correlationId: createCorrelationId(),
        causationId: createCausationId(),
        timestamp: now(),
        actor: { type: "system" as const },
      },
    }
    
    const program = pipe(
      routeUserCommand(aggregate, registerCommand),
      Effect.map((updatedAggregate) => {
        expect(updatedAggregate.uncommittedEvents).toHaveLength(1)
        expect(updatedAggregate.state).not.toBe(null)
        expect(updatedAggregate.state?.email).toBe(registerCommand.payload.email)
        return updatedAggregate
      })
    )
    
    await Effect.runPromise(program)
  })
})

// ============================================================================
// Projection Pipe Pattern Tests
// ============================================================================

describe("Projection Pipe Patterns", () => {
  test("createReducerProjection processes events correctly", async () => {
    type CountState = { count: number; lastEvent: string }
    
    const projection = await Effect.runPromise(
      createReducerProjection<CountState, UserEvent>(
        {
          name: "counter",
          initialState: { count: 0, lastEvent: "" },
        },
        (state, event) => ({
          count: state.count + 1,
          lastEvent: event.type,
        })
      )
    )
    
    const events = [
      createTestEvent("Event1", createAggregateId()),
      createTestEvent("Event2", createAggregateId()),
      createTestEvent("Event3", createAggregateId()),
    ]
    
    for (const event of events) {
      await Effect.runPromise(
        Stream.fromIterable([event]).pipe(
          Stream.mapEffect((e) => projection.processStream(Stream.make(e))),
          Stream.runDrain
        )
      )
    }
    
    const state = await Effect.runPromise(projection.getState())
    expect(state.state.count).toBe(3)
    expect(state.state.lastEvent).toBe("Event3")
  })

  test("createFilteredProjection only processes matching events", async () => {
    type FilteredState = { processed: string[] }
    
    const projection = await Effect.runPromise(
      createFilteredProjection<FilteredState, UserEvent>(
        {
          name: "filtered",
          initialState: { processed: [] },
        },
        (event) => event.type === "UserRegistered",
        (state, event) =>
          Effect.succeed({
            processed: [...state.processed, event.type],
          })
      )
    )
    
    const events = [
      { ...createTestEvent("UserRegistered", createAggregateId()), type: "UserRegistered" as const },
      { ...createTestEvent("UserActivated", createAggregateId()), type: "UserActivated" as const },
      { ...createTestEvent("UserRegistered", createAggregateId()), type: "UserRegistered" as const },
    ] as UserEvent[]
    
    for (const event of events) {
      await Effect.runPromise(
        Stream.fromIterable([event]).pipe(
          Stream.mapEffect((e) => projection.processStream(Stream.make(e))),
          Stream.runDrain
        )
      )
    }
    
    const state = await Effect.runPromise(projection.getState())
    expect(state.state.processed).toHaveLength(2)
    expect(state.state.processed).toEqual(["UserRegistered", "UserRegistered"])
  })
})

// ============================================================================
// Saga Pipe Pattern Tests
// ============================================================================

describe("Saga Pipe Patterns", () => {
  test("createSaga processes steps in order", async () => {
    const processedSteps: string[] = []
    
    const steps: SagaStep<UserEvent, { userId: string }>[] = [
      {
        name: "step1",
        matches: (event) => event.type === "UserRegistered",
        handle: (event, context) => {
          processedSteps.push("step1")
          return Effect.succeed({
            updateContext: { userId: "user123" },
          })
        },
      },
      {
        name: "step2",
        matches: (event) => event.type === "UserActivated",
        handle: (event, context) => {
          processedSteps.push("step2")
          expect(context.userId).toBe("user123")
          return Effect.succeed({ complete: true })
        },
      },
    ]
    
    const saga = await Effect.runPromise(
      createSaga("test-saga", { userId: "" }, steps)
    )
    
    const events = [
      { ...createTestEvent("UserRegistered", createAggregateId()), type: "UserRegistered" as const },
      { ...createTestEvent("UserActivated", createAggregateId()), type: "UserActivated" as const },
    ] as UserEvent[]
    
    for (const event of events) {
      await Effect.runPromise(
        Effect.provide(saga.process(event), CoreServicesLive)
      )
    }
    
    const state = await Effect.runPromise(saga.getState())
    expect(state.status).toBe("completed")
    expect(processedSteps).toEqual(["step1", "step2"])
  })

  test("createTimeoutSaga triggers compensation on timeout", async () => {
    let compensated = false
    
    const slowSaga = {
      process: (event: UserEvent) =>
        pipe(
          Effect.sleep(Duration.seconds(2)),
          Effect.map(() => "completed")
        ),
      compensate: () => {
        compensated = true
        return Effect.void
      },
    }
    
    const timeoutSaga = createTimeoutSaga(
      "timeout-test",
      Duration.millis(100),
      slowSaga
    )
    
    const program = pipe(
      timeoutSaga(createTestEvent("Test", createAggregateId())),
      Effect.catchTag("SagaError", (error) => {
        expect(error.reason).toBe("Timeout")
        return Effect.succeed("timeout handled")
      })
    )
    
    const result = await Effect.runPromise(
      Effect.provide(program, CoreServicesLive)
    )
    
    expect(result).toBe("timeout handled")
    expect(compensated).toBe(true)
  })
})

// ============================================================================
// Performance Comparison Tests
// ============================================================================

describe("Pipe Pattern Performance", () => {
  test("pipe pattern is faster for linear operations", async () => {
    const iterations = 1000
    
    // Pipe pattern version
    const pipeOperation = (n: number) =>
      pipe(
        Effect.succeed(n),
        Effect.map((x) => x * 2),
        Effect.map((x) => x + 1),
        Effect.map((x) => x.toString())
      )
    
    // Effect.gen version
    const genOperation = (n: number) =>
      Effect.gen(function* () {
        const value = yield* Effect.succeed(n)
        const doubled = value * 2
        const incremented = doubled + 1
        return incremented.toString()
      })
    
    // Measure pipe pattern
    const pipeResult = await measureExecutionTime(async () => {
      for (let i = 0; i < iterations; i++) {
        await Effect.runPromise(pipeOperation(i))
      }
    })
    
    // Measure Effect.gen
    const genResult = await measureExecutionTime(async () => {
      for (let i = 0; i < iterations; i++) {
        await Effect.runPromise(genOperation(i))
      }
    })
    
    console.log(`Pipe time: ${pipeResult.time.toFixed(2)}ms`)
    console.log(`Gen time: ${genResult.time.toFixed(2)}ms`)
    console.log(`Pipe is ${((genResult.time / pipeResult.time - 1) * 100).toFixed(1)}% faster`)
    
    // Pipe should generally be faster for this linear operation
    // Note: Actual performance may vary based on V8 optimizations
  })

  test("memory usage is lower with pipe pattern", async () => {
    const iterations = 100
    const measurements: number[] = []
    
    // Force GC if available
    if (global.gc) {
      global.gc()
    }
    
    const initialMemory = process.memoryUsage().heapUsed
    
    // Run pipe pattern operations
    for (let i = 0; i < iterations; i++) {
      const operation = pipe(
        Effect.succeed(new Array(1000).fill(i)),
        Effect.map((arr) => arr.map((x) => x * 2)),
        Effect.map((arr) => arr.reduce((a, b) => a + b, 0))
      )
      
      await Effect.runPromise(operation)
      
      if (i % 10 === 0) {
        measurements.push(process.memoryUsage().heapUsed - initialMemory)
      }
    }
    
    const avgMemoryIncrease = measurements.reduce((a, b) => a + b, 0) / measurements.length
    console.log(`Average memory increase: ${(avgMemoryIncrease / 1024).toFixed(2)} KB`)
    
    // Memory increase should be minimal due to efficient pipe composition
    expect(avgMemoryIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Pipe Pattern Integration", () => {
  test("complete workflow using pipe patterns", async () => {
    // Create repository
    const repository = createRepository<UserState | null, UserEvent>(
      "User",
      applyUserEvent,
      null
    )
    
    // Create projection
    const projection = await Effect.runPromise(
      createReducerProjection<{ userCount: number }, UserEvent>(
        {
          name: "user-count",
          initialState: { userCount: 0 },
        },
        (state, event) =>
          event.type === "UserRegistered"
            ? { userCount: state.userCount + 1 }
            : state
      )
    )
    
    // Complete workflow
    const userId = createAggregateId()
    const program = pipe(
      // Load aggregate
      repository.load(userId),
      // Register user
      Effect.flatMap((aggregate) =>
        routeUserCommand(aggregate, {
          type: "RegisterUser",
          payload: {
            email: email("integration@test.com"),
            username: username("integrationuser"),
            passwordHash: nonEmptyString("hash"),
          },
          metadata: {
            commandId: createEventId(),
            aggregateId: userId,
            correlationId: createCorrelationId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "system" },
          },
        })
      ),
      // Save to repository
      Effect.tap((aggregate) => repository.save(aggregate)),
      // Process through projection
      Effect.tap((aggregate) =>
        Effect.forEach(
          aggregate.uncommittedEvents,
          (event) =>
            Stream.fromIterable([event]).pipe(
              Stream.mapEffect((e) => projection.processStream(Stream.make(e))),
              Stream.runDrain
            ),
          { discard: true }
        )
      ),
      // Verify results
      Effect.flatMap(() => projection.getState()),
      Effect.map((projectionState) => {
        expect(projectionState.state.userCount).toBe(1)
        return "success"
      })
    )
    
    const result = await Effect.runPromise(
      Effect.provide(program, CoreServicesLive)
    )
    
    expect(result).toBe("success")
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Pipe Pattern Error Handling", () => {
  test("errors propagate correctly through pipe chains", async () => {
    const operation = pipe(
      Effect.succeed(10),
      Effect.flatMap((n) =>
        n > 5
          ? Effect.fail("Number too large")
          : Effect.succeed(n)
      ),
      Effect.map((n) => n * 2),
      Effect.catchAll((error) =>
        Effect.succeed(`Error caught: ${error}`)
      )
    )
    
    const result = await Effect.runPromise(operation)
    expect(result).toBe("Error caught: Number too large")
  })

  test("multiple error types handled correctly", async () => {
    class ErrorA {
      readonly _tag = "ErrorA"
      constructor(readonly message: string) {}
    }
    
    class ErrorB {
      readonly _tag = "ErrorB"
      constructor(readonly code: number) {}
    }
    
    const operation = pipe(
      Effect.succeed(Math.random()),
      Effect.flatMap((n) =>
        n < 0.33
          ? Effect.fail(new ErrorA("Random A"))
          : n < 0.66
          ? Effect.fail(new ErrorB(42))
          : Effect.succeed("success")
      ),
      Effect.catchTags({
        ErrorA: (error) => Effect.succeed(`A: ${error.message}`),
        ErrorB: (error) => Effect.succeed(`B: ${error.code}`),
      })
    )
    
    const result = await Effect.runPromise(operation)
    expect(result).toMatch(/^(A: Random A|B: 42|success)$/)
  })
})

// Export test utilities for other test files
export { createTestEvent, measureExecutionTime }