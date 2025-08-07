# Event Sourcing Overview

Event Sourcing is a pattern where state changes are stored as a sequence of events rather than updating data in place.

## Core Concepts

### Events
- Immutable records of something that happened
- Named in past tense (UserCreated, OrderPlaced)
- Contain all data needed to reconstruct the change

### Event Store
- Append-only log of all events
- Source of truth for the system
- Can be replayed to rebuild state

### Aggregates
- Domain objects that handle commands
- Produce events as a result of commands
- Rebuild their state from event history

## Benefits

1. **Complete Audit Trail**: Every change is recorded
2. **Time Travel**: Reconstruct state at any point in time
3. **Event Replay**: Rebuild projections or fix bugs
4. **Scalability**: Events can be processed asynchronously

## Implementation Pattern

```typescript
// Event
interface UserCreatedEvent {
  type: 'UserCreated';
  aggregateId: string;
  timestamp: Date;
  data: {
    name: string;
    email: string;
  };
}

// Command Handler
async function createUser(command: CreateUserCommand): Promise<UserCreatedEvent> {
  // Validate command
  // Create event
  // Store event
  // Return event
}

// Event Handler (Projection)
async function handleUserCreated(event: UserCreatedEvent): Promise<void> {
  // Update read model
  // Send notifications
  // Trigger workflows
}
```

## Integration with CQRS

- Commands produce events (write side)
- Events update projections (read side)
- Read models optimized for queries
- Complete separation of write and read paths