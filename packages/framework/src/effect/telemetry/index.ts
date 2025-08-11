/**
 * Framework Effect: Telemetry Module
 * 
 * OpenTelemetry integration for distributed tracing and metrics.
 */

export * from './tracing';
export * from './metrics';
export * from './context-propagation';

/**
 * Quick reference for telemetry:
 * 
 * 1. Tracing:
 * ```typescript
 * import { TracingHelpers } from '@cqrs/framework/effect/telemetry';
 * 
 * const traced = TracingHelpers.traceCommand(
 *   command,
 *   (cmd) => processCommand(cmd)
 * );
 * ```
 * 
 * 2. Metrics:
 * ```typescript
 * import { createCQRSMetricsCollector } from '@cqrs/framework/effect/telemetry';
 * 
 * const metrics = yield* createCQRSMetricsCollector();
 * yield* metrics.recordCommand(command, duration, success);
 * ```
 * 
 * 3. Context Propagation:
 * ```typescript
 * import { withDistributedContext, extractContextFromCommand } from '@cqrs/framework/effect/telemetry';
 * 
 * const context = extractContextFromCommand(command);
 * const result = yield* withDistributedContext(context, effect);
 * ```
 */