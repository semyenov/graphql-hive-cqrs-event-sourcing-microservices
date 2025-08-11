# CQRS/Event Sourcing Framework

A generic, domain-agnostic framework for implementing CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns in TypeScript applications.

## Features

- **Event Sourcing**: Immutable event storage with replay capabilities
- **CQRS Pattern**: Complete separation of read and write models
- **Aggregate Pattern**: Domain consistency boundaries with snapshot support
- **Command & Query Buses**: Routing with middleware support
- **Projection Builders**: Automated read model generation from events
- **Type Safety**: Full TypeScript support with branded types
- **Testing Utilities**: Built-in test harness for framework components

## Installation

This package is part of the workspace and can be imported directly:

```typescript
import { Aggregate, Command, Event } from '@cqrs/framework';
```

## Core Components

### Aggregates
Base class for domain aggregates with event application and state management.

### Commands
Command definitions with handlers and middleware pipeline support.

### Events
Event types with reducers and pattern matching for type-safe handling.

### Queries
Query definitions with projection builders for read models.

### Infrastructure
- Event Store (in-memory implementation)
- Command, Event, and Query buses
- Repository pattern implementation
- Projection builders
- Snapshot store for performance

## Usage

See the main application for example implementations in the user domain.