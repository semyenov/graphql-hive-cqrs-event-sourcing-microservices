/**
 * Framework Validation: Common Schemas
 * 
 * Reusable Zod schemas for common domain patterns.
 * These schemas provide both runtime validation and TypeScript type inference.
 */

import { z } from 'zod';
import type { AggregateId, EventVersion, Timestamp } from '../core/branded/types';

/**
 * Branded type schemas - maintain type safety with runtime validation
 */
export const AggregateIdSchema = z.string().uuid() as unknown as z.ZodSchema<AggregateId>;
export const EventVersionSchema = z.number().int().positive() as unknown as z.ZodSchema<EventVersion>;
export const TimestampSchema = z.string().datetime() as unknown as z.ZodSchema<Timestamp>;

/**
 * Common domain value objects
 */
export const EmailSchema = z.string().email().min(1).max(255);
export const PersonNameSchema = z.string().min(1).max(100).trim();
export const PhoneNumberSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);
export const URLSchema = z.string().url();
export const UUIDSchema = z.string().uuid();

/**
 * Common patterns for commands and events
 */
export const CommandSchema = z.object({
  type: z.string(),
  aggregateId: AggregateIdSchema,
  payload: z.unknown(),
  metadata: z.object({
    correlationId: z.string().uuid().optional(),
    causationId: z.string().uuid().optional(),
    userId: z.string().optional(),
    timestamp: TimestampSchema.optional(),
  }).optional(),
});

export const EventSchema = z.object({
  aggregateId: AggregateIdSchema,
  type: z.string(),
  version: EventVersionSchema,
  timestamp: TimestampSchema,
  data: z.unknown(),
});

/**
 * Pagination schema for queries
 */
export const PaginationSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Result schemas for command/query responses
 */
export const SuccessResultSchema = z.object({
  success: z.literal(true),
  data: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ErrorResultSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const ResultSchema = z.discriminatedUnion('success', [
  SuccessResultSchema,
  ErrorResultSchema,
]);

/**
 * Type exports - infer TypeScript types from schemas
 */
export type Command = z.infer<typeof CommandSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type SuccessResult = z.infer<typeof SuccessResultSchema>;
export type ErrorResult = z.infer<typeof ErrorResultSchema>;

/**
 * Schema factory functions for creating domain-specific schemas
 */
export function createCommandSchema<T extends z.ZodTypeAny>(
  type: string,
  payloadSchema: T
) {
  return z.object({
    type: z.literal(type),
    aggregateId: AggregateIdSchema,
    payload: payloadSchema,
    metadata: CommandSchema.shape.metadata,
  });
}

export function createEventSchema<T extends z.ZodTypeAny>(
  type: string,
  dataSchema: T
) {
  return z.object({
    aggregateId: AggregateIdSchema,
    type: z.literal(type),
    version: EventVersionSchema,
    timestamp: TimestampSchema,
    data: dataSchema,
  });
}

export function createQuerySchema<T extends z.ZodTypeAny>(
  type: string,
  parametersSchema: T
) {
  return z.object({
    type: z.literal(type),
    parameters: parametersSchema,
  });
}