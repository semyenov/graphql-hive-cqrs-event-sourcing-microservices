#!/usr/bin/env bun

import { graphql } from 'graphql';
import { schema } from './schemas/schema';
import type { GraphQLContext } from './server';
import { userRepository, eventStore } from './repositories';
import type { User } from './types';

// Mock context
const mockContext: GraphQLContext = {
  requestId: 'test-request-123',
  request: {} as any, // Mock request object
  clientInfo: {
    name: 'test-client',
    version: '1.0.0',
  },
  services: {
    userRepository,
    eventStore,
  },
  timing: {
    requestStart: Date.now(),
  },
};

// Test mutations
const testMutations = async () => {
  console.log('🧪 Testing GraphQL Mutations...\n');

  // Test 1: Create User
  console.log('1️⃣ Testing createUser mutation...');
  const createUserMutation = `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        success
        user {
          id
          name
          email
          createdAt
          updatedAt
        }
        errors {
          field
          message
        }
      }
    }
  `;

  const createResult = await graphql({
    schema,
    source: createUserMutation,
    variableValues: {
      input: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
    contextValue: mockContext,
  });

  console.log('Create User Result:', JSON.stringify(createResult, null, 2));

  // Extract user ID for next tests
  const createUserResult = createResult.data?.createUser;
  const userId = createUserResult && typeof createUserResult === 'object' && createUserResult !== null && 'user' in createUserResult && createUserResult.user ? (createUserResult.user as User).id : null;
  
  if (!userId) {
    console.error('❌ Failed to create user');
    console.error('Error details:', createResult.errors);
    return;
  }

  // Test 2: Update User
  console.log('\n2️⃣ Testing updateUser mutation...');
  const updateUserMutation = `
    mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) {
        success
        user {
          id
          name
          email
          updatedAt
        }
        errors {
          field
          message
        }
      }
    }
  `;

  const updateResult = await graphql({
    schema,
    source: updateUserMutation,
    variableValues: {
      id: userId,
      input: {
        name: 'John Smith',
      },
    },
    contextValue: mockContext,
  });

  console.log('Update User Result:', JSON.stringify(updateResult, null, 2));

  // Test 3: Query User
  console.log('\n3️⃣ Testing getUser query...');
  const getUserQuery = `
    query GetUser($id: ID!) {
      getUser(id: $id) {
        id
        name
        email
        createdAt
        updatedAt
      }
    }
  `;

  const queryResult = await graphql({
    schema,
    source: getUserQuery,
    variableValues: {
      id: userId,
    },
    contextValue: mockContext,
  });

  console.log('Get User Result:', JSON.stringify(queryResult, null, 2));

  // Test 4: List Users
  console.log('\n4️⃣ Testing listUsers query...');
  const listUsersQuery = `
    query ListUsers {
      listUsers(limit: 10, offset: 0) {
        users {
          id
          name
          email
        }
        total
        hasMore
      }
    }
  `;

  const listResult = await graphql({
    schema,
    source: listUsersQuery,
    contextValue: mockContext,
  });

  console.log('List Users Result:', JSON.stringify(listResult, null, 2));

  // Test 5: Delete User
  console.log('\n5️⃣ Testing deleteUser mutation...');
  const deleteUserMutation = `
    mutation DeleteUser($id: ID!) {
      deleteUser(id: $id) {
        success
        errors {
          field
          message
        }
      }
    }
  `;

  const deleteResult = await graphql({
    schema,
    source: deleteUserMutation,
    variableValues: {
      id: userId,
    },
    contextValue: mockContext,
  });

  console.log('Delete User Result:', JSON.stringify(deleteResult, null, 2));

  // Test 6: Verify deletion
  console.log('\n6️⃣ Verifying user deletion...');
  const verifyResult = await graphql({
    schema,
    source: getUserQuery,
    variableValues: {
      id: userId,
    },
    contextValue: mockContext,
  });

  console.log('Verification Result:', JSON.stringify(verifyResult, null, 2));

  console.log('\n✅ All tests completed!');
};

// Test error handling
const testErrorHandling = async () => {
  console.log('\n🧪 Testing Error Handling...\n');

  // Test non-existent user update
  console.log('Testing update on non-existent user...');
  const updateResult = await graphql({
    schema,
    source: `
      mutation UpdateNonExistent {
        updateUser(id: "non-existent-id", input: { name: "Test" }) {
          success
          errors {
            message
          }
        }
      }
    `,
    contextValue: mockContext,
  });

  console.log('Error Result:', JSON.stringify(updateResult, null, 2));
};

// Run tests
const runTests = async () => {
  try {
    await testMutations();
    await testErrorHandling();
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Execute if run directly
if (import.meta.main) {
  runTests();
}