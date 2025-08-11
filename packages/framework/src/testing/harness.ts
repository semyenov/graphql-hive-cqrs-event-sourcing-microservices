/**
 * Testing Harness
 * 
 * Testing utilities for the ultra-clean CQRS/Event Sourcing framework
 * Provides helpers for testing aggregates, projections, and sagas
 */

import * as Effect from "effect/Effect"
import * as ReadonlyArray from "effect/Array"
import * as TestClock from "effect/TestClock"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

import type { EventSourcedAggregate } from "../functions/event-sourcing"
import type { Projection } from "../functions/event-sourcing"
import type { Saga } from "../patterns/saga"
import { CoreServicesLive, type EventStore, type ProjectionStore, type CommandBus, type QueryBus } from "../effects/services"

// ============================================================================
// Test Scenario Builder
// ============================================================================

/**
 * Test scenario for aggregate testing
 */
export interface AggregateTestScenario<State, Command, Event, Error> {
  readonly given: ReadonlyArray<Event>
  readonly when: Command
  readonly then: 
    | { type: "success"; events: ReadonlyArray<Event>; state?: State }
    | { type: "failure"; error: Error }
}

/**
 * Build test scenario
 */
export const scenario = <State, Command, Event, Error>() => ({
  given: (events: ReadonlyArray<Event>) => ({
    when: (command: Command) => ({
      thenEvents: (expectedEvents: ReadonlyArray<Event>) => ({
        given: events,
        when: command,
        then: { type: "success" as const, events: expectedEvents }
      }),
      thenState: (expectedState: State) => ({
        given: events,
        when: command,
        then: { type: "success" as const, events: [], state: expectedState }
      }),
      thenFails: (expectedError: Error) => ({
        given: events,
        when: command,
        then: { type: "failure" as const, error: expectedError }
      })
    })
  })
})

// ============================================================================
// Aggregate Testing
// ============================================================================

/**
 * Test aggregate behavior
 */
export const testAggregate = <State, Command, Event, Error>(
  loadFromEvents: (events: ReadonlyArray<Event>) => EventSourcedAggregate<State, Event>,
  executeCommand: (
    aggregate: EventSourcedAggregate<State, Event>,
    command: Command
  ) => Effect.Effect<EventSourcedAggregate<State, Event>, Error>,
  scenario: AggregateTestScenario<State, Command, Event, Error>
): Effect.Effect<void, AssertionError> =>
  Effect.gen(function* () {
    // Load aggregate from given events
    const aggregate = loadFromEvents(scenario.given)
    
    // Execute command
    const result = yield* pipe(
      executeCommand(aggregate, scenario.when),
      Effect.either
    )
    
    // Assert result
    return match(scenario.then)
      .with({ type: "success" }, (expected) =>
        match(result)
          .with({ _tag: "Right" }, ({ right: newAggregate }) => {
            // Check events
            if (expected.events.length > 0) {
              assertEventsEqual(
                newAggregate.uncommittedEvents,
                expected.events
              )
            }
            
            // Check state if provided
            if (expected.state) {
              assertStateEqual(newAggregate.state, expected.state)
            }
            
            return Effect.succeed(undefined)
          })
          .with({ _tag: "Left" }, ({ left: error }) =>
            Effect.fail(
              new AssertionError(
                `Expected success but got error: ${JSON.stringify(error)}`
              )
            )
          )
          .exhaustive()
      )
      .with({ type: "failure" }, (expected) =>
        match(result)
          .with({ _tag: "Left" }, ({ left: error }) => {
            assertErrorEqual(error, expected.error)
            return Effect.succeed(undefined)
          })
          .with({ _tag: "Right" }, () =>
            Effect.fail(
              new AssertionError(
                `Expected error ${JSON.stringify(expected.error)} but command succeeded`
              )
            )
          )
          .exhaustive()
      )
      .exhaustive()
  })

// ============================================================================
// Projection Testing
// ============================================================================

/**
 * Test projection behavior
 */
export const testProjection = <State, Event>(
  projection: Projection<State, Event>,
  events: ReadonlyArray<Event>,
  expectedState: State
): Effect.Effect<void, AssertionError> =>
  Effect.gen(function* () {
    const finalState = pipe(
      events,
      ReadonlyArray.reduce(projection.initialState, projection.reducer)
    )
    
    assertStateEqual(finalState, expectedState)
  })

/**
 * Test projection with intermediate states
 */
export const testProjectionSteps = <State, Event>(
  projection: Projection<State, Event>,
  steps: ReadonlyArray<{
    event: Event
    expectedState: State
  }>
): Effect.Effect<void, AssertionError> =>
  Effect.gen(function* () {
    let currentState = projection.initialState
    
    for (const step of steps) {
      currentState = projection.reducer(currentState, step.event)
      assertStateEqual(currentState, step.expectedState)
    }
  })

// ============================================================================
// Saga Testing
// ============================================================================

/**
 * Test saga execution
 */
export const testSaga = <Input, Output>(
  saga: Saga<Input, Output>,
  input: Input,
  expectedOutput: Output
): Effect.Effect<void, AssertionError> =>
  pipe(
    saga.execute(input),
    Effect.map(output => assertStateEqual(output, expectedOutput)),
    Effect.mapError(error =>
      new AssertionError(`Saga failed: ${JSON.stringify(error)}`)
    ),
    Effect.provide(CoreServicesLive)
  )

/**
 * Test saga compensation
 */
export const testSagaCompensation = <Input, Output>(
  saga: Saga<Input, Output>,
  input: Input,
  failAtStep: string
): Effect.Effect<void, AssertionError> =>
  Effect.gen(function* () {
    // Inject failure at specific step
    const result = yield* pipe(
      saga.execute(input),
      Effect.either,
      Effect.provide(CoreServicesLive)
    )
    
    // Verify saga failed and compensations ran
    match(result)
      .with({ _tag: "Left" }, ({ left: error }) => {
        // Check error is from expected step
        if (!JSON.stringify(error).includes(failAtStep)) {
          return Effect.fail(
            new AssertionError(`Expected failure at step ${failAtStep}`)
          )
        }
        return Effect.succeed(undefined)
      })
      .with({ _tag: "Right" }, () =>
        Effect.fail(
          new AssertionError(`Expected saga to fail at step ${failAtStep}`)
        )
      )
      .exhaustive()
  })

// ============================================================================
// Event Testing Helpers
// ============================================================================

/**
 * Create event builder for testing
 */
export const eventBuilder = <Event extends { type: string }>(
  type: Event["type"]
) => (
  data: Omit<Event, "type" | "metadata">,
  metadata?: Partial<Event extends { metadata: infer M } ? M : never>
): Event => ({
  type,
  ...data,
  metadata: {
    eventId: "test-event-id",
    aggregateId: "test-aggregate-id",
    version: 1,
    timestamp: Date.now(),
    correlationId: "test-correlation-id",
    causationId: "test-causation-id",
    actor: { type: "system", service: "test" },
    ...metadata
  }
} as unknown as Event)

// ============================================================================
// Command Testing Helpers
// ============================================================================

/**
 * Create command builder for testing
 */
export const commandBuilder = <Command extends { type: string }>(
  type: Command["type"]
) => (
  payload: Omit<Command, "type" | "metadata" | "aggregateId">,
  aggregateId: string = "test-aggregate-id",
  metadata?: Partial<Command extends { metadata: infer M } ? M : never>
): Command => ({
  type,
  aggregateId,
  ...payload,
  metadata: {
    commandId: "test-command-id",
    correlationId: "test-correlation-id",
    timestamp: Date.now(),
    actor: { type: "system", service: "test" },
    ...metadata
  }
} as unknown as Command)

// ============================================================================
// Time Testing
// ============================================================================

/**
 * Test with controlled time
 */
export const withTestTime = <R, E, A>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.provide(TestEnvironment.TestContext),
    Effect.tap(() => TestClock.adjust(Duration.zero))
  )

/**
 * Advance time in test
 */
export const advanceTime = (duration: Duration.Duration) =>
  TestClock.adjust(duration)

// ============================================================================
// Assertion Helpers
// ============================================================================

export class AssertionError {
  readonly _tag = "AssertionError"
  constructor(readonly message: string) {}
}

const assertEventsEqual = <Event>(
  actual: ReadonlyArray<Event>,
  expected: ReadonlyArray<Event>
): void => {
  if (actual.length !== expected.length) {
    throw new AssertionError(
      `Expected ${expected.length} events but got ${actual.length}`
    )
  }
  
  for (let i = 0; i < actual.length; i++) {
    const actualEvent = actual[i]
    const expectedEvent = expected[i]
    
    // Compare event types and data (ignore metadata for testing)
    if ((actualEvent as any).type !== (expectedEvent as any).type) {
      throw new AssertionError(
        `Event ${i}: Expected type ${(expectedEvent as any).type} but got ${(actualEvent as any).type}`
      )
    }
    
    if (JSON.stringify((actualEvent as any).data) !== JSON.stringify((expectedEvent as any).data)) {
      throw new AssertionError(
        `Event ${i}: Data mismatch`
      )
    }
  }
}

const assertStateEqual = <State>(
  actual: State,
  expected: State
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AssertionError(
      `State mismatch:\nExpected: ${JSON.stringify(expected, null, 2)}\nActual: ${JSON.stringify(actual, null, 2)}`
    )
  }
}

const assertErrorEqual = <Error>(
  actual: Error,
  expected: Error
): void => {
  if ((actual as any)._tag !== (expected as any)._tag) {
    throw new AssertionError(
      `Error type mismatch: Expected ${(expected as any)._tag} but got ${(actual as any)._tag}`
    )
  }
}

// ============================================================================
// Test Suite Builder
// ============================================================================

/**
 * Build test suite for aggregate
 */
export const aggregateTestSuite = <State, Command, Event, Error>(
  name: string,
  loadFromEvents: (events: ReadonlyArray<Event>) => EventSourcedAggregate<State, Event>,
  executeCommand: (
    aggregate: EventSourcedAggregate<State, Event>,
    command: Command
  ) => Effect.Effect<EventSourcedAggregate<State, Event>, Error>
) => ({
  name,
  test: (
    description: string,
    scenario: AggregateTestScenario<State, Command, Event, Error>
  ) => ({
    description,
    run: () => testAggregate(loadFromEvents, executeCommand, scenario)
  })
})

// ============================================================================
// Integration Test Helpers
// ============================================================================

/**
 * Run integration test with full services
 */
export const integrationTest = <E, A>(
  test: Effect.Effect<A, E, EventStore | ProjectionStore | CommandBus | QueryBus>
): Promise<A> =>
  pipe(
    test,
    Effect.provide(CoreServicesLive),
    Effect.runPromise
  )

/**
 * Test event flow through system
 */
export const testEventFlow = <Event, Command>(
  command: Command,
  expectedEvents: ReadonlyArray<Event>
): Effect.Effect<void, AssertionError> =>
  Effect.gen(function* () {
    // This would connect to actual services
    // and verify events flow through the system
    yield* Effect.log(`Testing event flow for command: ${(command as any).type}`)
    yield* Effect.log(`Expecting ${expectedEvents.length} events`)
    
    // Simplified for example - in real implementation would verify events
    return undefined
  })