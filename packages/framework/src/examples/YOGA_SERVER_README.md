# Yoga GraphQL Server Examples

This directory contains examples of GraphQL servers using Yoga, demonstrating different approaches to building GraphQL APIs with the federation framework.

## 🚀 Quick Start

### Basic Yoga Server

The simplest example that demonstrates a working GraphQL server with Yoga:

```bash
# Start the basic server
bun packages/framework/examples/basic-yoga-server.ts
```

**Features:**
- ✅ Simple GraphQL schema with Users and Products
- ✅ Query and Mutation operations
- ✅ GraphiQL interface for testing
- ✅ Health check endpoint
- ✅ Graceful shutdown

**Available Operations:**
- `users: [User]` - Get all users
- `user(id: String!): User` - Get a specific user
- `products: [Product]` - Get all products
- `product(id: String!): Product` - Get a specific product
- `createUser(name: String!, email: String!): User` - Create a new user
- `createProduct(name: String!, price: Int!): Product` - Create a new product

### Federation Yoga Server

A more advanced example that integrates with the federation framework:

```bash
# Start the federation server
bun packages/framework/examples/simple-yoga-server.ts
```

**Features:**
- ✅ Effect-TS integration
- ✅ Federation entity resolution
- ✅ Cross-service field resolution
- ✅ Type-safe schema generation
- ✅ Error handling with Effect patterns

## 📊 Server Endpoints

Both servers provide the following endpoints:

- **GraphQL**: `http://localhost:4000/graphql`
- **GraphiQL**: `http://localhost:4000/graphiql`
- **Health Check**: `http://localhost:4000/health`

## 🔧 Configuration

### Environment Variables

- `PORT` - Server port (default: 4000)
- `HOST` - Server host (default: localhost)

### Example Usage

```bash
# Run on custom port
PORT=4001 bun packages/framework/examples/basic-yoga-server.ts

# Run on custom host
HOST=0.0.0.0 bun packages/framework/examples/basic-yoga-server.ts
```

## 📝 Example Queries

### Basic Server Queries

```graphql
# Get all users
query GetUsers {
  users {
    id
    name
    email
  }
}

# Get a specific user
query GetUser {
  user(id: "1") {
    id
    name
    email
  }
}

# Get all products
query GetProducts {
  products {
    id
    name
    price
  }
}

# Create a new user
mutation CreateUser {
  createUser(name: "New User", email: "newuser@example.com") {
    id
    name
    email
  }
}
```

### Federation Server Queries

```graphql
# Get user with federation data
query GetUser {
  GetUser(input: { id: "user-1" }) {
    data
    metadata {
      timestamp
      executionTime
      cached
    }
  }
}

# Get product with federation data
query GetProduct {
  GetProduct(input: { id: "product-1" }) {
    data
    metadata {
      timestamp
      executionTime
      cached
    }
  }
}

# Create user with federation
mutation CreateUser {
  CreateUser(input: {
    email: "newuser@example.com"
    username: "newuser"
    firstName: "New"
    lastName: "User"
  }) {
    success
    aggregateId
    version
    error
  }
}
```

## 🏗️ Architecture

### Basic Server Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GraphiQL      │    │   Yoga Server   │    │   Mock Data     │
│   Interface     │◄──►│   (GraphQL)     │◄──►│   (In-Memory)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Federation Server Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GraphiQL      │    │   Yoga Server   │    │   Federation    │
│   Interface     │◄──►│   (GraphQL)     │◄──►│   Framework     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Effect-TS     │
                       │   Integration   │
                       └─────────────────┘
```

## 🔍 Testing

### Manual Testing

1. Start the server:
   ```bash
   bun packages/framework/examples/basic-yoga-server.ts
   ```

2. Open GraphiQL in your browser:
   ```
   http://localhost:4000/graphiql
   ```

3. Try the example queries provided in the interface

### Automated Testing

Test the server endpoints:

```bash
# Health check
curl http://localhost:4000/health

# GraphQL query
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ hello }"}'

# Get users
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ users { id name email } }"}'
```

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json .
COPY bun.lockb .

RUN bun install

COPY . .

EXPOSE 4000

CMD ["bun", "packages/framework/examples/basic-yoga-server.ts"]
```

### Environment Configuration

```bash
# Production environment
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Development environment
NODE_ENV=development
PORT=4000
HOST=localhost
```

## 🔧 Customization

### Adding New Types

To add new GraphQL types to the basic server:

```typescript
const NewType = new GraphQLObjectType({
  name: 'NewType',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) }
  }
})
```

### Adding New Resolvers

To add new resolvers:

```typescript
const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    // ... existing fields
    newField: {
      type: NewType,
      resolve: () => ({ id: '1', name: 'Example' })
    }
  }
})
```

## 📚 Related Documentation

- [Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [GraphQL Federation](https://www.apollographql.com/docs/federation/)
- [Effect-TS Documentation](https://effect.website/)

## 🤝 Contributing

To add new examples or improve existing ones:

1. Create a new TypeScript file in this directory
2. Follow the existing patterns for server setup
3. Add comprehensive documentation
4. Test thoroughly before submitting

## 📄 License

This project is part of the federation framework and follows the same license terms. 