/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework with GraphQL bridge.
 */

import { 
  createGraphQLServer,
  createDomainConfig,
} from '../framework/graphql';
import { userGraphQLSchema } from '../domains/users';
import { createUserDomainResolvers } from '../domains/users/graphql-resolvers';
import { 
  bootstrapApplication, 
  loadFrameworkConfig,
  getHealthStatus,
  type ApplicationContext 
} from './bootstrap';

// Bootstrap application
let appContext: ApplicationContext;

async function startServer() {
  // Load configuration from environment
  const config = loadFrameworkConfig();
  
  // Bootstrap application with all domains
  appContext = await bootstrapApplication(config);
  
  // Get user domain from context
  const userDomain = appContext.domains.get('users')!;
  
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
    graphiql: config.graphql?.playground !== false,
    
    // Context extraction
    extractUserId: (request) => request.headers.get('x-user-id') || undefined,
    extractRequestId: (request) => request.headers.get('x-request-id') || undefined,
    
    // Logging
    logging: process.env.NODE_ENV !== 'production',
    
    // Health check endpoint (handled separately)
    // healthCheck: () => getHealthStatus(appContext),
    
    // Custom startup message
    onServerStart: (server) => {
      console.log('\n🚀 CQRS + GraphQL Server Started');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 GraphQL:  http://localhost:${server.port}/graphql`);
      console.log(`❤️  Health:   http://localhost:${server.port}/health`);
      console.log(`🔧 Mode:     ${process.env.NODE_ENV || 'development'}`);
      console.log(`📦 Domains:  ${appContext.registry.getAll().map(d => d.name).join(', ')}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    },
  });
  
  return server;
}

// Start the server
const server = startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default server;