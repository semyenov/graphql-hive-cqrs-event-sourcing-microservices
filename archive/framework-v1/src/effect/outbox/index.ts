/**
 * Framework Effect: Transactional Outbox Pattern
 * 
 * Ensures reliable event publishing after database transactions.
 * Implements the outbox pattern for guaranteed message delivery.
 */

// Core outbox functionality
export * from './outbox-store';
export * from './outbox-publisher';
export * from './outbox-processor';

/**
 * Transactional Outbox Pattern
 * 
 * The outbox pattern ensures that events are reliably published after
 * a database transaction commits. It prevents message loss and 
 * guarantees at-least-once delivery.
 * 
 * ## How it works:
 * 
 * 1. **Within Transaction**: Events are written to an outbox table
 *    as part of the business transaction
 * 2. **After Commit**: A separate process polls the outbox and 
 *    publishes events to the message broker
 * 3. **Acknowledgment**: Successfully published events are marked
 *    as processed or deleted from the outbox
 * 
 * ## Usage:
 * 
 * ```typescript
 * import { createOutbox } from '@cqrs/framework/effect/outbox';
 * 
 * const outbox = createOutbox({
 *   store: dbConnection,
 *   publisher: messageQueue,
 *   pollInterval: 1000,
 *   batchSize: 100
 * });
 * 
 * // Within a transaction
 * await transaction(async (tx) => {
 *   // Business logic
 *   await saveAggregate(aggregate);
 *   
 *   // Add events to outbox (same transaction)
 *   await outbox.add(tx, events);
 * });
 * 
 * // Start background processor
 * await outbox.startProcessor();
 * ```
 * 
 * ## Benefits:
 * 
 * - **Reliability**: Events are never lost, even if the message broker is down
 * - **Consistency**: Events are published only after transaction commits
 * - **Idempotency**: Duplicate detection prevents duplicate publishing
 * - **Ordering**: Events maintain their order within an aggregate
 * 
 * ## Configuration:
 * 
 * ```typescript
 * const config = {
 *   // Storage
 *   tableName: 'outbox_events',
 *   
 *   // Publishing
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   
 *   // Processing
 *   pollInterval: 5000,
 *   batchSize: 100,
 *   lockTimeout: 30000,
 *   
 *   // Cleanup
 *   retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   cleanupInterval: 60 * 60 * 1000 // 1 hour
 * };
 * ```
 */