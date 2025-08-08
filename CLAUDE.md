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

## Architecture: CQRS with Event Sourcing

### Core Pattern
The system implements **true CQRS** with complete separation of read and write models:

1. **Commands** → Generate **Events** → Stored in **Event Store**
2. **Events** → Build **Aggregates** (write model) & **Projections** (read model)
3. **GraphQL** → Routes **Queries** to projections, **Mutations** to commands

### Schema Architecture
Currently using a **unified schema** (`src/schema.graphql`) with runtime separation:
- **Queries**: Read from projections/read models
- **Mutations**: Execute commands that generate events
- **CQRS Plugin** (`src/plugins/cqrsPlugin.ts`): Routes operations appropriately

### Event Sourcing Implementation

#### Core Types (`src/core/types.ts`)
- `IEvent<TType, TData, TAggregateId>`: Base event interface
- `ICommand<TType, TPayload, TResult>`: Command intent
- `IAggregate<TState, TEvent, TAggregateId>`: Consistency boundary
- `IProjection<TEvent, TReadModel>`: Read model builder

#### Domain Layer (`src/domain/`)
- **Aggregates** (`aggregates/`): Business logic and invariants
- **Events** (`events/`): Domain event definitions with factories
- **Interfaces** (`interfaces.ts`): Repository and store contracts

#### Infrastructure (`src/infrastructure/`)
- **Event Store** (`event-store/optimized.ts`): In-memory implementation
- **Memory Store** (`event-store/memory.ts`): Alternative storage

### Type Safety Architecture

#### Branded Types (`src/core/branded.ts`)
Prevents primitive obsession and type mixing:
```typescript
UserId, AggregateId, EventId    // ID types
Email, PersonName               // Validated strings
EventVersion, AggregateVersion  // Versioning
Money, Percentage              // Constrained numbers
```

#### GraphQL Code Generation (`codegen.yml`)
- **Strict mode**: Maximum type safety enabled
- **Domain mappers**: GraphQL types → Domain models
- **Custom scalars**: ID types map to branded types
- **Immutable types**: All generated types are readonly

#### gql.tada Configuration
- **Type-safe clients** in `src/clients/`:
  - `CQRSClient.ts`: Unified client
  - `TypedReadClient.ts`: Query operations
  - `TypedWriteClient.ts`: Mutation operations
- **Persisted documents** for production optimization

### Key Implementation Patterns

#### GraphQL Context (`src/server.ts:7-25`)
```typescript
interface GraphQLContext {
  services: {
    userRepository: UserRepository
    eventStore: IEventStore<UserEvent>
    commandBus?: EventBus
  }
  // Request metadata, timing, client info
}
```

#### Event Pattern Matching (`src/domain/patterns/matching.ts`)
Type-safe event handling with exhaustive pattern matching

#### Repository Pattern (`src/repositories/index.ts`)
Abstracts storage concerns from domain logic

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