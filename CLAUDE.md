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
```

## Architecture: CQRS with Event Sourcing

### Dual Schema Strategy
The system uses **separate GraphQL schemas** for reads and writes, dynamically routed at runtime via the CQRS Envelop plugin (`src/plugins/cqrsPlugin.ts`):

- **Read Schema** (`src/schemas/read.graphql`): Query operations, served by `readSchema.ts`
- **Write Schema** (`src/schemas/write.graphql`): Mutations, served by `writeSchemaV2.ts`
- **Runtime Routing**: Operations are routed based on type (query vs mutation)

### Event Sourcing Pattern
Commands generate immutable events stored in an append-only log:

1. **Events**: Domain events with branded types (`src/events/generic-types.ts`)
2. **Aggregates**: Rebuild state from events (`src/events/GenericAggregate.ts`)
3. **Event Store**: Persistence layer (`src/events/optimized-event-store.ts`)
4. **Projections**: Read models built from event streams

### Type Safety Architecture

#### Branded Types System
The codebase uses branded types (`src/types/branded.ts`) for compile-time safety:
- `AggregateId`, `UserId`, `EventId` - Prevent ID type mixing
- `Email`, `PersonName` - Domain-specific string types
- `EventVersion`, `AggregateVersion` - Numeric constraints

#### GraphQL Type Generation
Multiple type generation strategies via `codegen.yml`:
- **Resolver Types**: Context-aware resolver signatures with domain model mappers
- **Command Types**: CQRS command definitions for mutations
- **Projection Types**: Read model types for queries
- **gql.tada**: Zero-runtime GraphQL client types with dual schema support

### Key Implementation Files

- **Server Entry**: `src/server.ts` - GraphQL Yoga with Hive monitoring
- **CQRS Plugin**: `src/plugins/cqrsPlugin.ts` - Schema routing logic
- **Event System**: `src/events/interfaces.ts` - Core event sourcing contracts
- **Type Guards**: `src/types/validation.ts` - Runtime type validation
- **Clients**: `src/clients/CQRSClient.ts` - Type-safe GraphQL client

## Bun-Specific Patterns

Always use Bun's native APIs:
- `Bun.serve()` for HTTP (not Express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.file()` for file operations
- `bun:test` for testing (not Jest/Vitest)
- Built-in `.env` loading (no dotenv needed)

## GraphQL Hive Integration

Monitoring is configured in `src/server.ts`:
- Requires `HIVE_API_TOKEN` environment variable
- Tracks both read and write operations separately
- Client info extracted from request headers
- Performance metrics per operation type