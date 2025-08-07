import { createYoga } from 'graphql-yoga';
import { useHive } from '@graphql-hive/envelop';
import { mergeSchemas } from '@graphql-tools/schema';
import { readSchema } from './schemas/readSchema';
import { writeSchema } from './schemas/writeSchema';
import { useCQRS } from './plugins/cqrsPlugin';

// GraphQL Context type for resolvers
export interface GraphQLContext {
  request: Request;
  // Add other context properties as needed
}

// Merge schemas for Hive reporting (not for execution)
const mergedSchema = mergeSchemas({
  schemas: [readSchema, writeSchema],
});

// Create GraphQL Yoga server with plugins
const yoga = createYoga({
  schema: mergedSchema,
  plugins: [
    useCQRS(), // CQRS routing plugin
    useHive({
      enabled: !!process.env.HIVE_API_TOKEN,
      debug: process.env.NODE_ENV !== 'production',
      token: process.env.HIVE_API_TOKEN || '',
      usage: {
        clientInfo: (context: any) => ({
          name: context?.request?.headers?.get('client-name') || 'unknown',
          version: context?.request?.headers?.get('client-version') || 'unknown',
        }),
      },
      reporting: {
        author: 'CQRS Service',
        commit: process.env.GIT_COMMIT_SHA || 'local',
      },
    }),
  ],
  graphiql: process.env.NODE_ENV !== 'production',
  maskedErrors: process.env.NODE_ENV === 'production',
  context: async ({ request }): Promise<GraphQLContext> => ({
    request,
  }),
});

// Create Bun server
const server = Bun.serve({
  port: process.env.PORT || 3001,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GraphQL endpoint - delegate to Yoga
    if (url.pathname === '/graphql') {
      return yoga.handle(req);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 GraphQL server running at http://localhost:${server.port}/graphql`);
console.log(`📊 Health check at http://localhost:${server.port}/health`);
if (process.env.NODE_ENV !== 'production') {
  console.log(`🎮 GraphiQL available at http://localhost:${server.port}/graphql`);
}

export default server;