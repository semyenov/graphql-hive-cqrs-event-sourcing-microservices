# CQRS (Command Query Responsibility Segregation) Overview

CQRS is an architectural pattern that separates read and write operations into different models.

## Key Concepts

### Commands (Write Operations)
- Represent actions that change state
- Return acknowledgment or result of the operation
- Examples: CreateUser, UpdateProduct, DeleteOrder

### Queries (Read Operations)
- Retrieve data without modifying state
- Can be optimized independently from writes
- Examples: GetUser, ListProducts, SearchOrders

## Implementation in GraphQL

This project implements CQRS at the GraphQL schema level:

1. **Separate Schemas**
   - `readSchema.ts`: Contains all Query operations
   - `writeSchema.ts`: Contains all Mutation operations

2. **Runtime Routing**
   - Envelop plugin dynamically routes operations to the correct schema
   - Single GraphQL endpoint for clients
   - Operations are executed against different schemas based on type

3. **Benefits**
   - Independent scaling of read/write workloads
   - Clear separation of concerns
   - Easier to reason about data flow
   - Better performance optimization opportunities

## Example Structure

```typescript
// Read Schema (Queries)
type Query {
  getUser(id: ID!): User
  listUsers(limit: Int): [User!]!
}

// Write Schema (Mutations)
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}
```

## Pattern helpers and factories

- Define events with `defineEventFactory` and match with `matchEvent` or reducers from `createReducerFromEventPattern`.
- Define commands/queries with `createCommandFactory` / `createQueryFactory`.
- Register many handlers at once:

```ts
import { registerCommandPattern, registerQueryPattern, subscribeEventPattern } from '../../src/framework';

registerCommandPattern(commandBus, {
  CreateUser: async (cmd) => { /* ... */ return makeCommandSuccess(); },
  DeleteUser: async (cmd) => { /* ... */ return makeCommandSuccess(); },
});

registerQueryPattern(queryBus, {
  GetUserById: async (q) => repo.findById(q.parameters!.userId as string),
});

subscribeEventPattern(eventBus, {
  UserCreated: (e) => console.log('User created', e.aggregateId),
});
```