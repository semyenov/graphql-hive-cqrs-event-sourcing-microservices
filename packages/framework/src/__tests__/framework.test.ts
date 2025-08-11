/**
 * Framework Integration Tests
 */

import { describe, test, expect } from "bun:test"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as S from "@effect/schema/Schema"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"
import {
  // Branded types
  AggregateId,
  EventId,
  CommandId,
  Version,
  Timestamp,
  
  // Event Store
  InMemoryEventStore,
  EventStore,
  StreamName,
  
  // Messages
  DomainEvent,
  EventMetadata,
  
  // Aggregate
  aggregate,
  validateRule,
  
  // Projection
  projection,
  InMemoryCheckpointStore,
  CheckpointStore,
} from "../index"

// ============================================================================
// Test Domain
// ============================================================================

interface TestState {
  aggregateId: AggregateId
  version: Version
  value: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

class ValueIncrementedEvent extends Data.Class<{
  type: "ValueIncremented"
  payload: { amount: number }
  metadata: EventMetadata
}> {
  static create(payload: { amount: number }, metadata: EventMetadata) {
    return new ValueIncrementedEvent({
      type: "ValueIncremented" as const,
      payload,
      metadata,
    })
  }
}

class ValueDecrementedEvent extends Data.Class<{
  type: "ValueDecremented"
  payload: { amount: number }
  metadata: EventMetadata
}> {
  static create(payload: { amount: number }, metadata: EventMetadata) {
    return new ValueDecrementedEvent({
      type: "ValueDecremented" as const,
      payload,
      metadata,
    })
  }
}

type TestEvent = ValueIncrementedEvent | ValueDecrementedEvent

interface IncrementCommand {
  type: "Increment"
  amount: number
}

interface DecrementCommand {
  type: "Decrement"
  amount: number
}

type TestCommand = IncrementCommand | DecrementCommand

const TestAggregate = aggregate<TestState, TestEvent, TestCommand>({
  name: "Test",
  
  initialState: (id) => ({
    aggregateId: id,
    version: Version.initial(),
    value: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }),
  
  eventHandlers: {
    ValueIncremented: (state, event) => ({
      ...state,
      value: state.value + event.payload.amount,
      updatedAt: Timestamp.now(),
    }),
    
    ValueDecremented: (state, event) => ({
      ...state,
      value: state.value - event.payload.amount,
      updatedAt: Timestamp.now(),
    }),
  },
  
  commandHandlers: {
    Increment: {
      execute: (state, cmd) =>
        Effect.succeed([
          ValueIncrementedEvent.create(
            { amount: cmd.amount },
            {
              eventId: EventId.generate(),
              eventType: "ValueIncremented" as any,
              aggregateId: state.aggregateId,
              aggregateVersion: state.version,
              correlationId: "test" as any,
              causationId: "test" as any,
              timestamp: Timestamp.now(),
            }
          ),
        ]),
    },
    
    Decrement: {
      validate: (state, cmd) =>
        validateRule(
          state.value >= cmd.amount,
          state.aggregateId,
          "Insufficient value for decrement"
        ),
      
      execute: (state, cmd) =>
        Effect.succeed([
          ValueDecrementedEvent.create(
            { amount: cmd.amount },
            {
              eventId: EventId.generate(),
              eventType: "ValueDecremented" as any,
              aggregateId: state.aggregateId,
              aggregateVersion: state.version,
              correlationId: "test" as any,
              causationId: "test" as any,
              timestamp: Timestamp.now(),
            }
          ),
        ]),
    },
  },
}).build()

// ============================================================================
// Tests
// ============================================================================

describe("Branded Types", () => {
  test("should generate valid IDs", () => {
    const aggregateId = AggregateId.generate()
    const eventId = EventId.generate()
    const commandId = CommandId.generate()
    
    expect(aggregateId).toMatch(/^[0-9A-Z]{26}$/)
    expect(eventId).toMatch(/^[0-9A-Z]{26}$/)
    expect(commandId).toMatch(/^[0-9A-Z]{26}$/)
  })
  
  test("should validate IDs", async () => {
    const validId = AggregateId.generate()
    const result = await Effect.runPromiseExit(
      AggregateId.make(validId)
    )
    
    expect(Exit.isSuccess(result)).toBe(true)
    
    const invalidResult = await Effect.runPromiseExit(
      AggregateId.make("invalid")
    )
    
    expect(Exit.isFailure(invalidResult)).toBe(true)
  })
  
  test("should handle versions", () => {
    const initial = Version.initial()
    expect(initial).toBe(0)
    
    const next = Version.increment(initial)
    expect(next).toBe(1)
  })
})

describe("Aggregate", () => {
  test("should handle commands", async () => {
    const id = AggregateId.generate()
    const agg = TestAggregate.create(id)
    
    const result = await Effect.runPromiseExit(
      agg.handle({ type: "Increment", amount: 5 })
    )
    
    expect(Exit.isSuccess(result)).toBe(true)
    expect(agg.getState().value).toBe(5)
    expect(agg.getUncommittedEvents()).toHaveLength(1)
  })
  
  test("should validate commands", async () => {
    const id = AggregateId.generate()
    const agg = TestAggregate.create(id)
    
    const result = await Effect.runPromiseExit(
      agg.handle({ type: "Decrement", amount: 5 })
    )
    
    expect(Exit.isFailure(result)).toBe(true)
  })
  
  test("should apply multiple commands", async () => {
    const id = AggregateId.generate()
    const agg = TestAggregate.create(id)
    
    await Effect.runPromise(
      agg.handle({ type: "Increment", amount: 10 })
    )
    
    await Effect.runPromise(
      agg.handle({ type: "Decrement", amount: 3 })
    )
    
    expect(agg.getState().value).toBe(7)
    expect(agg.getUncommittedEvents()).toHaveLength(2)
  })
})

describe("Event Store", () => {
  test("should append and read events", async () => {
    const eventStore = new InMemoryEventStore()
    const streamName = StreamName.create("test", AggregateId.generate())
    
    const testEvent = ValueIncrementedEvent.create(
      { amount: 5 },
      {
        eventId: EventId.generate(),
        eventType: "ValueIncremented" as any,
        aggregateId: AggregateId.generate(),
        aggregateVersion: Version.initial(),
        correlationId: "test" as any,
        causationId: "test" as any,
        timestamp: Timestamp.now(),
      }
    )
    
    // Append event
    await Effect.runPromise(
      eventStore.appendToStream(
        streamName,
        [testEvent],
        Version.initial()
      )
    )
    
    // Read stream
    const events = await Effect.runPromise(
      eventStore.readStream(streamName).pipe(
        Effect.map((stream) => Array.from(stream))
      )
    )
    
    expect(events).toHaveLength(1)
    expect(events[0]?.eventType).toBe("ValueIncremented")
  })
  
  test("should enforce optimistic concurrency", async () => {
    const eventStore = new InMemoryEventStore()
    const streamName = StreamName.create("test", AggregateId.generate())
    
    const testEvent = ValueIncrementedEvent.create(
      { amount: 5 },
      {
        eventId: EventId.generate(),
        eventType: "ValueIncremented" as any,
        aggregateId: AggregateId.generate(),
        aggregateVersion: Version.initial(),
        correlationId: "test" as any,
        causationId: "test" as any,
        timestamp: Timestamp.now(),
      }
    )
    
    // First append succeeds
    await Effect.runPromise(
      eventStore.appendToStream(
        streamName,
        [testEvent],
        Version.initial()
      )
    )
    
    // Second append with wrong version fails
    const result = await Effect.runPromiseExit(
      eventStore.appendToStream(
        streamName,
        [testEvent],
        Version.initial()
      )
    )
    
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe("Projections", () => {
  test("should process events", async () => {
    interface TestReadModel {
      total: number
      eventCount: number
    }
    
    const testProjection = projection<TestReadModel, TestEvent>()
      .withName("TestProjection")
      .withInitialState({ total: 0, eventCount: 0 })
      .on("ValueIncremented", (state, event) =>
        Effect.succeed({
          total: state.total + event.payload.amount,
          eventCount: state.eventCount + 1,
        })
      )
      .on("ValueDecremented", (state, event) =>
        Effect.succeed({
          total: state.total - event.payload.amount,
          eventCount: state.eventCount + 1,
        })
      )
      .build()
    
    // Process events
    const event1 = {
      eventId: EventId.generate(),
      streamName: StreamName.create("test", AggregateId.generate()),
      eventType: "ValueIncremented",
      eventData: ValueIncrementedEvent.create(
        { amount: 10 },
        {} as any
      ),
      eventMetadata: {} as any,
      streamVersion: Version.initial(),
      globalPosition: 1n,
      timestamp: Timestamp.now(),
    }
    
    await Effect.runPromise(
      testProjection.processEvent(event1)
    )
    
    const state = await Effect.runPromise(
      testProjection.getState()
    )
    
    expect(state.state.total).toBe(10)
    expect(state.state.eventCount).toBe(1)
  })
})

// Run tests
if (import.meta.main) {
  console.log("Running framework tests...")
}