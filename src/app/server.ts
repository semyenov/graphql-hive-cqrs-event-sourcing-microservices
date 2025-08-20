/**
 * Application Server
 * 
 * Main server using the CQRS/Event Sourcing framework.
 */

import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createAggregateId, createEventId, now, email, username } from '@cqrs/framework';

// Simple GraphQL schema
const typeDefs = `
  type User {
    id: String!
    email: String!
    username: String!
    firstName: String
    lastName: String
    isActive: Boolean!
    isEmailVerified: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type UserList {
    users: [User!]!
    total: Int!
    offset: Int!
    limit: Int!
    hasNext: Boolean!
    hasPrevious: Boolean!
  }

  type MutationResult {
    success: Boolean!
    message: String!
    userId: String
    error: String
  }

  type Query {
    user(id: String!): User
    users(
      offset: Int = 0
      limit: Int = 10
      sortBy: String
      sortOrder: String
    ): UserList!
    userByEmail(email: String!): User
    userStats: UserStats!
  }

  type UserStats {
    total: Int!
    active: Int!
    verified: Int!
    suspended: Int!
  }

  type Mutation {
    createUser(input: CreateUserInput!): MutationResult!
    updateUser(userId: String!, input: UpdateUserInput!): MutationResult!
    deleteUser(userId: String!, reason: String): MutationResult!
    verifyUserEmail(id: String!, token: String!): MutationResult!
    updateUserProfile(id: String!, input: UpdateProfileInput!): MutationResult!
  }

  input CreateUserInput {
    email: String!
    username: String!
    password: String!
    firstName: String!
    lastName: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  input UpdateProfileInput {
    bio: String
    avatar: String
    location: String
  }
`;

// Mock data store
const mockUsers = new Map<string, any>();

// Initialize with some test data
const testUser = {
  id: createAggregateId(),
  email: email('test@example.com'),
  username: username('testuser'),
  firstName: 'Test',
  lastName: 'User',
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

mockUsers.set(testUser.id, testUser);

// Create GraphQL schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      user: async (_: unknown, { id }: { id: string }) => {
        const user = mockUsers.get(id);
        if (!user) return null;
        
        return {
          ...user,
          id: user.id as string,
          email: user.email as string,
          username: user.username as string
        };
      },
      users: async (_: unknown, { offset = 0, limit = 10 }: { 
        offset?: number; 
        limit?: number; 
        sortBy?: string; 
        sortOrder?: string; 
      }) => {
        const users = Array.from(mockUsers.values());
        const total = users.length;
        const paginatedUsers = users.slice(offset, offset + limit);
        
        return {
          users: paginatedUsers.map(user => ({
            ...user,
            id: user.id as string,
            email: user.email as string,
            username: user.username as string
          })),
          total,
          offset,
          limit,
          hasNext: offset + limit < total,
          hasPrevious: offset > 0
        };
      },
      userByEmail: async (_: unknown, { email: emailParam }: { email: string }) => {
        const user = Array.from(mockUsers.values()).find(u => u.email === emailParam);
        if (!user) return null;
        
        return {
          ...user,
          id: user.id as string,
          email: user.email as string,
          username: user.username as string
        };
      },
      userStats: async () => {
        const users = Array.from(mockUsers.values());
        return {
          total: users.length,
          active: users.filter(u => u.isActive).length,
          verified: users.filter(u => u.isEmailVerified).length,
          suspended: users.filter(u => !u.isActive).length
        };
      },
    },
    Mutation: {
      createUser: async (_: unknown, { input }: { input: { email: string; username: string; password: string; firstName: string; lastName: string } }) => {
        const userId = createAggregateId();
        
        const newUser = {
          id: userId,
          email: email(input.email),
          username: username(input.username),
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: true,
          isEmailVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        mockUsers.set(userId, newUser);
        
        return { 
          success: true, 
          message: 'User created successfully',
          userId: userId as string
        };
      },
      updateUser: async (_: unknown, { userId, input }: { userId: string; input: { name?: string; email?: string } }) => {
        const user = mockUsers.get(userId);
        
        if (!user) {
          return { 
            success: false, 
            message: 'User not found',
            error: 'User not found'
          };
        }
        
        const updatedUser = {
          ...user,
          email: input.email ? email(input.email) : user.email,
          username: input.name ? username(input.name) : user.username,
          updatedAt: new Date().toISOString()
        };
        
        mockUsers.set(userId, updatedUser);
        
        return { 
          success: true, 
          message: 'User updated successfully',
          userId
        };
      },
      deleteUser: async (_: unknown, { userId, reason }: { userId: string; reason?: string }) => {
        const user = mockUsers.get(userId);
        
        if (!user) {
          return { 
            success: false, 
            message: 'User not found',
            error: 'User not found'
          };
        }
        
        mockUsers.delete(userId);
        
        return { 
          success: true, 
          message: 'User deleted successfully'
        };
      },
      verifyUserEmail: async (_: unknown, { id, token }: { id: string; token: string }) => {
        const user = mockUsers.get(id);
        
        if (!user) {
          return { 
            success: false, 
            error: 'User not found'
          };
        }
        
        // Simple token validation (in real app, validate against stored token)
        if (token === 'valid-token') {
          const updatedUser = {
            ...user,
            isEmailVerified: true,
            updatedAt: new Date().toISOString()
          };
          mockUsers.set(id, updatedUser);
          
          return { 
            success: true, 
            userId: id,
            message: 'Email verified successfully'
          };
        }
        
        return { 
          success: false, 
          error: 'Invalid verification token'
        };
      },
      updateUserProfile: async (_: unknown, { id, input }: { id: string; input: { bio?: string; avatar?: string; location?: string } }) => {
        const user = mockUsers.get(id);
        
        if (!user) {
          return { 
            success: false, 
            message: 'User not found',
            error: 'User not found'
          };
        }
        
        const updatedUser = {
          ...user,
          ...input,
          updatedAt: new Date().toISOString()
        };
        
        mockUsers.set(id, updatedUser);
        
        return { 
          success: true, 
          message: 'Profile updated successfully'
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

// Create Bun server configuration
const serverConfig = {
  port: process.env.PORT || 3006,
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
          users: {
            total: mockUsers.size,
            active: Array.from(mockUsers.values()).filter(u => u.isActive).length,
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
  console.log(`👤 Test user ID: ${testUser.id}`);
}

export default serverConfig;