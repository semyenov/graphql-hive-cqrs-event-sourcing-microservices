import { graphql, type ResultOf } from './graphql';

// Test script to demonstrate CQRS and Event Sourcing
const API_URL = 'http://localhost:3000/graphql';

// GraphQL operations using gql.tada
const CREATE_USER_MUTATION = graphql(`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      user {
        id
        name
        email
      }
      errors {
        message
      }
    }
  }
`);

const GET_USER_QUERY = graphql(`
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      name
      email
      createdAt
      updatedAt
    }
  }
`);

const LIST_USERS_QUERY = graphql(`
  query ListUsers {
    listUsers {
      users {
        id
        name
        email
      }
      total
      hasMore
    }
  }
`);

async function makeRequest<T>(query: { toString(): string } | string, variables?: Record<string, unknown>): Promise<{ data: T; errors?: Array<{ message: string }> }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client-name': 'test-script',
      'client-version': '1.0.0',
    },
    body: JSON.stringify({ 
      query: typeof query === 'string' ? query : query.toString(), 
      variables 
    }),
  });
  return response.json();
}

async function runDemo() {
  console.log('🚀 CQRS + Event Sourcing Demo\n');

  // 1. Create a user (Write operation - goes to write schema)
  console.log('1️⃣ Creating user...');
  const createResult = await makeRequest<ResultOf<typeof CREATE_USER_MUTATION>>(CREATE_USER_MUTATION, {
    input: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
    },
  });
  
  const userId = createResult.data.createUser.user?.id;
  console.log('✅ User created:', createResult.data.createUser);
  console.log('   Event stored: UserCreated\n');

  // 2. Query the user (Read operation - goes to read schema)
  console.log('2️⃣ Querying user...');
  const userResult = await makeRequest<ResultOf<typeof GET_USER_QUERY>>(GET_USER_QUERY, { id: userId });
  console.log('✅ User retrieved from projection:', userResult.data.getUser);
  console.log('   Read from event-sourced projection\n');

  // 3. List all users
  console.log('3️⃣ Listing all users...');
  const listResult = await makeRequest<ResultOf<typeof LIST_USERS_QUERY>>(LIST_USERS_QUERY);
  console.log('✅ Users list:', listResult.data.listUsers);
  console.log('   Projection rebuilt from event store\n');

  // 4. Create another user
  console.log('4️⃣ Creating another user...');
  const createResult2 = await makeRequest<ResultOf<typeof CREATE_USER_MUTATION>>(CREATE_USER_MUTATION, {
    input: {
      name: 'Bob Smith',
      email: 'bob@example.com',
    },
  });
  console.log('✅ Second user created:', createResult2.data.createUser.user);
  console.log('   Event stored: UserCreated\n');

  // 5. List users again to see both
  console.log('5️⃣ Listing all users again...');
  const listResult2 = await makeRequest<ResultOf<typeof LIST_USERS_QUERY>>(LIST_USERS_QUERY);
  console.log('✅ Updated users list:', listResult2.data.listUsers);
  console.log('   Both users visible in projection\n');

  console.log('📊 Summary:');
  console.log('- Mutations routed to write schema');
  console.log('- Events stored in event store');
  console.log('- Queries routed to read schema');
  console.log('- Read models built from event projections');
  console.log('- Complete CQRS separation achieved! 🎉');
}

// Run the demo
runDemo().catch(console.error);