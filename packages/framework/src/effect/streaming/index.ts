/**
 * Framework Effect: Streaming Module
 * 
 * Stream processing with backpressure, windowing, and event stream support.
 * Provides high-performance streaming for CQRS/Event Sourcing.
 */

// Core stream processing
export * from './event-stream';

// Streaming projections
export * from './projections-stream';

// Stream operators
export * from './operators';

// Stream sinks
export * from './sinks';

/**
 * Quick reference for streaming:
 * 
 * 1. Event Streams:
 * ```typescript
 * import { createEventStream } from '@cqrs/framework/effect/streaming';
 * 
 * const stream = createEventStream({
 *   source: eventStore,
 *   fromPosition: 0,
 *   batchSize: 100,
 *   backpressure: true
 * });
 * 
 * await stream
 *   .filter((event) => event.type === 'UserCreated')
 *   .map((event) => event.data)
 *   .runForeach((data) => console.log(data));
 * ```
 * 
 * 2. Streaming Projections:
 * ```typescript
 * import { createStreamingProjection } from '@cqrs/framework/effect/streaming';
 * 
 * const projection = createStreamingProjection({
 *   name: 'UserStats',
 *   handlers: {
 *     UserCreated: (state, event) => ({ ...state, count: state.count + 1 }),
 *     UserDeleted: (state, event) => ({ ...state, count: state.count - 1 })
 *   }
 * });
 * ```
 * 
 * 3. Stream Operators:
 * ```typescript
 * import { buffer, throttle, window } from '@cqrs/framework/effect/streaming';
 * 
 * stream
 *   .pipe(buffer(100))           // Buffer 100 items
 *   .pipe(throttle(1000))        // Throttle to 1 per second
 *   .pipe(window(5000))          // 5-second windows
 *   .runCollect();
 * ```
 * 
 * 4. Stream Sinks:
 * ```typescript
 * import { toDatabase, toEventStore } from '@cqrs/framework/effect/streaming';
 * 
 * stream
 *   .runSink(toDatabase(dbConnection))
 *   .runSink(toEventStore(eventStore));
 * ```
 */