# Architecture Overview

## System Design
This project follows CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns.

## Directory Structure
```
src/
├── domains/          # Domain-specific code
├── app/              # Application layer
└── schema.graphql    # GraphQL schema
```

## Technologies
- **Runtime**: Bun
- **Language**: TypeScript
- **Framework**: Effect-TS + Custom CQRS Framework
- **GraphQL**: gql.tada for type safety
