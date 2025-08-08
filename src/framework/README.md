# Framework Public API

This document describes the public API exports of the CQRS/Event Sourcing framework.

## Core Exports

### Essential Types and Interfaces
- `IEvent`, `ICommand`, `IQuery` - Base interfaces
- `IAggregate`, `ISnapshot` - Aggregate types  
- `IEventStore`, `ICommandBus`, `IQueryBus`, `IEventBus` - Infrastructure interfaces
- `ICommandHandler`, `IQueryHandler`, `EventHandler` - Handler interfaces
- `IProjection`, `IProjectionBuilder` - Projection interfaces

### Base Classes
- `Aggregate` - Base aggregate class with event sourcing
- `BaseValidator`, `SchemaValidator` - Validation base classes
- `ProjectionBuilder` - Base projection builder

### Factory Functions (Commonly Used)
- `createEventStore()` - Create event store
- `createCommandBus()` - Create command bus
- `createQueryBus()` - Create query bus  
- `createEventBus()` - Create event bus
- `createProjectionBuilder()` - Create projection builder

### Helper Functions (Used by Domains)
- `matchEvent()` - Type-safe event pattern matching
- `createEventTypeGuard()` - Create event type guards
- `createCommandResult()` - Create command results

### Validation Utilities  
- `ValidationRules` - Common validation rules
- `createCommandValidator()` - Create command validators
- `createQueryValidator()` - Create query validators

### Branded Types
- `BrandedTypes` - Factory for creating branded types
- Common types: `AggregateId`, `EventId`, `UserId`, `Email`, etc.

## Internal Exports

The following are exported but primarily for internal framework use:
- Event utility functions (processEvents, filterEventsByType, etc.)
- Type utilities (PartialBy, RequiredBy, etc.)
- Advanced helpers (retry, batch, debounce, throttle)

These may be used by advanced users but are not part of the core public API.