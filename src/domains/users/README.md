# User Domain - Framework Integration

This document outlines how the User domain has been updated to better utilize the CQRS/Event Sourcing framework.

## Framework Integration Improvements

### 1. **Proper Framework Imports**

- Updated imports to use framework's main exports instead of individual module imports
- Using `createCommandBus`, `createEventBus`, `createQueryBus` from framework
- Leveraging framework's helper functions like `success`, `failure`, `createEventMetadata`

### 2. **Enhanced Domain Module Structure**

- Improved `UserDomainModule` with proper framework integration
- Added event store integration middleware for automatic event persistence
- Enhanced configuration options for better framework utilization

### 3. **Improved Aggregate Implementation**

- Updated `UserAggregate` to use framework's `matchEvent` utility
- Added additional query methods like `getProfile()` and `isActive()`
- Better error handling and state management

### 4. **Enhanced Command Handlers**

- Using framework's `success` and `failure` helper functions
- Improved error handling with proper error types
- Better command result structure with user data

### 5. **Improved Event Handlers**

- Using framework's `ProjectionBuilder` interface
- Better event subscription patterns
- Enhanced audit logging and email notification handlers

### 6. **Enhanced Query Handlers**

- Using framework's `IQueryHandler` interface properly
- Improved null checking and parameter validation
- Better search and pagination logic

### 7. **Framework-Aware Projections**

- Using framework's `createProjectionBuilder` function
- Leveraging `matchEvent` for type-safe event handling
- Better projection update patterns

## Key Framework Features Utilized

### Event Sourcing

- Proper event store integration
- Event-driven projection updates
- Event replay capabilities

### CQRS Pattern

- Clear separation of commands and queries
- Command handlers with proper result types
- Query handlers with efficient read models

### Type Safety

- Using framework's branded types (`AggregateId`, `Email`, `PersonName`)
- Type-safe event pattern matching
- Proper TypeScript interfaces throughout

### Validation

- Framework's validation middleware integration
- Command validation with proper error handling
- Type-safe validation results

### Infrastructure

- Framework's bus implementations (Command, Query, Event)
- Projection builders with update capabilities
- Repository pattern with event sourcing

## Usage Examples

### Initializing the Domain

```typescript
import { initializeUserDomain } from "./domains/users";

const userDomain = initializeUserDomain({
  enableCache: true,
  enableValidation: true,
  enableProjections: true,
});
```

### Executing Commands

```typescript
const result = await userDomain.commandBus.send({
  type: "CREATE_USER",
  aggregateId: "user-123",
  payload: { name: "John Doe", email: "john@example.com" },
});
```

### Querying Data

```typescript
const user = await userDomain.queryBus.ask({
  type: "GetUserById",
  parameters: { userId: "user-123" },
});
```

## Benefits of Framework Integration

1. **Consistency**: All domains follow the same patterns
2. **Type Safety**: Compile-time guarantees for data integrity
3. **Testability**: Framework provides testing utilities
4. **Scalability**: Event sourcing enables horizontal scaling
5. **Maintainability**: Clear separation of concerns
6. **Performance**: Efficient read models through projections

## Next Steps

- Add GraphQL integration using framework's GraphQL utilities
- Implement snapshot capabilities for performance
- Add monitoring and metrics using framework hooks
- Consider adding saga patterns for complex workflows
