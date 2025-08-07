# Enhanced Generic Types for CQRS/Event Sourcing

## Overview

The `src/events/generic-types.ts` file has been significantly enhanced with advanced TypeScript patterns to provide a production-ready, type-safe foundation for CQRS and Event Sourcing implementations.

## Key Enhancements

### 1. Template Literal Types for Event Naming
- `PascalCase<S>` and `CamelCase<S>` type transformers
- `EventName<TAggregateType, TAction>` for consistent event naming
- `CommandName<TAggregateType, TAction>` for command naming
- Compile-time validation of naming conventions

### 2. Event Categorization System
- Three event categories: `domain`, `system`, `integration`
- `EventTypeCategory<TType>` maps events to categories
- Category-specific type guards: `isDomainEvent`, `isSystemEvent`, `isIntegrationEvent`
- Separate union types: `UserEvent`, `SystemEvent`, `IntegrationEvent`

### 3. Advanced Type Guards
- Generic `createTypeGuard<TType>` factory
- Category-based filtering
- Pre-defined guards for all event types
- Zero runtime overhead with compile-time safety

### 4. Enhanced Event Factories
- Generic `createEvent` with full type inference
- Automatic branded type conversion
- Type-safe payload validation
- Maintains backward compatibility

### 5. Event Versioning & Migration
- `EventSchemaVersion` type (1-5)
- `VersionedEvent<TEvent, TVersion>` interface
- `EventMigration<TFromVersion, TToVersion>` for schema evolution
- Type-safe migration strategies

### 6. Pattern Matching System
- `EventPattern<TEvent, TResult>` for exhaustive matching
- `PartialEventPattern` with default handling
- `matchEvent` and `matchEventPartial` helpers
- Compile-time exhaustiveness checking

### 7. Event Stream Processing
- `EventStream<TEvent>` interface with functional operations
- `EventProcessor<TEvent>` with backpressure support
- Async folding with `foldEventsAsync`
- Reactive stream transformations

### 8. Type-Safe Subscriptions
- `EventSubscription<TEvent>` with filtering options
- `EventBus<TEvent>` interface for pub/sub
- `SubscriptionOptions` for advanced filtering
- Batch processing support

### 9. Enhanced Command System
- `Command<TType, TPayload, TEvent, TError>` interface
- Built-in validation and authorization
- `CommandResult<TEvent, TError>` with metadata
- Command factories with type inference

### 10. Advanced Projections
- `Projection<TEvent, TReadModel>` base interface
- `MaterializedView<TEvent, TViewModel>` for queries
- Subscription support for reactive updates
- Performance optimized with indexing

### 11. Performance Optimizations
- `EventIndex<TEvent>` for O(1) type lookups
- `AggregateIndex<TEvent>` for aggregate queries
- `CompoundIndex<TEvent>` for version lookups
- `SnapshotStrategy` for optimization

### 12. Type Extraction Utilities
- `ExtractEventData<TEvent>` - get event payload type
- `ExtractEventType<TEvent>` - get event type literal
- `ExtractAggregateId<TEvent>` - get aggregate ID type
- `InferAggregateState<TEvent>` - infer state from events
- `InferAggregateType<TEvent>` - infer aggregate type

## Usage Examples

### Basic Event Creation
```typescript
// Type-safe event creation
const event = EventFactories.createUserCreated('user-123', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Pattern Matching
```typescript
const result = matchEvent(event, {
  UserCreated: (e) => `Welcome ${e.data.name}!`,
  UserUpdated: (e) => 'Profile updated',
  UserDeleted: () => 'Account deleted'
});
```

### Event Stream Processing
```typescript
const state = await foldEventsAsync(events, async (state, event) => {
  // Process with async operations
  await logEvent(event);
  return reducer(state, event);
}, initialState);
```

### Type-Safe Subscriptions
```typescript
eventBus.subscribe('UserCreated', async (event) => {
  // event is typed as UserCreatedEvent
  await sendWelcomeEmail(event.data.email);
});
```

## Benefits

1. **Compile-Time Safety**: All event operations are validated at compile time
2. **Zero Runtime Overhead**: Type guards and patterns compile to efficient JavaScript
3. **IntelliSense Support**: Full IDE autocomplete and type hints
4. **Backward Compatible**: Existing code continues to work unchanged
5. **Performance Optimized**: Built-in indexing and caching strategies
6. **Extensible**: Easy to add new event types and categories
7. **Production Ready**: Includes versioning, migration, and error handling

## Migration Guide

Existing code requires no changes. New features are opt-in:

1. Replace manual type guards with `createTypeGuard`
2. Use `EventFactories` instead of manual event creation
3. Implement `matchEvent` for cleaner switch statements
4. Add event versioning when schema changes are needed
5. Use indexes for performance-critical queries

## Future Enhancements

The foundation supports future additions:
- Effect-TS integration for functional error handling
- GraphQL subscription generation from event types
- Automatic projection generation from events
- Event sourcing snapshots with compression
- Distributed event streaming support