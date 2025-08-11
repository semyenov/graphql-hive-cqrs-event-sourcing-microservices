# @cqrs/framework API Reference

## Table of Contents

- [Core Schemas](#core-schemas)
  - [Primitives](#primitives)
  - [Messages](#messages)
- [Pure Functions](#pure-functions)
  - [Event Sourcing](#event-sourcing)
  - [Aggregate Operations](#aggregate-operations)
- [Effect Services](#effect-services)
- [GraphQL Federation](#graphql-federation)
- [Patterns](#patterns)

## Core Schemas

### Primitives

#### `AggregateId`
Branded type for aggregate identifiers.
```typescript
import { AggregateId, createAggregateId } from "@cqrs/framework"

const id: AggregateId = createAggregateId()
// "01HQNW3X4K3R5Q9Z7V2M8P6F1G"
```

#### `EventId`
Branded type for event identifiers.
```typescript
import { EventId, createEventId } from "@cqrs/framework"

const id: EventId = createEventId()
```

#### `Version`
Branded type for version numbers (optimistic concurrency).
```typescript
import { Version } from "@cqrs/framework"

const initial: Version = Version.initial() // 0
const next: Version = Version.increment(initial) // 1
```

#### `Timestamp`
Branded type for Unix timestamps in milliseconds.
```typescript
import { Timestamp, now } from "@cqrs/framework"

const timestamp: Timestamp = now()
```

#### `NonEmptyString`
Branded type for strings that cannot be empty.
```typescript
import { NonEmptyString, nonEmptyString } from "@cqrs/framework"

const name: NonEmptyString = nonEmptyString("John Doe")
// Throws if empty string provided
```

#### `Email`
Branded type for valid email addresses.
```typescript
import { Email } from "@cqrs/framework"
import * as Schema from "@effect/schema/Schema"

const email = Schema.decodeSync(Email)("user@example.com")
```

### Messages

#### `createEventSchema`
Create a schema for domain events.
```typescript
import { createEventSchema } from "@cqrs/framework"
import * as Schema from "@effect/schema/Schema"

const UserCreated = createEventSchema(
  "UserCreated",
  Schema.Struct({
    email: Email,
    username: Username
  })
)

type UserCreated = Schema.Schema.Type<typeof UserCreated>
```

#### `createCommandSchema`
Create a schema for commands.
```typescript
import { createCommandSchema } from "@cqrs/framework"

const CreateUser = createCommandSchema(
  "CreateUser",
  Schema.Struct({
    email: Schema.String,
    username: Schema.String
  })
)
```

#### `createQuerySchema`
Create a schema for queries.
```typescript
import { createQuerySchema } from "@cqrs/framework"

const GetUserById = createQuerySchema(
  "GetUserById",
  Schema.Struct({
    userId: AggregateId
  })
)
```

## Pure Functions

### Event Sourcing

#### `createAggregate`
Create a new aggregate with initial state.
```typescript
import { createAggregate } from "@cqrs/framework"

const aggregate = createAggregate<UserState, UserEvent>({
  id: createAggregateId(),
  email: "user@example.com",
  status: "pending"
})
// { state: {...}, version: 0, uncommittedEvents: [], isDeleted: false }
```

#### `applyEvent`
Apply a single event to an aggregate.
```typescript
import { applyEvent } from "@cqrs/framework"

const apply = applyEvent(userEventApplicator)
const updated = apply(aggregate, userCreatedEvent)
// Returns updated aggregate with incremented version
```

#### `applyEvents`
Apply multiple events to an aggregate.
```typescript
import { applyEvents } from "@cqrs/framework"

const apply = applyEvents(userEventApplicator)
const updated = apply(aggregate, [event1, event2, event3])
```

#### `loadFromEvents`
Rebuild aggregate state from event history.
```typescript
import { loadFromEvents } from "@cqrs/framework"

const load = loadFromEvents(userEventApplicator)
const aggregate = load(events)
// Aggregate state rebuilt from events
```

#### `executeCommand`
Execute a command against an aggregate.
```typescript
import { executeCommand, Effect } from "@cqrs/framework"

const execute = executeCommand(userCommandHandler, userEventApplicator)

const result = await pipe(
  execute(aggregate, createUserCommand),
  Effect.runPromise
)
```

#### `createEventApplicator`
Create an event applicator from handler map.
```typescript
import { createEventApplicator } from "@cqrs/framework"

const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    status: "active"
  }),
  UserDeleted: () => null // Marks as deleted
})
```

#### `createCommandHandler`
Create a command handler from handler map.
```typescript
import { createCommandHandler } from "@cqrs/framework"

const handleUserCommand = createCommandHandler<
  UserState,
  UserCommand,
  UserEvent,
  UserError
>({
  CreateUser: (state, cmd) =>
    state
      ? Effect.succeed({ type: "failure", error: new AlreadyExists() })
      : Effect.succeed({ type: "success", events: [createEvent(cmd)] }),
  
  DeleteUser: (state, cmd) =>
    !state
      ? Effect.succeed({ type: "failure", error: new NotFound() })
      : Effect.succeed({ type: "success", events: [deleteEvent(cmd)] })
})
```

### Aggregate Operations

#### `processCommand`
Process command with validation and decision phases.
```typescript
import { processCommand, Decision } from "@cqrs/framework"

const handleCommand = processCommand<UserState, UserCommand, UserEvent>(
  // Validation phase
  (state, command) => 
    match(command)
      .with({ type: "CreateUser" }, () =>
        state ? Effect.fail(new AlreadyExists()) : Effect.succeed(undefined)
      )
      .exhaustive(),
  
  // Decision phase
  (state, command) =>
    Effect.succeed(
      match(command)
        .with({ type: "CreateUser" }, cmd =>
          Decision.success([createUserCreatedEvent(cmd)])
        )
        .exhaustive()
    )
)
```

#### `validateRule`
Validate business rules.
```typescript
import { validateRule } from "@cqrs/framework"

const validation = validateRule(
  order.total > 0,
  order.id,
  "Order total must be positive",
  { total: order.total }
)
```

#### `createSimpleProjection`
Create a projection from events.
```typescript
import { createSimpleProjection } from "@cqrs/framework"

const UserListProjection = createSimpleProjection(
  "UserList",
  [] as User[],
  {
    UserCreated: (state, event) => 
      [...state, { id: event.aggregateId, name: event.data.name }],
    UserDeleted: (state, event) =>
      state.filter(u => u.id !== event.aggregateId)
  }
)

const userList = UserListProjection.rebuild(events)
```

## Effect Services

### EventStore
Service for persisting and reading events.
```typescript
import { EventStore, InMemoryEventStore } from "@cqrs/framework"

const program = Effect.gen(function* () {
  const store = yield* EventStore
  
  // Append events
  yield* store.append(streamName, events, expectedVersion)
  
  // Read events
  const events = yield* pipe(
    store.read(streamName),
    Stream.runCollect
  )
})

// Provide implementation
pipe(
  program,
  Effect.provide(InMemoryEventStore),
  Effect.runPromise
)
```

### CommandBus
Service for routing commands to handlers.
```typescript
import { CommandBus, InMemoryCommandBus } from "@cqrs/framework"

const program = Effect.gen(function* () {
  const bus = yield* CommandBus
  
  // Register handler
  yield* bus.register("CreateUser", userCommandHandler)
  
  // Send command
  const result = yield* bus.send(createUserCommand)
})
```

### QueryBus
Service for routing queries to handlers.
```typescript
import { QueryBus, InMemoryQueryBus } from "@cqrs/framework"

const program = Effect.gen(function* () {
  const bus = yield* QueryBus
  
  // Register handler
  yield* bus.register("GetUserById", getUserByIdHandler)
  
  // Execute query
  const user = yield* bus.execute(getUserByIdQuery)
})
```

### CoreServicesLive
Complete service bundle for testing.
```typescript
import { CoreServicesLive } from "@cqrs/framework"

const program = pipe(
  myEffect,
  Effect.provide(CoreServicesLive),
  Effect.runPromise
)
```

## GraphQL Federation

### FederationEntity
Define a federated GraphQL entity.
```typescript
import { FederationEntity } from "@cqrs/framework"

const UserEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  
  resolveReference: (reference) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const events = yield* loadUserEvents(reference.id)
      return loadFromEvents(userEventApplicator)(events).state
    }),
  
  fields: {
    fullName: (user) => `${user.firstName} ${user.lastName}`,
    isActive: (user) => user.status === "active"
  }
}
```

### createEntityResolver
Create a GraphQL resolver for federated entities.
```typescript
import { createEntityResolver } from "@cqrs/framework"

const resolver = createEntityResolver(UserEntity)

// Use in GraphQL schema
const resolvers = {
  User: {
    __resolveReference: resolver.__resolveReference,
    ...UserEntity.fields
  }
}
```

## Patterns

### Sequential Saga
Execute steps in sequence with automatic compensation on failure.
```typescript
import { createSequentialSaga, createStep } from "@cqrs/framework"

const orderSaga = createSequentialSaga(
  "OrderProcessing",
  [
    createStep({
      name: "ReserveInventory",
      execute: (order) => reserveInventory(order.items),
      compensate: (order, reservation) => releaseInventory(reservation)
    }),
    createStep({
      name: "ChargePayment",
      execute: (reservation) => chargeCard(reservation.total),
      compensate: (reservation, charge) => refundCharge(charge)
    }),
    createStep({
      name: "ShipOrder",
      execute: (payment) => createShipment(payment.orderId)
    })
  ]
)

// Execute with automatic rollback on failure
const result = await Effect.runPromise(orderSaga.execute(orderData))
```

### Parallel Saga
Execute steps in parallel.
```typescript
import { createParallelSaga } from "@cqrs/framework"

const notificationSaga = createParallelSaga(
  "SendNotifications",
  [
    createStep({
      name: "EmailCustomer",
      execute: (order) => sendEmail(order.customerEmail)
    }),
    createStep({
      name: "NotifyWarehouse",
      execute: (order) => notifyWarehouse(order.items)
    }),
    createStep({
      name: "UpdateAnalytics",
      execute: (order) => trackOrder(order)
    })
  ],
  (results) => ({ notificationsSent: results.length })
)
```

### Circuit Breaker
Protect against cascading failures.
```typescript
import { withCircuitBreaker } from "@cqrs/framework"

const protectedService = withCircuitBreaker({
  failureThreshold: 3,
  timeout: Duration.seconds(30),
  resetTimeout: Duration.minutes(1)
})(unreliableService)
```

### Retry with Backoff
Retry failed operations with exponential backoff.
```typescript
import { withRetry, exponentialBackoff } from "@cqrs/framework"

const resilientOperation = withRetry(
  exponentialBackoff({
    maxAttempts: 5,
    initialDelay: Duration.millis(100),
    maxDelay: Duration.seconds(10)
  })
)(operation)
```

## Type Safety

All operations are fully type-safe with TypeScript:

```typescript
// Schema defines the shape
const UserCreated = createEventSchema(
  "UserCreated",
  Schema.Struct({
    email: Email,
    username: Username
  })
)

// Type is automatically derived
type UserCreated = Schema.Schema.Type<typeof UserCreated>
// {
//   type: "UserCreated"
//   data: { email: Email; username: Username }
//   metadata: EventMetadata
// }
```

## Error Handling

All operations use Effect for explicit error handling:

```typescript
const program = pipe(
  executeCommand(handler, applicator)(aggregate, command),
  Effect.catchTag("BusinessRuleViolation", error =>
    Effect.log(`Business rule violated: ${error.rule}`)
  ),
  Effect.catchTag("ConcurrencyConflict", error =>
    Effect.log(`Version conflict: expected ${error.expectedVersion}`)
  ),
  Effect.catchAll(error =>
    Effect.log(`Unexpected error: ${error}`)
  )
)
```

## Best Practices

1. **Always use schemas** - Define schemas first, derive types from them
2. **Pure functions only** - No classes, no mutations
3. **Explicit errors** - Use Effect error channel, not exceptions
4. **Pattern matching** - Use exhaustive matching for branching
5. **Composition** - Build complex operations from simple functions
6. **Type safety** - Let TypeScript catch errors at compile time