# @cqrs-framework/core

Universal CQRS/Event Sourcing framework core components with complete type safety.

## Features

- **Type-Safe Event Sourcing**: Full TypeScript support with branded types and compile-time safety
- **Generic Aggregates**: Base aggregate class with pattern matching and event handling
- **Universal Error Handling**: Rich error types with discriminated unions and result types
- **Validation Framework**: Advanced validation with template literal types
- **Event Stores**: In-memory event store with optimistic concurrency control
- **Pattern Matching**: Type-safe event pattern matching without `any` types
- **Event Handlers**: Generic event handling system with middleware support

## Installation

```bash
npm install @cqrs-framework/core
# or
bun add @cqrs-framework/core
```

## Quick Start

```typescript
import { 
  Aggregate, 
  createEventStore, 
  matchEvent,
  BrandedTypes 
} from '@cqrs-framework/core';

// Define your domain events
interface UserCreated extends Event {
  type: 'UserCreated';
  data: { name: string; email: string };
}

interface UserUpdated extends Event {
  type: 'UserUpdated';
  data: { name?: string; email?: string };
}

type UserEvent = UserCreated | UserUpdated;

// Create aggregate
class UserAggregate extends Aggregate<UserState, UserEvent> {
  protected handleEvent(event: UserEvent): void {
    this.state = matchEvent(event, {
      UserCreated: (e) => ({
        id: e.aggregateId,
        name: e.data.name,
        email: e.data.email,
        createdAt: e.timestamp,
        updatedAt: e.timestamp,
      }),
      UserUpdated: (e) => ({
        ...this.state!,
        ...(e.data.name && { name: e.data.name }),
        ...(e.data.email && { email: e.data.email }),
        updatedAt: e.timestamp,
      }),
    });
  }

  createUser(name: string, email: string): void {
    const event = this.createEvent('UserCreated', { name, email });
    this.applyEvent(event, true);
  }
}

// Use event store
const eventStore = createEventStore<UserEvent>();
const userId = BrandedTypes.aggregateId('user-123');
const user = new UserAggregate(userId);

user.createUser('John Doe', 'john@example.com');
await eventStore.appendBatch(user.getUncommittedEvents());
```

## Core Concepts

### Branded Types
Compile-time type safety with runtime validation:

```typescript
import { BrandedTypes, type UserId, type Email } from '@cqrs-framework/core';

const userId = BrandedTypes.userId('user-123'); // Type: UserId
const email = BrandedTypes.email('user@example.com'); // Type: Email

// Prevents mixing incompatible types
function sendEmail(userId: UserId, email: Email) { /* ... */ }
sendEmail(email, userId); // TypeScript error!
```

### Error Handling
Rich error types with discriminated unions:

```typescript
import { ErrorFactory, Result } from '@cqrs-framework/core';

const validateUser = (data: unknown): Result<UserData, ValidationError> => {
  if (!isValidEmail(data.email)) {
    return Result.err(ErrorFactory.validation({
      code: ErrorCodes.INVALID_FORMAT,
      message: 'Invalid email format',
      field: 'email',
    }));
  }
  
  return Result.ok(data as UserData);
};
```

### Pattern Matching
Type-safe event pattern matching:

```typescript
import { matchEvent, createEventPattern } from '@cqrs-framework/core';

// Direct pattern matching
const result = matchEvent(event, {
  UserCreated: (e) => `User ${e.data.name} created`,
  UserUpdated: (e) => `User updated`,
  UserDeleted: (e) => `User deleted`,
});

// Fluent builder pattern
const processor = createEventPattern<UserEvent, string>()
  .on('UserCreated', (e) => `Created: ${e.data.name}`)
  .on('UserUpdated', (e) => 'Updated')
  .otherwise((e) => 'Unknown event');
```

## API Reference

### Core Types
- `Event` - Base event interface
- `Command` - Base command interface  
- `Aggregate<TState, TEvent>` - Base aggregate class
- `IEventStore<TEvent>` - Event store interface
- `Result<T, E>` - Result type for error handling

### Branded Types
- `AggregateId`, `EventId`, `CorrelationId` - Framework ID types
- `Timestamp`, `EventVersion` - Framework value types
- `BrandedTypes` - Type constructors with validation

### Error Types
- `DomainError`, `ValidationError`, `BusinessRuleError` - Domain errors
- `InfrastructureError`, `ApplicationError` - System errors  
- `ErrorFactory` - Error creation utilities
- `Result` - Result type helpers

## License

MIT