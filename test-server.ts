/**
 * Test script to verify the server is working
 */

import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { BrandedTypes } from '@cqrs/framework/core/branded/factories';

// Base GraphQL schema  
const baseSchema = `
  type Query {
    health: String
  }
  
  type Mutation {
    test: String
  }
`;

// Simple user schema for testing
const userSchema = `
  type User {
    id: ID!
    email: String!
    username: String!
    status: String!
    role: String!
    profile: UserProfile!
    emailVerified: Boolean!
    createdAt: String!
    updatedAt: String!
  }
  
  type UserProfile {
    firstName: String!
    lastName: String!
    displayName: String!
  }
  
  input CreateUserInput {
    email: String!
    username: String!
    password: String!
    firstName: String!
    lastName: String!
  }
  
  type OperationResult {
    success: Boolean!
    message: String
  }
  
  extend type Query {
    user(id: ID!): User
    users: [User!]!
  }
  
  extend type Mutation {
    createUser(input: CreateUserInput!): User!
    verifyUserEmail(id: ID!, token: String!): OperationResult!
    updateUserProfile(id: ID!, input: UpdateProfileInput!): OperationResult!
  }
  
  input UpdateProfileInput {
    bio: String
    avatar: String
    location: String
  }
`;

// Mock user data
const mockUser = {
  id: '123',
  email: 'test@example.com',
  username: 'testuser',
  status: 'ACTIVE',
  role: 'USER',
  profile: {
    firstName: 'Test',
    lastName: 'User', 
    displayName: 'Test User'
  },
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Create schema
const schema = makeExecutableSchema({
  typeDefs: [baseSchema, userSchema].join('\n'),
  resolvers: {
    Query: {
      health: () => 'OK',
      user: () => mockUser,
      users: () => [mockUser]
    },
    Mutation: {
      test: () => 'Test mutation works',
      createUser: (_: unknown, { input }: any) => ({
        ...mockUser,
        id: crypto.randomUUID(),
        email: input.email,
        username: input.username,
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`
        }
      }),
      verifyUserEmail: () => ({ success: true, message: 'Email verified' }),
      updateUserProfile: () => ({ success: true, message: 'Profile updated' })
    }
  }
});

// Create server
const yoga = createYoga({
  schema,
  graphiql: true
});

const server = Bun.serve({
  port: 3007,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/graphql') {
      return yoga.handle(req);
    }
    
    return new Response('Not Found', { status: 404 });
  }
});

console.log(`🚀 Test server running at http://localhost:${server.port}`);
console.log(`📊 GraphQL endpoint: http://localhost:${server.port}/graphql`);
console.log(`❤️  Health check: http://localhost:${server.port}/health`);