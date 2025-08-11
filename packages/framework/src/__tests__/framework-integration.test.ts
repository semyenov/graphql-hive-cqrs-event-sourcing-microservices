/**
 * Framework Integration Test
 * Tests the complete refactored framework with pure functions and Effect patterns
 */

import { describe, test, expect } from "bun:test"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as Cause from "effect/Cause"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

import {
  // Schema types
  createEventSchema,
  createCommandSchema,
  AggregateId,
  Version,
  Timestamp,
  createAggregateId,
  createEventId,
  
  // Pure functions
  createEventApplicator,
  createCommandHandler,
  loadFromEvents,
  createAggregate,
  applyEvent,
  executeCommand,
  
  // Aggregate functions
  processCommand,
  Decision,
  validateRule,
  rebuildFromEvents,
  createProjection,
  createSimpleProjection,
  
  // Services
  EventStore,
  InMemoryEventStore,
  CoreServicesLive,
  
  // Types
  type DomainEvent,
  type Command
} from "../index"

import * as Schema from "@effect/schema/Schema"

// ============================================================================
// Test Domain Definition
// ============================================================================

// State
interface CounterState {
  readonly id: AggregateId
  readonly value: number
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

// Events
const CounterCreated = createEventSchema(
  "CounterCreated",
  Schema.Struct({
    initialValue: Schema.Number
  })
)

const CounterIncremented = createEventSchema(
  "CounterIncremented",
  Schema.Struct({
    amount: Schema.Number
  })
)

const CounterDecremented = createEventSchema(
  "CounterDecremented",
  Schema.Struct({
    amount: Schema.Number
  })
)

type CounterEvent = 
  | Schema.Schema.Type<typeof CounterCreated>
  | Schema.Schema.Type<typeof CounterIncremented>
  | Schema.Schema.Type<typeof CounterDecremented>

// Commands
const CreateCounter = createCommandSchema(
  "CreateCounter",
  Schema.Struct({
    initialValue: Schema.Number
  })
)

const IncrementCounter = createCommandSchema(
  "IncrementCounter",
  Schema.Struct({
    amount: Schema.Number.pipe(Schema.positive())
  })
)

const DecrementCounter = createCommandSchema(
  "DecrementCounter",
  Schema.Struct({
    amount: Schema.Number.pipe(Schema.positive())
  })
)

type CounterCommand = 
  | Schema.Schema.Type<typeof CreateCounter>
  | Schema.Schema.Type<typeof IncrementCounter>
  | Schema.Schema.Type<typeof DecrementCounter>

// Pure event applicator
const applyCounterEvent = createEventApplicator<CounterState, CounterEvent>({
  CounterCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    value: event.data.initialValue,
    createdAt: event.metadata.timestamp,
    updatedAt: event.metadata.timestamp
  }),
  
  CounterIncremented: (state, event) => 
    state ? {
      ...state,
      value: state.value + event.data.amount,
      updatedAt: event.metadata.timestamp
    } : null,
  
  CounterDecremented: (state, event) =>
    state ? {
      ...state,
      value: state.value - event.data.amount,
      updatedAt: event.metadata.timestamp
    } : null
})

// Pure command handler
const handleCounterCommand = processCommand<CounterState, CounterCommand, CounterEvent>(
  // Validation
  (state, command) => 
    match(command)
      .with({ type: "CreateCounter" }, () =>
        state !== null
          ? Effect.fail(new Error("Counter already exists"))
          : Effect.succeed(undefined)
      )
      .with({ type: "IncrementCounter" }, () =>
        state === null
          ? Effect.fail(new Error("Counter not found"))
          : Effect.succeed(undefined)
      )
      .with({ type: "DecrementCounter" }, (cmd) =>
        Effect.gen(function* () {
          if (state === null) {
            return yield* Effect.fail(new Error("Counter not found"))
          }
          if (state.value - cmd.payload.amount < 0) {
            return yield* Effect.fail(new Error("Counter cannot go negative"))
          }
        })
      )
      .exhaustive(),
  
  // Decision
  (state, command) =>
    Effect.succeed(
      match(command)
        .with({ type: "CreateCounter" }, cmd =>
          Decision.success([{
            type: "CounterCreated" as const,
            data: { initialValue: cmd.payload.initialValue },
            metadata: {
              eventId: createEventId(),
              aggregateId: cmd.aggregateId,
              version: 0 as Version,
              timestamp: Date.now() as Timestamp,
              correlationId: createEventId(),
              causationId: createEventId(),
              actor: { type: "test", id: "test-user" }
            }
          }])
        )
        .with({ type: "IncrementCounter" }, cmd =>
          Decision.success([{
            type: "CounterIncremented" as const,
            data: { amount: cmd.payload.amount },
            metadata: {
              eventId: createEventId(),
              aggregateId: cmd.aggregateId,
              version: ((state?.updatedAt || 0) + 1) as Version,
              timestamp: Date.now() as Timestamp,
              correlationId: createEventId(),
              causationId: createEventId(),
              actor: { type: "test", id: "test-user" }
            }
          }])
        )
        .with({ type: "DecrementCounter" }, cmd =>
          Decision.success([{
            type: "CounterDecremented" as const,
            data: { amount: cmd.payload.amount },
            metadata: {
              eventId: createEventId(),
              aggregateId: cmd.aggregateId,
              version: ((state?.updatedAt || 0) + 1) as Version,
              timestamp: Date.now() as Timestamp,
              correlationId: createEventId(),
              causationId: createEventId(),
              actor: { type: "test", id: "test-user" }
            }
          }])
        )
        .exhaustive()
    )
)

// Projection
const CounterStatsProjection = createSimpleProjection<
  { total: number; operations: number },
  CounterEvent
>(
  "CounterStats",
  { total: 0, operations: 0 },
  {
    CounterCreated: (state, event) => ({
      total: state.total + event.data.initialValue,
      operations: state.operations + 1
    }),
    CounterIncremented: (state, event) => ({
      total: state.total + event.data.amount,
      operations: state.operations + 1
    }),
    CounterDecremented: (state, event) => ({
      total: state.total - event.data.amount,
      operations: state.operations + 1
    })
  }
)

// ============================================================================
// Tests
// ============================================================================

describe("Framework Integration", () => {
  
  test("should create and manipulate counter aggregate", async () => {
    const counterId = createAggregateId()
    
    // Create counter
    const createCmd: CounterCommand = {
      type: "CreateCounter",
      aggregateId: counterId,
      payload: { initialValue: 10 },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: Date.now() as Timestamp,
        actor: { type: "test", id: "test-user" }
      }
    }
    
    const createResult = await pipe(
      handleCounterCommand(null, createCmd),
      Effect.runPromiseExit
    )
    
    expect(Exit.isSuccess(createResult)).toBe(true)
    if (Exit.isSuccess(createResult)) {
      const decision = createResult.value
      expect(decision._tag).toBe("Success")
      if (decision._tag === "Success") {
        expect(decision.events).toHaveLength(1)
        expect(decision.events[0].type).toBe("CounterCreated")
      }
    }
    
    // Apply event to get state
    const events = Exit.isSuccess(createResult) && createResult.value._tag === "Success" 
      ? createResult.value.events 
      : []
    const state = rebuildFromEvents(applyCounterEvent, null, events)
    
    expect(state).not.toBeNull()
    expect(state?.value).toBe(10)
    
    // Increment counter
    const incrementCmd: CounterCommand = {
      type: "IncrementCounter",
      aggregateId: counterId,
      payload: { amount: 5 },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: Date.now() as Timestamp,
        actor: { type: "test", id: "test-user" }
      }
    }
    
    const incrementResult = await pipe(
      handleCounterCommand(state, incrementCmd),
      Effect.runPromiseExit
    )
    
    expect(Exit.isSuccess(incrementResult)).toBe(true)
    
    // Rebuild state from all events
    const allEvents = [
      ...events,
      ...(Exit.isSuccess(incrementResult) && incrementResult.value._tag === "Success" 
        ? incrementResult.value.events 
        : [])
    ]
    
    const finalState = rebuildFromEvents(applyCounterEvent, null, allEvents)
    expect(finalState?.value).toBe(15)
  })
  
  test("should prevent invalid operations", async () => {
    const counterId = createAggregateId()
    
    // Try to increment non-existent counter
    const incrementCmd: CounterCommand = {
      type: "IncrementCounter",
      aggregateId: counterId,
      payload: { amount: 5 },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: Date.now() as Timestamp,
        actor: { type: "test", id: "test-user" }
      }
    }
    
    const result = await pipe(
      handleCounterCommand(null, incrementCmd),
      Effect.runPromiseExit
    )
    
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const error = Cause.failureOption(result.cause)
      expect(Option.isSome(error)).toBe(true)
      if (Option.isSome(error)) {
        expect(error.value.message).toContain("not found")
      }
    }
  })
  
  test("should build projections from events", () => {
    const events: CounterEvent[] = [
      {
        type: "CounterCreated",
        data: { initialValue: 10 },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 0 as Version,
          timestamp: Date.now() as Timestamp,
          correlationId: createEventId(),
          causationId: createEventId(),
          actor: { type: "test", id: "test-user" }
        }
      },
      {
        type: "CounterIncremented",
        data: { amount: 5 },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 1 as Version,
          timestamp: Date.now() as Timestamp,
          correlationId: createEventId(),
          causationId: createEventId(),
          actor: { type: "test", id: "test-user" }
        }
      },
      {
        type: "CounterDecremented",
        data: { amount: 3 },
        metadata: {
          eventId: createEventId(),
          aggregateId: createAggregateId(),
          version: 2 as Version,
          timestamp: Date.now() as Timestamp,
          correlationId: createEventId(),
          causationId: createEventId(),
          actor: { type: "test", id: "test-user" }
        }
      }
    ]
    
    const stats = CounterStatsProjection.rebuild(events)
    
    expect(stats.total).toBe(12) // 10 + 5 - 3
    expect(stats.operations).toBe(3)
  })
  
  test("should work with event store", async () => {
    const program = Effect.gen(function* () {
      const store = yield* EventStore
      const streamName = `Counter-${createAggregateId()}` as any
      
      const events: CounterEvent[] = [
        {
          type: "CounterCreated",
          data: { initialValue: 100 },
          metadata: {
            eventId: createEventId(),
            aggregateId: createAggregateId(),
            version: 0 as Version,
            timestamp: Date.now() as Timestamp,
            correlationId: createEventId(),
            causationId: createEventId(),
            actor: { type: "test", id: "test-user" }
          }
        }
      ]
      
      // Append events
      yield* store.append(streamName, events, -1 as Version)
      
      // Read events back
      const readEvents = yield* pipe(
        store.read<CounterEvent>(streamName),
        Stream.runCollect
      )
      
      expect(readEvents.length).toBe(1)
      expect(Array.from(readEvents)[0].type).toBe("CounterCreated")
      
      return { success: true }
    })
    
    const result = await pipe(
      program,
      Effect.provide(InMemoryEventStore),
      Effect.runPromise
    )
    
    expect(result.success).toBe(true)
  })
})

describe("Schema-First Approach", () => {
  
  test("should validate commands using schemas", async () => {
    // Invalid amount (negative)
    const invalidCmd = {
      type: "IncrementCounter",
      aggregateId: createAggregateId(),
      payload: { amount: -5 }, // Schema requires positive
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: Date.now() as Timestamp,
        actor: { type: "test", id: "test-user" }
      }
    }
    
    // Schema validation should catch this
    const result = await pipe(
      Schema.decodeUnknown(IncrementCounter)(invalidCmd),
      Effect.runPromiseExit
    )
    
    expect(Exit.isFailure(result)).toBe(true)
  })
  
  test("should derive types from schemas", () => {
    // Types are automatically derived from schemas
    const event: Schema.Schema.Type<typeof CounterCreated> = {
      type: "CounterCreated",
      data: { initialValue: 42 },
      metadata: {
        eventId: createEventId(),
        aggregateId: createAggregateId(),
        version: 0 as Version,
        timestamp: Date.now() as Timestamp,
        correlationId: createEventId(),
        causationId: createEventId(),
        actor: { type: "test", id: "test-user" }
      }
    }
    
    // TypeScript ensures type safety
    expect(event.data.initialValue).toBe(42)
  })
})