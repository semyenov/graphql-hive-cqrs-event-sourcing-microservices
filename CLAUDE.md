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

# Framework-specific Commands (in packages/framework/)
cd packages/framework
bun run demo              # Run simple demo (src/examples/simple-demo.ts)
bun run demo:full         # Run full demo (src/examples/demo.ts)
bun run monitor           # Start monitoring server
bun run cli              # Run pipe generator CLI
```

## Federation Package Commands (`packages/federation/`)

```bash
# Run Federation Examples
cd packages/federation
bun run demo                                        # Full federation demo
bun run demo:quick                                  # Quick demo
bun src/examples/run-federation-example.ts schema   # Schema generation demo
bun src/examples/run-federation-example.ts entities # Entity resolution demo

# Start Yoga GraphQL Federation Server
bun run demo:server                                 # Start server on port 4000
bun run dev                                         # Development mode with hot reload
PORT=5000 bun src/examples/yoga-federation-server.ts # Custom port
```

## Framework Architecture (`packages/framework/`)

The framework is a **Bun workspace package** (`@cqrs/framework`) providing a functional, Effect-TS based CQRS/Event Sourcing foundation.

### Package Structure

#### Framework Package
- **Location**: `packages/framework/`
- **Import**: `import { ... } from '@cqrs/framework'`
- **Purpose**: Core CQRS/Event Sourcing patterns with Effect-TS

#### Federation Package
- **Location**: `packages/federation/`
- **Import**: `import { ... } from '@cqrs/federation'`
- **Purpose**: GraphQL Federation support with automatic schema generation

### Core Technologies
- **Effect-TS v3**: Functional programming with type-safe error handling and dependency injection
- **Effect Schema**: Schema-first development (replacing Zod)
- **Branded Types**: Type-safe domain primitives preventing primitive obsession
- **Pattern Matching**: Exhaustive event handling with ts-pattern
- **GraphQL Federation**: Native federation support with automatic schema generation

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

## GraphQL Federation Features

### Key Components
- **FederationEntity**: Type-safe entity configuration with resolvers
- **DomainSchemaConfig**: Complete domain configuration for federation
- **Schema to GraphQL Type Conversion**: Automatic GraphQL type generation from Effect Schemas
- **Federation Directives**: Full Apollo Federation v2 support

### Federation Pattern
```typescript
// 1. Define domain schema with Effect Schema
const UserState = Schema.Struct({
  id: UserId,
  email: Email,
  username: Username
})

// 2. Create federation entity
const userEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  resolveReference: (ref) => Effect.succeed(getUserById(ref.id)),
  fields: {}
}

// 3. Generate federated schema
const schema = await Effect.runPromise(
  buildFederatedSchema({
    entities: [userEntity],
    commands: { CreateUser: CreateUserCommand },
    queries: { GetUser: GetUserQuery },
    events: { UserCreated: UserCreatedEvent }
  })
)
```

## Framework API Design Principles

### 1. Schema-First Development
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

### 2. Pure Functions Only
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

### 3. Effect-Native Operations
```typescript
// All operations return Effects
const handleCommand = (cmd: Command) => Effect.gen(function* () {
  const store = yield* EventStore
  const events = yield* store.getEvents(cmd.aggregateId)
  // ...
})
```

## Effect Pattern Compliance

Follow these patterns from EFFECT_PATTERNS.md:

### 1. Generator Syntax
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

### 2. Error Handling
```typescript
// ✅ CORRECT: Use Effect.fail
return yield* Effect.fail(new ValidationError({ field: "email" }))

// ❌ WRONG: Throwing in Effect.sync
Effect.sync(() => { throw new Error("Failed") })
```

### 3. Service Pattern
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
   - `users/`: User domain with complete CQRS implementation

2. **Legacy Domains** (`src/_legacy_domains/`)
   - Old class-based implementations being migrated

3. **Framework Examples** (`packages/framework/src/examples/`)
   - `simple-demo.ts`: Basic CQRS/ES patterns
   - `product-domain.ts`: Domain implementation with Effect
   - Other framework-specific examples

4. **Federation Examples** (`packages/federation/src/examples/`)
   - `federation-example.ts`: Complete federation patterns
   - `yoga-federation-server.ts`: Working GraphQL server with federation
   - `run-federation-example.ts`: CLI runner for demonstrations

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

## Testing Strategy

### Test Locations
- **Framework tests**: `packages/framework/src/__tests__/`
- **Domain tests**: `src/domains/<domain>/__tests__/`
- **Integration tests**: `src/app/test-framework.ts`

### Test Commands
- `bun test` - Run all tests
- `bun test <path>` - Test specific file
- `bun run test:framework` - Framework integration test
- `bun run typecheck` - Verify type safety

### Test Pattern
```typescript
import { test, expect } from "bun:test"
import * as Effect from "effect/Effect"

test("should handle command", async () => {
  const result = await Effect.runPromise(
    handleCommand(command)
  )
  expect(result.type).toBe("success")
})
```

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

# 2. Define schemas with Effect Schema
# 3. Create pure function handlers
# 4. Add GraphQL federation entity
# 5. Register in server.ts
```

### Creating a Federation Entity
```typescript
// 1. Define schemas
import * as Schema from "@effect/schema/Schema"
import { FederationEntity } from "@cqrs/federation"

// 2. Create entity with resolver
export const productEntity: FederationEntity<ProductState> = {
  typename: "Product",
  key: "id",
  schema: ProductState,
  resolveReference: (reference) => 
    Effect.succeed(getProductById(reference.id)),
  fields: {
    // Add custom field resolvers if needed
  }
}

// 3. Build federated schema
const schema = await Effect.runPromise(
  buildFederatedSchema({
    entities: [productEntity],
    commands: { CreateProduct },
    queries: { GetProduct },
    events: { ProductCreated }
  })
)
```

### Running Federation Server
```typescript
// Start the Yoga GraphQL server with federation
import { createYogaServer } from "@cqrs/federation/examples"

const yoga = await createYogaServer()
// Server will be available at http://localhost:4000
// GraphiQL at http://localhost:4000/graphiql
```

Or use the provided scripts:
```bash
cd packages/federation
bun run demo:server  # Start the federation server
bun run dev         # Start with hot reload
```

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
- **Federation Support**: Apollo Federation v2 with automatic schema generation
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