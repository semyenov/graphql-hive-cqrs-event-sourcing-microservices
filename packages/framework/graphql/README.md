# @cqrs-framework/graphql

GraphQL integration for the Universal CQRS/Event Sourcing framework.

## Features

- **CQRS Schema Routing**: Automatic routing of queries to read schema and mutations to write schema
- **Type-Safe Error Handling**: Rich domain errors converted to GraphQL format
- **Schema Builders**: Utilities for building read and write schemas
- **GraphQL Yoga Integration**: Built for GraphQL Yoga with Envelop plugins
- **Hive Compatible**: Works seamlessly with GraphQL Hive monitoring

## Installation

```bash
npm install @cqrs-framework/graphql @cqrs-framework/core
# or  
bun add @cqrs-framework/graphql @cqrs-framework/core
```

## Quick Start

```typescript
import { createYoga } from 'graphql-yoga';
import { useCQRS } from '@cqrs-framework/graphql';
import { readSchema, writeSchema } from './schemas';

const yoga = createYoga({
  plugins: [
    useCQRS({
      readSchema,   // Schema for queries/subscriptions
      writeSchema,  // Schema for mutations
      debug: true,
    }),
  ],
});
```

## CQRS Plugin

The core of the GraphQL integration is the CQRS plugin that automatically routes operations:

```typescript
import { useCQRS, createCQRSPlugin } from '@cqrs-framework/graphql';

// Basic usage
const cqrsPlugin = useCQRS({
  readSchema: querySchema,
  writeSchema: mutationSchema,
});

// With custom options
const advancedPlugin = useCQRS({
  readSchema: querySchema,
  writeSchema: mutationSchema,
  debug: true,
  schemaSelector: (operationType, operation) => {
    // Custom schema selection logic
    return operationType === 'mutation' ? writeSchema : readSchema;
  },
});

// Factory function
const plugin = createCQRSPlugin(readSchema, writeSchema, {
  debug: process.env.NODE_ENV === 'development',
});
```

## Error Handling

Convert rich domain errors to GraphQL format:

```typescript
import { 
  toGraphQLError, 
  toExtendedGraphQLError,
  ErrorFactory 
} from '@cqrs-framework/graphql';

const resolver = async (parent, args, context) => {
  try {
    const result = await userService.createUser(args.input);
    
    if (!result.success) {
      return {
        success: false,
        data: null,
        errors: result.errors.map(toGraphQLError),
      };
    }
    
    return {
      success: true,
      data: result.data,
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: [errorToGraphQL(error)],
    };
  }
};
```

## Schema Builders

Build schemas programmatically with built-in patterns:

```typescript
import { 
  createReadSchemaBuilder, 
  createWriteSchemaBuilder,
  buildErrorType,
  buildMutationResultType 
} from '@cqrs-framework/graphql';

// Read schema for queries
const readBuilder = createReadSchemaBuilder()
  .addQuery('getUser', {
    type: UserType,
    args: { id: { type: new GraphQLNonNull(GraphQLString) } },
    resolve: async (parent, { id }, context) => {
      return userService.getUser(id);
    },
  })
  .addQuery('listUsers', {
    type: buildListResultType('User', UserType),
    args: { 
      pagination: { type: buildPaginationInputType() }
    },
    resolve: async (parent, { pagination }, context) => {
      return userService.listUsers(pagination);
    },
  });

// Write schema for mutations  
const writeBuilder = createWriteSchemaBuilder()
  .addMutation('createUser', {
    type: buildMutationResultType('CreateUser', UserType),
    args: { 
      input: { type: new GraphQLNonNull(CreateUserInputType) }
    },
    resolve: async (parent, { input }, context) => {
      const result = await userService.createUser(input);
      return {
        success: result.success,
        data: result.success ? result.data : null,
        errors: result.success ? null : result.errors.map(toGraphQLError),
      };
    },
  });

const readSchema = readBuilder.build();
const writeSchema = writeBuilder.build();
```

## Error Adaptation

Advanced error handling with custom mappings:

```typescript
import { GraphQLErrorAdapter } from '@cqrs-framework/graphql';

const errorAdapter = new GraphQLErrorAdapter()
  .mapField('userName', 'name')  // Map domain field to GraphQL field
  .mapMessage('INVALID_EMAIL', 'Please provide a valid email address');

const resolver = async (parent, args, context) => {
  const result = await userService.validateUser(args.input);
  
  if (!result.success) {
    return {
      success: false,
      errors: errorAdapter.adaptMany(result.errors),
    };
  }
  
  return { success: true, data: result.data };
};
```

## Type Definitions

### GraphQL Error Types
```typescript
interface GraphQLError {
  field: string | null;
  message: string;
  code?: string;
  path?: (string | number)[];
}

interface ExtendedGraphQLError extends GraphQLError {
  extensions?: {
    code?: string;
    timestamp?: string;
    correlationId?: string;
    category?: string;
    type?: string;
  };
}
```

### Plugin Options
```typescript
interface CQRSPluginOptions {
  readSchema: GraphQLSchema;
  writeSchema: GraphQLSchema;
  operationTypeDetector?: (document: DocumentNode) => 'query' | 'mutation' | 'subscription' | null;
  debug?: boolean;
  schemaSelector?: (operationType: string, operation: OperationDefinitionNode) => GraphQLSchema;
}
```

## Best Practices

1. **Separate Concerns**: Keep read and write schemas completely separate
2. **Error Handling**: Always convert domain errors to GraphQL format  
3. **Type Safety**: Use the framework's branded types throughout your resolvers
4. **Monitoring**: Enable debug mode in development, use with GraphQL Hive in production
5. **Schema Design**: Use the builders for consistent schema patterns

## Integration with Hive

```typescript
import { createYoga } from 'graphql-yoga';
import { useHive } from '@graphql-hive/client';
import { useCQRS } from '@cqrs-framework/graphql';

const yoga = createYoga({
  plugins: [
    useHive({
      enabled: true,
      token: process.env.HIVE_TOKEN,
      usage: true,
      reporting: true,
    }),
    useCQRS({
      readSchema,
      writeSchema,
    }),
  ],
});
```

## License

MIT