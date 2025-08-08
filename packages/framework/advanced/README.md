# @cqrs-framework/advanced

Advanced event sourcing patterns and optimizations for CQRS framework applications.

## Features

- **Enhanced Aggregates** - Advanced aggregate base class with snapshots, metrics, and performance tracking
- **Event Handler Registry** - Sophisticated event handler system with middleware, retries, and error handling  
- **Optimized Event Store** - High-performance event store with streaming, batching, and indexing
- **Snapshot Management** - Intelligent snapshot strategies with automated cleanup and compression
- **Event Migration** - Schema evolution support with type-safe migrations and rollbacks
- **Pattern Matching** - Advanced event pattern matching with middleware and caching

## Installation

```bash
bun install @cqrs-framework/advanced
```

## Quick Start

```typescript
import { 
  EnhancedAggregate, 
  EventHandlerRegistry,
  InMemoryOptimizedEventStore,
  SnapshotManager 
} from '@cqrs-framework/advanced';

// Enhanced aggregate with snapshots
class MyAggregate extends EnhancedAggregate<MyState, MyEvent> {
  constructor(id: AggregateId) {
    super(id, myReducer, initialState, {
      autoSnapshot: true,
      snapshotFrequency: 100,
    });
  }
}

// Event handler with middleware
const registry = new EventHandlerRegistry();
registry.registerMiddleware(new LoggingMiddleware(logger));
registry.register(new MyEventHandler());
```

## Key Components

### Enhanced Aggregates

Advanced aggregate base class with built-in performance optimizations:

```typescript
const aggregate = new MyAggregate(aggregateId);

// Auto-snapshots every 100 events
// Performance metrics tracking
// Concurrency control
// Command validation
```

### Event Handler Registry

Sophisticated event processing with middleware support:

```typescript
// Register handlers with priorities
registry.register({
  eventType: 'UserCreated',
  priority: 100,
  handle: async (event) => { /* ... */ }
});

// Add middleware for cross-cutting concerns
registry.registerMiddleware(new MetricsMiddleware(collector));
```

### Optimized Event Store

High-performance event store with advanced features:

```typescript
const eventStore = new InMemoryOptimizedEventStore({
  batchSize: 100,
  enableIndexes: true,
  compactAfterSnapshot: true,
});

// Stream events efficiently
for await (const event of eventStore.streamAllEvents({ batchSize: 50 })) {
  await processEvent(event);
}
```

### Snapshot Management

Intelligent snapshot strategies:

```typescript
const snapshotManager = new SnapshotManager(
  snapshotStore,
  eventStore,
  { eventCountThreshold: 50 }
);

// Auto-creates snapshots based on strategies
await snapshotManager.shouldCreateSnapshot(aggregateId, version);
```

### Event Migration

Type-safe schema evolution:

```typescript
// Register field rename migration
registry.register(new FieldRenameMigration(
  'UserEvent',
  1, // from version
  2, // to version
  { oldField: 'newField' }
));

// Migrate events to latest version
const result = await registry.migrateToLatest(event);
```

### Pattern Matching

Advanced event pattern matching:

```typescript
const matcher = EventPatternBuilder
  .create<MyEvent>()
  .handle('UserCreated', (event) => handleUserCreated(event))
  .handleWhen(
    (event) => event.type.includes('Error'),
    (event) => handleError(event)
  )
  .withMiddleware(new CachingPatternMiddleware())
  .build();
```

## Architecture

This package provides advanced patterns for production CQRS applications:

- **Performance** - Optimized for high-throughput event processing
- **Scalability** - Streaming, batching, and indexing for large datasets  
- **Reliability** - Error handling, retries, and graceful degradation
- **Maintainability** - Schema evolution and migration support
- **Observability** - Built-in metrics and monitoring hooks

## Dependencies

- `@cqrs-framework/core` - Core event sourcing interfaces
- `@cqrs-framework/types` - Advanced type system and error handling

## License

MIT