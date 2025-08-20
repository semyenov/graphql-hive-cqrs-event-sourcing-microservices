/**
 * Simple Test Server
 * 
 * Minimal server to test the framework without complex domain dependencies
 */

import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';

// Simple GraphQL schema
const typeDefs = `
  type Query {
    hello: String!
    testId: String!
    testTimestamp: Int!
  }
  
  type Mutation {
    echo(message: String!): String!
  }
`;

// Create GraphQL schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      hello: () => 'Hello from CQRS Framework!',
      testId: () => {
        // Generate a simple ID for testing
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        const id = (timestamp + random).padEnd(26, "0").slice(0, 26).toUpperCase();
        return `Generated ID: ${id}`;
      },
      testTimestamp: () => {
        return Date.now();
      },
    },
    Mutation: {
      echo: (_: unknown, { message }: { message: string }) => {
        return `Echo: ${message}`;
      },
    },
  },
});

// Create GraphQL Yoga server
const yoga = createYoga({
  schema,
  graphiql: true,
});

// Create Bun server configuration
const serverConfig = {
  port: process.env.PORT || 3005,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          framework: {
            name: '@cqrs/framework',
            version: '3.0.0',
            features: ['schema-first', 'pure-functional', 'effect-native'],
          },
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json'
          },
        }
      );
    }

    // GraphQL endpoint
    if (url.pathname === '/graphql') {
      return yoga.handle(req);
    }

    return new Response('Not Found', { status: 404 });
  },
};

// Only start server if this is the main module
if (import.meta.main) {
  console.log('🚀 Starting Simple CQRS Framework Test Server...');
  const server = Bun.serve(serverConfig);
  console.log(`🚀 Server running at http://localhost:${server.port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${server.port}/graphql`);
  console.log(`❤️  Health check: http://localhost:${server.port}/health`);
}

export default serverConfig; 