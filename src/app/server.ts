/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework with restructured users domain.
 */

import { createYoga } from 'graphql-yoga';
import { BrandedTypes } from '@cqrs/framework/core/branded/factories';
import { makeExecutableSchema } from '@graphql-tools/schema';

// User domain - new structure
import { 
  userGraphQLSchema,
  initializeUserDomain,
  UserCommandType,
  UserQueryType,
  // Import command and query handlers directly
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  verifyEmailHandler,
  updateProfileHandler,
  getUserByIdHandler,
  getUserByEmailHandler,
  listUsersHandler,
  getUserStatsHandler,
  type GetUserByEmailQuery,
  type GetUserStatsQuery,
  type CreateUserCommand,
  type UpdateUserCommand,
  type DeleteUserCommand,
  type VerifyEmailCommand,
  type UpdateProfileCommand,
  type GetUserByIdQuery,
  type ListUsersQuery,
  UserTypes,
  type UserQueryResults
} from '../domains/users/index.ts';
import { MockProjectionStore, createMockUserDTO } from '../domains/users/mocks.ts';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

// Initialize mock projection store for testing
const mockProjectionStore = new MockProjectionStore();

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
        const userOption = await Effect.runPromise(
          mockProjectionStore.getUserById(UserTypes.userId(id))
        );
        
        if (Option.isNone(userOption)) {
          return null;
        }
        
        // Convert branded types to plain strings for GraphQL
        const user = userOption.value;
        return {
          ...user,
          id: user.id as string,
          email: user.email as string,
          username: user.username as string
        };
      },
      users: async (_: unknown, { pagination, includeDeleted }: { 
        pagination?: { offset?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }; 
        includeDeleted?: boolean 
      }) => {
        const result = await Effect.runPromise(
          mockProjectionStore.listUsers({
            offset: pagination?.offset || 0,
            limit: pagination?.limit || 10,
            sortBy: pagination?.sortBy,
            sortOrder: pagination?.sortOrder
          })
        );
        
        // Convert branded types to plain strings for GraphQL
        return {
          ...result,
          users: result.users.map(user => ({
            ...user,
            id: user.id as string,
            email: user.email as string,
            username: user.username as string
          }))
        };
      },
      userByEmail: async (_: unknown, { email }: { email: string }) => {
        const userOption = await Effect.runPromise(
          mockProjectionStore.getUserByEmail(UserTypes.email(email))
        );
        
        if (Option.isNone(userOption)) {
          return null;
        }
        
        // Convert branded types to plain strings for GraphQL
        const user = userOption.value;
        return {
          ...user,
          id: user.id as string,
          email: user.email as string,
          username: user.username as string
        };
      },
      userStats: async () => {
        const stats = await Effect.runPromise(
          mockProjectionStore.getUserStats({})
        );
        return stats;
      },
    },
    Mutation: {
      createUser: async (_: unknown, { input }: { input: { email: string; username: string; password: string; firstName: string; lastName: string } }) => {
        const userId = UserTypes.userId(crypto.randomUUID());
        
        // Create mock user
        const newUser = createMockUserDTO({
          id: userId,
          email: UserTypes.email(input.email),
          username: UserTypes.username(input.username),
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`,
            bio: '',
            avatarUrl: '',
            location: '',
            website: ''
          }
        });
        
        // Add to mock store
        mockProjectionStore.addUser(newUser);
        
        // Return with plain strings for GraphQL
        return {
          ...newUser,
          id: newUser.id as string,
          email: newUser.email as string,
          username: newUser.username as string
        };
      },
      updateUser: async (_: unknown, { userId, input }: { userId: string; input: { name?: string; email?: string } }) => {
        // Get existing user from mock store
        const userOption = await Effect.runPromise(
          mockProjectionStore.getUserById(UserTypes.userId(userId))
        );
        
        if (Option.isNone(userOption)) {
          throw new Error('User not found');
        }
        
        // Update and return
        const updatedUser = {
          ...userOption.value,
          email: input.email ? UserTypes.email(input.email) : userOption.value.email,
          username: input.name ? UserTypes.username(input.name) : userOption.value.username,
          updatedAt: new Date().toISOString()
        };
        
        mockProjectionStore.addUser(updatedUser);
        
        return {
          ...updatedUser,
          id: updatedUser.id as string,
          email: updatedUser.email as string,
          username: updatedUser.username as string
        };
      },
      deleteUser: async (_: unknown, { userId, reason }: { userId: string; reason?: string }) => {
        const command = {
          type: UserCommandType.DELETE_USER,
          aggregateId: BrandedTypes.aggregateId(userId),
          payload: { reason }
        };
        
        try {
          await deleteUserHandler.handle(command as DeleteUserCommand);
          return { 
            success: true, 
            message: 'User deleted successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Failed to delete user'
          };
        }
      },
      verifyUserEmail: async (_: unknown, { id, token }: { id: string; token: string }) => {
        const command = {
          type: UserCommandType.VERIFY_EMAIL,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: { verificationToken: token }
        };
        
        try {
          const result = await verifyEmailHandler.handle(command as VerifyEmailCommand);
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
          type: UserCommandType.UPDATE_PROFILE,
          aggregateId: BrandedTypes.aggregateId(id),
          payload: input
        };
        
        try {
          await updateProfileHandler.handle(command as UpdateProfileCommand);
          return { 
            success: true, 
            message: 'Profile updated successfully'
          };
        } catch (error) {
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Failed to update profile'
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
  console.log('🚀 Starting CQRS/Event Sourcing Server...');
  const server = Bun.serve(serverConfig);
  console.log(`🚀 Server running at http://localhost:${server.port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${server.port}/graphql`);
  console.log(`❤️  Health check: http://localhost:${server.port}/health`);
}

export default serverConfig;