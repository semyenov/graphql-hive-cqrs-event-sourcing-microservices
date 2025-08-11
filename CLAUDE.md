# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
description: GraphQL Hive CQRS/Event Sourcing Microservices using Bun with Effect-TS
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## 🚨 FRAMEWORK REFACTORING IN PROGRESS

The framework package is undergoing major refactoring to eliminate duplicates and align with Effect patterns. Current state and migration path documented below.

## Core Commands

```bash
# Development
bun run dev                 # Start with hot reload (using --hot flag)
bun run start              # Production server
bun test                   # Run all tests
bun test <path>            # Run specific test file

# Framework Testing
bun run test:framework     # Run framework test suite (src/app/test-framework.ts)

# Type Generation & Validation
bun run generate:all       # Generate both GraphQL types and gql.tada types
bun run codegen           # Generate GraphQL resolver types only
bun run gql:generate      # Generate gql.tada types only
bun run gql:check         # Validate GraphQL operations
bun run typecheck         # TypeScript type checking

# Production Optimizations
bun run gql:persisted     # Generate persisted GraphQL documents
bun run generate:manifest # Generate persisted documents manifest (deprecated)

# Code Maintenance
bun run clean:unused      # Remove unused exports (using knip)
```

## Framework Architecture (`packages/framework/`)

The framework is a **Bun workspace package** (`@cqrs/framework`) providing a functional, Effect-TS based CQRS/Event Sourcing foundation.

### Package Structure
- **Location**: `packages/framework/`
- **Import**: `import { ... } from '@cqrs/framework'`
- **NO separate Effect imports** - Everything is Effect-native

### Core Technologies
- **Effect-TS v3**: Functional programming with type-safe error handling and dependency injection
- **Effect Schema**: Schema-first development (replacing Zod)
- **Branded Types**: Type-safe domain primitives preventing primitive obsession
- **Pattern Matching**: Exhaustive event handling with ts-pattern

### Current Refactoring Status

#### ✅ Completed
- Schema-first message definitions in `src/schema/core/`
- Pure functional event sourcing in `src/functions/`
- Effect services foundation in `src/effects/`
- GraphQL federation support in `src/graphql/`

#### 🔄 In Progress - Duplicates to Remove
1. **Message Definitions**
   - **KEEP**: `src/schema/core/messages.ts` (Schema-first approach)
   - **REMOVE**: `src/core/messages.ts` (Class-based approach)
   
2. **Branded Types**
   - **KEEP**: `src/schema/core/primitives.ts` (Effect Schema branded types)
   - **REMOVE**: `src/core/branded-types.ts` (Manual branded types)

3. **Domain Layer**
   - **REFACTOR**: `src/domain/aggregate.ts` to pure functions
   - **REMOVE**: All class-based aggregates

#### 🎯 Target Architecture

```
packages/framework/src/
├── schema/           # Schema-first definitions (Single Source of Truth)
│   └── core/
│       ├── primitives.ts   # Branded types with Effect Schema
│       └── messages.ts     # Event, Command, Query schemas
├── functions/        # Pure functions only
│   ├── event-sourcing.ts  # Event applicators, command handlers
│   ├── projections.ts     # Projection builders
│   └── sagas.ts          # Saga orchestration
├── effects/          # Effect services and layers
│   ├── services.ts        # Core services (EventStore, CommandBus, etc.)
│   ├── persistence.ts     # Repository patterns with Effect
│   └── resilience.ts      # Retry, circuit breaker patterns
├── graphql/          # GraphQL integration
│   ├── federation.ts      # Federation support
│   └── resolvers.ts       # Effect-based resolvers
└── index.ts          # Public API exports
```

### Framework API Design Principles

#### 1. Schema-First Development
```typescript
// Define schema once - derive everything
const UserCreatedEvent = createEventSchema("UserCreated", Schema.Struct({
  email: Email,
  username: Username
}))

// Automatically get:
// - TypeScript types
// - Validation
// - Serialization
// - GraphQL types
```

#### 2. Pure Functions Only
```typescript
// ✅ CORRECT: Pure function
const applyUserEvent = (state: UserState | null, event: UserEvent) => {
  return match(event)
    .with({ type: "UserCreated" }, e => ({ ...e.data, version: 1 }))
    .with({ type: "UserDeleted" }, () => null)
    .exhaustive()
}

// ❌ WRONG: Class with methods
class UserAggregate {
  apply(event: UserEvent) { /* ... */ }
}
```

#### 3. Effect-Native Operations
```typescript
// All operations return Effects
const handleCommand = (cmd: Command) => Effect.gen(function* () {
  const store = yield* EventStore
  const events = yield* store.getEvents(cmd.aggregateId)
  // ...
})
```

### Key Refactoring Guidelines

#### Removing Duplicates

1. **Messages**: Use ONLY `schema/core/messages.ts`
   - Remove all class-based message definitions
   - Use `createEventSchema`, `createCommandSchema`, `createQuerySchema`

2. **Branded Types**: Use ONLY `schema/core/primitives.ts`
   - All branded types via Effect Schema
   - Remove manual brand implementations

3. **Event Sourcing**: Use ONLY `functions/event-sourcing.ts`
   - Pure functions for event application
   - No aggregate classes

#### Effect Pattern Compliance

Follow these patterns from EFFECT_PATTERNS.md:

1. **Generator Syntax**
```typescript
// ✅ CORRECT
Effect.gen(function* () {
  const value = yield* Effect.succeed(42)
  return value
})

// ❌ WRONG
Effect.gen((function* () { }))  // Extra parenthesis
Effect.gen(function* (_) { yield* _(effect) })  // Using _ incorrectly
```

2. **Error Handling**
```typescript
// ✅ CORRECT: Use Effect.fail
return yield* Effect.fail(new ValidationError({ field: "email" }))

// ❌ WRONG: Throwing in Effect.sync
Effect.sync(() => { throw new Error("Failed") })
```

3. **Service Pattern**
```typescript
// Define service
class EventStore extends Context.Tag("EventStore")<EventStore, EventStore>() {}

// Create implementation
const EventStoreLive = Layer.succeed(EventStore, { /* ... */ })

// Use in effect
const program = Effect.gen(function* () {
  const store = yield* EventStore
  // ...
})
```

## Domain Implementation

### Current Architecture Status

The codebase is transitioning from legacy to Effect-based implementation:

1. **Active Domains** (`src/domains/`)
   - `orders/`: Basic order types (minimal implementation)
   - `products/`: Product domain with Effect integration examples

2. **Legacy Domains** (`src/_legacy_domains/`)
   - `users/`: Complete user domain (being migrated)
   - Full layered architecture example

3. **Examples** (`src/examples/`)
   - `effect-demo.ts`: Complete Effect-TS usage patterns
   - `product-domain-demo.ts`: Domain implementation with Effect

### Domain Layer Structure

Each domain follows clean architecture with distinct layers:

#### Domain Layer (`domain/`)
- **Aggregates**: Core business entities
- **Events**: Domain events with factories
- **Commands**: Command type definitions
- **Queries**: Query type definitions
- **Types**: Value objects and domain types
- **Errors**: Domain-specific errors

#### Application Layer (`application/`)
- **Command Handlers**: Execute commands with Effect
- **Query Handlers**: Process queries against projections
- **Services**: Cross-cutting concerns

#### Infrastructure Layer (`infrastructure/`)
- **Persistence**: Repository implementations
- **Projections**: Read model builders
- **Event Handlers**: Side effects
- **Validation**: Command validators

#### API Layer (`api/`)
- **GraphQL Schema**: Domain schemas
- **DTOs**: Data transfer objects
- **Resolvers**: GraphQL resolvers

## Correct Effect-TS Usage Patterns

### Command Handler (Schema-First + Pure Functions)
```typescript
// 1. Define schema
const CreateUserCommand = createCommandSchema("CreateUser", Schema.Struct({
  email: Email,
  username: Username,
  password: Schema.String
}))

// 2. Pure command handler
const handleCreateUser = (state: UserState | null, cmd: CreateUserCommand) =>
  Effect.gen(function* () {
    // Validation via schema is automatic
    if (state !== null) {
      return { type: "failure", error: new UserAlreadyExists() }
    }
    
    const event = {
      type: "UserCreated",
      data: { email: cmd.payload.email, username: cmd.payload.username },
      metadata: createEventMetadata(cmd)
    }
    
    return { type: "success", events: [event] }
  })

// 3. Execute with services
const program = Effect.gen(function* () {
  const store = yield* EventStore
  const bus = yield* EventBus
  
  const aggregate = yield* store.load(aggregateId)
  const decision = yield* handleCreateUser(aggregate.state, command)
  
  if (decision.type === "success") {
    yield* store.append(aggregateId, decision.events)
    yield* bus.publishAll(decision.events)
  }
  
  return decision
})
```

### Service Layer Pattern
```typescript
// Define service interface
interface EventStore {
  readonly load: (id: AggregateId) => Effect.Effect<EventSourcedAggregate, EventStoreError>
  readonly append: (id: AggregateId, events: ReadonlyArray<DomainEvent>) => Effect.Effect<void, EventStoreError>
}

// Create service tag
class EventStore extends Context.Tag("EventStore")<EventStore, EventStore>() {}

// Implementation
const EventStoreLive = Layer.effect(
  EventStore,
  Effect.gen(function* () {
    const db = yield* Database
    
    return {
      load: (id) => Effect.gen(function* () {
        const events = yield* db.query("SELECT * FROM events WHERE aggregate_id = ?", [id])
        return rebuildAggregate(events)
      }),
      
      append: (id, events) => Effect.gen(function* () {
        yield* db.transaction(tx => 
          Effect.forEach(events, event =>
            tx.insert("events", event)
          )
        )
      })
    }
  })
)
```

### Resilience with Proper Schedule
```typescript
import * as Schedule from "effect/Schedule"

const retryPolicy = Schedule.exponential(Duration.millis(100)).pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(4))
)

const resilientOperation = pipe(
  loadAggregate(aggregateId),
  Effect.retry(retryPolicy),
  Effect.timeout(Duration.seconds(30)),
  Effect.catchTag("TimeoutException", () => 
    Effect.fail(new OperationTimedOut())
  )
)

## Migration Path

### From Class-Based to Schema-First

```typescript
// ❌ OLD: Class-based
class UserCreatedEvent extends DomainEvent {
  constructor(public email: string, public username: string) {
    super()
  }
}

// ✅ NEW: Schema-first
const UserCreatedEvent = createEventSchema("UserCreated", Schema.Struct({
  email: Email,
  username: Username
}))
```

### From Aggregate Classes to Pure Functions

```typescript
// ❌ OLD: Class with methods
class UserAggregate extends Aggregate {
  handle(command: Command) { /* ... */ }
  apply(event: Event) { /* ... */ }
}

// ✅ NEW: Pure functions
const handleUserCommand = (state: UserState | null, cmd: Command) =>
  Effect.gen(function* () { /* ... */ })

const applyUserEvent = (state: UserState | null, event: Event) =>
  match(event).with(/* ... */).exhaustive()
```

### From Promises to Effects

```typescript
// ❌ OLD: Promise-based
async function saveAggregate(aggregate: Aggregate): Promise<void> {
  try {
    await eventStore.save(aggregate.getEvents())
  } catch (error) {
    logger.error(error)
    throw error
  }
}

// ✅ NEW: Effect-based
const saveAggregate = (aggregate: EventSourcedAggregate) =>
  Effect.gen(function* () {
    const store = yield* EventStore
    yield* store.append(aggregate.id, aggregate.uncommittedEvents)
  }).pipe(
    Effect.tapError(error => Effect.log(`Save failed: ${error}`))
  )
```

## Bun-Specific Patterns

Always use Bun's native APIs:
- `Bun.serve()` for HTTP server
- `bun:sqlite` for SQLite 
- `Bun.file()` for file operations
- `bun:test` for testing
- Built-in `.env` loading
- `--hot` flag for hot reload

## GraphQL Architecture

### Schema Organization
- **Unified Schema**: Single schema at `src/schema.graphql`
- **Domain Schemas**: Individual domain GraphQL definitions
- **Code Generation**: Automatic type generation with strict mode

### Type Safety
- **gql.tada**: Compile-time GraphQL types
- **Custom Scalars**: Branded types for IDs
- **Strict Resolvers**: No implicit any types
- **Immutable Types**: Readonly generated types

### GraphQL Hive Integration
- Set `HIVE_API_TOKEN` environment variable
- Schema version control and monitoring
- Operation tracking and performance metrics
- Client usage analytics

## Testing Strategy

### Test Locations
- **Framework tests**: `packages/framework/src/effect/__tests__/`
- **Domain tests**: `src/domains/<domain>/__tests__/`
- **Integration tests**: `src/app/test-framework.ts`

### Test Commands
- `bun test` - Run all tests
- `bun test <path>` - Test specific file
- `bun run test:framework` - Framework integration test
- `bun run typecheck` - Verify type safety

## Development Workflow

1. **Start server**: `bun run dev`
2. **Modify code**: Make changes to domains or framework
3. **Generate types**: `bun run generate:all` (after schema changes)
4. **Type check**: `bun run typecheck`
5. **Run tests**: `bun test`
6. **Clean unused**: `bun run clean:unused`

## Environment Variables

```env
HIVE_API_TOKEN=<your_token>  # GraphQL Hive monitoring
PORT=3001                     # Server port (default: 3001)
NODE_ENV=development         # Environment mode
```

## Common Tasks

### Adding a New Domain
```bash
# 1. Create domain structure
mkdir -p src/domains/<domain>/{domain,application,infrastructure,api}

# 2. Define aggregate with Effect
# 3. Create command/event handlers
# 4. Add GraphQL schema
# 5. Register in server.ts
```

### Creating a New Domain (Schema-First Approach)
```typescript
// 1. Define schemas in src/domains/<domain>/schema.ts
import * as Schema from "@effect/schema/Schema"
import { createEventSchema, createCommandSchema } from "@cqrs/framework"

export const ProductCreatedEvent = createEventSchema("ProductCreated", Schema.Struct({
  name: Schema.String,
  price: Schema.Number
}))

export const CreateProductCommand = createCommandSchema("CreateProduct", Schema.Struct({
  name: Schema.String,
  price: Schema.Number
}))

// 2. Pure event applicator in src/domains/<domain>/domain.ts
export const applyProductEvent = (state: ProductState | null, event: ProductEvent) =>
  match(event)
    .with({ type: "ProductCreated" }, e => ({
      id: e.metadata.aggregateId,
      ...e.data,
      version: e.metadata.version
    }))
    .with({ type: "ProductDeleted" }, () => null)
    .exhaustive()

// 3. Command handler in src/domains/<domain>/handlers.ts
export const handleProductCommand = (state: ProductState | null, cmd: ProductCommand) =>
  Effect.gen(function* () {
    return match(cmd)
      .with({ type: "CreateProduct" }, c => {
        if (state !== null) {
          return { type: "failure", error: new ProductAlreadyExists() }
        }
        return {
          type: "success",
          events: [ProductCreatedEvent.create(c.payload, createMetadata(c))]
        }
      })
      .exhaustive()
  })

// 4. Wire up with services in src/domains/<domain>/service.ts
export const ProductServiceLive = Layer.effect(
  ProductService,
  Effect.gen(function* () {
    const store = yield* EventStore
    
    return {
      createProduct: (cmd) => Effect.gen(function* () {
        const aggregate = yield* store.load(cmd.aggregateId)
        const decision = yield* handleProductCommand(aggregate.state, cmd)
        
        if (decision.type === "success") {
          const newAggregate = applyEvents(applyProductEvent)(aggregate, decision.events)
          yield* store.save(newAggregate)
        }
        
        return decision
      })
    }
  })
)
```