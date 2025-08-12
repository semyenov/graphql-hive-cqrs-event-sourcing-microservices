/**
 * 🔍 Distributed Tracing for Pipe Patterns
 * 
 * OpenTelemetry integration for observability across pipe patterns
 * Automatic span creation, context propagation, and metrics collection
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as Ref from "effect/Ref"
import * as HashMap from "effect/HashMap"
import { pipe } from "effect/Function"

// ============================================================================
// Tracing Types
// ============================================================================

export interface Span {
  readonly spanId: string
  readonly traceId: string
  readonly parentSpanId?: string
  readonly operationName: string
  readonly startTime: number
  readonly endTime?: number
  readonly duration?: number
  readonly tags: Record<string, any>
  readonly logs: Array<{ timestamp: number; message: string; level: string }>
  readonly status: "in_progress" | "success" | "error"
  readonly error?: any
}

export interface TraceContext {
  readonly traceId: string
  readonly spanId: string
  readonly baggage: Record<string, string>
}

export interface TracingService {
  readonly startSpan: (
    operationName: string,
    parentContext?: TraceContext
  ) => Effect.Effect<Span>
  readonly finishSpan: (
    span: Span,
    status: "success" | "error",
    error?: any
  ) => Effect.Effect<void>
  readonly addTags: (
    span: Span,
    tags: Record<string, any>
  ) => Effect.Effect<void>
  readonly addLog: (
    span: Span,
    message: string,
    level?: string
  ) => Effect.Effect<void>
  readonly getActiveSpan: () => Effect.Effect<Span | null>
  readonly withSpan: <A, E, R>(
    operationName: string,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
  readonly extractContext: (headers: Record<string, string>) => TraceContext | null
  readonly injectContext: (context: TraceContext) => Record<string, string>
}

export const TracingService = Context.GenericTag<TracingService>("TracingService")

// ============================================================================
// Span ID Generation
// ============================================================================

const generateId = (): string => {
  const chars = "0123456789abcdef"
  let id = ""
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

// ============================================================================
// Tracing Implementation
// ============================================================================

export const TracingServiceLive = Layer.effect(
  TracingService,
  Effect.gen(function* () {
    const spans = yield* Ref.make(HashMap.empty<string, Span>())
    const activeSpanStack = yield* Ref.make<Array<Span>>([])
    const metrics = yield* Ref.make({
      totalSpans: 0,
      successfulSpans: 0,
      failedSpans: 0,
      averageDuration: 0,
    })

    return {
      startSpan: (operationName, parentContext) =>
        Effect.gen(function* () {
          const traceId = parentContext?.traceId || generateId()
          const spanId = generateId()
          const parentSpanId = parentContext?.spanId

          const span: Span = {
            spanId,
            traceId,
            parentSpanId,
            operationName,
            startTime: Date.now(),
            tags: {},
            logs: [],
            status: "in_progress",
          }

          yield* Ref.update(spans, HashMap.set(spanId, span))
          yield* Ref.update(activeSpanStack, (stack) => [...stack, span])
          yield* Ref.update(metrics, (m) => ({ ...m, totalSpans: m.totalSpans + 1 }))

          return span
        }),

      finishSpan: (span, status, error) =>
        Effect.gen(function* () {
          const endTime = Date.now()
          const duration = endTime - span.startTime

          const finishedSpan: Span = {
            ...span,
            endTime,
            duration,
            status,
            error,
          }

          yield* Ref.update(spans, HashMap.set(span.spanId, finishedSpan))
          yield* Ref.update(activeSpanStack, (stack) =>
            stack.filter((s) => s.spanId !== span.spanId)
          )

          // Update metrics
          yield* Ref.update(metrics, (m) => {
            const newSuccessful = status === "success" ? m.successfulSpans + 1 : m.successfulSpans
            const newFailed = status === "error" ? m.failedSpans + 1 : m.failedSpans
            const totalDuration = m.averageDuration * (m.totalSpans - 1) + duration
            const newAverage = totalDuration / m.totalSpans

            return {
              ...m,
              successfulSpans: newSuccessful,
              failedSpans: newFailed,
              averageDuration: newAverage,
            }
          })

          // Export span (in real implementation, send to collector)
          if (process.env.TRACING_ENABLED === "true") {
            console.log(`[TRACE] ${span.operationName} - ${duration}ms - ${status}`)
          }
        }),

      addTags: (span, tags) =>
        Ref.update(spans, (map) => {
          const current = HashMap.get(map, span.spanId)
          return current.value
            ? HashMap.set(map, span.spanId, { ...current.value, tags: { ...current.value.tags, ...tags } })
            : map
        }),

      addLog: (span, message, level = "info") =>
        Ref.update(spans, (map) => {
          const current = HashMap.get(map, span.spanId)
          return current.value
            ? HashMap.set(map, span.spanId, {
                ...current.value,
                logs: [...current.value.logs, { timestamp: Date.now(), message, level }],
              })
            : map
        }),

      getActiveSpan: () =>
        Ref.get(activeSpanStack).pipe(
          Effect.map((stack) => stack[stack.length - 1] || null)
        ),

      withSpan: (operationName, effect) =>
        Effect.gen(function* () {
          const service = yield* TracingService
          const parentSpan = yield* service.getActiveSpan()
          const parentContext = parentSpan
            ? { traceId: parentSpan.traceId, spanId: parentSpan.spanId, baggage: {} }
            : undefined

          const span = yield* service.startSpan(operationName, parentContext)

          return yield* pipe(
            effect,
            Effect.tapBoth({
              onFailure: (error) =>
                service.finishSpan(span, "error", error),
              onSuccess: () =>
                service.finishSpan(span, "success"),
            })
          )
        }),

      extractContext: (headers) => {
        const traceId = headers["x-trace-id"]
        const spanId = headers["x-span-id"]
        const baggage = headers["x-baggage"]
          ? JSON.parse(headers["x-baggage"])
          : {}

        return traceId && spanId
          ? { traceId, spanId, baggage }
          : null
      },

      injectContext: (context) => ({
        "x-trace-id": context.traceId,
        "x-span-id": context.spanId,
        "x-baggage": JSON.stringify(context.baggage),
      }),
    }
  })
)

// ============================================================================
// Tracing Operators for Pipe Patterns
// ============================================================================

/**
 * 🎯 Trace a pipe operation
 */
export const traced = <A, E, R>(
  operationName: string,
  tags?: Record<string, any>
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | TracingService> =>
  pipe(
    TracingService,
    Effect.flatMap((service) =>
      service.withSpan(
        operationName,
        pipe(
          effect,
          Effect.tap(() =>
            tags
              ? pipe(
                  service.getActiveSpan(),
                  Effect.flatMap((span) =>
                    span ? service.addTags(span, tags) : Effect.void
                  )
                )
              : Effect.void
          )
        )
      )
    )
  )

/**
 * 🎯 Add span tags in pipe
 */
export const withTags = <A>(
  tags: Record<string, any> | ((a: A) => Record<string, any>)
) => (value: A): Effect.Effect<A, never, TracingService> =>
  pipe(
    TracingService,
    Effect.flatMap((service) =>
      pipe(
        service.getActiveSpan(),
        Effect.flatMap((span) =>
          span
            ? service.addTags(
                span,
                typeof tags === "function" ? tags(value) : tags
              )
            : Effect.void
        ),
        Effect.map(() => value)
      )
    )
  )

/**
 * 🎯 Log to active span
 */
export const spanLog = <A>(
  message: string | ((a: A) => string),
  level: string = "info"
) => (value: A): Effect.Effect<A, never, TracingService> =>
  pipe(
    TracingService,
    Effect.flatMap((service) =>
      pipe(
        service.getActiveSpan(),
        Effect.flatMap((span) =>
          span
            ? service.addLog(
                span,
                typeof message === "function" ? message(value) : message,
                level
              )
            : Effect.void
        ),
        Effect.map(() => value)
      )
    )
  )

/**
 * 🎯 Measure operation duration
 */
export const measured = <A, E, R>(
  metricName: string
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | TracingService> => {
  const startTime = Date.now()
  
  return pipe(
    effect,
    Effect.tap(() =>
      pipe(
        TracingService,
        Effect.flatMap((service) =>
          pipe(
            service.getActiveSpan(),
            Effect.flatMap((span) =>
              span
                ? service.addTags(span, {
                    [`${metricName}.duration`]: Date.now() - startTime,
                  })
                : Effect.void
            )
          )
        )
      )
    )
  )
}

// ============================================================================
// Distributed Context Propagation
// ============================================================================

/**
 * 🎯 Propagate trace context through pipe
 */
export const propagateContext = <A, E, R>(
  headers: Record<string, string>
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | TracingService> =>
  pipe(
    TracingService,
    Effect.flatMap((service) => {
      const context = service.extractContext(headers)
      
      return context
        ? service.withSpan("remote-call", effect)
        : effect
    })
  )

/**
 * 🎯 Extract context for outgoing calls
 */
export const extractTraceHeaders = (): Effect.Effect<
  Record<string, string>,
  never,
  TracingService
> =>
  pipe(
    TracingService,
    Effect.flatMap((service) =>
      pipe(
        service.getActiveSpan(),
        Effect.map((span) =>
          span
            ? service.injectContext({
                traceId: span.traceId,
                spanId: span.spanId,
                baggage: {},
              })
            : {}
        )
      )
    )
  )

// ============================================================================
// Trace Visualization
// ============================================================================

export interface TraceVisualization {
  readonly getTraceTree: (traceId: string) => Effect.Effect<TraceNode>
  readonly getTraceTimeline: (traceId: string) => Effect.Effect<Timeline>
  readonly getTraceMetrics: (traceId: string) => Effect.Effect<TraceMetrics>
}

export interface TraceNode {
  span: Span
  children: TraceNode[]
}

export interface Timeline {
  startTime: number
  endTime: number
  spans: Array<{
    span: Span
    relativeStart: number
    duration: number
  }>
}

export interface TraceMetrics {
  totalDuration: number
  spanCount: number
  errorCount: number
  criticalPath: Span[]
}

// ============================================================================
// Example: Traced Command Processing
// ============================================================================

/**
 * 🎯 Example of traced command processing pipeline
 */
export const tracedCommandPipeline = <Command, Event, Error>(
  command: Command
): Effect.Effect<ReadonlyArray<Event>, Error, TracingService> =>
  pipe(
    Effect.succeed(command),
    traced("command.validate", { commandType: (command as any).type }),
    Effect.tap(spanLog("Validating command")),
    Effect.flatMap((cmd) =>
      pipe(
        Effect.succeed(cmd),
        traced("command.execute"),
        Effect.tap(withTags({ aggregateId: (cmd as any).aggregateId })),
        Effect.map(() => [] as ReadonlyArray<Event>)
      )
    ),
    traced("command.persist"),
    Effect.tap(spanLog((events) => `Persisted ${events.length} events`)),
    measured("command.total")
  )

// ============================================================================
// Monitoring Integration
// ============================================================================

export const MetricsExporter = Layer.effect(
  Context.GenericTag<{
    export: (span: Span) => Effect.Effect<void>
  }>("MetricsExporter"),
  Effect.succeed({
    export: (span: Span) =>
      Effect.sync(() => {
        // In production, send to Prometheus, DataDog, etc.
        if (span.duration) {
          console.log(`[METRIC] ${span.operationName}_duration_ms ${span.duration}`)
        }
        if (span.status === "error") {
          console.log(`[METRIC] ${span.operationName}_errors_total 1`)
        }
      }),
  })
)

// ============================================================================
// Export all tracing utilities
// ============================================================================

export default {
  // Core
  TracingService,
  TracingServiceLive,
  
  // Operators
  traced,
  withTags,
  spanLog,
  measured,
  
  // Context
  propagateContext,
  extractTraceHeaders,
  
  // Example
  tracedCommandPipeline,
  
  // Monitoring
  MetricsExporter,
}