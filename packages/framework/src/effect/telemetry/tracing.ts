/**
 * Framework Effect: Distributed Tracing
 * 
 * OpenTelemetry tracing integration for observability.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';
import type { ICommand, IEvent, IQuery } from '../core/types';

/**
 * Span attributes for CQRS operations
 */
export interface CQRSSpanAttributes {
  readonly 'cqrs.operation.type': 'command' | 'event' | 'query' | 'saga';
  readonly 'cqrs.operation.name': string;
  readonly 'cqrs.aggregate.id'?: string;
  readonly 'cqrs.aggregate.type'?: string;
  readonly 'cqrs.event.type'?: string;
  readonly 'cqrs.command.type'?: string;
  readonly 'cqrs.query.type'?: string;
  readonly 'cqrs.correlation.id'?: string;
  readonly 'cqrs.causation.id'?: string;
  readonly 'cqrs.user.id'?: string;
}

/**
 * Span context
 */
export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly traceFlags: number;
  readonly traceState?: string;
}

/**
 * Span interface
 */
export interface Span {
  readonly context: SpanContext;
  readonly setAttribute: (key: string, value: string | number | boolean) => void;
  readonly addEvent: (name: string, attributes?: Record<string, unknown>) => void;
  readonly setStatus: (status: SpanStatus) => void;
  readonly end: () => void;
}

/**
 * Span status
 */
export type SpanStatus = 
  | { code: 'OK' }
  | { code: 'ERROR'; message?: string }
  | { code: 'UNSET' };

/**
 * Tracer interface
 */
export interface Tracer {
  readonly startSpan: (
    name: string,
    options?: {
      parent?: SpanContext;
      attributes?: Record<string, unknown>;
      kind?: SpanKind;
    }
  ) => Span;
}

/**
 * Span kind
 */
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

/**
 * Tracing service
 */
export interface TracingService {
  readonly tracer: Tracer;
  readonly withSpan: <R, E, A>(
    name: string,
    attributes: Record<string, unknown>,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
}

/**
 * Tracing service tag
 */
export const TracingService = Context.GenericTag<TracingService>('TracingService');

/**
 * Mock tracer for testing
 */
export const createMockTracer = (): Tracer => {
  const generateId = () => Math.random().toString(36).substring(2, 18);
  
  return {
    startSpan: (name, options) => {
      const context: SpanContext = {
        traceId: generateId(),
        spanId: generateId(),
        parentSpanId: options?.parent?.spanId,
        traceFlags: 1,
      };
      
      console.log(`[TRACE] Starting span: ${name}`, {
        traceId: context.traceId,
        spanId: context.spanId,
        attributes: options?.attributes,
      });
      
      return {
        context,
        setAttribute: (key, value) => {
          console.log(`[TRACE] Set attribute: ${key}=${value}`);
        },
        addEvent: (name, attributes) => {
          console.log(`[TRACE] Event: ${name}`, attributes);
        },
        setStatus: (status) => {
          console.log(`[TRACE] Status: ${status.code}`);
        },
        end: () => {
          console.log(`[TRACE] Span ended: ${name}`);
        },
      };
    },
  };
};

/**
 * Create tracing service layer
 */
export const TracingServiceLive = Layer.succeed(
  TracingService,
  {
    tracer: createMockTracer(),
    withSpan: <R, E, A>(
      name: string,
      attributes: Record<string, unknown>,
      effect: Effect.Effect<A, E, R>
    ) =>
      Effect.gen(function* () {
        const tracer = createMockTracer();
        const span = tracer.startSpan(name, { attributes });
        
        try {
          const result = yield* effect;
          span.setStatus({ code: 'OK' });
          return result;
        } catch (error) {
          span.setStatus({ 
            code: 'ERROR', 
            message: error instanceof Error ? error.message : String(error) 
          });
          throw error;
        } finally {
          span.end();
        }
      }),
  }
);

/**
 * Tracing helpers for CQRS operations
 */
export const TracingHelpers = {
  /**
   * Trace command execution
   */
  traceCommand: <C extends ICommand, R, E, A>(
    command: C,
    handler: (cmd: C) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | TracingService> =>
    Effect.gen(function* () {
      const tracing = yield* TracingService;
      
      const attributes: CQRSSpanAttributes = {
        'cqrs.operation.type': 'command',
        'cqrs.operation.name': `command.${command.type}`,
        'cqrs.command.type': command.type,
        'cqrs.aggregate.id': command.aggregateId,
      };
      
      if ((command as any).metadata?.correlationId) {
        attributes['cqrs.correlation.id'] = (command as any).metadata.correlationId;
      }
      
      return yield* tracing.withSpan(
        `command.${command.type}`,
        attributes,
        handler(command)
      );
    }),
  
  /**
   * Trace event processing
   */
  traceEvent: <E extends IEvent, R, Err, A>(
    event: E,
    processor: (evt: E) => Effect.Effect<A, Err, R>
  ): Effect.Effect<A, Err, R | TracingService> =>
    Effect.gen(function* () {
      const tracing = yield* TracingService;
      
      const attributes: CQRSSpanAttributes = {
        'cqrs.operation.type': 'event',
        'cqrs.operation.name': `event.${event.type}`,
        'cqrs.event.type': event.type,
        'cqrs.aggregate.id': event.aggregateId,
      };
      
      return yield* tracing.withSpan(
        `event.${event.type}`,
        attributes,
        processor(event)
      );
    }),
  
  /**
   * Trace query execution
   */
  traceQuery: <Q extends IQuery, R, E, A>(
    query: Q,
    handler: (qry: Q) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | TracingService> =>
    Effect.gen(function* () {
      const tracing = yield* TracingService;
      
      const attributes: CQRSSpanAttributes = {
        'cqrs.operation.type': 'query',
        'cqrs.operation.name': `query.${query.type}`,
        'cqrs.query.type': query.type,
      };
      
      return yield* tracing.withSpan(
        `query.${query.type}`,
        attributes,
        handler(query)
      );
    }),
  
  /**
   * Trace saga step
   */
  traceSagaStep: <R, E, A>(
    sagaId: string,
    stepName: string,
    step: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | TracingService> =>
    Effect.gen(function* () {
      const tracing = yield* TracingService;
      
      const attributes: CQRSSpanAttributes = {
        'cqrs.operation.type': 'saga',
        'cqrs.operation.name': `saga.${stepName}`,
        'cqrs.correlation.id': sagaId,
      };
      
      return yield* tracing.withSpan(
        `saga.${stepName}`,
        attributes,
        step
      );
    }),
};

/**
 * Automatic instrumentation for Effects
 */
export const instrument = <R, E, A>(
  name: string,
  effect: Effect.Effect<A, E, R>,
  attributes?: Record<string, unknown>
): Effect.Effect<A, E, R | TracingService> =>
  Effect.gen(function* () {
    const tracing = yield* TracingService;
    return yield* tracing.withSpan(name, attributes ?? {}, effect);
  });

/**
 * Create child span
 */
export const withChildSpan = <R, E, A>(
  name: string,
  parentContext: SpanContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | TracingService> =>
  Effect.gen(function* () {
    const tracing = yield* TracingService;
    const span = tracing.tracer.startSpan(name, { parent: parentContext });
    
    try {
      const result = yield* effect;
      span.setStatus({ code: 'OK' });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: 'ERROR', 
        message: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    } finally {
      span.end();
    }
  });

/**
 * Baggage for context propagation
 */
export interface Baggage {
  readonly items: Map<string, string>;
}

export const Baggage = {
  empty: (): Baggage => ({ items: new Map() }),
  
  set: (baggage: Baggage, key: string, value: string): Baggage => ({
    items: new Map([...baggage.items, [key, value]]),
  }),
  
  get: (baggage: Baggage, key: string): string | undefined =>
    baggage.items.get(key),
  
  getAll: (baggage: Baggage): Map<string, string> =>
    new Map(baggage.items),
};

/**
 * Span link for relating spans
 */
export interface SpanLink {
  readonly context: SpanContext;
  readonly attributes?: Record<string, unknown>;
}

/**
 * Create span link
 */
export const createSpanLink = (
  context: SpanContext,
  attributes?: Record<string, unknown>
): SpanLink => ({
  context,
  attributes,
});

/**
 * Sampling decision
 */
export type SamplingDecision = 'RECORD_AND_SAMPLE' | 'RECORD_ONLY' | 'DROP';

/**
 * Sampler for trace sampling
 */
export interface Sampler {
  readonly shouldSample: (
    parentContext: SpanContext | undefined,
    traceId: string,
    name: string,
    attributes: Record<string, unknown>
  ) => SamplingDecision;
}

/**
 * Always sample
 */
export const AlwaysSample: Sampler = {
  shouldSample: () => 'RECORD_AND_SAMPLE',
};

/**
 * Never sample
 */
export const NeverSample: Sampler = {
  shouldSample: () => 'DROP',
};

/**
 * Probability sampler
 */
export const ProbabilitySampler = (probability: number): Sampler => ({
  shouldSample: (parentContext, traceId) => {
    // Use trace ID for consistent sampling decision
    const hash = traceId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    
    const threshold = probability * 0xffffffff;
    return Math.abs(hash) < threshold ? 'RECORD_AND_SAMPLE' : 'DROP';
  },
});