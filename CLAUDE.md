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

# Type Generation & Validation
bun run generate:all       # Generate both GraphQL types and gql.tada types
bun run codegen           # Generate GraphQL resolver types only
bun run gql:generate      # Generate gql.tada types only
bun run gql:check         # Validate GraphQL operations
bun run typecheck         # TypeScript type checking

# Production Optimizations
bun run gql:persisted     # Generate persisted GraphQL documents
bun run generate:manifest # Generate persisted documents manifest

# Demo & Testing
bun run src/examples/test-cqrs.ts    # Run CQRS demo
bun run src/examples/client-usage.ts # Test gql.tada client
```

## Framework Architecture (`src/framework/`)

### Core Components
The framework provides a generic, domain-agnostic foundation for CQRS/Event Sourcing:

#### Core Abstractions (`src/framework/core/`)
- **Aggregate** (`aggregate.ts`): Base class with event application, snapshots, and state management
- **Command** (`command.ts`): Command definitions with handlers and middleware support
- **Event** (`event.ts`): Event types with reducers and pattern matching
- **Query** (`query.ts`): Query definitions with projection builders
- **Repository** (`repository.ts`): Aggregate persistence abstraction
- **Branded Types** (`branded/`): Type-safe primitives (IDs, emails, versions, timestamps)

#### Infrastructure (`src/framework/infrastructure/`)
- **Event Store** (`event-store/memory.ts`): In-memory event persistence with replay
- **Command Bus** (`bus/command-bus.ts`): Routes commands to handlers with middleware
- **Event Bus** (`bus/event-bus.ts`): Event publishing with replay capabilities
- **Query Bus** (`bus/query-bus.ts`): Query routing with caching support
- **Projection Builder** (`projections/builder.ts`): Builds read models from event streams
- **Aggregate Repository** (`repository/aggregate.ts`): Generic aggregate persistence

### Framework Patterns
- **Event Reducers**: Pure functions that apply events to state
- **Snapshots**: Performance optimization for long event streams
- **Domain Modules**: Self-contained domain boundaries with own events/commands/aggregates
- **Middleware Pipeline**: Command preprocessing (validation, auth, logging)

## Domain Implementation (`src/domains/`)

### User Domain Example (`src/domains/users/`)
Demonstrates framework usage with a complete user management domain:

#### Structure
- **Aggregates** (`aggregates/`):
  - `user.ts`: UserAggregate with business logic (create, update, delete, verify)
  - `repository.ts`: UserRepository for persistence
- **Events** (`events/`):
  - `types.ts`: Event type definitions (UserCreated, UserUpdated, etc.)
  - `factories.ts`: Type-safe event factory functions
- **Commands** (`commands/`):
  - `types.ts`: Command definitions (CreateUser, UpdateUser, etc.)
  - `handlers.ts`: Command handlers that load aggregates and apply changes
- **Index** (`index.ts`): Domain module registration and GraphQL schema

#### Key Patterns in User Domain
- **Aggregate State Management**: UserState with profile, verification status
- **Event Sourcing**: All changes generate events (UserCreated, UserDeleted, etc.)
- **Command Handlers**: Load aggregate → Execute command → Save events
- **Type Safety**: Branded types for IDs, emails, names
- **GraphQL Integration**: Domain-specific schema extensions

### Adding New Domains
1. Create domain folder under `src/domains/`
2. Implement aggregate extending `Aggregate<TState, TEvent>`
3. Define events implementing `IEvent`
4. Create command handlers implementing `ICommandHandler`
5. Export domain module with `IDomainModule` interface
6. Register with framework buses (CommandBus, EventBus, QueryBus)

## Architecture: CQRS with Event Sourcing

### Core Pattern
The system implements **true CQRS** with complete separation of read and write models:

1. **Commands** → Generate **Events** → Stored in **Event Store**
2. **Events** → Build **Aggregates** (write model) & **Projections** (read model)
3. **GraphQL** → Routes **Queries** to projections, **Mutations** to commands

### Event Flow
1. Client sends GraphQL mutation
2. Mutation resolver creates command
3. CommandBus routes to appropriate handler
4. Handler loads aggregate from repository
5. Aggregate executes business logic, generates events
6. Repository saves events to EventStore
7. EventBus publishes events to projections
8. Projections update read models

### Type Safety Architecture

#### Branded Types (`src/framework/core/branded/`)
Prevents primitive obsession and type mixing:
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

## Bun-Specific Patterns

Always use Bun's native APIs:
- `Bun.serve()` for HTTP server (not Express/Koa)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.file()` for file operations (not fs)
- `bun:test` for testing (not Jest/Vitest)
- Built-in `.env` loading (no dotenv needed)
- `--hot` flag for hot reload in development

## GraphQL Hive Integration

Configured in `src/server.ts:38-52`:
- Set `HIVE_API_TOKEN` environment variable
- Monitors schema changes and operations
- Tracks client usage via headers
- Separate metrics for read/write operations

## Environment Variables

```env
HIVE_API_TOKEN=<your_token>  # GraphQL Hive monitoring
PORT=3001                     # Server port (default: 3001)
NODE_ENV=development         # Environment mode
```

## Testing Approach

- Unit tests: `bun test src/types/__tests__/`
- Integration tests: Run example scripts in `src/examples/`
- Type checking: `bun run typecheck` before commits

## Framework Refactoring Guidelines

### Clean Code Principles for CQRS Framework

#### Core Design Patterns to Follow
- **Single Responsibility**: Each class should have one reason to change
  - Split large domain builders (`enhanced-domain-builder.ts` 400+ lines)
  - Separate discovery concerns from registration logic
  - Extract type conversion logic into dedicated utilities

#### Framework Architecture Patterns
- **Builder Pattern**: Use for complex object construction (Domain, Schema, Context builders)
- **Strategy Pattern**: Implement for different discovery strategies and validation approaches
- **Factory Pattern**: Create consistent APIs for framework components
- **Chain of Responsibility**: Use for middleware and validation pipelines

#### Refactoring Priorities
1. **Extract Strategy Interfaces**: Replace hardcoded discovery patterns with pluggable strategies
2. **Split Large Classes**: Break down `EnhancedDomainBuilder` into focused components
3. **Eliminate Code Duplication**: Consolidate similar type extraction logic across handlers
4. **Improve Error Handling**: Implement Result types consistently across all operations
5. **Enhance Type Safety**: Use more specific branded types instead of generic ones

#### Framework Extension Points
- **IDiscoveryStrategy**: For custom component discovery patterns
- **IValidationStrategy**: For domain-specific validation approaches  
- **IProjectionStrategy**: For different read model building approaches
- **IMiddlewareStrategy**: For cross-cutting concerns (logging, metrics, auth)

### Refactoring Commands

```bash
# Before refactoring - run full test suite
bun test
bun run typecheck

# After refactoring - verify framework integrity
bun run src/examples/test-cqrs.ts
bun run generate:all
bun test --coverage
```

### Framework Component Guidelines

#### When Refactoring Core Components:
1. **Maintain Backward Compatibility**: Existing domains should work without changes
2. **Extract Interfaces First**: Define contracts before implementation
3. **Use Composition Over Inheritance**: Favor strategies and builders over class hierarchies
4. **Test Framework Changes**: Run both unit tests and integration examples
5. **Update Type Exports**: Ensure new interfaces are properly exported in `index.ts`

#### Code Organization Rules:
- **Core**: Abstract interfaces and contracts only
- **Infrastructure**: Concrete implementations with clear boundaries  
- **Utils**: Pure functions with no framework dependencies
- **Patterns**: Reusable implementation strategies