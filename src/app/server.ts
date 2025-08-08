/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework.
 */

import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  createEventStore,
  createCommandBus,
  createEventBus,
  createQueryBus,
  initializeFramework,
} from '../framework';
import { registerUserDomain, userGraphQLSchema } from '../domains/users';
import type { UserEvent } from '../domains/users';

// Initialize framework
const framework = initializeFramework({
  eventStore: 'memory',
  enableCache: true,
  enableMonitoring: true,
});

// Create infrastructure
const eventStore = createEventStore<UserEvent>();
const commandBus = createCommandBus();
const eventBus = createEventBus<UserEvent>();
const queryBus = createQueryBus(true, 60000);

// Register domains
const { repository: userRepository } = registerUserDomain(
  eventStore,
  commandBus,
  queryBus
);

// Base GraphQL schema
const baseSchema = `
  type Query {
    _empty: String
  }
  
  type Mutation {
    _empty: String
  }
  
  type Subscription {
    _empty: String
  }
`;

// Combine schemas
const typeDefs = [baseSchema, userGraphQLSchema].join('\n');

// Create GraphQL schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      user: async (_, { id }) => {
        // TODO: Implement query handler
        return null;
      },
      users: async () => {
        // TODO: Implement query handler
        return [];
      },
      userByEmail: async (_, { email }) => {
        // TODO: Implement query handler
        return null;
      },
    },
    Mutation: {
      createUser: async (_, { input }) => {
        // TODO: Use command bus
        return {
          success: false,
          errors: [{ message: 'Not implemented' }],
        };
      },
      updateUser: async (_, { id, input }) => {
        // TODO: Use command bus
        return {
          success: false,
          errors: [{ message: 'Not implemented' }],
        };
      },
      deleteUser: async (_, { id, reason }) => {
        // TODO: Use command bus
        return {
          success: false,
          errors: [{ message: 'Not implemented' }],
        };
      },
    },
  },
});

// Create GraphQL Yoga server
const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== 'production',
});

// Create Bun server
const server = Bun.serve({
  port: process.env.PORT || 3002,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          framework: framework,
          domains: ['users'],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // GraphQL endpoint
    if (url.pathname === '/graphql') {
      return yoga.handle(req);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log(`📊 GraphQL endpoint: http://localhost:${server.port}/graphql`);
console.log(`❤️  Health check: http://localhost:${server.port}/health`);

export default server;