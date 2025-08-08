# GraphQL-to-CQRS Bridge

A comprehensive bridge for seamlessly connecting GraphQL operations to CQRS (Command Query Responsibility Segregation) infrastructure.

## Overview

This bridge provides:
- **Type-safe resolver factories** for mutations and queries
- **Automatic command/query mapping** from GraphQL inputs
- **Error handling and transformation** to GraphQL-compliant errors
- **Context building** with CQRS buses
- **Schema composition** from multiple domains
- **Built-in caching** for queries
- **Subscription support** via event bus

## Quick Start

```typescript
import { 
  setupGraphQLBridge,
  createMutationResolver,
  createQueryResolver 
} from '@framework/graphql';

// Setup the bridge
const yoga = setupGraphQLBridge({
  commandBus,
  queryBus,
  eventBus,
  domains: [userDomain, orderDomain],
  graphiql: true,
});

// Create a Bun server
Bun.serve({
  port: 3000,
  fetch: yoga.handle,
});
```

## Core Components

### 1. Context Builder

Creates GraphQL context with CQRS infrastructure:

```typescript
const contextBuilder = createContextBuilder({
  commandBus,
  queryBus,
  eventBus,
  extractUserId: (req) => req.headers.get('x-user-id'),
});
```

### 2. Mutation Resolver Factory

Maps GraphQL mutations to commands:

```typescript
const createUser = createMutationResolver({
  commandType: UserCommandTypes.CreateUser,
  mapInput: (args, context) => ({
    aggregateId: generateId(),
    payload: {
      name: args.input.name,
      email: args.input.email,
    },
  }),
  validate: async (args) => {
    // Optional validation
    if (!isValidEmail(args.input.email)) {
      return [{ message: 'Invalid email', field: 'email' }];
    }
    return [];
  },
});
```

### 3. Query Resolver Factory

Maps GraphQL queries to query bus:

```typescript
const getUser = createQueryResolver({
  queryType: UserQueryTypes.GetUserById,
  mapParams: (args) => ({ userId: args.id }),
  cache: {
    ttl: 60000, // Cache for 1 minute
    key: (args) => `user:${args.id}`,
  },
});
```

### 4. Subscription Resolver Factory

Maps GraphQL subscriptions to event bus:

```typescript
const userCreated = createSubscriptionResolver({
  eventTypes: [UserEventTypes.UserCreated],
  filter: (event, args, context) => {
    // Optional filtering
    return context.userId === event.data.createdBy;
  },
  mapPayload: (event) => ({
    user: event.data,
  }),
});
```

## Domain Configuration

Define domains with type definitions and resolvers:

```typescript
const userDomain = createDomainConfig(
  'users',
  userGraphQLSchema,
  {
    Query: {
      user: getUserResolver,
      users: listUsersResolver,
    },
    Mutation: {
      createUser: createUserResolver,
      updateUser: updateUserResolver,
      deleteUser: deleteUserResolver,
    },
  }
);
```

## Error Handling

Automatic error transformation to GraphQL format:

```typescript
// Domain errors are automatically transformed
throw new Error('User not found'); // -> { code: 'NOT_FOUND', message: 'User not found' }

// Validation errors
return {
  success: false,
  errors: validationErrorsToGraphQL(validationErrors),
};
```

## Type Safety

Full TypeScript support with type inference:

```typescript
// Types are inferred from configuration
type CreateUserArgs = ExtractResolverArgs<typeof createUserResolver>;
type CreateUserResult = ExtractResolverResult<typeof createUserResolver>;
```

## Advanced Features

### Middleware Support

```typescript
const contextBuilder = createEnhancedContextBuilder({
  commandBus,
  queryBus,
  eventBus,
  middleware: [
    authenticationMiddleware(authenticate),
    loggingMiddleware(logger),
    rateLimitingMiddleware(rateLimiter),
  ],
});
```

### Batch Resolvers

```typescript
const userLoader = createBatchResolver<string, User>(
  async (ids) => {
    // Batch load users
    return await userRepository.findByIds(ids);
  },
  { cache: true, maxBatchSize: 100 }
);
```

### Custom Scalars

```typescript
const schema = buildSchema({
  domains,
  scalars: {
    ...standardScalars,
    Money: moneyScalar,
  },
});
```

## Best Practices

1. **Use factories for all resolvers** - Ensures consistency and type safety
2. **Validate at the GraphQL layer** - Use the `validate` option for user-facing validation
3. **Map errors appropriately** - Transform domain errors to user-friendly messages
4. **Cache read operations** - Use the cache option for frequently accessed data
5. **Extract context properly** - Use middleware for authentication and authorization
6. **Keep resolvers thin** - Business logic belongs in command/query handlers

## Example Integration

```typescript
// server.ts
import { createGraphQLServer } from '@framework/graphql';
import { initializeUserDomain } from '@domains/users';

// Initialize domains
const userDomain = initializeUserDomain();

// Create GraphQL server
const server = createGraphQLServer({
  commandBus: userDomain.commandBus,
  queryBus: userDomain.queryBus,
  eventBus: userDomain.eventBus,
  domains: [{
    name: 'users',
    typeDefs: userGraphQLSchema,
    resolvers: createUserResolvers(userDomain),
  }],
  port: 3000,
  graphiql: true,
});
```