# GraphQL Federation Examples

This directory contains comprehensive examples demonstrating how to use the Effect-TS GraphQL Federation framework.

## Federation Example

The `federation-example.ts` file provides a complete demonstration of building a federated GraphQL architecture with multiple microservices.

### Overview

The example demonstrates a typical e-commerce scenario with three domains:

- **User Service**: Manages user accounts, profiles, and authentication
- **Product Service**: Handles product catalog, inventory, and pricing
- **Order Service**: Manages orders, cart functionality, and order processing

### Key Features Demonstrated

1. **Multi-Domain Schema Definition**: Shows how to define schemas for different business domains
2. **Entity Federation**: Demonstrates cross-service entity references and resolution
3. **Effect-TS Integration**: Uses Effect for error handling, async operations, and type safety
4. **Type-Safe Schema Generation**: Leverages Effect Schema for runtime validation
5. **Federation Directives**: Proper use of GraphQL Federation v2 directives
6. **Service Decomposition**: Shows how to split a monolithic schema into microservices

### Domain Models

#### User Domain
```typescript
- UserId (branded string)
- User entity with profile information
- CreateUser command
- GetUser query
- UserCreated event
```

#### Product Domain
```typescript
- ProductId (branded string)
- Product entity with catalog information
- CreateProduct command
- GetProduct query
- ProductCreated event
```

#### Order Domain
```typescript
- OrderId (branded string)
- Order entity with items and totals
- CreateOrder command
- GetOrder query
- OrderCreated event
```

### Entity Relationships

The example demonstrates federated entity relationships:

- **User** → **Orders**: Users can have multiple orders
- **Order** → **User**: Orders belong to a user
- **Order** → **Products**: Orders contain multiple products
- **Product** → **Reviews**: Products can have reviews (stub implementation)

### Running the Example

#### Basic Usage

```typescript
import { runFederationExample } from './federation-example'
import * as Effect from "effect/Effect"

// Run the complete example
Effect.runSync(runFederationExample())
```

#### Generate Schema SDL

```typescript
import { generateExampleSchema } from './federation-example'

const schemaEffect = generateExampleSchema()
const sdl = Effect.runSync(schemaEffect)
console.log(sdl)
```

#### Test Entity Resolution

```typescript
import { testEntityResolutionExample } from './federation-example'

const resolutionTest = testEntityResolutionExample()
Effect.runSync(resolutionTest)
```

#### Create Service-Specific Schemas

```typescript
import { generateServiceSchemas } from './federation-example'

const serviceSchemas = Effect.runSync(generateServiceSchemas())
console.log(serviceSchemas.userService)
console.log(serviceSchemas.productService)
console.log(serviceSchemas.orderService)
```

### Expected Output

When you run the example, you'll see:

1. **Schema Generation**: Complete federated GraphQL schema with all directives
2. **Entity Resolver Creation**: Resolver functions for each federated entity
3. **Entity Resolution Testing**: Demonstration of cross-service entity resolution
4. **Schema Building**: Complete GraphQL schema object creation

### Federation Schema Output

The generated schema includes:

- **Federation Directives**: `@key`, `@external`, `@requires`, `@provides`, etc.
- **Entity Types**: User, Product, Order with proper federation annotations
- **Command Input Types**: For mutations across all services
- **Query Input Types**: For queries across all services
- **Event Types**: For event sourcing and notifications
- **Federation Metadata**: `_Entity` union, `_Service` type, federation queries

### Microservice Deployment

The example also shows how to decompose the federated schema for microservice deployment:

```typescript
// Individual service configurations
userServiceConfig    // User service schema
productServiceConfig // Product service schema
orderServiceConfig   // Order service schema
```

Each service can be deployed independently while maintaining federation compatibility.

### Advanced Features

#### Custom Field Resolvers

The example demonstrates custom field resolvers for cross-service relationships:

```typescript
// User entity with orders field
fields: {
  orders: (user, args, context, info) =>
    Effect.succeed(/* fetch orders for user */)
}
```

#### Error Handling

Proper error handling using Effect:

```typescript
resolveReference: (reference: { id: string }) =>
  pipe(
    Option.fromNullable(mockUsers.get(reference.id)),
    Option.match({
      onSome: (user) => Effect.succeed(user),
      onNone: () => Effect.fail(new EntityResolverError(
        "NotFound",
        `User with id ${reference.id} not found`
      ))
    })
  )
```

#### Context Management

Request context schema for tracing and user information:

```typescript
const RequestContext = Schema.Struct({
  userId: Schema.optional(UserId),
  traceId: Schema.String,
  timestamp: Schema.Number
})
```

### Best Practices Demonstrated

1. **Type Safety**: All schemas are type-safe using Effect Schema
2. **Error Handling**: Comprehensive error handling with Effect
3. **Separation of Concerns**: Clear domain boundaries
4. **Federation Compliance**: Proper federation directive usage
5. **Testability**: Easy to test with mock data
6. **Observability**: Logging and tracing integration

### Integration with Apollo Federation

The generated schemas are compatible with Apollo Federation Gateway:

```typescript
// Gateway composition
const gateway = new ApolloGateway({
  serviceList: [
    { name: 'users', url: 'http://localhost:4001/graphql' },
    { name: 'products', url: 'http://localhost:4002/graphql' },
    { name: 'orders', url: 'http://localhost:4003/graphql' },
  ],
});
```

### Extending the Example

To extend this example:

1. **Add New Domains**: Create new schemas following the same patterns
2. **Add Custom Scalars**: Define custom scalar types in the configuration
3. **Add Complex Relationships**: Implement more sophisticated entity relationships
4. **Add Real Data Sources**: Replace mock data with actual databases
5. **Add Authentication**: Implement proper authentication and authorization
6. **Add Subscriptions**: Add real-time updates with GraphQL subscriptions

### Next Steps

- Review the generated schema SDL
- Implement actual data sources
- Deploy services independently
- Set up Apollo Federation Gateway
- Add monitoring and observability
- Implement proper authentication
- Add comprehensive testing

This example provides a solid foundation for building production-ready federated GraphQL architectures with Effect-TS. 