# gql.tada Documentation

gql.tada is a TypeScript-first GraphQL document authoring library that provides fully typed GraphQL operations.

## Features

- **Type-safe GraphQL**: Full TypeScript support for queries, mutations, and subscriptions
- **Zero runtime overhead**: Types are generated at compile time
- **IDE integration**: Autocomplete and type checking in your editor
- **Fragment colocation**: Keep fragments close to components

## Usage

```typescript
import { graphql } from 'gql.tada';

const GET_USER = graphql(`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`);

// Types are automatically inferred
const result = await client.query(GET_USER, { id: '123' });
// result.data.user is fully typed
```

## Configuration

The project is configured with:
- TypeScript plugin for IDE support (`@0no-co/graphqlsp`)
- Schema location: `./src/schema.graphql`
- Type definitions output: `./src/graphql-env.d.ts`

## Commands

```bash
# Generate types from schema
bun run gql.tada generate

# Check GraphQL operations
bun run gql.tada check
```