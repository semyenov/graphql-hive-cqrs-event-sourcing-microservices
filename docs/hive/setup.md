# GraphQL Hive Setup

GraphQL Hive is a schema registry and observability platform for GraphQL APIs.

## Features

- **Schema Registry**: Version control for GraphQL schemas
- **Operation Monitoring**: Track performance and usage
- **Schema Validation**: Prevent breaking changes
- **Client Management**: Track which clients use which fields

## Configuration

### 1. Install Dependencies
```bash
bun add @graphql-hive/envelop
```

### 2. Environment Variables
```env
HIVE_API_TOKEN=your_hive_token_here
HIVE_CDN_ENDPOINT=https://cdn.graphql-hive.com
```

### 3. Envelop Plugin Setup
```typescript
import { useHive } from '@graphql-hive/envelop';

const getEnveloped = envelop({
  plugins: [
    useHive({
      enabled: true,
      debug: true,
      token: process.env.HIVE_API_TOKEN,
      usage: {
        clientInfo: (context) => ({
          name: context?.req.headers['client-name'],
          version: context?.req.headers['client-version']
        })
      },
      reporting: {
        author: 'CQRS Service',
        commit: process.env.GIT_COMMIT_SHA
      }
    })
  ]
});
```

## Usage Tracking

Hive automatically tracks:
- Query/mutation execution
- Field usage statistics
- Performance metrics
- Error rates
- Client usage patterns

## Schema Publishing

```bash
# Publish schema to Hive
bunx @graphql-hive/cli schema:publish \
  --token $HIVE_API_TOKEN \
  --author "CI/CD" \
  --commit $GIT_COMMIT_SHA \
  ./src/schema.graphql
```

## Best Practices

1. **Use in Production**: Get real usage data
2. **Track Client Info**: Identify which clients use which fields
3. **Monitor Performance**: Set up alerts for slow operations
4. **Schema Evolution**: Use Hive to safely evolve your schema