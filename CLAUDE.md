# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---
description: GraphQL Hive CQRS/Event Sourcing Microservices using Bun
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Development Environment

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Common Commands

```bash
# Install dependencies
bun install

# Run the application
bun run start

# Run in development mode with hot reload
bun run dev

# Run tests
bun test

# Run a specific test file
bun test path/to/test.ts

# TypeScript type checking
bun run typecheck

# Generate GraphQL types with gql.tada
bun run gql:generate

# Check GraphQL operations
bun run gql:check
```

## Architecture Overview

This project implements CQRS (Command Query Responsibility Segregation) with Event Sourcing patterns for GraphQL services, with complete type safety using gql.tada and GraphQL Hive integration.

### CQRS Implementation Strategy

1. **Schema Separation**: 
   - Read operations (queries) use `src/schemas/read.graphql`
   - Write operations (mutations) use `src/schemas/write.graphql`
   - Runtime schema switching based on operation type using Envelop plugins
   - Separate type generation for each schema with gql.tada

2. **GraphQL Hive Integration**:
   - Full operation monitoring and schema registry support
   - Performance tracking for both read and write operations
   - Client info tracking via headers

3. **Type Safety with gql.tada**:
   - Multiple schema support with separate type generation
   - Fragment colocation and masking for component isolation
   - Compile-time query validation
   - Persisted documents for production optimization

4. **TypeScript Configuration**:
   - Strict mode enabled for type safety
   - Bundler module resolution for modern imports
   - ESNext target with latest JavaScript features
   - gql.tada TypeScript plugin for IDE support

### Key Technical Decisions

- **Bun APIs**: Use Bun's built-in APIs instead of external packages:
  - `Bun.serve()` for HTTP server (not Express)
  - `bun:sqlite` for SQLite (not better-sqlite3)
  - `Bun.redis` for Redis (not ioredis)
  - `Bun.sql` for Postgres (not pg)
  - Built-in WebSocket support
  - `Bun.file` for file operations

- **Testing**: Use Bun's built-in test runner with `bun:test`

- **GraphQL Type Safety**: Using gql.tada for compile-time type safety with zero runtime overhead

## Project Structure

```
src/
├── schemas/
│   ├── read.graphql     # Query schema definition
│   ├── write.graphql    # Mutation schema definition
│   ├── readSchema.ts    # Query resolvers and executable schema
│   └── writeSchema.ts   # Mutation resolvers and executable schema
├── graphql/
│   ├── read-graphql.ts  # gql.tada for read operations
│   ├── write-graphql.ts # gql.tada for write operations
│   ├── fragments/       # Reusable GraphQL fragments
│   ├── read/           # Read operation queries
│   ├── write/          # Write operation mutations
│   └── persisted/      # Persisted documents for production
├── types/
│   └── resolvers.ts     # TypeScript types for resolvers
├── plugins/
│   └── cqrsPlugin.ts    # Envelop plugin for CQRS routing
├── events/              # Event sourcing implementation
│   ├── types.ts         # Event type definitions
│   ├── typed-events.ts  # Type guards and factories
│   └── EventHandler.ts  # Type-safe event handling
├── clients/             # Type-safe GraphQL clients
│   ├── TypedReadClient.ts
│   ├── TypedWriteClient.ts
│   └── CQRSClient.ts
├── components/          # React components with fragments
└── server.ts            # Main server setup with Hive integration
```

## Important Patterns

1. **CQRS Plugin**: The core of the architecture is the Envelop plugin that routes operations to the appropriate schema based on operation type

2. **Event Sourcing**: Commands produce events that are stored and can be replayed to rebuild state

3. **Hive Monitoring**: All GraphQL operations are monitored through GraphQL Hive for performance tracking and schema evolution

## Frontend Development

When building frontend components:
- Use HTML imports with `Bun.serve()` instead of Vite
- Direct imports of .tsx/.jsx files in HTML are supported
- CSS imports work directly in TypeScript/JavaScript files
- Hot Module Replacement (HMR) is built into Bun
