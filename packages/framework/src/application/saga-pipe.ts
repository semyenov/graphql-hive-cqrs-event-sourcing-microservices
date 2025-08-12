/**
 * Saga Orchestration - Pipe Pattern Implementation
 * 
 * Process managers and long-running transactions using functional composition
 * Superior to class-based sagas with clean pipe patterns
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as HashMap from "effect/HashMap"
import * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type { DomainEvent, Command } from "../schema/core/messages"
import type { AggregateId } from "../schema/core/primitives"
import { EventStore, CommandBus } from "../effects/services"

// ============================================================================
// Saga Types
// ============================================================================

export interface SagaState {
  readonly id: string
  readonly status: "running" | "completed" | "failed" | "compensating"
  readonly startedAt: number
  readonly updatedAt: number
  readonly context: Record<string, unknown>
  readonly processedEvents: Set<string>
  readonly compensationStack: ReadonlyArray<() => Effect.Effect<void, any>>
}

export interface SagaStep<Event extends DomainEvent, Context> {
  readonly name: string
  readonly matches: (event: Event) => boolean
  readonly handle: (
    event: Event,
    context: Context
  ) => Effect.Effect<{
    readonly commands?: ReadonlyArray<Command>
    readonly updateContext?: Partial<Context>
    readonly complete?: boolean
    readonly compensate?: () => Effect.Effect<void, any>
  }, SagaError>
}

export class SagaError {
  readonly _tag = "SagaError"
  constructor(
    readonly reason: "StepFailed" | "CompensationFailed" | "Timeout" | "InvalidState",
    readonly message: string,
    readonly sagaId: string,
    readonly details?: unknown
  ) {}
}

// ============================================================================
// Saga Builder - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Process saga step - PIPE PATTERN
 * Clean step execution without Effect.gen
 */
export const processSagaStep = <Event extends DomainEvent, Context>(
  step: SagaStep<Event, Context>,
  sagaState: SagaState,
  event: Event
): Effect.Effect<SagaState, SagaError, CommandBus> =>
  pipe(
    // Check if event already processed
    sagaState.processedEvents.has(event.metadata.eventId)
      ? Effect.succeed(sagaState)
      : pipe(
          // Execute step handler
          step.handle(event, sagaState.context as Context),
          Effect.mapError((error) =>
            new SagaError(
              "StepFailed",
              `Step ${step.name} failed: ${error.message}`,
              sagaState.id,
              error
            )
          ),
          // Process step result
          Effect.flatMap((result) =>
            pipe(
              // Send commands if any
              result.commands
                ? pipe(
                    CommandBus,
                    Effect.flatMap((bus) =>
                      Effect.forEach(
                        result.commands,
                        (cmd) => bus.send(cmd.metadata.aggregateId, cmd),
                        { discard: true }
                      )
                    )
                  )
                : Effect.void,
              // Update saga state
              Effect.map(() => ({
                ...sagaState,
                status: result.complete
                  ? ("completed" as const)
                  : ("running" as const),
                updatedAt: Date.now(),
                context: result.updateContext
                  ? { ...sagaState.context, ...result.updateContext }
                  : sagaState.context,
                processedEvents: new Set([
                  ...sagaState.processedEvents,
                  event.metadata.eventId,
                ]),
                compensationStack: result.compensate
                  ? [...sagaState.compensationStack, result.compensate]
                  : sagaState.compensationStack,
              }))
            )
          )
        )
  )

/**
 * 🎯 Create saga - PIPE PATTERN
 * Build saga processor with functional composition
 */
export const createSaga = <Event extends DomainEvent, Context>(
  name: string,
  initialContext: Context,
  steps: ReadonlyArray<SagaStep<Event, Context>>
): Effect.Effect<
  {
    readonly process: (event: Event) => Effect.Effect<void, SagaError, CommandBus>
    readonly getState: () => Effect.Effect<SagaState, never>
    readonly compensate: () => Effect.Effect<void, SagaError>
  },
  never
> =>
  pipe(
    Ref.make<SagaState>({
      id: `${name}-${Date.now()}`,
      status: "running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      context: initialContext as Record<string, unknown>,
      processedEvents: new Set(),
      compensationStack: [],
    }),
    Effect.map((stateRef) => ({
      process: (event: Event) =>
        pipe(
          // Find matching step
          Effect.succeed(steps.find((step) => step.matches(event))),
          Effect.flatMap(
            Option.fromNullable,
            Option.match({
              onNone: () => Effect.void,
              onSome: (step) =>
                pipe(
                  Ref.get(stateRef),
                  Effect.flatMap((currentState) =>
                    currentState.status === "running"
                      ? processSagaStep(step, currentState, event)
                      : Effect.succeed(currentState)
                  ),
                  Effect.flatMap((newState) => Ref.set(stateRef, newState))
                ),
            })
          )
        ),

      getState: () => Ref.get(stateRef),

      compensate: () =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            pipe(
              // Update status to compensating
              Ref.update(stateRef, (s) => ({ ...s, status: "compensating" as const })),
              // Run compensation in reverse order
              Effect.flatMap(() =>
                Effect.forEach(
                  [...state.compensationStack].reverse(),
                  (compensate) =>
                    pipe(
                      compensate(),
                      Effect.mapError((error) =>
                        new SagaError(
                          "CompensationFailed",
                          `Compensation failed: ${error}`,
                          state.id,
                          error
                        )
                      )
                    ),
                  { discard: true }
                )
              ),
              // Update status to failed
              Effect.flatMap(() =>
                Ref.update(stateRef, (s) => ({ ...s, status: "failed" as const }))
              )
            )
          )
        ),
    }))
  )

// ============================================================================
// Saga Patterns - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Create choreography saga - PIPE PATTERN
 * Event-driven coordination without central orchestrator
 */
export const createChoreographySaga = <Event extends DomainEvent>(
  name: string,
  eventHandlers: ReadonlyArray<{
    readonly eventType: string
    readonly handle: (event: Event) => Effect.Effect<ReadonlyArray<Command>, any>
  }>
) => (eventStream: Stream.Stream<Event, any>): Effect.Effect<void, never, CommandBus> =>
  pipe(
    eventStream,
    Stream.mapEffect((event) =>
      pipe(
        Effect.succeed(eventHandlers.find((h) => h.eventType === event.type)),
        Effect.flatMap(
          Option.fromNullable,
          Option.match({
            onNone: () => Effect.void,
            onSome: (handler) =>
              pipe(
                handler.handle(event),
                Effect.flatMap((commands) =>
                  pipe(
                    CommandBus,
                    Effect.flatMap((bus) =>
                      Effect.forEach(
                        commands,
                        (cmd) => bus.send(cmd.metadata.aggregateId, cmd),
                        { discard: true }
                      )
                    )
                  )
                ),
                Effect.catchAll(() => Effect.void)
              ),
          })
        )
      )
    ),
    Stream.runDrain
  )

/**
 * 🎯 Create orchestration saga - PIPE PATTERN
 * Central coordinator with state management
 */
export const createOrchestrationSaga = <Event extends DomainEvent, State>(
  name: string,
  initialState: State,
  transitions: ReadonlyArray<{
    readonly fromState: keyof State
    readonly event: string
    readonly toState: keyof State
    readonly action: (event: Event, state: State) => Effect.Effect<ReadonlyArray<Command>, any>
  }>
): Effect.Effect<
  {
    readonly process: (event: Event) => Effect.Effect<void, SagaError, CommandBus>
    readonly getState: () => Effect.Effect<State, never>
  },
  never
> =>
  pipe(
    Ref.make(initialState),
    Effect.map((stateRef) => ({
      process: (event: Event) =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((currentState) =>
            pipe(
              Effect.succeed(
                transitions.find(
                  (t) =>
                    t.event === event.type &&
                    currentState[t.fromState as keyof State] !== undefined
                )
              ),
              Effect.flatMap(
                Option.fromNullable,
                Option.match({
                  onNone: () => Effect.void,
                  onSome: (transition) =>
                    pipe(
                      transition.action(event, currentState),
                      Effect.flatMap((commands) =>
                        pipe(
                          CommandBus,
                          Effect.flatMap((bus) =>
                            Effect.forEach(
                              commands,
                              (cmd) => bus.send(cmd.metadata.aggregateId, cmd),
                              { discard: true }
                            )
                          )
                        )
                      ),
                      Effect.flatMap(() =>
                        Ref.update(stateRef, (state) => ({
                          ...state,
                          [transition.toState]: true,
                          [transition.fromState]: undefined,
                        }))
                      ),
                      Effect.mapError((error) =>
                        new SagaError(
                          "StepFailed",
                          `Transition failed: ${error}`,
                          name,
                          error
                        )
                      )
                    ),
                })
              )
            )
          )
        ),

      getState: () => Ref.get(stateRef),
    }))
  )

/**
 * 🎯 Create timeout saga - PIPE PATTERN
 * Saga with automatic timeout and compensation
 */
export const createTimeoutSaga = <Event extends DomainEvent, Context>(
  name: string,
  timeout: Duration.Duration,
  saga: {
    readonly process: (event: Event) => Effect.Effect<void, SagaError, CommandBus>
    readonly compensate: () => Effect.Effect<void, SagaError>
  }
) => (event: Event): Effect.Effect<void, SagaError, CommandBus> =>
  pipe(
    saga.process(event),
    Effect.timeout(timeout),
    Effect.catchTag("TimeoutException", () =>
      pipe(
        saga.compensate(),
        Effect.flatMap(() =>
          Effect.fail(
            new SagaError(
              "Timeout",
              `Saga ${name} timed out after ${Duration.toMillis(timeout)}ms`,
              name
            )
          )
        )
      )
    )
  )

/**
 * 🎯 Create retry saga - PIPE PATTERN
 * Saga with automatic retry logic
 */
export const createRetrySaga = <Event extends DomainEvent>(
  name: string,
  retrySchedule: Schedule.Schedule<unknown, any, never>,
  saga: {
    readonly process: (event: Event) => Effect.Effect<void, SagaError, CommandBus>
  }
) => (event: Event): Effect.Effect<void, SagaError, CommandBus> =>
  pipe(
    saga.process(event),
    Effect.retry(retrySchedule),
    Effect.mapError((error) =>
      new SagaError(
        "StepFailed",
        `Saga ${name} failed after retries: ${error}`,
        name,
        error
      )
    )
  )

// ============================================================================
// Example: Order Processing Saga - PIPE PATTERN
// ============================================================================

interface OrderSagaContext {
  orderId: AggregateId
  customerId: AggregateId
  items: ReadonlyArray<{ productId: string; quantity: number }>
  totalAmount: number
  paymentId?: string
  shipmentId?: string
}

/**
 * 🎯 Order processing saga using PIPE PATTERN
 * Complete order workflow with compensation
 */
export const createOrderSaga = () => {
  const steps: SagaStep<DomainEvent, OrderSagaContext>[] = [
    {
      name: "reserve-inventory",
      matches: (event) => event.type === "OrderPlaced",
      handle: (event, context) =>
        Effect.succeed({
          commands: context.items.map((item) => ({
            type: "ReserveInventory" as const,
            payload: { productId: item.productId, quantity: item.quantity },
            metadata: {
              commandId: "cmd-" + Date.now(),
              aggregateId: item.productId as AggregateId,
              correlationId: event.metadata.correlationId,
              causationId: event.metadata.eventId,
              timestamp: Date.now(),
              actor: { type: "system" as const },
            },
          })),
          compensate: () =>
            Effect.forEach(
              context.items,
              (item) =>
                Effect.sync(() =>
                  console.log(`Releasing inventory for ${item.productId}`)
                ),
              { discard: true }
            ),
        }),
    },
    {
      name: "process-payment",
      matches: (event) => event.type === "InventoryReserved",
      handle: (event, context) =>
        Effect.succeed({
          commands: [
            {
              type: "ProcessPayment" as const,
              payload: {
                customerId: context.customerId,
                amount: context.totalAmount,
              },
              metadata: {
                commandId: "cmd-" + Date.now(),
                aggregateId: context.customerId,
                correlationId: event.metadata.correlationId,
                causationId: event.metadata.eventId,
                timestamp: Date.now(),
                actor: { type: "system" as const },
              },
            },
          ],
          updateContext: { paymentId: "payment-" + Date.now() },
          compensate: () =>
            Effect.sync(() =>
              console.log(`Refunding payment ${context.paymentId}`)
            ),
        }),
    },
    {
      name: "ship-order",
      matches: (event) => event.type === "PaymentProcessed",
      handle: (event, context) =>
        Effect.succeed({
          commands: [
            {
              type: "ShipOrder" as const,
              payload: {
                orderId: context.orderId,
                customerId: context.customerId,
              },
              metadata: {
                commandId: "cmd-" + Date.now(),
                aggregateId: context.orderId,
                correlationId: event.metadata.correlationId,
                causationId: event.metadata.eventId,
                timestamp: Date.now(),
                actor: { type: "system" as const },
              },
            },
          ],
          updateContext: { shipmentId: "shipment-" + Date.now() },
          complete: true,
        }),
    },
  ]

  return createSaga("order-processing", {} as OrderSagaContext, steps)
}

// ============================================================================
// Saga Manager - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Saga manager for running multiple sagas
 */
export const createSagaManager = () => {
  const sagas = new Map<string, any>()

  return {
    register: (name: string, saga: any) =>
      Effect.sync(() => {
        sagas.set(name, saga)
      }),

    process: (event: DomainEvent) =>
      pipe(
        Effect.forEach(
          Array.from(sagas.values()),
          (saga) => saga.process(event),
          { discard: true, concurrency: "unbounded" }
        ),
        Effect.catchAll(() => Effect.void)
      ),

    getStates: () =>
      Effect.forEach(
        Array.from(sagas.entries()),
        ([name, saga]) =>
          pipe(
            saga.getState(),
            Effect.map((state) => ({ name, state }))
          )
      ),
  }
}

// All exports are already declared inline above