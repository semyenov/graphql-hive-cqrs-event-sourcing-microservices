# @cqrs-framework/client

Generic client patterns for CQRS/Event Sourcing framework applications.

## Features

- **Base GraphQL Client** - Generic GraphQL client with caching, retries, and error handling
- **Base CQRS Client** - Unified client that separates read and write operations
- **Eventual Consistency** - Patterns for handling eventual consistency in distributed systems  
- **Bulk Operations** - Efficient batch processing with progress tracking
- **Cache Warming** - Smart caching strategies with background warming
- **Persisted Documents** - GraphQL persisted queries support
- **Error Handling** - Comprehensive GraphQL and client error management

## Installation

```bash
bun install @cqrs-framework/client
```

## Quick Start

```typescript
import { BaseGraphQLClient, BaseCQRSClient } from '@cqrs-framework/client';

// Extend base clients for your domain
class MyReadClient extends BaseGraphQLClient {
  protected getClientName() { return 'my-read-client'; }
  protected getClientVersion() { return '1.0.0'; }
}

class MyCQRSClient extends BaseCQRSClient<User, CreateUserInput, UpdateUserInput> {
  // Implement abstract methods for your domain
}
```

## Key Concepts

### Eventual Consistency Handling

```typescript
import { eventualConsistency } from '@cqrs-framework/client';

// Wait for consistency
await eventualConsistency.waitForConsistency(100);

// Retry with backoff
const result = await eventualConsistency.withRetry(
  () => client.getUser(id),
  3, // max retries
  1000 // initial backoff
);
```

### Bulk Operations

```typescript
import { BulkOperationHandler } from '@cqrs-framework/client';

const bulk = new BulkOperationHandler();

// Process with progress tracking
for await (const progress of bulk.executeBulk(inputs, processItem)) {
  console.log(`Progress: ${progress.progress * 100}%`);
}
```

### Cache Warming

```typescript
import { CacheWarmingHandler } from '@cqrs-framework/client';

const cache = new CacheWarmingHandler();

// Warm cache intelligently
await cache.smartWarm(candidateKeys, loadFunction);
```

## Architecture

This package provides the foundation for building type-safe, efficient clients for CQRS applications:

- **Separation of Concerns** - Read and write operations use separate clients
- **Type Safety** - Full TypeScript support with generic interfaces
- **Performance** - Built-in caching, batching, and optimization strategies
- **Resilience** - Retry logic, error handling, and graceful degradation
- **Observability** - Progress tracking and metrics collection

## Dependencies

- `@cqrs-framework/core` - Core event sourcing types and interfaces
- `@cqrs-framework/types` - Advanced type system and error handling

## License

MIT