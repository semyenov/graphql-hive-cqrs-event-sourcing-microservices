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

## 🚀 Ultimate Quick Start

### 🧠 Smart Development Launcher (Recommended)

```bash
# One command to rule them all - intelligent environment detection
./dev.sh

# Quick actions:
# Press 'd' → Start development server
# Press 't' → Run complete test suite
# Press 'g' → Generate GraphQL types
# Press 'a' → Launch AI assistant
# Press 'm' → Open interactive dashboard
```

### 🤖 AI-Powered Development

```bash
# Launch the intelligent development assistant
./dev-assistant.sh

# Features:
# • Smart project analysis and optimization
# • Automated issue detection and resolution
# • Intelligent workflow automation
# • Code generation with best practices
# • Performance monitoring and suggestions
```

### 📊 Visual Development Dashboard

```bash
# Interactive project management
./dev-dashboard.sh

# Features:
# • Real-time health monitoring
# • Visual git workflow
# • Performance benchmarking
# • Interactive search and navigation
# • Project analytics and insights
```

### ⚙️ One-Command Setup

```bash
# Complete environment setup (run once)
./setup-dev.sh

# Auto-installs: Nix, direnv, modern CLI tools
# Auto-configures: shell, aliases, completions
# Auto-optimizes: development workflow
```

### 🐚 Enhanced Shell Experience

```bash
# Clean Zsh environment with modern tools
./dev-zsh.sh

# Features:
# • Syntax highlighting and suggestions
# • Fuzzy finding with previews
# • Smart history with deduplication
# • Beautiful Starship prompt
# • Enhanced git workflow
```

### 🏠 Automatic Environment Loading

```bash
# After setup, environment loads automatically
cd graphql-hive-cqrs-event-sourcing-microservices
# Environment activates instantly with direnv!
```

### 📡 Development Server

The GraphQL server runs at:

- **GraphQL Endpoint**: http://localhost:3001/graphql
- **GraphQL Playground**: http://localhost:3001/graphql (dev mode)
- **Health Check**: http://localhost:3001/health
- **Hive Integration**: Automatic schema reporting and monitoring

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
