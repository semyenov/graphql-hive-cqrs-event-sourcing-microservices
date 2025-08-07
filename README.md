# GraphQL Hive CQRS Event Sourcing Microservices

A production-ready implementation of CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns with GraphQL, featuring GraphQL Hive integration for monitoring and type-safe operations using gql.tada.

## 🚀 Features

- **CQRS Architecture**: Separate read and write models with GraphQL schemas
- **Event Sourcing**: All state changes stored as immutable events
- **GraphQL Hive Integration**: Schema registry and operation monitoring
- **Type Safety**: Full TypeScript support with gql.tada
- **Bun Runtime**: Fast, modern JavaScript runtime

## 📋 Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- GraphQL Hive account (optional, for monitoring)

## 🛠️ Installation

```bash
bun install
```

## 🏃 Running the Application

### Development Mode (with hot reload)
```bash
bun run dev
```

### Production Mode
```bash
bun run start
```

The GraphQL server will be available at:
- GraphQL Endpoint: http://localhost:3000/graphql
- GraphQL Playground: http://localhost:3000/graphql (dev mode only)
- Health Check: http://localhost:3000/health

## 🧪 Testing the Implementation

Run the CQRS demo:
```bash
bun run src/examples/test-cqrs.ts
```

## 📁 Project Structure

```
src/
├── schemas/
│   ├── readSchema.ts    # Query operations (read model)
│   └── writeSchema.ts   # Mutation operations (write model)
├── plugins/
│   └── cqrsPlugin.ts    # Envelop plugin for CQRS routing
├── events/
│   ├── types.ts         # Event type definitions
│   ├── InMemoryEventStore.ts  # Event storage implementation
│   └── UserAggregate.ts # Domain aggregate example
├── examples/
│   ├── client-usage.ts  # gql.tada client examples
│   └── test-cqrs.ts     # CQRS demo script
├── graphql.ts           # gql.tada configuration
├── schema.graphql       # Combined GraphQL schema
└── server.ts            # Main server with Hive integration
```

## 🔧 Configuration

Create a `.env` file based on `.env.example`:

```env
# GraphQL Hive Configuration
HIVE_API_TOKEN=your_hive_token_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 📚 Key Concepts

### CQRS Implementation
- **Write Schema**: Handles all mutations (commands)
- **Read Schema**: Handles all queries
- **Runtime Routing**: Envelop plugin routes operations to correct schema

### Event Sourcing
- **Events**: Immutable records of state changes
- **Event Store**: Append-only log of all events
- **Projections**: Read models built from event streams

### Type Safety with gql.tada
- Compile-time GraphQL type generation
- Zero runtime overhead
- Full IDE support with autocomplete

## 🛠️ Available Scripts

```bash
# Development
bun run dev          # Start with hot reload
bun run start        # Start production server

# Type Checking
bun run typecheck    # Run TypeScript type checking
bun run gql:generate # Generate GraphQL types
bun run gql:check    # Validate GraphQL operations

# Testing
bun test             # Run all tests
```

## 📊 GraphQL Hive Integration

This project includes GraphQL Hive integration for:
- Schema version control
- Operation monitoring
- Performance tracking
- Client usage analytics

To enable Hive monitoring, add your `HIVE_API_TOKEN` to the `.env` file.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is created for demonstration purposes.
