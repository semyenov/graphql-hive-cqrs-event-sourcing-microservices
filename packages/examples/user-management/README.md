# User Management Example

A comprehensive example application demonstrating the CQRS/Event Sourcing framework with GraphQL, featuring user management operations.

## Features

- **User Domain**: Complete user lifecycle management (create, read, update, delete)
- **CQRS Architecture**: Separate read and write models with schema routing
- **Event Sourcing**: All state changes captured as immutable events
- **GraphQL Integration**: Type-safe operations with gql.tada
- **React Components**: Interactive UI components for user management
- **Framework Integration**: Uses all `@cqrs-framework/*` packages

## Domain Structure

```
src/
├── domains/user/          # User domain logic
│   ├── models/           # User data models
│   ├── aggregates/       # UserAggregate with business logic
│   ├── events/          # User domain events
│   ├── commands/        # User commands
│   └── queries/         # User queries
├── graphql/             # GraphQL layer
│   ├── schemas/         # Read and write GraphQL schemas
│   ├── resolvers/       # GraphQL resolvers
│   ├── fragments/       # Reusable GraphQL fragments
│   └── operations/      # Query and mutation operations
├── components/          # React UI components
├── clients/            # Type-safe GraphQL clients
├── server/             # Application server
└── types/              # Application-specific types
```

## Getting Started

### Install Dependencies

```bash
# From the root of the monorepo
bun install
```

### Development

```bash
# Run the user management example
bun run dev:user-management

# Or from this directory
bun run dev
```

### Production

```bash
# Build the application
bun run build

# Start production server
bun run start
```

## GraphQL Operations

### Queries (Read Schema)
- `getUser(id: ID!)` - Fetch a single user
- `listUsers(limit: Int, offset: Int)` - List users with pagination
- `searchUsers(query: String!)` - Search users

### Mutations (Write Schema)  
- `createUser(input: CreateUserInput!)` - Create a new user
- `updateUser(id: ID!, input: UpdateUserInput!)` - Update existing user
- `deleteUser(id: ID!)` - Delete a user

## Framework Usage

This example demonstrates usage of all framework packages:

- **@cqrs-framework/core**: Base aggregates, event sourcing, and types
- **@cqrs-framework/graphql**: CQRS plugin for schema routing and error handling
- **@cqrs-framework/client**: Type-safe GraphQL client patterns
- **@cqrs-framework/projections**: Read model projections
- **@cqrs-framework/plugins**: Lifecycle hooks and middleware
- **@cqrs-framework/advanced**: Enhanced aggregates and snapshots

## Architecture Highlights

### Event Sourcing
- `UserAggregate` handles all user business logic
- Events: `UserCreated`, `UserUpdated`, `UserDeleted`
- State rebuilt from event streams

### CQRS Implementation
- Separate GraphQL schemas for read and write operations
- Automatic routing based on operation type
- Independent scaling of read vs write models

### Type Safety
- Full TypeScript integration with framework types
- gql.tada for compile-time GraphQL validation
- Branded types for domain identifiers

## GraphQL Playground

When running in development mode, visit:
- **GraphQL Endpoint**: http://localhost:3000/graphql
- **GraphQL Playground**: http://localhost:3000/graphql

## Testing

```bash
# Run tests
bun test

# Type checking
bun run typecheck
```

## Learning Resources

This example serves as a learning resource for:
- Building CQRS applications with the framework
- GraphQL schema design for CQRS
- Event sourcing patterns
- Type-safe client development
- React integration with GraphQL

## Next Steps

Use this example as a foundation to:
- Add more domain entities (products, orders, etc.)
- Implement complex business workflows  
- Add authentication and authorization
- Scale with event streaming platforms
- Deploy to production environments