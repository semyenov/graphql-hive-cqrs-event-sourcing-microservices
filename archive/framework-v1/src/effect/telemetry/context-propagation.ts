/**
 * Framework Effect: Context Propagation
 * 
 * Distributed tracing context propagation for CQRS/Event Sourcing.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as FiberRef from 'effect/FiberRef';
import * as Layer from 'effect/Layer';
import { pipe } from 'effect/Function';
import type { ICommand, IEvent, IQuery } from '../core/types';

/**
 * Trace context
 */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly flags: number;
  readonly baggage?: Record<string, string>;
}

/**
 * Correlation context
 */
export interface CorrelationContext {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly tenantId?: string;
}

/**
 * Complete context
 */
export interface DistributedContext {
  readonly trace: TraceContext;
  readonly correlation: CorrelationContext;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context tags
 */
export const TraceContextTag = Context.GenericTag<TraceContext>('TraceContext');
export const CorrelationContextTag = Context.GenericTag<CorrelationContext>('CorrelationContext');
export const DistributedContextTag = Context.GenericTag<DistributedContext>('DistributedContext');

/**
 * Generate trace ID
 */
const generateTraceId = (): string => {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Generate span ID
 */
const generateSpanId = (): string => {
  const buffer = new Uint8Array(8);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Create new trace context
 */
export const createTraceContext = (
  parent?: TraceContext
): TraceContext => ({
  traceId: parent?.traceId ?? generateTraceId(),
  spanId: generateSpanId(),
  parentSpanId: parent?.spanId,
  flags: parent?.flags ?? 1,
  baggage: parent?.baggage,
});

/**
 * Create correlation context
 */
export const createCorrelationContext = (
  correlationId?: string,
  causationId?: string
): CorrelationContext => ({
  correlationId: correlationId ?? generateTraceId(),
  causationId,
});

/**
 * With trace context
 */
export const withTraceContext = <R, E, A>(
  context: TraceContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.provideService(effect, TraceContextTag, context);

/**
 * With correlation context
 */
export const withCorrelationContext = <R, E, A>(
  context: CorrelationContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.provideService(effect, CorrelationContextTag, context);

/**
 * With distributed context
 */
export const withDistributedContext = <R, E, A>(
  context: DistributedContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.provideService(effect, DistributedContextTag, context);

/**
 * Get current trace context
 */
export const getTraceContext = (): Effect.Effect<TraceContext, never, TraceContext> =>
  TraceContextTag;

/**
 * Get current correlation context
 */
export const getCorrelationContext = (): Effect.Effect<CorrelationContext, never, CorrelationContext> =>
  CorrelationContextTag;

/**
 * Get current distributed context
 */
export const getDistributedContext = (): Effect.Effect<DistributedContext, never, DistributedContext> =>
  DistributedContextTag;

/**
 * Create child span
 */
export const createChildSpan = <R, E, A>(
  name: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | TraceContext> =>
  Effect.gen(function* (_) {
    const parentContext = yield* _(getTraceContext());
    const childContext = createTraceContext(parentContext);
    
    return yield* _(withTraceContext(childContext, effect));
  });

/**
 * Extract context from command
 */
export const extractContextFromCommand = (
  command: ICommand
): DistributedContext => {
  const metadata = command.metadata ?? {};
  
  return {
    trace: {
      traceId: (metadata.traceId as string) ?? generateTraceId(),
      spanId: (metadata.spanId as string) ?? generateSpanId(),
      parentSpanId: metadata.parentSpanId as string | undefined,
      flags: (metadata.traceFlags as number) ?? 1,
      baggage: metadata.baggage as Record<string, string> | undefined,
    },
    correlation: {
      correlationId: (metadata.correlationId as string) ?? command.id,
      causationId: metadata.causationId as string | undefined,
      userId: metadata.userId as string | undefined,
      sessionId: metadata.sessionId as string | undefined,
      tenantId: metadata.tenantId as string | undefined,
    },
    metadata: metadata as Record<string, unknown>,
  };
};

/**
 * Extract context from event
 */
export const extractContextFromEvent = (
  event: IEvent
): DistributedContext => {
  const metadata = event.metadata ?? {};
  
  return {
    trace: {
      traceId: (metadata.traceId as string) ?? generateTraceId(),
      spanId: (metadata.spanId as string) ?? generateSpanId(),
      parentSpanId: metadata.parentSpanId as string | undefined,
      flags: (metadata.traceFlags as number) ?? 1,
      baggage: metadata.baggage as Record<string, string> | undefined,
    },
    correlation: {
      correlationId: (metadata.correlationId as string) ?? event.id,
      causationId: (metadata.causationId as string) ?? event.id,
      userId: metadata.userId as string | undefined,
      sessionId: metadata.sessionId as string | undefined,
      tenantId: metadata.tenantId as string | undefined,
    },
    metadata: metadata as Record<string, unknown>,
  };
};

/**
 * Inject context into command
 */
export const injectContextIntoCommand = <C extends ICommand>(
  command: C,
  context: DistributedContext
): C => ({
  ...command,
  metadata: {
    ...command.metadata,
    traceId: context.trace.traceId,
    spanId: context.trace.spanId,
    parentSpanId: context.trace.parentSpanId,
    traceFlags: context.trace.flags,
    baggage: context.trace.baggage,
    correlationId: context.correlation.correlationId,
    causationId: context.correlation.causationId,
    userId: context.correlation.userId,
    sessionId: context.correlation.sessionId,
    tenantId: context.correlation.tenantId,
  },
});

/**
 * Inject context into event
 */
export const injectContextIntoEvent = <E extends IEvent>(
  event: E,
  context: DistributedContext
): E => ({
  ...event,
  metadata: {
    ...event.metadata,
    traceId: context.trace.traceId,
    spanId: context.trace.spanId,
    parentSpanId: context.trace.parentSpanId,
    traceFlags: context.trace.flags,
    baggage: context.trace.baggage,
    correlationId: context.correlation.correlationId,
    causationId: context.correlation.causationId,
    userId: context.correlation.userId,
    sessionId: context.correlation.sessionId,
    tenantId: context.correlation.tenantId,
  },
});

/**
 * Context propagation fiber ref
 */
export const contextFiberRef = FiberRef.unsafeMake<DistributedContext | null>(null);

/**
 * With fiber context
 */
export const withFiberContext = <R, E, A>(
  context: DistributedContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.locally(effect, contextFiberRef, context);

/**
 * Get fiber context
 */
export const getFiberContext = (): Effect.Effect<DistributedContext | null, never, never> =>
  FiberRef.get(contextFiberRef);

/**
 * Create context layer
 */
export const createContextLayer = (
  context: DistributedContext
): Layer.Layer<DistributedContext, never, never> =>
  Layer.succeed(DistributedContextTag, context);

/**
 * HTTP headers for context propagation
 */
export const TRACE_PARENT_HEADER = 'traceparent';
export const TRACE_STATE_HEADER = 'tracestate';
export const BAGGAGE_HEADER = 'baggage';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CAUSATION_ID_HEADER = 'x-causation-id';

/**
 * Extract context from HTTP headers
 */
export const extractContextFromHeaders = (
  headers: Record<string, string | string[] | undefined>
): DistributedContext => {
  const traceParent = headers[TRACE_PARENT_HEADER] as string | undefined;
  let trace: TraceContext;
  
  if (traceParent) {
    // Parse W3C Trace Context format: version-trace-id-parent-id-flags
    const parts = traceParent.split('-');
    trace = {
      traceId: parts[1] ?? generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: parts[2],
      flags: parseInt(parts[3] ?? '1', 16),
      baggage: headers[BAGGAGE_HEADER] ? 
        parseBaggage(headers[BAGGAGE_HEADER] as string) : undefined,
    };
  } else {
    trace = createTraceContext();
  }
  
  const correlation: CorrelationContext = {
    correlationId: (headers[CORRELATION_ID_HEADER] as string) ?? generateTraceId(),
    causationId: headers[CAUSATION_ID_HEADER] as string | undefined,
  };
  
  return {
    trace,
    correlation,
  };
};

/**
 * Inject context into HTTP headers
 */
export const injectContextIntoHeaders = (
  context: DistributedContext,
  headers: Record<string, string> = {}
): Record<string, string> => {
  const traceParent = `00-${context.trace.traceId}-${context.trace.spanId}-${context.trace.flags.toString(16).padStart(2, '0')}`;
  
  return {
    ...headers,
    [TRACE_PARENT_HEADER]: traceParent,
    [CORRELATION_ID_HEADER]: context.correlation.correlationId,
    ...(context.correlation.causationId && {
      [CAUSATION_ID_HEADER]: context.correlation.causationId,
    }),
    ...(context.trace.baggage && {
      [BAGGAGE_HEADER]: serializeBaggage(context.trace.baggage),
    }),
  };
};

/**
 * Parse baggage header
 */
const parseBaggage = (baggage: string): Record<string, string> => {
  const result: Record<string, string> = {};
  
  for (const pair of baggage.split(',')) {
    const [key, value] = pair.trim().split('=');
    if (key && value) {
      result[key] = decodeURIComponent(value);
    }
  }
  
  return result;
};

/**
 * Serialize baggage to header
 */
const serializeBaggage = (baggage: Record<string, string>): string =>
  Object.entries(baggage)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join(',');

/**
 * Context propagation middleware
 */
export const contextPropagationMiddleware = <R, E, A>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | DistributedContext> =>
  Effect.gen(function* (_) {
    const context = yield* _(getDistributedContext());
    const childContext = {
      ...context,
      trace: createTraceContext(context.trace),
    };
    
    return yield* _(withDistributedContext(childContext, effect));
  });