# @cqrs/federation

GraphQL Federation support for CQRS/Event Sourcing with Effect-TS.

## Features

- 🚀 **Automatic Schema Generation**: Generate federated GraphQL schemas from Effect Schemas
- 🔗 **Entity Federation**: Full Apollo Federation v2 support with @key directives
- 🎯 **Type Safety**: Complete TypeScript types with Effect-TS integration
- 🏗️ **Microservices Ready**: Service decomposition for distributed architectures
- ⚡ **Effect Native**: Built on Effect-TS for robust error handling and composition

## Installation

```bash
bun add @cqrs/federation
```

## Quick Start

### 1. Define Your Domain Schema

```typescript
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"

// Define branded types
export const UserId = pipe(
  Schema.String,
  Schema.brand("UserId")
)

// Define domain state
export const UserState = Schema.Struct({
  id: UserId,
  email: Schema.String,
  username: Schema.String,
  isActive: Schema.Boolean
}).pipe(Schema.annotations({
  title: "User",
  description: "A user entity"
}))
```

### 2. Create a Federation Entity

```typescript
import { FederationEntity } from "@cqrs/federation"
import * as Effect from "effect/Effect"

const userEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  resolveReference: (reference) => 
    Effect.succeed(getUserById(reference.id)),
  fields: {}
}
```

### 3. Generate Federated Schema

```typescript
import { buildFederatedSchema, DomainSchemaConfig } from "@cqrs/federation"

const config: DomainSchemaConfig = {
  entities: [userEntity],
  commands: { CreateUser: CreateUserCommand },
  queries: { GetUser: GetUserQuery },
  events: { UserCreated: UserCreatedEvent }
}

const schema = await Effect.runPromise(
  buildFederatedSchema(config)
)
```

### 4. Create GraphQL Server

```typescript
import { createYoga } from 'graphql-yoga'
import { createEntityResolver } from "@cqrs/federation"

const yoga = createYoga({
  schema,
  context: () => ({
    userId: 'system',
    traceId: `trace-${Date.now()}`
  })
})

// Start server
const server = createServer(yoga)
server.listen(4000)
```

## Running Examples

```bash
# Run complete federation demo
bun run demo

# Run quick demo
bun run demo:quick

# Start federation server
bun run demo:server

# Development mode with hot reload
bun run dev
```

## Architecture

### Core Components

- **FederationEntity**: Type-safe entity configuration with resolvers
- **DomainSchemaConfig**: Complete domain configuration for federation
- **Schema Conversion**: Automatic GraphQL type generation from Effect Schemas
- **Federation Directives**: Full Apollo Federation v2 support

### File Structure

```
packages/federation/
├── src/
│   ├── core/
│   │   └── federation.ts      # Core federation logic
│   ├── examples/
│   │   ├── federation-example.ts    # Complete example
│   │   ├── yoga-federation-server.ts # GraphQL server
│   │   └── run-federation-example.ts # CLI runner
│   └── index.ts               # Main exports
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

### Types

#### FederationEntity

```typescript
interface FederationEntity<SourceType, ArgsType, ContextType, ResultType> {
  typename: string
  key: string
  schema: Schema.Schema.Any
  fields: FieldResolvers
  resolveReference: ReferenceResolver
}
```

#### DomainSchemaConfig

```typescript
interface DomainSchemaConfig {
  commands: Record<string, Schema.Schema.Any>
  queries: Record<string, Schema.Schema.Any>
  events: Record<string, Schema.Schema.Any>
  entities: ReadonlyArray<FederationEntity>
  context?: Schema.Schema.Any
  scalars?: Record<string, GraphQLScalarType>
}
```

### Functions

#### generateFederatedSchema

Generate SDL string for a federated GraphQL schema.

```typescript
generateFederatedSchema(config: DomainSchemaConfig): Effect<string, SchemaConversionError>
```

#### buildFederatedSchema

Build a complete GraphQL schema with resolvers.

```typescript
buildFederatedSchema(config: DomainSchemaConfig): Effect<GraphQLSchema, SchemaConversionError>
```

#### createEntityResolver

Create a federation entity resolver with field resolution.

```typescript
createEntityResolver(entity: FederationEntity): GraphQLFieldConfig
```

## Service Decomposition

Split your schema into microservices:

```typescript
// User Service
const userServiceConfig: DomainSchemaConfig = {
  commands: { CreateUser },
  queries: { GetUser },
  events: { UserCreated },
  entities: [userEntity]
}

// Product Service
const productServiceConfig: DomainSchemaConfig = {
  commands: { CreateProduct },
  queries: { GetProduct },
  events: { ProductCreated },
  entities: [productEntity]
}

// Order Service (references users and products)
const orderServiceConfig: DomainSchemaConfig = {
  commands: { CreateOrder },
  queries: { GetOrder },
  events: { OrderCreated },
  entities: [orderEntity]
}
```

## Error Handling

All operations use Effect-TS for type-safe error handling:

```typescript
import { EntityResolverError, SchemaConversionError } from "@cqrs/federation"

const resolveUser = (reference) =>
  pipe(
    getUserById(reference.id),
    Effect.mapError(() => new EntityResolverError(
      "NotFound",
      `User ${reference.id} not found`
    ))
  )
```

## Best Practices

1. **Use Branded Types**: Prevent primitive obsession with Effect Schema brands
2. **Schema-First Design**: Define schemas once, derive everything else
3. **Pure Functions**: Keep resolvers pure for testability
4. **Effect Composition**: Leverage Effect's powerful composition capabilities
5. **Service Boundaries**: Design clear boundaries between federated services

## Integration with @cqrs/framework

This package integrates seamlessly with `@cqrs/framework`:

```typescript
import { createEventSchema, createCommandSchema } from "@cqrs/framework"
import { buildFederatedSchema } from "@cqrs/federation"

// Use framework schemas with federation
const UserCreatedEvent = createEventSchema("UserCreated", Schema.Struct({
  email: Email,
  username: Username
}))

// Build federated schema
const schema = await Effect.runPromise(
  buildFederatedSchema({
    events: { UserCreated: UserCreatedEvent },
    // ... other config
  })
)
```

## License

MIT