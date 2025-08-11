/**
 * Simple Framework Demonstration
 * 
 * Focused demo showing core CQRS/Event Sourcing patterns without complex Stream operations
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"

// Import framework core
import {
  AggregateId,
  Email,
  Username,
  createAggregateId,
  createEventId,
  createCausationId,
  now,
  createEventSchema,
  createCommandSchema,
  createEventApplicator,
  createCommandHandler,
  createAggregate,
  executeCommand,
  loadFromEvents
} from "../index"

// ============================================================================
// Simple Domain Model
// ============================================================================

/**
 * Task state - simple example domain
 */
const TaskState = Schema.Struct({
  id: AggregateId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.Number
})
type TaskState = Schema.Schema.Type<typeof TaskState>

/**
 * Task events
 */
const TaskCreated = createEventSchema(
  "TaskCreated",
  Schema.Struct({
    title: Schema.String
  })
)

const TaskCompleted = createEventSchema(
  "TaskCompleted", 
  Schema.Struct({})
)

type TaskEvent = 
  | Schema.Schema.Type<typeof TaskCreated>
  | Schema.Schema.Type<typeof TaskCompleted>

/**
 * Task commands
 */
const CreateTask = createCommandSchema(
  "CreateTask",
  Schema.Struct({
    title: Schema.String
  })
)

const CompleteTask = createCommandSchema(
  "CompleteTask",
  Schema.Struct({})
)

type TaskCommand =
  | Schema.Schema.Type<typeof CreateTask>
  | Schema.Schema.Type<typeof CompleteTask>

// ============================================================================
// Domain Logic
// ============================================================================

class TaskAlreadyExists {
  readonly _tag = "TaskAlreadyExists"
  constructor(readonly id: AggregateId) {}
}

class TaskNotFound {
  readonly _tag = "TaskNotFound" 
  constructor(readonly id: AggregateId) {}
}

type TaskError = TaskAlreadyExists | TaskNotFound

/**
 * Pure event application
 */
const applyTaskEvent = createEventApplicator<TaskState, TaskEvent>({
  TaskCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    title: event.data.title,
    completed: false,
    createdAt: event.metadata.timestamp
  }),
  
  TaskCompleted: (state, event) =>
    state ? { ...state, completed: true } : null
})

/**
 * Pure command handling
 */
const handleTaskCommand = createCommandHandler<
  TaskState,
  TaskCommand, 
  TaskEvent,
  TaskError
>({
  CreateTask: (state, command) =>
    Effect.gen(function* () {
      // Check if task already exists (not empty state)
      if (state && state.title !== "") {
        return {
          type: "failure" as const,
          error: new TaskAlreadyExists(command.aggregateId)
        }
      }
      
      const event: Schema.Schema.Type<typeof TaskCreated> = {
        type: "TaskCreated" as const,
        data: { title: command.payload.title },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 0 as any,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    }),
    
  CompleteTask: (state, command) =>
    Effect.gen(function* () {
      // Check if task exists
      if (!state || state.title === "") {
        return {
          type: "failure" as const,
          error: new TaskNotFound(command.aggregateId)
        }
      }
      
      // Check if already completed
      if (state.completed) {
        return {
          type: "success" as const,
          events: [] // Already completed - idempotent
        }
      }
      
      const event: Schema.Schema.Type<typeof TaskCompleted> = {
        type: "TaskCompleted" as const,
        data: {},
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 1 as any,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    })
})

// ============================================================================
// Simple Demo Functions
// ============================================================================

/**
 * Create task aggregate
 */
const createTaskAggregate = (id: AggregateId = createAggregateId()) =>
  createAggregate<TaskState, TaskEvent>({
    id,
    title: "",
    completed: false,
    createdAt: 0
  })

/**
 * Execute command against task
 */
const executeTaskCommand = (aggregate: any, command: TaskCommand) =>
  executeCommand(handleTaskCommand, applyTaskEvent)(aggregate, command)

/**
 * Load task from events
 */
const loadTaskFromEvents = (events: ReadonlyArray<TaskEvent>) =>
  loadFromEvents(applyTaskEvent)(events)

// ============================================================================
// Demo Program
// ============================================================================

const runSimpleDemo = () =>
  Effect.gen(function* () {
    yield* Effect.log("🚀 Simple CQRS Framework Demo")
    
    // 1. Create new task
    yield* Effect.log("📝 Creating new task...")
    
    const taskId = createAggregateId()
    const createCommand: Schema.Schema.Type<typeof CreateTask> = {
      type: "CreateTask" as const,
      aggregateId: taskId,
      payload: { title: "Learn CQRS with Effect" },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(), 
        timestamp: now(),
        actor: { type: "system", service: "demo" }
      }
    }
    
    const aggregate = createTaskAggregate(taskId)
    const result1 = yield* executeTaskCommand(aggregate, createCommand)
    
    yield* Effect.log(`✅ Task created with ${result1.uncommittedEvents.length} events`)
    yield* Effect.log(`📊 Current state: ${JSON.stringify(result1.state)}`)
    
    // 2. Complete the task
    yield* Effect.log("⚡ Completing task...")
    
    const completeCommand: Schema.Schema.Type<typeof CompleteTask> = {
      type: "CompleteTask" as const,
      aggregateId: taskId,
      payload: {},
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: now(),
        actor: { type: "system", service: "demo" }
      }
    }
    
    const result2 = yield* executeTaskCommand(result1, completeCommand)
    
    yield* Effect.log(`✅ Task completed with ${result2.uncommittedEvents.length} new events`)
    yield* Effect.log(`📊 Final state: ${JSON.stringify(result2.state)}`)
    
    // 3. Demonstrate event sourcing - rebuild from events
    yield* Effect.log("🔄 Demonstrating event sourcing...")
    
    const allEvents = [...result1.uncommittedEvents, ...result2.uncommittedEvents]
    const rebuiltAggregate = loadTaskFromEvents(allEvents)
    
    yield* Effect.log(`📈 Rebuilt from ${allEvents.length} events`)
    yield* Effect.log(`📊 Rebuilt state: ${JSON.stringify(rebuiltAggregate.state)}`)
    yield* Effect.log(`🔍 States match: ${JSON.stringify(rebuiltAggregate.state) === JSON.stringify(result2.state)}`)
    
    // 4. Try completing again (should be idempotent)
    yield* Effect.log("🔄 Testing idempotence...")
    
    const result3 = yield* executeTaskCommand(result2, completeCommand)
    yield* Effect.log(`✅ Idempotent completion: ${result3.uncommittedEvents.length} new events (should be 0)`)
    
    yield* Effect.log("🎉 Simple demo completed successfully!")
    
    return {
      taskId,
      finalState: result3.state,
      totalEvents: allEvents.length + result3.uncommittedEvents.length,
      success: true
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`❌ Demo failed: ${JSON.stringify(error)}`)
        return { error: JSON.stringify(error) }
      })
    )
  )

// ============================================================================
// Run Demo
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runSimpleDemo()).then(
    result => {
      console.log("🎯 Demo Result:", result)
      process.exit(0)
    },
    error => {
      console.error("💥 Demo Error:", error)
      process.exit(1)
    }
  )
}

export { runSimpleDemo }