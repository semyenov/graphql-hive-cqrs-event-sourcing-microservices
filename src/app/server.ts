/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework with GraphQL bridge.
 */

import { 
  createGraphQLServer,
  createDomainConfig,
} from '../framework/graphql';
import { initializeUserDomain, userGraphQLSchema } from '../domains/users';
import { createUserDomainResolvers } from '../domains/users/graphql-resolvers';

// Initialize user domain with all infrastructure
const userDomain = initializeUserDomain({
  enableCache: true,
  enableValidation: true,
  enableProjections: true,
});

// Create user domain configuration for GraphQL
const userDomainConfig = createDomainConfig(
  'users',
  userGraphQLSchema,
  createUserDomainResolvers(userDomain)
);

// Create GraphQL server with CQRS bridge
const server = createGraphQLServer({
  // CQRS infrastructure
  commandBus: userDomain.commandBus,
  queryBus: userDomain.queryBus,
  eventBus: userDomain.eventBus,
  
  // Domain configurations
  domains: [userDomainConfig],
  
  // Server configuration
  port: Number(process.env.PORT) || 3005,
  graphiql: process.env.NODE_ENV !== 'production',
  
  // Context extraction
  extractUserId: (request) => request.headers.get('x-user-id') || undefined,
  extractRequestId: (request) => request.headers.get('x-request-id') || undefined,
  
  // Logging
  logging: process.env.NODE_ENV !== 'production',
  
  // Custom startup message
  onServerStart: (server) => {
    console.log('\n🚀 CQRS + GraphQL Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 GraphQL:  http://localhost:${server.port}/graphql`);
    console.log(`❤️  Health:   http://localhost:${server.port}/health`);
    console.log(`🔧 Mode:     ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Domains:  users`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },
});

export default server;