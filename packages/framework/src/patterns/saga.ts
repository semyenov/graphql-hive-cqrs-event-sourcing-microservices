/**
 * Saga/Process Manager Patterns
 *
 * Orchestration and choreography patterns for complex workflows
 * Pure functional implementation with Effect-TS
 */

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as ReadonlyArray from "effect/Array";
import * as Ref from "effect/Ref";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
import { pipe } from "effect/Function";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Saga State - Represents the current state of a saga
 */
export type SagaState<Data> = {
  readonly id: string;
  readonly type: string;
  readonly status: SagaStatus;
  readonly data: Data;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
  readonly compensations: ReadonlyArray<CompensationRecord>;
  readonly error?: SagaError;
};

export type SagaStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "compensating"
  | "compensated";

export interface CompensationRecord {
  readonly step: string;
  readonly timestamp: number;
  readonly success: boolean;
  readonly error?: unknown;
}

export class SagaError {
  readonly _tag = "SagaError";
  constructor(
    readonly step: string,
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

// ============================================================================
// Saga Step Definition
// ============================================================================

/**
 * Saga Step - A single step in a saga with compensation
 */
export interface SagaStep<Input, Output, Error = SagaError> {
  readonly name: string;
  readonly execute: (input: Input) => Effect.Effect<Output, Error>;
  readonly compensate?: (
    input: Input,
    output: Output,
  ) => Effect.Effect<void, Error>;
  readonly canRetry?: boolean;
  readonly timeout?: Duration.Duration;
}

/**
 * Create a saga step
 */
export const createStep = <Input, Output, Error = SagaError>(
  config: SagaStep<Input, Output, Error>,
): SagaStep<Input, Output, Error> => config;

// ============================================================================
// Saga Definition
// ============================================================================

/**
 * Saga - A complete workflow definition
 */
export interface Saga<Input, Output, Context = never> {
  readonly name: string;
  readonly steps: ReadonlyArray<SagaStep<any, any>>;
  readonly execute: (input: Input) => Effect.Effect<Output, SagaError, Context>;
}

/**
 * Create a sequential saga
 */
export const createSequentialSaga = <Input, Output, Context = never>(
  name: string,
  steps: ReadonlyArray<SagaStep<any, any>>,
): Saga<Input, Output, Context> => ({
  name,
  steps,
  execute: (input) =>
    Effect.gen(function* () {
      const completedSteps: Array<{ step: SagaStep<any, any>; output: any }> =
        [];
      let currentInput: any = input;

      for (const step of steps) {
        const result = yield* pipe(
          step.execute(currentInput),
          (effect) => step.timeout ? Effect.timeout(effect, step.timeout) : effect,
          (effect) => step.canRetry 
            ? Effect.retry(effect, Schedule.exponential(Duration.seconds(1)))
            : effect,
          Effect.mapError((error) =>
            new SagaError(step.name, `Step failed: ${step.name}`, error)
          ),
          Effect.either
        );

        if (result._tag === "Left") {
          // Compensate in reverse order
          yield* compensateSteps(completedSteps, input);
          return yield* Effect.fail(result.left);
        }

        const output = result.right;
        completedSteps.push({ step, output });
        currentInput = output;
      }

      return currentInput as Output;
    }) as Effect.Effect<Output, SagaError, Context>,
});

/**
 * Compensate completed steps
 */
const compensateSteps = <Input>(
  completedSteps: Array<{ step: SagaStep<any, any>; output: any }>,
  originalInput: Input,
): Effect.Effect<void, SagaError> =>
  Effect.gen(function* () {
    const reversedSteps = [...completedSteps].reverse();

    for (const { step, output } of reversedSteps) {
      if (step.compensate) {
        yield* pipe(
          step.compensate(originalInput, output),
          Effect.mapError((error) =>
            new SagaError(
              step.name,
              `Compensation failed for step: ${step.name}`,
              error,
            )
          ),
          Effect.catchAll((error) =>
            // Log compensation failure but continue
            Effect.logError(`Compensation failed: ${error.message}`)
          ),
        );
      }
    }
  });

// ============================================================================
// Parallel Saga Pattern
// ============================================================================

/**
 * Create a parallel saga where steps can run concurrently
 */
export const createParallelSaga = <Input, Output, Context = never>(
  name: string,
  steps: ReadonlyArray<SagaStep<Input, any>>,
  combineOutputs: (outputs: ReadonlyArray<any>) => Output,
): Saga<Input, Output, Context> => ({
  name,
  steps,
  execute: (input) =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        steps.map((step) =>
          pipe(
            step.execute(input),
            Effect.mapError((error) =>
              new SagaError(
                step.name,
                `Parallel step failed: ${step.name}`,
                error,
              )
            ),
          )
        ),
        { concurrency: "unbounded" },
      );

      return combineOutputs(results);
    }),
});

// ============================================================================
// Choreography Pattern
// ============================================================================

/**
 * Event-driven choreography
 */
export interface ChoreographyStep<Event extends { type: string }, Command> {
  readonly on: Event["type"];
  readonly execute: (
    event: Event,
  ) => Effect.Effect<ReadonlyArray<Command>, never>;
}

/**
 * Create choreography-based saga
 */
export const createChoreography = <Event extends { type: string }, Command>(
  name: string,
  steps: ReadonlyArray<ChoreographyStep<Event, Command>>,
) =>
(event: Event): Effect.Effect<ReadonlyArray<Command>, never> =>
  pipe(
    steps,
    ReadonlyArray.findFirst((step) => step.on === event.type),
    Option.match({
      onNone: () => Effect.succeed([]),
      onSome: (step) => step.execute(event),
    }),
  );

// ============================================================================
// Saga Manager
// ============================================================================

/**
 * Saga Manager - Manages saga execution and state
 */
export interface SagaManager<Event extends { type: string }, Command> {
  readonly start: <Data>(
    sagaId: string,
    saga: Saga<Event, Data>,
  ) => Effect.Effect<void, SagaError>;

  readonly handle: (
    event: Event,
  ) => Effect.Effect<ReadonlyArray<Command>, SagaError>;

  readonly getState: (
    sagaId: string,
  ) => Effect.Effect<Option.Option<SagaState<any>>, never>;

  readonly complete: (sagaId: string) => Effect.Effect<void, SagaError>;

  readonly fail: (
    sagaId: string,
    error: SagaError,
  ) => Effect.Effect<void, never>;
}

/**
 * Create in-memory saga manager
 */
export const createSagaManager = <
  Event extends { type: string },
  Command,
>(): Effect.Effect<
  SagaManager<Event, Command>,
  never
> =>
  Effect.gen(function* () {
    const sagas = yield* Ref.make(new Map<string, SagaState<any>>());
    const handlers = yield* Ref.make(new Map<string, Saga<Event, any>>());

    return {
      start: (sagaId, saga) =>
        Effect.gen(function* () {
          const state: SagaState<any> = {
            id: sagaId,
            type: saga.name,
            status: "running",
            data: null,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            compensations: [],
          };

          yield* Ref.update(sagas, (map) => {
            const newMap = new Map(map);
            newMap.set(sagaId, state);
            return newMap;
          });

          yield* Ref.update(handlers, (map) => {
            const newMap = new Map(map);
            newMap.set(sagaId, saga);
            return newMap;
          });
        }),

      handle: (event) =>
        Effect.gen(function* () {
          const currentHandlers = yield* Ref.get(handlers);
          const commands: Command[] = [];

          for (const [sagaId, saga] of currentHandlers) {
            const result = yield* pipe(
              saga.execute(event),
              Effect.map((output) => {
                // Update saga state
                Ref.update(sagas, (map) => {
                  const newMap = new Map(map);
                  const state = newMap.get(sagaId);
                  if (state) {
                    newMap.set(sagaId, {
                      ...state,
                      data: output,
                      updatedAt: Date.now(),
                    });
                  }
                  return newMap;
                });
                return output;
              }),
              Effect.catchAll((error) => {
                // Mark saga as failed
                Ref.update(sagas, (map) => {
                  const newMap = new Map(map);
                  const state = newMap.get(sagaId);
                  if (state) {
                    newMap.set(sagaId, {
                      ...state,
                      status: "failed",
                      error,
                      updatedAt: Date.now(),
                    });
                  }
                  return newMap;
                });
                return Effect.succeed(null);
              }),
            );

            if (result) {
              commands.push(result as Command);
            }
          }

          return commands;
        }),

      getState: (sagaId) =>
        Effect.gen(function* () {
          const currentSagas = yield* Ref.get(sagas);
          return Option.fromNullable(currentSagas.get(sagaId));
        }),

      complete: (sagaId) =>
        Effect.gen(function* () {
          yield* Ref.update(sagas, (map) => {
            const newMap = new Map(map);
            const state = newMap.get(sagaId);
            if (state) {
              newMap.set(sagaId, {
                ...state,
                status: "completed",
                completedAt: Date.now(),
                updatedAt: Date.now(),
              });
            }
            return newMap;
          });

          // Remove from active handlers
          yield* Ref.update(handlers, (map) => {
            const newMap = new Map(map);
            newMap.delete(sagaId);
            return newMap;
          });
        }),

      fail: (sagaId, error) =>
        Ref.update(sagas, (map) => {
          const newMap = new Map(map);
          const state = newMap.get(sagaId);
          if (state) {
            newMap.set(sagaId, {
              ...state,
              status: "failed",
              error,
              updatedAt: Date.now(),
            });
          }
          return newMap;
        }),
    };
  });

// ============================================================================
// Common Saga Patterns
// ============================================================================

/**
 * Timeout pattern - Fail saga if not completed within duration
 */
export const withTimeout = <Input, Output, Context>(
  saga: Saga<Input, Output, Context>,
  timeout: Duration.Duration,
): Saga<Input, Output, Context> => ({
  ...saga,
  execute: (input) =>
    pipe(
      saga.execute(input),
      Effect.timeout(timeout),
      Effect.mapError((error) =>
        error._tag === "TimeoutException"
          ? new SagaError(
            saga.name,
            `Saga timed out after ${Duration.toMillis(timeout)}ms`,
          )
          : error as SagaError
      ),
    ),
});

/**
 * Retry pattern - Retry saga on failure
 */
export const withRetry = <Input, Output, Context>(
  saga: Saga<Input, Output, Context>,
  schedule: Schedule.Schedule<Output, SagaError>,
): Saga<Input, Output, Context> => ({
  ...saga,
  execute: (input) =>
    pipe(
      saga.execute(input),
      Effect.retry(schedule),
    ),
});

/**
 * Circuit breaker pattern for sagas
 */
export const withCircuitBreaker = <Input, Output, Context>(
  saga: Saga<Input, Output, Context>,
  config: {
    maxFailures: number;
    resetTimeout: Duration.Duration;
  },
): Saga<Input, Output, Context> => {
  let failures = 0;
  let lastFailureTime = 0;
  let isOpen = false;

  return {
    ...saga,
    execute: (input) =>
      Effect.gen(function* () {
        // Check if circuit breaker should reset
        if (
          isOpen &&
          Date.now() - lastFailureTime > Duration.toMillis(config.resetTimeout)
        ) {
          isOpen = false;
          failures = 0;
        }

        // Fail fast if circuit is open
        if (isOpen) {
          return yield* Effect.fail(
            new SagaError(saga.name, "Circuit breaker is open"),
          );
        }

        return yield* pipe(
          saga.execute(input),
          Effect.tapError(() =>
            Effect.sync(() => {
              failures++;
              lastFailureTime = Date.now();
              if (failures >= config.maxFailures) {
                isOpen = true;
              }
            })
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              failures = 0;
            })
          ),
        );
      }),
  };
};
