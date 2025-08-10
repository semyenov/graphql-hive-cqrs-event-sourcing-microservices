/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework.
 */

import { createYoga } from 'graphql-yoga';
import { BrandedTypes } from '../framework/core/branded/factories';
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  createCommandFactory,
  createQueryFactory,
} from '../framework';
import type { ICommand } from '../framework/core/command';

// User domain
import { 
  userGraphQLSchema,
  initializeUserDomain,
  UserCommandTypes,
  UserQueryTypes,
} from '../domains/users';

// Initialize domains
const { 
  commandBus, 
  queryBus, 
  eventBus,
  eventStore, 
} = await initializeUserDomain({
  enableCache: true,
  enableProjections: true,
  enableValidation: true,
});

// Command/query factories
const createUserCmd = createCommandFactory<ICommand<UserCommandTypes.CreateUser, { name: string; email: string }>>(UserCommandTypes.CreateUser);
const updateUserCmd = createCommandFactory<ICommand<UserCommandTypes.UpdateUser, { name?: string; email?: string }>>(UserCommandTypes.UpdateUser);
const deleteUserCmd = createCommandFactory<ICommand<UserCommandTypes.DeleteUser, { reason?: string }>>(UserCommandTypes.DeleteUser);
const verifyEmailCmd = createCommandFactory<ICommand<UserCommandTypes.VerifyUserEmail, { token?: string }>>(UserCommandTypes.VerifyUserEmail);
const updateProfileCmd = createCommandFactory<ICommand<UserCommandTypes.UpdateUserProfile, { bio?: string; avatar?: string; location?: string }>>(UserCommandTypes.UpdateUserProfile);

const getUserByIdQry = createQueryFactory<{ type: UserQueryTypes.GetUserById; parameters: { userId: string } }>(UserQueryTypes.GetUserById);
const getUserByEmailQry = createQueryFactory<{ type: UserQueryTypes.GetUserByEmail; parameters: { email: string } }>(UserQueryTypes.GetUserByEmail);
const listUsersQry = createQueryFactory<{ type: UserQueryTypes.ListUsers; parameters: { pagination: { offset: number; limit: number }; includeDeleted?: boolean } }>(UserQueryTypes.ListUsers);

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
        return queryBus.ask(getUserByIdQry({ userId: id }));
      },
      users: async (_: unknown, { pagination, includeDeleted }: { 
        pagination: { offset: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }; 
        includeDeleted?: boolean 
      }) => {
        return queryBus.ask(listUsersQry({ pagination, includeDeleted }));
      },
      userByEmail: async (_: unknown, { email }: { email: string }) => {
        return queryBus.ask(getUserByEmailQry({ email }));
      },
    },
    Mutation: {
      createUser: async (_: unknown, { input }: { input: { name: string; email: string } }) => {
        const aggregateId = BrandedTypes.aggregateId(crypto.randomUUID());
        const result = await commandBus.send(createUserCmd(aggregateId, input));
        return { success: result.success };
      },
      updateUser: async (_: unknown, { id, input }: { id: string; input: { name?: string; email?: string } }) => {
        const result = await commandBus.send(updateUserCmd(BrandedTypes.aggregateId(id), input));
        return { success: result.success };
      },
      deleteUser: async (_: unknown, { id, reason }: { id: string; reason?: string }) => {
        const result = await commandBus.send(deleteUserCmd(BrandedTypes.aggregateId(id), { reason }));
        return { success: result.success };
      },
      verifyUserEmail: async (_: unknown, { id, token }: { id: string; token: string }) => {
        const result = await commandBus.send(verifyEmailCmd(BrandedTypes.aggregateId(id), { token }));
        return { success: result.success };
      },
      updateUserProfile: async (_: unknown, { id, input }: { id: string; input: { bio?: string; avatar?: string; location?: string } }) => {
        const result = await commandBus.send(updateProfileCmd(BrandedTypes.aggregateId(id), input));
        return { success: result.success };
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
            eventStore: eventStore ? 'active' : 'inactive',
            commandBus: commandBus ? 'active' : 'inactive',
            eventBus: eventBus ? 'active' : 'inactive',
            queryBus: queryBus ? 'active' : 'inactive',
          },
          domains: ['users'],
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
  const server = Bun.serve(serverConfig);
  console.log(`🚀 Server running at http://localhost:${server.port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${server.port}/graphql`);
  console.log(`❤️  Health check: http://localhost:${server.port}/health`);
}

export default serverConfig;