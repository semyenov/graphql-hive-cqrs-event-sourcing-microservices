/**
 * Framework Validation: Core Schemas
 * 
 * Reusable Zod schemas for CQRS/Event Sourcing patterns.
 * These schemas provide both runtime validation and TypeScript type inference.
 */

import { z } from 'zod';
import type { 
  AggregateId, 
  EventId,
  EventVersion, 
  AggregateVersion,
  Timestamp,
  CorrelationId,
  UserId
} from '../core/branded/types';

/**
 * Branded type schemas - maintain type safety with runtime validation
 */
export const AggregateIdSchema = z.string().uuid().brand<'AggregateId'>() as unknown as z.ZodSchema<AggregateId>;
export const EventIdSchema = z.string().uuid().brand<'EventId'>() as unknown as z.ZodSchema<EventId>;
export const EventVersionSchema = z.number().int().positive().brand<'EventVersion'>() as unknown as z.ZodSchema<EventVersion>;
export const AggregateVersionSchema = z.number().int().nonnegative().brand<'AggregateVersion'>() as unknown as z.ZodSchema<AggregateVersion>;
export const TimestampSchema = z.string().datetime().brand<'Timestamp'>() as unknown as z.ZodSchema<Timestamp>;
export const CorrelationIdSchema = z.string().uuid().brand<'CorrelationId'>() as unknown as z.ZodSchema<CorrelationId>;
export const UserIdSchema = z.string().uuid().brand<'UserId'>() as unknown as z.ZodSchema<UserId>;

/**
 * Common value object schemas
 */
export const EmailSchema = z.string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .toLowerCase()
  .trim();

export const UsernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .trim();

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const PersonNameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

export const PhoneNumberSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

export const URLSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL is too long');

export const UUIDSchema = z.string()
  .uuid('Invalid UUID format');

/**
 * Pagination schemas
 */
export const PaginationSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Command metadata schema
 */
export const CommandMetadataSchema = z.object({
  correlationId: CorrelationIdSchema.optional(),
  causationId: EventIdSchema.optional(),
  userId: UserIdSchema.optional(),
  timestamp: TimestampSchema.optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
}).optional();

/**
 * Base command schema
 */
export const BaseCommandSchema = z.object({
  type: z.string(),
  aggregateId: AggregateIdSchema,
  metadata: CommandMetadataSchema,
});

/**
 * Base event schema
 */
export const BaseEventSchema = z.object({
  id: EventIdSchema,
  aggregateId: AggregateIdSchema,
  type: z.string(),
  version: EventVersionSchema,
  aggregateVersion: AggregateVersionSchema,
  timestamp: TimestampSchema,
  data: z.unknown(),
  metadata: z.object({
    correlationId: CorrelationIdSchema.optional(),
    causationId: EventIdSchema.optional(),
    userId: UserIdSchema.optional(),
  }).optional(),
});

/**
 * Query metadata schema
 */
export const QueryMetadataSchema = z.object({
  requestId: z.string().uuid().optional(),
  correlationId: CorrelationIdSchema.optional(),
  userId: UserIdSchema.optional(),
  timestamp: TimestampSchema.optional(),
});

/**
 * Base query schema
 */
export const BaseQuerySchema = z.object({
  type: z.string(),
  metadata: QueryMetadataSchema.optional(),
});

/**
 * Schema factory functions
 */

/**
 * Create a command schema with type inference
 */
export function createCommandSchema<T extends z.ZodRawShape>(
  shape: T & { type: z.ZodString | z.ZodLiteral<string> }
) {
  return BaseCommandSchema.extend(shape);
}

/**
 * Create an event schema with type inference
 */
export function createEventSchema<T extends z.ZodRawShape>(
  dataShape: T,
  eventType: string
) {
  return BaseEventSchema.extend({
    type: z.literal(eventType),
    data: z.object(dataShape),
  });
}

/**
 * Create a query schema with type inference
 */
export function createQuerySchema<T extends z.ZodRawShape>(
  shape: T & { type: z.ZodString | z.ZodLiteral<string> }
) {
  return BaseQuerySchema.extend(shape);
}

/**
 * Common domain schemas
 */

export const AddressSchema = z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(2).max(50),
  postalCode: z.string().min(3).max(20),
  country: z.string().length(2), // ISO country code
});

export const MoneySchema = z.object({
  amount: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3), // ISO currency code
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'End date must be after start date' }
);

/**
 * Validation result schema
 */
export const ValidationResultSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
    code: z.string().optional(),
  })).optional(),
  data: z.unknown().optional(),
});

/**
 * Schema versioning support
 */
export interface SchemaVersion {
  version: number;
  schema: z.ZodSchema;
  up?: (data: unknown) => unknown;
  down?: (data: unknown) => unknown;
}

export class VersionedSchema {
  constructor(
    private versions: SchemaVersion[],
    private currentVersion: number
  ) {}

  parse(data: unknown, version?: number): unknown {
    const targetVersion = version ?? this.currentVersion;
    const versionSchema = this.versions.find(v => v.version === targetVersion);
    
    if (!versionSchema) {
      throw new Error(`Schema version ${targetVersion} not found`);
    }
    
    return versionSchema.schema.parse(data);
  }
  
  migrate(data: unknown, fromVersion: number, toVersion: number): unknown {
    let current = data;
    const direction = fromVersion < toVersion ? 'up' : 'down';
    
    if (direction === 'up') {
      for (let v = fromVersion + 1; v <= toVersion; v++) {
        const version = this.versions.find(ver => ver.version === v);
        if (version?.up) {
          current = version.up(current);
        }
      }
    } else {
      for (let v = fromVersion; v > toVersion; v--) {
        const version = this.versions.find(ver => ver.version === v);
        if (version?.down) {
          current = version.down(current);
        }
      }
    }
    
    return current;
  }
}

/**
 * Type inference helpers
 */
export type InferCommand<T extends z.ZodSchema> = z.infer<T>;
export type InferEvent<T extends z.ZodSchema> = z.infer<T>;
export type InferQuery<T extends z.ZodSchema> = z.infer<T>;