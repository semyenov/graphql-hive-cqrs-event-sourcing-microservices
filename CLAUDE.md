# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
description: GraphQL Hive CQRS/Event Sourcing Microservices using Bun with Effect-TS
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

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
- **Effect imports**: `import { ... } from '@cqrs/framework/effect'`

### Core Technologies
- **Effect-TS v3**: Functional programming with type-safe error handling and dependency injection
- **Branded Types**: Type-safe domain primitives preventing primitive obsession
- **Pattern Matching**: Exhaustive event handling with ts-pattern
- **Zod**: Runtime validation for commands and queries

### Effect-TS Integration (`packages/framework/src/effect/`)

The framework now uses Effect-TS for all core functionality:

#### Command Effects (`core/command-effects.ts`)
- `createCommandHandler`: Effect-based command handlers with validation and execution phases
- `CommandContext`: Dependency injection for command handling
- `commandPipeline`: Compose command handling with middleware
- `withCommandRetry`, `withCommandCircuitBreaker`: Resilience patterns

#### Event Effects (`core/event-effects.ts`)
- `createEventHandler`: Process events with effects
- `createEventStream`: Stream-based event processing
- `createProjection`: Build projections from event streams
- `EventSourcing`: Complete event sourcing with snapshots

#### Repository Effects (`core/repository-effects.ts`)
- `createRepository`: Effect-based aggregate repository
- `withOptimisticLocking`: Version control for concurrent updates
- `createCachedRepository`: Performance optimization with caching
- `withTransaction`: Transactional aggregate operations

#### Resilience Patterns
- **Retry** (`patterns/retry.ts`): Exponential/linear backoff strategies
- **Circuit Breaker** (`patterns/circuit-breaker.ts`): Failure protection
- **Bulkhead**: Resource isolation and throttling
- **Timeout**: Operation time limits

#### Services (`services/index.ts`)
Pre-built service layers with dependency injection:
- `EventStoreService`: Event persistence
- `CommandBusService`: Command routing
- `LoggerService`: Structured logging
- `MetricsService`: Performance monitoring
- `CacheService`: In-memory caching
- `CoreServicesLive`: Complete service bundle

### Legacy Framework Components (_legacy/)

The original framework implementation remains available for migration purposes:

#### Core Abstractions (`_legacy/core/`)
- **Aggregate**: Base class with event application and snapshots
- **Command/Event/Query**: Type definitions and handlers
- **Repository**: Aggregate persistence abstraction
- **Branded Types**: Shared between legacy and Effect implementations

#### Infrastructure (`_legacy/infrastructure/`)
- **Event Store**: In-memory event persistence
- **Command/Event/Query Bus**: Message routing
- **Projections**: Read model builders
- **Snapshot Store**: Performance optimization

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

## Effect-TS Usage Patterns

### Command Handler Example
```typescript
const handler = createCommandHandler({
  canHandle: (cmd) => cmd.type === 'CreateUser',
  validate: (cmd) => validateUserData(cmd.payload),
  execute: (cmd) => Effect.gen(function* () {
    const repo = yield* RepositoryContext
    const aggregate = yield* repo.createAggregate(cmd.aggregateId)
    aggregate.create(cmd.payload)
    yield* repo.save(aggregate)
    return { userId: cmd.aggregateId }
  })
})
```

### Service Composition
```typescript
const AppLive = Layer.mergeAll(
  EventStoreServiceLive,
  CommandBusServiceLive,
  CoreServicesLive
)

const program = pipe(
  myEffect,
  Effect.provide(AppLive),
  Effect.runPromise
)
```

### Resilience Pattern
```typescript
const resilientEffect = pipe(
  effect,
  Effect.retry(exponentialBackoff({ maxAttempts: 5 })),
  withCircuitBreaker({
    failureThreshold: 3,
    timeout: Duration.seconds(30)
  })
)
```

## Migration Path

When migrating from legacy to Effect:

1. **Start with new domains**: Implement new features using Effect
2. **Gradual migration**: Use `adaptLegacyServices` for interop
3. **Preserve interfaces**: Keep `ICommand`, `IEvent` for compatibility
4. **Test thoroughly**: Use framework test suite to verify behavior

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

### Implementing Effect Command Handler
```typescript
import { createCommandHandler, Effect } from '@cqrs/framework/effect'

const handler = createCommandHandler({
  canHandle: (cmd) => cmd.type === 'YourCommand',
  execute: (cmd) => Effect.succeed({ result: 'success' })
})
```

### Creating Projection with Effect
```typescript
import { createProjection, Effect } from '@cqrs/framework/effect'

const projection = createProjection({
  name: 'UserList',
  handlers: {
    UserCreated: (event) => Effect.log(`User created: ${event.data.name}`)
  }
})
```