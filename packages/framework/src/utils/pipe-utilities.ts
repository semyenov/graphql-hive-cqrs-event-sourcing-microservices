/**
 * 🛠️ Pipe Pattern Utilities Library
 * 
 * Comprehensive utility functions for working with pipe patterns
 * Includes helpers, combinators, and advanced patterns
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as Either from "effect/Either"
import * as Duration from "effect/Duration"
import * as Schedule from "effect/Schedule"
import * as Metric from "effect/Metric"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { pipe } from "effect/Function"

// ============================================================================
// Conditional Operators
// ============================================================================

/**
 * 🎯 Conditional execution in pipe
 * Execute effect only if condition is true
 */
export const when = <A, E, R>(
  condition: boolean | ((a: A) => boolean),
  effect: Effect.Effect<A, E, R>
) => (value: A): Effect.Effect<A, E, R> => {
  const shouldExecute = typeof condition === "function" ? condition(value) : condition
  return shouldExecute ? effect : Effect.succeed(value)
}

/**
 * 🎯 Unless - opposite of when
 */
export const unless = <A, E, R>(
  condition: boolean | ((a: A) => boolean),
  effect: Effect.Effect<A, E, R>
) => (value: A): Effect.Effect<A, E, R> =>
  when((a) => !(typeof condition === "function" ? condition(a) : condition), effect)(value)

/**
 * 🎯 Switch case for pipe patterns
 */
export const switchCase = <A, B, E, R>(
  cases: Array<{
    when: (a: A) => boolean
    then: (a: A) => Effect.Effect<B, E, R>
  }>,
  defaultCase: (a: A) => Effect.Effect<B, E, R>
) => (value: A): Effect.Effect<B, E, R> => {
  const matchedCase = cases.find((c) => c.when(value))
  return matchedCase ? matchedCase.then(value) : defaultCase(value)
}

// ============================================================================
// Tapping Utilities
// ============================================================================

/**
 * 🎯 Tap with condition
 */
export const tapWhen = <A, E, R>(
  condition: (a: A) => boolean,
  f: (a: A) => Effect.Effect<any, E, R>
) => (value: A): Effect.Effect<A, E, R> =>
  condition(value)
    ? pipe(f(value), Effect.map(() => value))
    : Effect.succeed(value)

/**
 * 🎯 Tap with logging
 */
export const tapLog = <A>(
  message: string | ((a: A) => string)
) => (value: A): Effect.Effect<A, never, never> =>
  pipe(
    Effect.log(typeof message === "function" ? message(value) : message),
    Effect.map(() => value)
  )

/**
 * 🎯 Tap with metrics
 */
export const tapMetric = <A>(
  metric: Metric.Metric<any, any, any>,
  value: number | ((a: A) => number)
) => (input: A): Effect.Effect<A, never, never> =>
  pipe(
    Metric.update(metric, typeof value === "function" ? value(input) : value),
    Effect.map(() => input)
  )

// ============================================================================
// Retry and Resilience
// ============================================================================

/**
 * 🎯 Retry with exponential backoff
 */
export const retryExponential = <A, E, R>(
  maxRetries: number = 3,
  baseDelay: Duration.Duration = Duration.millis(100)
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.retry(
      Schedule.exponential(baseDelay).pipe(
        Schedule.jittered,
        Schedule.compose(Schedule.recurs(maxRetries))
      )
    )
  )

/**
 * 🎯 Circuit breaker pattern
 */
export const circuitBreaker = <A, E, R>(
  maxFailures: number = 5,
  resetTimeout: Duration.Duration = Duration.seconds(60)
) => {
  let failures = 0
  let lastFailureTime = 0
  let isOpen = false

  return (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | CircuitBreakerError, R> =>
    pipe(
      Effect.sync(() => {
        const now = Date.now()
        if (isOpen && now - lastFailureTime > Duration.toMillis(resetTimeout)) {
          isOpen = false
          failures = 0
        }
        return isOpen
      }),
      Effect.flatMap((open) =>
        open
          ? Effect.fail(new CircuitBreakerError("Circuit breaker is open"))
          : pipe(
              effect,
              Effect.tapBoth({
                onFailure: () =>
                  Effect.sync(() => {
                    failures++
                    lastFailureTime = Date.now()
                    if (failures >= maxFailures) {
                      isOpen = true
                    }
                  }),
                onSuccess: () =>
                  Effect.sync(() => {
                    failures = 0
                  }),
              })
            )
      )
    )
}

export class CircuitBreakerError {
  readonly _tag = "CircuitBreakerError"
  constructor(readonly message: string) {}
}

// ============================================================================
// Caching Utilities
// ============================================================================

/**
 * 🎯 Memoization for pipe functions
 */
export const memoize = <A, B, E, R>(
  f: (a: A) => Effect.Effect<B, E, R>,
  keyFn: (a: A) => string = JSON.stringify
) => {
  const cache = new Map<string, B>()
  
  return (value: A): Effect.Effect<B, E, R> => {
    const key = keyFn(value)
    const cached = cache.get(key)
    
    if (cached !== undefined) {
      return Effect.succeed(cached)
    }
    
    return pipe(
      f(value),
      Effect.tap((result) =>
        Effect.sync(() => {
          cache.set(key, result)
        })
      )
    )
  }
}

/**
 * 🎯 TTL cache for effects
 */
export const withTTLCache = <A, B, E, R>(
  ttl: Duration.Duration,
  keyFn: (a: A) => string = JSON.stringify
) => {
  const cache = new Map<string, { value: B; expiry: number }>()
  
  return (f: (a: A) => Effect.Effect<B, E, R>) =>
    (value: A): Effect.Effect<B, E, R> => {
      const key = keyFn(value)
      const cached = cache.get(key)
      const now = Date.now()
      
      if (cached && cached.expiry > now) {
        return Effect.succeed(cached.value)
      }
      
      return pipe(
        f(value),
        Effect.tap((result) =>
          Effect.sync(() => {
            cache.set(key, {
              value: result,
              expiry: now + Duration.toMillis(ttl),
            })
          })
        )
      )
    }
}

// ============================================================================
// Stream Utilities
// ============================================================================

/**
 * 🎯 Batch processing with pipe
 */
export const processBatch = <A, B, E, R>(
  batchSize: number,
  processor: (batch: ReadonlyArray<A>) => Effect.Effect<ReadonlyArray<B>, E, R>
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<B, E, R> =>
  pipe(
    stream,
    Stream.grouped(batchSize),
    Stream.mapEffect(processor),
    Stream.flatMap(Stream.fromIterable)
  )

/**
 * 🎯 Rate limiting for streams
 */
export const rateLimit = <A, E, R>(
  maxPerSecond: number
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<A, E, R> => {
  const delay = Duration.millis(1000 / maxPerSecond)
  return pipe(
    stream,
    Stream.mapEffect((item) =>
      pipe(
        Effect.sleep(delay),
        Effect.map(() => item)
      )
    )
  )
}

/**
 * 🎯 Stream windowing
 */
export const window = <A, E, R>(
  windowSize: Duration.Duration
) => (stream: Stream.Stream<A, E, R>): Stream.Stream<ReadonlyArray<A>, E, R> =>
  pipe(
    stream,
    Stream.groupedWithin(Number.MAX_SAFE_INTEGER, windowSize)
  )

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * 🎯 Validation pipeline
 */
export const validate = <A, E>(
  validators: ReadonlyArray<(a: A) => Effect.Effect<void, E>>
) => (value: A): Effect.Effect<A, E> =>
  pipe(
    Effect.all(validators.map((v) => v(value)), { discard: true }),
    Effect.map(() => value)
  )

/**
 * 🎯 Validation with accumulation
 */
export const validateAll = <A, E>(
  validators: ReadonlyArray<(a: A) => Either.Either<E, void>>
) => (value: A): Effect.Effect<A, ReadonlyArray<E>> => {
  const errors = validators
    .map((v) => v(value))
    .filter(Either.isLeft)
    .map((e) => e.left)
  
  return errors.length > 0
    ? Effect.fail(errors)
    : Effect.succeed(value)
}

// ============================================================================
// Parallel Execution
// ============================================================================

/**
 * 🎯 Parallel map for arrays
 */
export const parallelMap = <A, B, E, R>(
  f: (a: A) => Effect.Effect<B, E, R>,
  concurrency: number = Number.MAX_SAFE_INTEGER
) => (items: ReadonlyArray<A>): Effect.Effect<ReadonlyArray<B>, E, R> =>
  Effect.forEach(items, f, { concurrency })

/**
 * 🎯 Race multiple effects
 */
export const race = <A, E, R>(
  effects: ReadonlyArray<Effect.Effect<A, E, R>>
) => Effect.raceAll(effects)

// ============================================================================
// Debugging Utilities
// ============================================================================

/**
 * 🎯 Debug tap - logs value and passes through
 */
export const debug = <A>(
  label: string = "Debug"
) => (value: A): Effect.Effect<A, never, never> =>
  pipe(
    Effect.sync(() => {
      console.log(`[${label}]`, value)
      return value
    })
  )

/**
 * 🎯 Performance timing
 */
export const timed = <A, E, R>(
  label: string
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
  const start = Date.now()
  return pipe(
    effect,
    Effect.tap(() =>
      Effect.sync(() => {
        console.log(`[${label}] took ${Date.now() - start}ms`)
      })
    )
  )
}

/**
 * 🎯 Trace execution path
 */
export const trace = <A>(
  label: string
) => (value: A): Effect.Effect<A, never, never> =>
  pipe(
    Effect.sync(() => {
      console.trace(`[Trace: ${label}]`, value)
      return value
    })
  )

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * 🎯 Convert Promise to Effect
 */
export const fromPromise = <A>(
  promise: () => Promise<A>
): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: promise,
    catch: (error) => new Error(String(error)),
  })

/**
 * 🎯 Convert callback to Effect
 */
export const fromCallback = <A>(
  fn: (callback: (error: Error | null, result?: A) => void) => void
): Effect.Effect<A, Error> =>
  Effect.async<A, Error>((resume) => {
    fn((error, result) => {
      if (error) {
        resume(Effect.fail(error))
      } else {
        resume(Effect.succeed(result!))
      }
    })
  })

// ============================================================================
// Composition Utilities
// ============================================================================

/**
 * 🎯 Kleisli composition for Effects
 */
export const compose = <A, B, C, E1, E2, R1, R2>(
  f: (a: A) => Effect.Effect<B, E1, R1>,
  g: (b: B) => Effect.Effect<C, E2, R2>
) => (a: A): Effect.Effect<C, E1 | E2, R1 | R2> =>
  pipe(f(a), Effect.flatMap(g))

/**
 * 🎯 Pipeline builder
 */
export class PipelineBuilder<A, E = never, R = never> {
  constructor(private effect: Effect.Effect<A, E, R>) {}

  static of<T>(value: T): PipelineBuilder<T> {
    return new PipelineBuilder(Effect.succeed(value))
  }

  map<B>(f: (a: A) => B): PipelineBuilder<B, E, R> {
    return new PipelineBuilder(pipe(this.effect, Effect.map(f)))
  }

  flatMap<B, E2, R2>(
    f: (a: A) => Effect.Effect<B, E2, R2>
  ): PipelineBuilder<B, E | E2, R | R2> {
    return new PipelineBuilder(pipe(this.effect, Effect.flatMap(f)))
  }

  tap<E2, R2>(
    f: (a: A) => Effect.Effect<any, E2, R2>
  ): PipelineBuilder<A, E | E2, R | R2> {
    return new PipelineBuilder(pipe(this.effect, Effect.tap(f)))
  }

  filter(
    predicate: (a: A) => boolean,
    error: E
  ): PipelineBuilder<A, E, R> {
    return new PipelineBuilder(
      pipe(
        this.effect,
        Effect.filterOrFail(predicate, () => error)
      )
    )
  }

  catchAll<B, E2, R2>(
    f: (e: E) => Effect.Effect<B, E2, R2>
  ): PipelineBuilder<A | B, E2, R | R2> {
    return new PipelineBuilder(pipe(this.effect, Effect.catchAll(f)))
  }

  build(): Effect.Effect<A, E, R> {
    return this.effect
  }

  run(): Promise<A> {
    return Effect.runPromise(this.effect)
  }
}

// ============================================================================
// Advanced Patterns
// ============================================================================

/**
 * 🎯 Saga pattern helper
 */
export const saga = <State, Event, Error, Requirements>(
  initialState: State,
  steps: Array<{
    match: (event: Event) => boolean
    handle: (state: State, event: Event) => Effect.Effect<State, Error, Requirements>
  }>
) => (event: Event): Effect.Effect<State, Error, Requirements> => {
  const step = steps.find((s) => s.match(event))
  return step
    ? step.handle(initialState, event)
    : Effect.succeed(initialState)
}

/**
 * 🎯 Event sourcing fold
 */
export const eventFold = <State, Event>(
  initialState: State,
  reducer: (state: State, event: Event) => State
) => (events: ReadonlyArray<Event>): State =>
  events.reduce(reducer, initialState)

/**
 * 🎯 CQRS command pipeline
 */
export const commandPipeline = <Command, Event, Error, Requirements>(
  validate: (cmd: Command) => Effect.Effect<void, Error, Requirements>,
  execute: (cmd: Command) => Effect.Effect<ReadonlyArray<Event>, Error, Requirements>,
  persist: (events: ReadonlyArray<Event>) => Effect.Effect<void, Error, Requirements>
) => (command: Command): Effect.Effect<ReadonlyArray<Event>, Error, Requirements> =>
  pipe(
    validate(command),
    Effect.flatMap(() => execute(command)),
    Effect.tap(persist)
  )

// ============================================================================
// Export all utilities
// ============================================================================

export default {
  // Conditionals
  when,
  unless,
  switchCase,
  
  // Tapping
  tapWhen,
  tapLog,
  tapMetric,
  
  // Resilience
  retryExponential,
  circuitBreaker,
  
  // Caching
  memoize,
  withTTLCache,
  
  // Streams
  processBatch,
  rateLimit,
  window,
  
  // Validation
  validate,
  validateAll,
  
  // Parallel
  parallelMap,
  race,
  
  // Debugging
  debug,
  timed,
  trace,
  
  // Conversion
  fromPromise,
  fromCallback,
  
  // Composition
  compose,
  PipelineBuilder,
  
  // Advanced
  saga,
  eventFold,
  commandPipeline,
}