/**
 * Performance Benchmark
 * 
 * Demonstrates the ultra-clean framework's performance characteristics
 * across various scenarios and load patterns
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"

import {
  AggregateId,
  createAggregateId,
  createEventId,
  createCommandId,
  createCorrelationId,
  createCausationId,
  now,
  nonEmptyString,
  createEventSchema,
  createCommandSchema,
  createEventApplicator,
  createCommandHandler,
  createAggregate,
  executeCommand,
  loadFromEvents,
  CoreServicesLive
} from "../index"

// ============================================================================
// Benchmark Domain Model
// ============================================================================

const BenchmarkState = Schema.Struct({
  id: AggregateId,
  counter: Schema.Number,
  name: Schema.String,
  lastUpdated: Schema.Number
})
type BenchmarkState = Schema.Schema.Type<typeof BenchmarkState>

const CounterIncremented = createEventSchema(
  "CounterIncremented",
  Schema.Struct({
    increment: Schema.Number,
    timestamp: Schema.Number
  })
)

const CounterReset = createEventSchema(
  "CounterReset", 
  Schema.Struct({
    resetValue: Schema.Number
  })
)

type BenchmarkEvent = 
  | Schema.Schema.Type<typeof CounterIncremented>
  | Schema.Schema.Type<typeof CounterReset>

const IncrementCounter = createCommandSchema(
  "IncrementCounter",
  Schema.Struct({
    amount: Schema.Number
  })
)

const ResetCounter = createCommandSchema(
  "ResetCounter",
  Schema.Struct({
    newValue: Schema.Number
  })
)

type BenchmarkCommand =
  | Schema.Schema.Type<typeof IncrementCounter>
  | Schema.Schema.Type<typeof ResetCounter>

// ============================================================================
// Pure Functions
// ============================================================================

const applyBenchmarkEvent = createEventApplicator<BenchmarkState, BenchmarkEvent>({
  CounterIncremented: (state, event) =>
    state ? {
      ...state,
      counter: state.counter + event.data.increment,
      lastUpdated: event.data.timestamp
    } : null,
    
  CounterReset: (state, event) =>
    state ? {
      ...state,
      counter: event.data.resetValue,
      lastUpdated: event.metadata.timestamp
    } : null
})

const handleBenchmarkCommand = createCommandHandler<
  BenchmarkState,
  BenchmarkCommand,
  BenchmarkEvent,
  never
>({
  IncrementCounter: (state, command) =>
    Effect.succeed({
      type: "success" as const,
      events: [{
        type: "CounterIncremented" as const,
        data: {
          increment: command.payload.amount,
          timestamp: now()
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any)?.version || 0,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }]
    }),
    
  ResetCounter: (state, command) =>
    Effect.succeed({
      type: "success" as const,
      events: [{
        type: "CounterReset" as const,
        data: {
          resetValue: command.payload.newValue
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any)?.version || 0,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }]
    })
})

// ============================================================================
// Benchmark Utilities
// ============================================================================

const createBenchmarkAggregate = (id: AggregateId = createAggregateId()) =>
  createAggregate<BenchmarkState, BenchmarkEvent>({
    id,
    counter: 0,
    name: `benchmark-${id}`,
    lastUpdated: now()
  })

const executeBenchmarkCommand = (aggregate: any, command: BenchmarkCommand) =>
  executeCommand(handleBenchmarkCommand, applyBenchmarkEvent)(aggregate, command)

// ============================================================================
// Benchmark Tests
// ============================================================================

/**
 * Single operation benchmark
 */
const benchmarkSingleOperation = () =>
  Effect.gen(function* () {
    yield* Effect.log("🏃 Single Operation Benchmark")
    
    const startTime = performance.now()
    
    // Create aggregate
    const aggregate = createBenchmarkAggregate()
    
    // Execute command
    const command: Schema.Schema.Type<typeof IncrementCounter> = {
      type: "IncrementCounter" as const,
      aggregateId: aggregate.state.id,
      payload: { amount: 1 },
      metadata: {
        commandId: createCommandId(),
        correlationId: createCorrelationId(),
        timestamp: now(),
        actor: { type: "system", service: nonEmptyString("benchmark") }
      }
    }
    
    const result = yield* executeBenchmarkCommand(aggregate, command)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    yield* Effect.log(`✅ Single operation: ${duration.toFixed(3)}ms`)
    
    return { duration, result }
  })

/**
 * Batch operations benchmark
 */
const benchmarkBatchOperations = (batchSize: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`🏃 Batch Operations Benchmark (${batchSize} operations)`)
    
    const startTime = performance.now()
    
    let aggregate = createBenchmarkAggregate()
    
    // Execute batch of commands
    for (let i = 0; i < batchSize; i++) {
      const command: Schema.Schema.Type<typeof IncrementCounter> = {
        type: "IncrementCounter" as const,
        aggregateId: aggregate.state.id,
        payload: { amount: 1 },
        metadata: {
          commandId: createCommandId(),
          correlationId: createCorrelationId(),
          timestamp: now(),
          actor: { type: "system", service: nonEmptyString("benchmark") }
        }
      }
      
      aggregate = yield* executeBenchmarkCommand(aggregate, command)
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    const opsPerSecond = (batchSize / duration) * 1000
    
    yield* Effect.log(`✅ Batch ${batchSize} operations: ${duration.toFixed(3)}ms`)
    yield* Effect.log(`📊 Operations per second: ${opsPerSecond.toFixed(0)} ops/sec`)
    yield* Effect.log(`📊 Average per operation: ${(duration / batchSize).toFixed(4)}ms`)
    
    return { 
      duration, 
      opsPerSecond, 
      averagePerOp: duration / batchSize,
      finalCounter: aggregate.state.counter
    }
  })

/**
 * Event replay benchmark
 */
const benchmarkEventReplay = (eventCount: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`🏃 Event Replay Benchmark (${eventCount} events)`)
    
    // Generate events
    const events: BenchmarkEvent[] = Array.from({ length: eventCount }, (_, i) => ({
      type: "CounterIncremented" as const,
      data: {
        increment: 1,
        timestamp: now() + i
      },
      metadata: {
        eventId: createEventId(),
        aggregateId: createAggregateId(),
        version: i,
        timestamp: now() + i,
        correlationId: createCorrelationId(),
        causationId: createCausationId(),
        actor: { type: "system", service: nonEmptyString("benchmark") }
      }
    }))
    
    const startTime = performance.now()
    
    // Replay events to rebuild state
    const finalAggregate = loadFromEvents(applyBenchmarkEvent)(events)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    const eventsPerSecond = (eventCount / duration) * 1000
    
    yield* Effect.log(`✅ Event replay ${eventCount} events: ${duration.toFixed(3)}ms`)
    yield* Effect.log(`📊 Events per second: ${eventsPerSecond.toFixed(0)} events/sec`)
    yield* Effect.log(`📊 Average per event: ${(duration / eventCount).toFixed(4)}ms`)
    yield* Effect.log(`📊 Final counter value: ${finalAggregate.state?.counter || 0}`)
    
    return {
      duration,
      eventsPerSecond,
      averagePerEvent: duration / eventCount,
      finalState: finalAggregate.state
    }
  })

/**
 * Concurrent operations benchmark
 */
const benchmarkConcurrentOperations = (concurrency: number, operationsPerFiber: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`🏃 Concurrent Operations Benchmark (${concurrency} fibers × ${operationsPerFiber} ops)`)
    
    const startTime = performance.now()
    
    // Create concurrent fibers
    const fibers = Array.from({ length: concurrency }, () =>
      Effect.gen(function* () {
        let aggregate = createBenchmarkAggregate()
        
        for (let i = 0; i < operationsPerFiber; i++) {
          const command: Schema.Schema.Type<typeof IncrementCounter> = {
            type: "IncrementCounter" as const,
            aggregateId: aggregate.state.id,
            payload: { amount: 1 },
            metadata: {
              commandId: createCommandId(),
              correlationId: createCorrelationId(),
              timestamp: now(),
              actor: { type: "system", service: nonEmptyString("benchmark") }
            }
          }
          
          aggregate = yield* executeBenchmarkCommand(aggregate, command)
        }
        
        return aggregate.state.counter
      })
    )
    
    // Run all fibers concurrently
    const results = yield* Effect.all(fibers, { concurrency: "unbounded" })
    
    const endTime = performance.now()
    const duration = endTime - startTime
    const totalOperations = concurrency * operationsPerFiber
    const opsPerSecond = (totalOperations / duration) * 1000
    
    yield* Effect.log(`✅ Concurrent ${totalOperations} operations: ${duration.toFixed(3)}ms`)
    yield* Effect.log(`📊 Operations per second: ${opsPerSecond.toFixed(0)} ops/sec`)
    yield* Effect.log(`📊 Concurrent fibers: ${concurrency}`)
    yield* Effect.log(`📊 Operations per fiber: ${operationsPerFiber}`)
    
    return {
      duration,
      opsPerSecond,
      concurrency,
      operationsPerFiber,
      totalOperations,
      results
    }
  })

/**
 * Memory usage benchmark
 */
const benchmarkMemoryUsage = (aggregateCount: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`🏃 Memory Usage Benchmark (${aggregateCount} aggregates)`)
    
    const startMemory = process.memoryUsage()
    const startTime = performance.now()
    
    // Create many aggregates
    const aggregates = Array.from({ length: aggregateCount }, () => {
      const aggregate = createBenchmarkAggregate()
      
      // Add some events to each
      const events: BenchmarkEvent[] = Array.from({ length: 10 }, (_, i) => ({
        type: "CounterIncremented" as const,
        data: { increment: 1, timestamp: now() + i },
        metadata: {
          eventId: createEventId(),
          aggregateId: aggregate.state.id,
          version: i,
          timestamp: now() + i,
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("benchmark") }
        }
      }))
      
      return loadFromEvents(applyBenchmarkEvent)(events)
    })
    
    const endTime = performance.now()
    const endMemory = process.memoryUsage()
    
    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed
    const memoryPerAggregate = memoryUsed / aggregateCount
    
    yield* Effect.log(`✅ Created ${aggregateCount} aggregates: ${(endTime - startTime).toFixed(3)}ms`)
    yield* Effect.log(`📊 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`)
    yield* Effect.log(`📊 Memory per aggregate: ${(memoryPerAggregate / 1024).toFixed(2)} KB`)
    yield* Effect.log(`📊 Total counter sum: ${aggregates.reduce((sum, agg) => sum + (agg.state?.counter || 0), 0)}`)
    
    return {
      aggregateCount,
      memoryUsed,
      memoryPerAggregate,
      creationTime: endTime - startTime,
      aggregates: aggregates.length
    }
  })

// ============================================================================
// Complete Benchmark Suite
// ============================================================================

const runPerformanceBenchmarks = () =>
  Effect.gen(function* () {
    yield* Effect.log("🏁 Starting Ultra-Clean Framework Performance Benchmarks")
    yield* Effect.log("=" .repeat(60))
    
    // Single operation
    yield* benchmarkSingleOperation()
    yield* Effect.log("")
    
    // Batch operations - various sizes
    yield* benchmarkBatchOperations(100)
    yield* benchmarkBatchOperations(1000)
    yield* benchmarkBatchOperations(10000)
    yield* Effect.log("")
    
    // Event replay - various sizes
    yield* benchmarkEventReplay(100)
    yield* benchmarkEventReplay(1000)
    yield* benchmarkEventReplay(10000)
    yield* Effect.log("")
    
    // Concurrent operations
    yield* benchmarkConcurrentOperations(10, 100)
    yield* benchmarkConcurrentOperations(50, 100)
    yield* benchmarkConcurrentOperations(100, 100)
    yield* Effect.log("")
    
    // Memory usage
    yield* benchmarkMemoryUsage(1000)
    yield* benchmarkMemoryUsage(10000)
    yield* Effect.log("")
    
    yield* Effect.log("🏆 Benchmark Suite Completed!")
    yield* Effect.log("=" .repeat(60))
    
    return { message: "Performance benchmarks completed successfully!" }
  }).pipe(
    Effect.provide(CoreServicesLive),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`❌ Benchmark failed: ${JSON.stringify(error)}`)
        return { error: JSON.stringify(error) }
      })
    )
  )

// ============================================================================
// Run Benchmarks
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runPerformanceBenchmarks()).then(
    result => {
      console.log("🎯 Benchmark Result:", result)
      process.exit(0)
    },
    error => {
      console.error("💥 Benchmark Error:", error)
      process.exit(1)
    }
  )
}

export { runPerformanceBenchmarks }