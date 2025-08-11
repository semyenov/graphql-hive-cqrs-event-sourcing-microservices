/**
 * Core Primitive Schemas
 *
 * Single source of truth for all branded types and value objects
 * Using Effect Schema for validation, serialization, and type derivation
 */

import * as Schema from "@effect/schema/Schema";
import { pipe } from "effect/Function";

// ============================================================================
// Branded Primitive Types
// ============================================================================

/**
 * AggregateId - Unique identifier for aggregates
 */
export const AggregateId = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9]{26}$/),
  Schema.brand("AggregateId"),
  Schema.annotations({
    title: "AggregateId",
    description: "Unique identifier for an aggregate (ULID format)",
  }),
);
export type AggregateId = Schema.Schema.Type<typeof AggregateId>;

/**
 * EventId - Unique identifier for events
 */
export const EventId = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9]{26}$/),
  Schema.brand("EventId"),
  Schema.annotations({
    title: "EventId",
    description: "Unique identifier for an event (ULID format)",
  }),
);
export type EventId = Schema.Schema.Type<typeof EventId>;

/**
 * CommandId - Unique identifier for commands
 */
export const CommandId = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9]{26}$/),
  Schema.brand("CommandId"),
  Schema.annotations({
    title: "CommandId",
    description: "Unique identifier for a command (ULID format)",
  }),
);
export type CommandId = Schema.Schema.Type<typeof CommandId>;

/**
 * CorrelationId - For tracing related operations
 */
export const CorrelationId = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9-]{36}$/),
  Schema.brand("CorrelationId"),
  Schema.annotations({
    title: "CorrelationId",
    description: "UUID for correlating related operations",
  }),
);
export type CorrelationId = Schema.Schema.Type<typeof CorrelationId>;

/**
 * CausationId - For tracking causality chain
 */
export const CausationId = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9-]{36}$/),
  Schema.brand("CausationId"),
  Schema.annotations({
    title: "CausationId",
    description: "UUID for tracking causality in event chains",
  }),
);
export type CausationId = Schema.Schema.Type<typeof CausationId>;

/**
 * Version - Aggregate version for optimistic concurrency
 */
export const Version = Object.assign(
  pipe(
    Schema.Number,
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.brand("Version"),
    Schema.annotations({
      title: "Version",
      description: "Version number for optimistic concurrency control",
    }),
  ),
  {
    // Helper methods for backward compatibility
    initial: (): Version => 0 as Version,
    increment: (v: Version): Version => ((v as number) + 1) as Version,
  },
);
export type Version = Schema.Schema.Type<typeof Version>;

/**
 * Timestamp - Unix timestamp in milliseconds
 */
export const Timestamp = pipe(
  Schema.Number,
  Schema.positive(),
  Schema.brand("Timestamp"),
  Schema.annotations({
    title: "Timestamp",
    description: "Unix timestamp in milliseconds",
  }),
);
export type Timestamp = Schema.Schema.Type<typeof Timestamp>;

/**
 * StreamName - Event stream identifier
 */
export const StreamName = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9-]+$/),
  Schema.minLength(1),
  Schema.maxLength(255),
  Schema.brand("StreamName"),
  Schema.annotations({
    title: "StreamName",
    description: "Event stream name (alphanumeric with hyphens)",
  }),
);
export type StreamName = Schema.Schema.Type<typeof StreamName>;

/**
 * Email - Validated email address
 */
export const Email = pipe(
  Schema.String,
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email"),
  Schema.annotations({
    title: "Email",
    description: "Valid email address",
  }),
);
export type Email = Schema.Schema.Type<typeof Email>;

/**
 * Username - Valid username
 */
export const Username = pipe(
  Schema.String,
  Schema.pattern(/^[a-zA-Z0-9_-]{3,20}$/),
  Schema.brand("Username"),
  Schema.annotations({
    title: "Username",
    description: "Username (3-20 chars, alphanumeric with _ and -)",
  }),
);
export type Username = Schema.Schema.Type<typeof Username>;

/**
 * NonEmptyString - String that cannot be empty
 */
export const NonEmptyString = pipe(
  Schema.String,
  Schema.minLength(1),
  Schema.brand("NonEmptyString"),
  Schema.annotations({
    title: "NonEmptyString",
    description: "Non-empty string value",
  }),
);
export type NonEmptyString = Schema.Schema.Type<typeof NonEmptyString>;

/**
 * PositiveInt - Positive integer
 */
export const PositiveInt = pipe(
  Schema.Number,
  Schema.int(),
  Schema.positive(),
  Schema.brand("PositiveInt"),
  Schema.annotations({
    title: "PositiveInt",
    description: "Positive integer value",
  }),
);
export type PositiveInt = Schema.Schema.Type<typeof PositiveInt>;

/**
 * Money - Monetary amount (in cents)
 */
export const Money = pipe(
  Schema.Number,
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("Money"),
  Schema.annotations({
    title: "Money",
    description: "Monetary amount in cents",
  }),
);
export type Money = Schema.Schema.Type<typeof Money>;

/**
 * Percentage - Value between 0 and 100
 */
export const Percentage = pipe(
  Schema.Number,
  Schema.between(0, 100),
  Schema.brand("Percentage"),
  Schema.annotations({
    title: "Percentage",
    description: "Percentage value (0-100)",
  }),
);
export type Percentage = Schema.Schema.Type<typeof Percentage>;

/**
 * PositiveNumber - Positive number (float)
 */
export const PositiveNumber = pipe(
  Schema.Number,
  Schema.positive(),
  Schema.brand("PositiveNumber"),
  Schema.annotations({
    title: "PositiveNumber",
    description: "Positive number value",
  }),
);
export type PositiveNumber = Schema.Schema.Type<typeof PositiveNumber>;

/**
 * NonNegativeNumber - Non-negative number (>= 0)
 */
export const NonNegativeNumber = pipe(
  Schema.Number,
  Schema.nonNegative(),
  Schema.brand("NonNegativeNumber"),
  Schema.annotations({
    title: "NonNegativeNumber",
    description: "Non-negative number value (>= 0)",
  }),
);
export type NonNegativeNumber = Schema.Schema.Type<typeof NonNegativeNumber>;

/**
 * Url - Valid HTTP/HTTPS URL
 */
export const Url = pipe(
  Schema.String,
  Schema.pattern(/^https?:\/\/.+/),
  Schema.brand("Url"),
  Schema.annotations({
    title: "Url",
    description: "Valid HTTP/HTTPS URL",
  }),
);
export type Url = Schema.Schema.Type<typeof Url>;

// ============================================================================
// Composite Value Objects
// ============================================================================

/**
 * DateRange - A range between two dates
 */
export const DateRange = Schema.Struct({
  start: Timestamp,
  end: Timestamp,
}).pipe(
  Schema.filter(
    (range) => range.start <= range.end,
    { message: () => "Start date must be before or equal to end date" },
  ),
  Schema.annotations({
    title: "DateRange",
    description: "A valid date range",
  }),
);
export type DateRange = Schema.Schema.Type<typeof DateRange>;

/**
 * Pagination - Standard pagination parameters
 */
export const Pagination = Schema.Struct({
  offset: pipe(
    Schema.Number,
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({ default: 0 }),
  ),
  limit: pipe(
    Schema.Number,
    Schema.int(),
    Schema.between(1, 100),
    Schema.annotations({ default: 20 }),
  ),
}).pipe(
  Schema.annotations({
    title: "Pagination",
    description: "Pagination parameters",
  }),
);
export type Pagination = Schema.Schema.Type<typeof Pagination>;

/**
 * SortOrder - Sorting direction
 */
export const SortOrder = Schema.Literal("asc", "desc").pipe(
  Schema.annotations({
    title: "SortOrder",
    description: "Sort direction",
    default: "asc",
  }),
);
export type SortOrder = Schema.Schema.Type<typeof SortOrder>;

/**
 * Actor - Represents who performed an action
 */
export const Actor = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("user"),
    id: Schema.String.pipe(Schema.brand("UserId")),
    email: Email,
  }),
  Schema.Struct({
    type: Schema.Literal("system"),
    service: NonEmptyString,
  }),
  Schema.Struct({
    type: Schema.Literal("anonymous"),
  }),
).pipe(
  Schema.annotations({
    title: "Actor",
    description: "Actor who performed an action",
  }),
);
export type Actor = Schema.Schema.Type<typeof Actor>;

// ============================================================================
// GraphQL Federation Types
// ============================================================================

/**
 * EntityReference - Federation entity reference
 */
export const EntityReference = Schema.Struct({
  __typename: NonEmptyString,
  id: Schema.String,
}).pipe(
  Schema.annotations({
    title: "EntityReference",
    description: "GraphQL Federation entity reference",
  }),
);
export type EntityReference = Schema.Schema.Type<typeof EntityReference>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new ULID
 */
export const generateId = (): string => {
  // Using timestamp + random for ULID-like format
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return (timestamp + random).padEnd(26, "0").slice(0, 26).toUpperCase();
};

/**
 * Create a new AggregateId
 */
export const createAggregateId = (): AggregateId => {
  const id = generateId();
  return Schema.decodeSync(AggregateId)(id);
};

/**
 * Create a new EventId
 */
export const createEventId = (): EventId => {
  const id = generateId();
  return Schema.decodeSync(EventId)(id);
};

/**
 * Create a new CommandId
 */
export const createCommandId = (): CommandId => {
  const id = generateId();
  return Schema.decodeSync(CommandId)(id);
};

/**
 * Create a new CorrelationId
 */
export const createCorrelationId = (): CorrelationId => {
  const id = crypto.randomUUID();
  return Schema.decodeSync(CorrelationId)(id);
};

/**
 * Create a new CausationId
 */
export const createCausationId = (): CausationId => {
  const id = crypto.randomUUID();
  return Schema.decodeSync(CausationId)(id);
};

/**
 * Get current timestamp
 */
export const now = (): Timestamp => Date.now() as Timestamp;

/**
 * Create timestamp from number
 */
export const timestamp = (value: number): Timestamp => value as Timestamp;

/**
 * Create version from number
 */
export const version = (value: number): Version => value as Version;

/**
 * Create a NonEmptyString (unsafe - assumes valid input)
 */
export const nonEmptyString = (value: string): NonEmptyString => {
  if (!value || value.trim().length === 0) {
    throw new Error(`Cannot create NonEmptyString from empty value`);
  }
  return Schema.decodeSync(NonEmptyString)(value);
};

/**
 * Create email safely
 */
export const email = (value: string): Email => Schema.decodeSync(Email)(value);

/**
 * Create username safely
 */
export const username = (value: string): Username => Schema.decodeSync(Username)(value);

/**
 * Create first name safely
 */
export const firstName = (value: string): FirstName => Schema.decodeSync(FirstName)(value);

/**
 * Create last name safely
 */
export const lastName = (value: string): LastName => Schema.decodeSync(LastName)(value);

/**
 * Create stream name safely
 */
export const streamName = (value: string): StreamName => Schema.decodeSync(StreamName)(value);
