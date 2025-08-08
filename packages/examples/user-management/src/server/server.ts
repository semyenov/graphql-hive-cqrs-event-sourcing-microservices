import { createYoga } from 'graphql-yoga';
import { useHive } from '@graphql-hive/envelop';
import { mergeSchemas } from '@graphql-tools/schema';
import { useCQRS } from '@cqrs-framework/graphql';
import { readSchema } from '../graphql/schemas/read';
import { writeSchema } from '../graphql/schemas/write';
import { userRepository, eventStore } from '../repositories';

// Enhanced GraphQL Context with domain services
export interface GraphQLContext {
  request: Request;
  userId?: import('../events/domain-events').UserId;
  requestId: string;
  correlationId?: import('@cqrs-framework/core').CorrelationId;
  traceId?: string;
  clientInfo: {
    name: string;
    version: string;
  };
  services: {
    userRepository: import('../domains/user/aggregates/UserAggregate').UserRepository;
    eventStore: import('../events/interfaces').IEventStore<import('../events/domain-events').UserEvent>;
    commandBus?: unknown; // EventBus type to be defined when needed
  };
  timing: {
    requestStart: number;
  };
}

// GraphQL Root Value type for additional type safety
export interface GraphQLRootValue {
  // Add root value properties if needed
  version: string;
  environment: 'development' | 'staging' | 'production';
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
    requestId: crypto.randomUUID(),
    clientInfo: {
      name: request.headers.get('client-name') || 'unknown',
      version: request.headers.get('client-version') || 'unknown',
    },
    services: {
      userRepository,
      eventStore,
    },
    timing: {
      requestStart: Date.now(),
    },
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