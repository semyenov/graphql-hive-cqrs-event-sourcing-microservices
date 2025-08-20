/**
 * Core Message Schemas
 *
 * Schema-first definitions for Commands, Events, and Queries
 * These schemas drive validation, serialization, and GraphQL generation
 */

import * as Schema from "@effect/schema/Schema";
import {
  Actor,
  AggregateId,
  CausationId,
  CommandId,
  CorrelationId,
  EventId,
  NonEmptyString,
  Pagination,
  Timestamp,
  Version,
} from "./primitives";

// ============================================================================
// Type Aliases for backward compatibility
// ============================================================================

/**
 * Generic domain event type
 */
export interface DomainEvent {
  readonly type: string
  readonly data: unknown
  readonly metadata: EventMetadata
}

/**
 * Generic command type
 */
export interface Command {
  readonly type: string
  readonly aggregateId: AggregateId
  readonly payload: unknown
  readonly metadata: CommandMetadata
}

/**
 * Generic query type
 */
export interface Query {
  readonly type: string
  readonly params: unknown
  readonly metadata: QueryMetadata
}

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Event Metadata - Common metadata for all events
 */
export const EventMetadata = Schema.Struct({
  eventId: EventId,
  aggregateId: AggregateId,
  version: Version,
  timestamp: Timestamp,
  correlationId: CorrelationId,
  causationId: CausationId,
  actor: Actor,
}).pipe(
  Schema.annotations({
    title: "EventMetadata",
    description: "Metadata for domain events",
  }),
);
export type EventMetadata = Schema.Schema.Type<typeof EventMetadata>;

/**
 * Base Event Schema - Foundation for all domain events
 */
export const createEventSchema = <
  Type extends string,
  Data extends Schema.Schema.Any,
>(
  type: Type,
  dataSchema: Data,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    aggregateId: AggregateId,
    data: dataSchema,
    metadata: EventMetadata,
  }).pipe(
    Schema.annotations({
      title: `${type}Event`,
      description: `Domain event: ${type}`,
    }),
  );

/**
 * Event Union Helper - Create discriminated union of events
 */
export const createEventUnion = <
  Events extends ReadonlyArray<Schema.Schema.Any>,
>(
  ...events: Events
) => Schema.Union(...events);

// ============================================================================
// Command Schemas
// ============================================================================

/**
 * Command Metadata - Common metadata for all commands
 */
export const CommandMetadata = Schema.Struct({
  commandId: CommandId,
  correlationId: CorrelationId,
  causationId: Schema.optional(CausationId),
  timestamp: Timestamp,
  actor: Actor,
  expectedVersion: Schema.optional(Version),
}).pipe(
  Schema.annotations({
    title: "CommandMetadata",
    description: "Metadata for commands",
  }),
);
export type CommandMetadata = Schema.Schema.Type<typeof CommandMetadata>;

/**
 * Base Command Schema - Foundation for all commands
 */
export const createCommandSchema = <
  Type extends string,
  Payload extends Schema.Schema.Any,
>(
  type: Type,
  payloadSchema: Payload,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    aggregateId: AggregateId,
    payload: payloadSchema,
    metadata: CommandMetadata,
  }).pipe(
    Schema.annotations({
      title: `${type}Command`,
      description: `Command: ${type}`,
    }),
  );

/**
 * Command Union Helper
 */
export const createCommandUnion = <
  Commands extends ReadonlyArray<Schema.Schema.Any>,
>(
  ...commands: Commands
) => Schema.Union(...commands);

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Query Metadata - Common metadata for all queries
 */
export const QueryMetadata = Schema.Struct({
  correlationId: CorrelationId,
  timestamp: Timestamp,
  actor: Actor,
  pagination: Schema.optional(Pagination),
  includeDeleted: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: "QueryMetadata",
    description: "Metadata for queries",
  }),
);
export type QueryMetadata = Schema.Schema.Type<typeof QueryMetadata>;

/**
 * Base Query Schema - Foundation for all queries
 */
export const createQuerySchema = <
  Type extends string,
  Params extends Schema.Schema.Any,
>(
  type: Type,
  paramsSchema: Params,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    params: paramsSchema,
    metadata: QueryMetadata,
  }).pipe(
    Schema.annotations({
      title: `${type}Query`,
      description: `Query: ${type}`,
    }),
  );

/**
 * Query Result Schema - Standard query result wrapper
 */
export const createQueryResultSchema = <
  Data extends Schema.Schema.Type<unknown>,
>(
  dataSchema: Data,
) =>
  Schema.Struct({
    data: dataSchema,
    metadata: Schema.Struct({
      timestamp: Timestamp,
      executionTime: Schema.Number,
      cached: Schema.Boolean,
    }),
  });

/**
 * Paginated Result Schema
 */
export const createPaginatedResultSchema = <Item extends Schema.Schema.Any>(
  itemSchema: Item,
) =>
  Schema.Struct({
    items: Schema.Array(itemSchema),
    total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    limit: Schema.Number.pipe(Schema.int(), Schema.positive()),
    hasNext: Schema.Boolean,
    hasPrevious: Schema.Boolean,
  }).pipe(
    Schema.annotations({
      title: "PaginatedResult",
      description: "Paginated query result",
    }),
  );

// ============================================================================
// Error Schemas
// ============================================================================

/**
 * Domain Error Schema - Base for all domain errors
 */
export const DomainError = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("ValidationError"),
    field: NonEmptyString,
    message: NonEmptyString,
    value: Schema.Unknown,
  }),
  Schema.Struct({
    _tag: Schema.Literal("NotFoundError"),
    resource: NonEmptyString,
    id: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ConflictError"),
    resource: NonEmptyString,
    message: NonEmptyString,
  }),
  Schema.Struct({
    _tag: Schema.Literal("UnauthorizedError"),
    action: NonEmptyString,
    resource: Schema.optional(NonEmptyString),
  }),
  Schema.Struct({
    _tag: Schema.Literal("BusinessRuleViolation"),
    rule: NonEmptyString,
    message: NonEmptyString,
    context: Schema.optional(Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })),
  }),
).pipe(
  Schema.annotations({
    title: "DomainError",
    description: "Domain error types",
  }),
);
export type DomainError = Schema.Schema.Type<typeof DomainError>;

// ============================================================================
// Saga/Process Manager Schemas
// ============================================================================

/**
 * Saga State Schema
 */
export const SagaState = Schema.Union(
  Schema.Literal("pending", "running", "completed", "failed", "compensating"),
).pipe(
  Schema.annotations({
    title: "SagaState",
    description: "State of a saga/process manager",
  }),
);
export type SagaState = Schema.Schema.Type<typeof SagaState>;

/**
 * Saga Context Schema
 */
export const createSagaSchema = <State extends Schema.Schema.Any>(
  stateSchema: State,
) =>
  Schema.Struct({
    id: Schema.String.pipe(Schema.brand("SagaId")),
    type: NonEmptyString,
    state: SagaState,
    data: stateSchema,
    startedAt: Timestamp,
    updatedAt: Timestamp,
    completedAt: Schema.optional(Timestamp),
    error: Schema.optional(DomainError),
    compensations: Schema.Array(
      Schema.Struct({
        event: NonEmptyString,
        timestamp: Timestamp,
        success: Schema.Boolean,
      }),
    ),
  });

// ============================================================================
// Snapshot Schemas
// ============================================================================

/**
 * Aggregate Snapshot Schema
 */
export const createSnapshotSchema = <State extends Schema.Schema.Any>(
  stateSchema: State,
) =>
  Schema.Struct({
    aggregateId: AggregateId,
    version: Version,
    state: stateSchema,
    timestamp: Timestamp,
    metadata: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }),
  }).pipe(
    Schema.annotations({
      title: "AggregateSnapshot",
      description: "Snapshot of aggregate state",
    }),
  );

// ============================================================================
// Federation Support
// ============================================================================

/**
 * Federation Entity Schema
 */
export const FederationEntity = Schema.Struct({
  __typename: NonEmptyString,
  id: Schema.String,
  _service: Schema.optional(
    Schema.Struct({
      sdl: Schema.String,
    }),
  ),
}).pipe(
  Schema.annotations({
    title: "FederationEntity",
    description: "GraphQL Federation entity",
  }),
);

/**
 * Federation Reference Schema
 */
export const createReferenceSchema = <Type extends string>(
  typename: Type,
) =>
  Schema.Struct({
    __typename: Schema.Literal(typename),
    id: Schema.String,
  });

// ============================================================================
// Example Usage Schemas
// ============================================================================

// Example: User Events
export const UserCreatedEvent = createEventSchema(
  "UserCreated",
  Schema.Struct({
    email: Schema.String,
    username: Schema.String,
  }),
);

export const EmailVerifiedEvent = createEventSchema(
  "EmailVerified",
  Schema.Struct({
    verifiedAt: Timestamp,
  }),
);

export const UserEvents = createEventUnion(
  UserCreatedEvent,
  EmailVerifiedEvent,
);

// Example: User Commands
export const CreateUserCommand = createCommandSchema(
  "CreateUser",
  Schema.Struct({
    email: Schema.String,
    username: Schema.String,
    password: Schema.String,
  }),
);

export const VerifyEmailCommand = createCommandSchema(
  "VerifyEmail",
  Schema.Struct({
    token: Schema.String,
  }),
);

export const UserCommands = createCommandUnion(
  CreateUserCommand,
  VerifyEmailCommand,
);

// Example: User Queries
export const GetUserByIdQuery = createQuerySchema(
  "GetUserById",
  Schema.Struct({
    userId: AggregateId,
  }),
);

export const ListUsersQuery = createQuerySchema(
  "ListUsers",
  Schema.Struct({
    filter: Schema.optional(
      Schema.Struct({
        email: Schema.optional(Schema.String),
        status: Schema.optional(Schema.Literal("active", "inactive")),
      }),
    ),
  }),
);

export const UserQueries = createCommandUnion(
  GetUserByIdQuery,
  ListUsersQuery,
);

// ============================================================================
// Backward Compatibility Interfaces
// ============================================================================

// Note: Legacy interfaces removed to avoid conflicts with schema-based types above
