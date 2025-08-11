# @cqrs/framework v3 - Ultra-Clean CQRS/Event Sourcing Framework

A schema-first, pure functional, Effect-native framework for building event-sourced systems with GraphQL Federation as a first-class citizen.

## 🚀 Features

✅ **Schema-First Development** - Single source of truth using Effect Schema  
✅ **Pure Functional Core** - No classes, no inheritance, just functions  
✅ **Effect-Native** - All operations return Effects for composability  
✅ **GraphQL Federation** - Native Federation v2.5 support  
✅ **Pattern Matching** - Exhaustive matching with ts-pattern  
✅ **Zero Runtime Surprises** - Compile-time type safety  

## 📚 Quick Start

```typescript
import { 
  createEventSchema,
  createCommandSchema,
  createEventApplicator,
  createCommandHandler,
  executeCommand,
  Effect,
  Schema,
  pipe
} from "@cqrs/framework"

// 1. Define schemas (single source of truth)
const UserCreated = createEventSchema("UserCreated", Schema.Struct({
  email: Email,
  username: Username
}))

// 2. Create pure event applicator
const applyUserEvent = createEventApplicator({
  UserCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    username: event.data.username
  })
})

// 3. Create pure command handler
const handleUserCommand = createCommandHandler({
  CreateUser: (state, command) =>
    Effect.succeed({
      type: "success",
      events: [createUserCreatedEvent(command)]
    })
})

// 4. Execute with Effect
const program = pipe(
  executeCommand(handleUserCommand, applyUserEvent)(aggregate, command),
  Effect.provide(CoreServicesLive)
)

await Effect.runPromise(program)
```

## 🏗️ Architecture

### Schema-First Approach

All types are defined once using Effect Schema and everything else is derived:

```typescript
// Define once
const UserState = Schema.Struct({
  id: AggregateId,
  email: Email,
  username: Username,
  status: Schema.Literal("active", "suspended", "deleted")
})

// Validation, serialization, GraphQL types all derived automatically
```

### Pure Functional Core

No classes or inheritance, just pure functions and data:

```typescript
// Pure event application
const applyEvent = (state: State | null, event: Event): State | null =>
  match(event)
    .with({ type: "Created" }, (e) => ({ ...initialState, ...e.data }))
    .with({ type: "Updated" }, (e) => state ? { ...state, ...e.data } : null)
    .with({ type: "Deleted" }, () => null)
    .exhaustive()

// Pure command handling
const handleCommand = (state: State | null, command: Command) =>
  match(command)
    .with({ type: "Create" }, (cmd) => 
      state ? Effect.fail(AlreadyExists) : Effect.succeed(events))
    .exhaustive()
```

### Effect-Native Services

All services use Effect for dependency injection and error handling:

```typescript
const program = Effect.gen(function* () {
  const eventStore = yield* EventStore
  const commandBus = yield* CommandBus
  
  const events = yield* eventStore.read(streamName)
  const result = yield* commandBus.send(command)
  
  return result
})

// Compose services with Layers
const AppLive = Layer.mergeAll(
  InMemoryEventStore,
  InMemoryCommandBus,
  InMemoryQueryBus,
  InMemoryProjectionStore
)
```

### GraphQL Federation Native

Federation support built-in from the ground up:

```graphql
type User @key(fields: "id") {
  id: ID!
  email: Email!
  username: NonEmptyString!
  
  # Computed fields resolved with Effect
  fullName: String!
  isActive: Boolean!
}
```

```typescript
const UserEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  resolveReference: (ref) => loadUserById(ref.id),
  fields: {
    fullName: (user) => `${user.firstName} ${user.lastName}`,
    isActive: (user) => user.status === "active"
  }
}
```

## 🔧 Core Concepts

### Event Sourcing

```typescript
// Define event schemas
const UserCreated = createEventSchema("UserCreated", dataSchema)
const UserUpdated = createEventSchema("UserUpdated", dataSchema)

// Create event applicator
const applyUserEvent = createEventApplicator({
  UserCreated: (state, event) => createUser(event.data),
  UserUpdated: (state, event) => updateUser(state, event.data)
})

// Load from events
const aggregate = loadFromEvents(applyUserEvent)(events)
```

### Command Handling

```typescript
// Define command schemas
const CreateUser = createCommandSchema("CreateUser", payloadSchema)

// Create command handler
const handleUserCommand = createCommandHandler({
  CreateUser: (state, cmd) => 
    state 
      ? Effect.fail(new AlreadyExists())
      : Effect.succeed({ 
          type: "success", 
          events: [createUserCreatedEvent(cmd)] 
        })
})

// Execute command
const result = await pipe(
  executeCommand(handler, applicator)(aggregate, command),
  Effect.runPromise
)
```

### Projections

```typescript
// Define projection as pure reducer
const UserListProjection = createProjection(
  "UserList",
  [] as UserListItem[],
  {
    UserCreated: (state, event) => [...state, createItem(event)],
    UserDeleted: (state, event) => state.filter(u => u.id !== event.aggregateId)
  }
)

// Run projection over events
const userList = runProjection(UserListProjection, events)
```

### Sagas/Process Managers

```typescript
// Define saga steps
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
    })
  ]
)

// Execute with automatic compensation on failure
const result = await Effect.runPromise(orderSaga.execute(orderData))
```

## 🧪 Testing

Comprehensive testing utilities included:

```typescript
// Test aggregates
const suite = aggregateTestSuite(
  "User Aggregate",
  loadUserFromEvents,
  executeUserCommand
)

suite.test("should create user", 
  scenario()
    .given([])
    .when(createUserCommand)
    .thenEvents([userCreatedEvent])
)

// Test projections
await testProjection(
  UserListProjection,
  [userCreated, userUpdated],
  expectedFinalState
)

// Test sagas
await testSaga(
  orderSaga,
  orderInput,
  expectedOutput
)
```

## 📁 Directory Structure

```
packages/framework/
├── src/
│   ├── schema/           # Effect Schema definitions (single source of truth)
│   │   └── core/
│   │       ├── primitives.ts   # Branded types and value objects
│   │       └── messages.ts     # Commands, Events, Queries
│   ├── functions/        # Pure functions only
│   │   └── event-sourcing.ts   # Event application, command handling
│   ├── effects/          # Effect-based services
│   │   └── services.ts         # EventStore, CommandBus, QueryBus
│   ├── graphql/          # GraphQL Federation
│   │   ├── federation.ts       # Entity resolution
│   │   └── base.schema.graphql # Federated schema
│   ├── patterns/         # Advanced patterns
│   │   └── saga.ts            # Saga/Process Manager
│   ├── testing/          # Testing utilities
│   │   └── harness.ts         # Test helpers
│   ├── runtime/          # Runtime configuration
│   │   └── config.ts          # Application bootstrap
│   └── examples/         # Domain examples
│       └── user-domain.ts     # Complete user domain
```

## 🔄 Migration from v1/v2

If migrating from class-based implementations:

### Before (v1/v2)
```typescript
class UserAggregate extends Aggregate {
  handle(command: Command): void {
    if (command instanceof CreateUser) {
      this.apply(new UserCreated(command.data))
    }
  }
}
```

### After (v3)
```typescript
const handleUserCommand = createCommandHandler({
  CreateUser: (state, cmd) => 
    Effect.succeed({ 
      type: "success", 
      events: [createUserCreatedEvent(cmd)] 
    })
})
```

## 💡 Philosophy

1. **Schema-First**: Define once, derive everything
2. **Pure Functions**: No classes, no inheritance
3. **Effect-Native**: Leverage Effect for all operations
4. **Type-Safe**: No runtime surprises
5. **GraphQL Federation**: First-class citizen
6. **Pattern Matching**: Exhaustive branching

## ⚡ Performance

- Zero-cost abstractions with TypeScript
- Efficient event replay with streaming
- Built-in caching and memoization
- Optimized for V8 engine

## 🌟 Key Differences from Traditional CQRS Frameworks

| Traditional | Ultra-Clean |
|------------|-------------|
| Class-based aggregates | Pure functions |
| Inheritance hierarchies | Composition |
| Runtime validation | Compile-time schemas |
| Exceptions for errors | Effect error channel |
| Manual DI containers | Effect Layers |
| Separate GraphQL layer | Federation-native |
| Imperative sagas | Functional sagas |
| Mutable state | Immutable data |

## 📖 Examples

Check out the `examples/` directory for complete domain implementations:

- **User Domain** - Authentication and user management
- **Order Domain** - E-commerce order processing (coming soon)
- **Inventory Domain** - Stock management with sagas (coming soon)

## 🛠️ Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## 📝 License

MIT

---

Built with ❤️ using [Effect-TS](https://effect.website/), [ts-pattern](https://github.com/gvergnaud/ts-pattern), and [Bun](https://bun.sh/)