# Architecture Overview

## Project Structure

```
src/
├── app/                    # Application entry points
│   ├── server.ts          # Main GraphQL server
│   └── test-framework.ts  # Framework test harness
│
├── domains/               # Domain modules (DDD bounded contexts)
│   └── users/            # User domain module
│       ├── aggregates/   # Domain aggregates (write model)
│       ├── commands/     # Command definitions and handlers
│       ├── events/       # Domain events
│       ├── projections/  # Read model projections
│       ├── queries/      # Query definitions and handlers
│       ├── validators/   # Command/query validation
│       └── index.ts      # Domain module export
│
└── framework/            # CQRS/Event Sourcing framework
    ├── core/            # Core abstractions
    │   ├── aggregate.ts # Aggregate root base class
    │   ├── command.ts   # Command interfaces
    │   ├── event.ts     # Event interfaces
    │   ├── query.ts     # Query interfaces
    │   ├── branded/     # Branded types for type safety
    │   └── validation.ts # Validation framework
    │
    └── infrastructure/  # Infrastructure implementations
        ├── bus/        # Command, Query, Event buses
        ├── event-store/ # Event persistence
        └── projections/ # Projection builders
```

## Entry Points

### Main Server (`src/app/server.ts`)
The primary application entry point that:
- Initializes the framework
- Registers domain modules
- Sets up GraphQL server with Yoga
- Configures infrastructure (event stores, buses)

### Test Framework (`src/app/test-framework.ts`)
A test harness for validating framework functionality:
- Tests aggregate creation and event sourcing
- Validates command/event flow
- Ensures repository operations work correctly

## Public APIs

### Framework (`src/framework/index.ts`)
Exports the core framework components for domain implementations:
- Core interfaces and base classes
- Infrastructure factories (createEventStore, createCommandBus, etc.)
- Helper utilities for domains
- Branded types for type safety

### User Domain (`src/domains/users/index.ts`)
Example domain module that exports:
- Domain aggregates and entities
- Command/Query types and handlers
- Event types and factories
- Domain initialization function

## Key Design Patterns

### CQRS (Command Query Responsibility Segregation)
- **Commands**: Modify state through aggregates
- **Queries**: Read from optimized projections
- **Separation**: Write and read models are completely separate

### Event Sourcing
- **Event Store**: Persistent log of all domain events
- **Aggregates**: Rebuilt from event history
- **Projections**: Read models built from events

### Domain-Driven Design
- **Bounded Contexts**: Each domain is isolated
- **Aggregates**: Consistency boundaries
- **Value Objects**: Branded types for domain primitives

### Type Safety
- **Branded Types**: Prevent primitive obsession
- **Discriminated Unions**: Type-safe event handling
- **Exhaustive Checking**: Compiler-enforced completeness

## Development Tools

### Scripts
- `scripts/generate-domain.ts`: Generate new domain boilerplate

### Testing
- `bun test`: Run all tests
- `bun run typecheck`: TypeScript type checking
- `bunx knip`: Find unused code and dependencies

## Configuration

### Knip (`knip.json`)
Configured to analyze:
- Entry points: app/server.ts, app/test-framework.ts
- Ignores: archive/, tests, generated code

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- Target: ES2022
- Module: ESNext
- Paths configured for framework imports