# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
description: GraphQL Hive CQRS/Event Sourcing Microservices using Bun
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
bun run generate:manifest # Generate persisted documents manifest

# Code Maintenance
bun run clean:unused      # Remove unused exports (using knip)
```

## Framework Architecture (`packages/framework/`)

The framework is now a **Bun workspace package** (`@cqrs/framework`) for better modularity and reusability.

### Package Structure
- **Location**: `packages/framework/`
- **Import**: `import { ... } from '@cqrs/framework'`
- **Submodules**: 
  - `@cqrs/framework/core` - Core abstractions
  - `@cqrs/framework/infrastructure` - Infrastructure implementations
  - `@cqrs/framework/testing` - Testing utilities

### Core Components
The framework provides a generic, domain-agnostic foundation for CQRS/Event Sourcing:

#### Core Abstractions (`packages/framework/src/core/`)
- **Aggregate** (`aggregate.ts`): Base class with event application, snapshots, and state management
- **Command** (`command.ts`): Command definitions with handlers and middleware support
- **Event** (`event.ts`): Event types with reducers and pattern matching
- **Query** (`query.ts`): Query definitions with projection builders
- **Repository** (`repository.ts`): Aggregate persistence abstraction
- **Branded Types** (`branded/`): Type-safe primitives (IDs, emails, versions, timestamps)
- **Errors** (`errors.ts`): Domain-specific error types

#### Infrastructure (`packages/framework/src/infrastructure/`)
- **Event Store** (`event-store/memory.ts`): In-memory event persistence with replay
- **Command Bus** (`bus/command-bus.ts`): Routes commands to handlers with middleware
- **Event Bus** (`bus/event-bus.ts`): Event publishing with replay capabilities
- **Query Bus** (`bus/query-bus.ts`): Query routing with caching support
- **Projection Builder** (`projections/builder.ts`): Builds read models from event streams
- **Aggregate Repository** (`repository/aggregate.ts`): Generic aggregate persistence
- **Snapshot Store** (`snapshot-store/memory.ts`): Performance optimization for aggregates

#### Testing (`packages/framework/src/testing/`)
- **Test Harness** (`harness.ts`): Testing utilities for framework components

### Framework Patterns
- **Event Reducers**: Pure functions that apply events to state
- **Snapshots**: Performance optimization for long event streams
- **Domain Modules**: Self-contained domain boundaries with own events/commands/aggregates
- **Middleware Pipeline**: Command preprocessing (validation, auth, logging)
- **Pattern Matching**: Type-safe event handling with exhaustive checks

## Domain Implementation (`src/domains/`)

### Layered Architecture Pattern
Each domain follows a clean architecture with four distinct layers:

#### 1. Domain Layer (`domain/`)
Pure business logic with no framework dependencies:
- **Aggregates**: Core business entities and logic
- **Events**: Domain event types and factories
- **Commands**: Command type definitions
- **Queries**: Query type definitions
- **Types**: Domain value objects and types
- **Errors**: Domain-specific error definitions

#### 2. Application Layer (`application/`)
Orchestrates use cases and workflows:
- **Command Handlers**: Execute commands, load aggregates, apply changes
- **Query Handlers**: Process queries against projections
- **Services**: Cross-cutting concerns (if needed)

#### 3. Infrastructure Layer (`infrastructure/`)
Technical implementations:
- **Persistence**: Repository implementations
- **Projections**: Read model builders
- **Event Handlers**: Side effects and integrations
- **Validation**: Command validators

#### 4. API Layer (`api/`)
External interfaces:
- **GraphQL Schema**: Domain-specific schema definitions
- **DTOs**: Data transfer objects for API boundaries
- **Resolvers**: GraphQL resolver implementations (if separate from handlers)

### User Domain Example (`src/domains/users/`)
Complete implementation demonstrating all patterns:

#### Domain Layer Files
- `user.aggregate.ts`: UserAggregate with create, update, delete, verify operations
- `user.events.ts`: Event types (UserCreated, UserUpdated, etc.) and factories
- `user.commands.ts`: Command definitions (CreateUser, UpdateUser, etc.)
- `user.queries.ts`: Query definitions (GetUser, ListUsers, GetStats)
- `user.types.ts`: UserState, UserProfile, verification status types

#### Application Layer Organization
- `commands/`: Individual handler files for each command
- `queries/`: Individual handler files for each query
- Clean separation of concerns with single responsibility

#### Infrastructure Components
- `persistence/user.repository.ts`: UserRepository extending AggregateRepository
- `projections/`: Separate projection files (details, list, stats)
- `events/event.handlers.ts`: Side effect handlers (notifications, etc.)
- `validation/command.validators.ts`: Input validation middleware

#### Module Bootstrap (`user.module.ts`)
- Wires all components together
- Registers handlers with buses
- Configures projections and event handlers
- Exports domain context for application use

### Adding New Domains
1. Create domain folder: `src/domains/<domain-name>/`
2. Implement layers following the pattern above
3. Define aggregate extending `Aggregate<TState, TEvent>`
4. Create events implementing `IEvent` with factories
5. Implement command/query handlers with proper typing
6. Create domain module with initialization logic
7. Register in application server (`src/app/server.ts`)

## Architecture: CQRS with Event Sourcing

### Core Pattern
True CQRS implementation with complete separation:

1. **Commands** → Generate **Events** → Stored in **Event Store**
2. **Events** → Build **Aggregates** (write model) & **Projections** (read model)
3. **GraphQL** → Routes **Queries** to projections, **Mutations** to commands

### Event Flow
1. Client sends GraphQL mutation
2. Resolver creates command with validated input
3. CommandBus routes to appropriate handler
4. Handler loads aggregate from repository
5. Aggregate executes business logic, generates events
6. Repository saves events to EventStore
7. EventBus publishes events to projections
8. Projections update read models
9. Queries read from optimized projections

### Type Safety Architecture

#### Branded Types (`packages/framework/src/core/branded/`)
Prevents primitive obsession and ensures type safety:
```typescript
AggregateId, EventId, UserId    // ID types
Email, PersonName               // Validated strings
EventVersion, AggregateVersion  // Versioning
Timestamp                       // Time tracking
```

#### GraphQL Code Generation (`codegen.yml`)
- **Strict mode**: Maximum type safety enabled
- **Domain mappers**: GraphQL types → Domain models
- **Custom scalars**: ID types map to branded types
- **Immutable types**: All generated types are readonly
- **No index signatures**: Prevents any-typed access

### Key Implementation Patterns

#### Aggregate Pattern
```typescript
class UserAggregate extends Aggregate<UserState, UserEvent> {
  create(data): void {
    const event = UserEventFactories.createUserCreated(...)
    this.applyEvent(event, true) // true = new event
  }
}
```

#### Command Handler Pattern
```typescript
class CreateUserCommandHandler implements ICommandHandler {
  async handle(command): Promise<Result> {
    const aggregate = repository.createAggregate(id)
    aggregate.create(command.payload)
    await repository.save(aggregate)
  }
}
```

#### Event Reducer Pattern
```typescript
const userReducer: EventReducer<UserEvent, UserState> = (state, event) => {
  switch(event.type) {
    case UserEventTypes.UserCreated:
      return { ...initialState, ...event.data }
  }
}
```

#### Projection Pattern
```typescript
class UserDetailsProjection extends ProjectionBuilder {
  handleUserCreated(event): void {
    this.state.set(event.aggregateId, event.data)
  }
}
```

## Bun-Specific Patterns

Always use Bun's native APIs:
- `Bun.serve()` for HTTP server (not Express/Koa)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.file()` for file operations (not fs)
- `bun:test` for testing (not Jest/Vitest)
- Built-in `.env` loading (no dotenv needed)
- `--hot` flag for hot reload in development

## GraphQL Hive Integration

Configured in application server:
- Set `HIVE_API_TOKEN` environment variable
- Monitors schema changes and operations
- Tracks client usage via headers
- Separate metrics for read/write operations
- Schema registry for versioning

## Environment Variables

```env
HIVE_API_TOKEN=<your_token>  # GraphQL Hive monitoring
PORT=3001                     # Server port (default: 3001)
NODE_ENV=development         # Environment mode
```

## Testing Approach

- **Unit tests**: Domain logic in `__tests__/` folders
- **Integration tests**: `bun run test:framework`
- **Type checking**: `bun run typecheck` before commits
- **GraphQL validation**: `bun run gql:check`
- **Test specific files**: `bun test <path>`

## Development Workflow

1. **Start development server**: `bun run dev`
2. **Make changes** to domain or framework code
3. **Generate types** after schema changes: `bun run generate:all`
4. **Run type checking**: `bun run typecheck`
5. **Test changes**: `bun test` or `bun run test:framework`
6. **Clean unused code**: `bun run clean:unused`