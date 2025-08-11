/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework with restructured users domain.
 */

import { createYoga } from 'graphql-yoga';
import { BrandedTypes } from '@cqrs/framework/core/branded/factories';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createConsola } from 'consola';

const logger = createConsola().withTag('server');

// User domain - new structure
import { 
  userGraphQLSchema,
  initializeUserDomain,
  UserCommandTypes,
  UserQueryTypes,
  // Import command and query handlers directly
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  verifyEmailHandler,
  updateProfileHandler,
  getUserHandler,
  getUserByEmailHandler,
  listUsersHandler,
  getUserStatsHandler,
} from '../domains/users';

// Initialize user domain
const userDomain = await initializeUserDomain({
  enableCache: true,
  enableProjections: true,
  enableValidation: true,
});

const { repository, projections } = userDomain;

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
      user: async (_: unknown, { id }: { id: string }) => {
        const query = {
          type: UserQueryTypes.GetUserById,
          parameters: { userId: BrandedTypes.aggregateId(id) }
        };
        return getUserHandler(projections.userDetailsProjection, query);
      },
      users: async (_: unknown, { pagination, includeDeleted }: { 
        pagination?: { offset?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }; 
        includeDeleted?: boolean 
      }) => {
        const query = {
          type: UserQueryTypes.ListUsers,
          parameters: { 
            pagination: {
              offset: pagination?.offset || 0,
              limit: pagination?.limit || 10,
              sortBy: pagination?.sortBy,
              sortOrder: pagination?.sortOrder
            },
            includeDeleted 
          }
        };
        return listUsersHandler(projections.userDetailsProjection, query);
      },
      userByEmail: async (_: unknown, { email }: { email: string }) => {
        const query = {
          parameters: { email }
        };
        return getUserByEmailHandler(projections.userDetailsProjection, query);
      },
      userStats: async () => {
        const query = {
          type: UserQueryTypes.GetUserStats,
          parameters: {}
        };
        return getUserStatsHandler(projections.userDetailsProjection, query);
      },
    },
    Mutation: {
      createUser: async (_: unknown, { input }: { input: { name: string; email: string } }) => {
        const command = {
          type: UserCommandTypes.CreateUser,
          aggregateId: BrandedTypes.aggregateId(crypto.randomUUID()),
          payload: input
        };
        
        try {
          const result = await createUserHandler(repository, command);
          return { 
            success: true, 
            userId: command.aggregateId,
            message: 'User created successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      updateUser: async (_: unknown, { id, input }: { id: string; input: { name?: string; email?: string } }) => {
        const command = {
          type: UserCommandTypes.UpdateUser,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: input
        };
        
        try {
          const result = await updateUserHandler(repository, command);
          return { 
            success: true, 
            userId: id,
            message: 'User updated successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      deleteUser: async (_: unknown, { id, reason }: { id: string; reason?: string }) => {
        const command = {
          type: UserCommandTypes.DeleteUser,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: { reason }
        };
        
        try {
          const result = await deleteUserHandler(repository, command);
          return { 
            success: true, 
            userId: id,
            message: 'User deleted successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      verifyUserEmail: async (_: unknown, { id, token }: { id: string; token: string }) => {
        const command = {
          type: UserCommandTypes.VerifyUserEmail,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: { verificationToken: token }
        };
        
        try {
          const result = await verifyEmailHandler(repository, command);
          return { 
            success: true, 
            userId: id,
            message: 'Email verified successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      updateUserProfile: async (_: unknown, { id, input }: { id: string; input: { bio?: string; avatar?: string; location?: string } }) => {
        const command = {
          type: UserCommandTypes.UpdateUserProfile,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: input
        };
        
        try {
          const result = await updateProfileHandler(repository, command);
          return { 
            success: true, 
            userId: id,
            message: 'Profile updated successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
    },
  },
});

// Create GraphQL Yoga server
const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== 'production',
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
            initialized: true,
            eventStore: userDomain.eventStore ? 'active' : 'inactive',
            commandBus: userDomain.commandBus ? 'active' : 'inactive',
            eventBus: userDomain.eventBus ? 'active' : 'inactive',
            queryBus: userDomain.queryBus ? 'active' : 'inactive',
          },
          domains: {
            users: {
              status: 'active',
              projections: Object.keys(userDomain.projections),
              validators: Object.keys(userDomain.validators),
            }
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
  logger.info('Starting CQRS/Event Sourcing Server...');
  const server = Bun.serve(serverConfig);
  
  logger.success('Server started successfully!');
  logger.info(`Server running at http://localhost:${server.port}`);
  logger.info(`GraphQL endpoint: http://localhost:${server.port}/graphql`);
  logger.info(`Health check: http://localhost:${server.port}/health`);
  
  logger.info('Server configuration', {
    port: server.port,
    environment: process.env.NODE_ENV || 'development',
    graphiqlEnabled: process.env.NODE_ENV !== 'production',
    domains: ['users'],
  });
}

export default serverConfig;