/**
 * Framework Effect: Outbox Store
 *
 * Storage layer for the transactional outbox pattern.
 */

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Data from "effect/Data";
import { pipe } from "effect/Function";
import type { IEvent } from "../core/types";
import { BrandedTypes } from "../../core/branded";

/**
 * Outbox message status
 */
export type OutboxStatus =
  | "pending"
  | "processing"
  | "published"
  | "failed"
  | "dead";

/**
 * Outbox message
 */
export interface OutboxMessage {
  readonly id: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventData: unknown;
  readonly metadata: Record<string, unknown>;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly createdAt: Date;
  readonly processedAt?: Date;
  readonly lockedUntil?: Date;
  readonly error?: string;
}

/**
 * Outbox store configuration
 */
export interface OutboxStoreConfig {
  readonly tableName?: string;
  readonly maxRetries?: number;
  readonly lockTimeout?: number;
  readonly batchSize?: number;
}

export interface OutboxMessageRow {
  readonly id: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_data: string;
  readonly metadata: string;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly created_at: Date;
  readonly processed_at: Date;
  readonly locked_until: Date;
  readonly error: string;
}

/**
 * Outbox store interface
 */
export interface OutboxStore {
  readonly add: (
    messages: OutboxMessage[],
    transaction?: unknown,
  ) => Effect.Effect<void, OutboxStoreError, never>;

  readonly getNextBatch: (
    limit: number,
  ) => Effect.Effect<OutboxMessage[], OutboxStoreError, never>;

  readonly markAsPublished: (
    messageIds: string[],
  ) => Effect.Effect<void, OutboxStoreError, never>;

  readonly markAsFailed: (
    messageId: string,
    error: string,
  ) => Effect.Effect<void, OutboxStoreError, never>;

  readonly cleanup: (
    before: Date,
  ) => Effect.Effect<number, OutboxStoreError, never>;

  readonly getDeadLetters: (
    limit: number,
  ) => Effect.Effect<OutboxMessage[], OutboxStoreError, never>;
}

/**
 * Outbox store errors
 */
export class OutboxStoreError extends Data.TaggedError("OutboxStoreError")<{
  readonly operation: string;
  readonly cause?: unknown;
  readonly message?: string;
}> {
  constructor(operation: string, cause?: unknown, message?: string) {
    super({ operation, cause, message });
  }
}

/**
 * Create outbox message from event
 */
export const createOutboxMessage = (
  event: IEvent,
  metadata?: Record<string, unknown>,
): OutboxMessage => ({
  id: BrandedTypes.eventId(event.aggregateId),
  aggregateId: event.aggregateId,
  eventType: event.type,
  eventData: event,
  metadata: metadata ?? {},
  status: "pending",
  attempts: 0,
  createdAt: new Date(),
});

/**
 * In-memory outbox store for testing
 */
export const createInMemoryOutboxStore = (
  config: OutboxStoreConfig = {},
): Effect.Effect<OutboxStore, never, never> =>
  Effect.gen(function* () {
    const messages = new Map<string, OutboxMessage>();
    const maxRetries = config.maxRetries ?? 3;
    const lockTimeout = config.lockTimeout ?? 30000;

    return {
      add: (newMessages, transaction) =>
        Effect.sync(() => {
          for (const message of newMessages) {
            messages.set(message.id, message);
          }
        }),

      getNextBatch: (limit) =>
        Effect.sync(() => {
          const now = new Date();
          const batch: OutboxMessage[] = [];

          for (const message of messages.values()) {
            if (batch.length >= limit) break;

            if (
              message.status === "pending" ||
              (message.status === "processing" &&
                message.lockedUntil &&
                message.lockedUntil < now)
            ) {
              const updated: OutboxMessage = {
                ...message,
                status: "processing",
                lockedUntil: new Date(now.getTime() + lockTimeout),
              };
              messages.set(message.id, updated);
              batch.push(updated);
            }
          }

          return batch;
        }),

      markAsPublished: (messageIds) =>
        Effect.sync(() => {
          const now = new Date();
          for (const id of messageIds) {
            const message = messages.get(id);
            if (message) {
              messages.set(id, {
                ...message,
                status: "published",
                processedAt: now,
              });
            }
          }
        }),

      markAsFailed: (messageId, error) =>
        Effect.sync(() => {
          const message = messages.get(messageId);
          if (message) {
            const attempts = message.attempts + 1;
            messages.set(messageId, {
              ...message,
              status: attempts >= maxRetries ? "dead" : "failed",
              attempts,
              error,
              lockedUntil: undefined,
            });
          }
        }),

      cleanup: (before) =>
        Effect.sync(() => {
          let deleted = 0;
          for (const [id, message] of messages.entries()) {
            if (
              message.status === "published" &&
              message.processedAt &&
              message.processedAt < before
            ) {
              messages.delete(id);
              deleted++;
            }
          }
          return deleted;
        }),

      getDeadLetters: (limit) =>
        Effect.sync(() => {
          const deadLetters: OutboxMessage[] = [];

          for (const message of messages.values()) {
            if (deadLetters.length >= limit) break;
            if (message.status === "dead") {
              deadLetters.push(message);
            }
          }

          return deadLetters;
        }),
    };
  });

/**
 * SQL-based outbox store
 */
export interface SqlConnection {
  readonly query: <T>(
    sql: string,
    params?: unknown[],
  ) => Promise<T[]>;

  readonly execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ affectedRows: number }>;
}

export const createSqlOutboxStore = (
  connection: SqlConnection,
  config: OutboxStoreConfig = {},
): OutboxStore => {
  const tableName = config.tableName ?? "outbox_events";
  const maxRetries = config.maxRetries ?? 3;
  const lockTimeout = config.lockTimeout ?? 30000;

  return {
    add: (messages, transaction) =>
      Effect.tryPromise({
        try: async () => {
          const conn = (transaction as SqlConnection) ?? connection;

          for (const message of messages) {
            await conn.execute(
              `INSERT INTO ${tableName} 
(id, aggregate_id, event_type, event_data, metadata, status, attempts, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                message.id,
                message.aggregateId,
                message.eventType,
                JSON.stringify(message.eventData),
                JSON.stringify(message.metadata),
                message.status,
                message.attempts,
                message.createdAt,
              ],
            );
          }
        },
        catch: (error) => new OutboxStoreError("add", error),
      }),

    getNextBatch: (limit) =>
      Effect.tryPromise({
        try: async () => {
          const now = new Date();

          // Lock messages for processing
          await connection.execute(
            `UPDATE ${tableName} 
SET status = 'processing', 
    locked_until = ?
WHERE (status = 'pending' OR 
      (status = 'processing' AND locked_until < ?))
LIMIT ?`,
            [
              new Date(now.getTime() + lockTimeout),
              now,
              limit,
            ],
          );

          // Fetch locked messages
          const rows = await connection.query<OutboxMessageRow>(
            `SELECT * FROM ${tableName}
WHERE status = 'processing' 
  AND locked_until > ?
ORDER BY created_at
LIMIT ?`,
            [now, limit],
          ).then((rows): OutboxMessage[] =>
            rows.map((row) => ({
              id: row.id,
              aggregateId: row.aggregate_id,
              eventType: row.event_type,
              eventData: JSON.parse(row.event_data),
              metadata: JSON.parse(row.metadata),
              status: row.status as OutboxStatus,
              attempts: row.attempts,
              createdAt: row.created_at,
              processedAt: row.processed_at,
              lockedUntil: row.locked_until,
              error: row.error,
            }))
          );

          return rows;
        },
        catch: (error) => new OutboxStoreError("getNextBatch", error),
      }),

    markAsPublished: (messageIds) =>
      Effect.tryPromise({
        try: async () => {
          if (messageIds.length === 0) return;

          const placeholders = messageIds.map(() => "?").join(",");
          await connection.execute(
            `UPDATE ${tableName}
SET status = 'published',
    processed_at = ?
WHERE id IN (${placeholders})`,
            [new Date(), ...messageIds],
          );
        },
        catch: (error) => new OutboxStoreError("markAsPublished", error),
      }),

    markAsFailed: (messageId, error) =>
      Effect.tryPromise({
        try: async () => {
          const result = await connection.execute(
            `UPDATE ${tableName}
SET attempts = attempts + 1,
  status = CASE 
    WHEN attempts + 1 >= ? THEN 'dead'
    ELSE 'failed'
  END,
  error = ?,
  locked_until = NULL
WHERE id = ?`,
            [maxRetries, error, messageId],
          );
        },
        catch: (error) => new OutboxStoreError("markAsFailed", error),
      }),

    cleanup: (before) =>
      Effect.tryPromise({
        try: async () => {
          const result = await connection.execute(
            `DELETE FROM ${tableName}
WHERE status = 'published' AND processed_at < ?`,
            [before],
          );
          return result.affectedRows;
        },
        catch: (error) => new OutboxStoreError("cleanup", error),
      }),

    getDeadLetters: (limit) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await connection.query<OutboxMessageRow>(
            `SELECT * FROM ${tableName}
WHERE status = 'dead'
ORDER BY created_at DESC
LIMIT ?`,
            [limit],
          ).then((rows): OutboxMessage[] =>
            rows.map((row) => ({
              id: row.id,
              aggregateId: row.aggregate_id,
              eventType: row.event_type,
              eventData: JSON.parse(row.event_data),
              metadata: JSON.parse(row.metadata),
              status: row.status as OutboxStatus,
              attempts: row.attempts,
              createdAt: row.created_at,
              processedAt: row.processed_at,
              lockedUntil: row.locked_until,
              error: row.error,
            }))
          );

          return rows;
        },
        catch: (error) => new OutboxStoreError("getDeadLetters", error),
      }),
  };
};

/**
 * SQL schema for outbox table
 */
export const outboxTableSchema = `
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(255) PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSON NOT NULL,
  metadata JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  locked_until TIMESTAMP NULL,
  error TEXT NULL,
  
  INDEX idx_status_locked (status, locked_until),
  INDEX idx_aggregate_id (aggregate_id),
  INDEX idx_created_at (created_at),
  INDEX idx_processed_at (processed_at)
);`;
