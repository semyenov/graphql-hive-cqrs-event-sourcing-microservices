/**
 * Framework GraphQL: Setup Helper
 * 
 * Quick setup function for GraphQL with CQRS bridge.
 */

import { createYoga, type YogaServerOptions } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import type { ICommandBus } from '../core/command';
import type { IQueryBus } from '../core/query';
import type { IEvent, IEventBus } from '../core/event';
import { createContextBuilder, type IContextBuilderConfig } from './context';
import { buildSchema, type ISchemaBuilderConfig } from './schema';
import { standardScalars } from './schema';

/**
 * GraphQL bridge setup configuration
 */
export interface IGraphQLBridgeConfig<TEvent extends IEvent = IEvent> {
  // CQRS infrastructure
  commandBus: ICommandBus;
  queryBus: IQueryBus;
  eventBus: IEventBus<TEvent>;
  
  // Schema configuration
  domains: ISchemaBuilderConfig['domains'];
  baseTypeDefs?: string;
  
  // Context configuration
  extractUserId?: IContextBuilderConfig<TEvent>['extractUserId'];
  extractRequestId?: IContextBuilderConfig<TEvent>['extractRequestId'];
  extractMetadata?: IContextBuilderConfig<TEvent>['extractMetadata'];
  
  // Yoga server options
  graphiql?: boolean;
  cors?: YogaServerOptions<any, any>['cors'];
  endpoint?: string;
  
  // Additional options
  includeStandardScalars?: boolean;
  logging?: boolean;
}

/**
 * Setup GraphQL bridge with CQRS
 */
export function setupGraphQLBridge<TEvent extends IEvent = IEvent>(
  config: IGraphQLBridgeConfig<TEvent>
): ReturnType<typeof createYoga> {
  // Build schema
  const schema = buildSchema({
    domains: config.domains,
    baseTypeDefs: config.baseTypeDefs,
    scalars: config.includeStandardScalars !== false ? standardScalars : undefined,
  });
  
  // Create context builder
  const contextBuilder = createContextBuilder({
    commandBus: config.commandBus,
    queryBus: config.queryBus,
    eventBus: config.eventBus,
    extractUserId: config.extractUserId,
    extractRequestId: config.extractRequestId,
    extractMetadata: config.extractMetadata,
  });
  
  // Create Yoga server
  const yoga = createYoga({
    schema,
    context: contextBuilder,
    graphiql: config.graphiql ?? process.env.NODE_ENV !== 'production',
    cors: config.cors,
    graphqlEndpoint: config.endpoint ?? '/graphql',
    logging: config.logging ?? process.env.NODE_ENV !== 'production',
  });
  
  return yoga;
}

/**
 * Create a complete GraphQL server with Bun
 */
export function createGraphQLServer<TEvent extends IEvent = IEvent>(
  config: IGraphQLBridgeConfig<TEvent> & {
    port?: number;
    healthEndpoint?: string;
    onServerStart?: (server: { port: number }) => void;
  }
) {
  const yoga = setupGraphQLBridge(config);
  const port = config.port ?? process.env.PORT ?? 3000;
  const healthEndpoint = config.healthEndpoint ?? '/health';
  const graphqlEndpoint = config.endpoint ?? '/graphql';
  
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      
      // Health check endpoint
      if (url.pathname === healthEndpoint) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            endpoints: {
              graphql: graphqlEndpoint,
              health: healthEndpoint,
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      // GraphQL endpoint
      if (url.pathname === graphqlEndpoint) {
        return yoga.handle(req);
      }
      
      // 404 for other routes
      return new Response('Not Found', { status: 404 });
    },
  });
  
  // Call onServerStart callback if provided
  if (config.onServerStart) {
    config.onServerStart(server);
  } else {
    console.log(`🚀 GraphQL server running at http://localhost:${server.port}${graphqlEndpoint}`);
    console.log(`❤️  Health check at http://localhost:${server.port}${healthEndpoint}`);
  }
  
  return server;
}