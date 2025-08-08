import { graphql } from '../graphql';

// Define queries with full type safety
export const GET_USER = graphql(`
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

export const LIST_USERS = graphql(`
  query ListUsers($limit: Int, $offset: Int) {
    listUsers(limit: $limit, offset: $offset) {
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

// Define mutations
export const CREATE_USER = graphql(`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      user {
        id
        name
        email
      }
      errors {
        field
        message
      }
    }
  }
`);

export const UPDATE_USER = graphql(`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      user {
        id
        name
        email
      }
      errors {
        field
        message
      }
    }
  }
`);

// Example usage with a GraphQL client
async function exampleUsage() {
  // The types are automatically inferred from the GraphQL operations
  const userResult = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client-name': 'example-app',
      'client-version': '1.0.0',
    },
    body: JSON.stringify({
      query: GET_USER,
      variables: { id: '123' }, // Type-safe variables
    }),
  }).then(res => res.json());

  // userResult.data.getUser is fully typed
  if (userResult.data?.getUser) {
    console.log(userResult.data.getUser.name); // TypeScript knows this is a string
  }

  // Create a new user
  const createResult = await fetch('http://localhost:3000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client-name': 'example-app',
      'client-version': '1.0.0',
    },
    body: JSON.stringify({
      query: CREATE_USER,
      variables: {
        input: {
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
      },
    }),
  }).then(res => res.json());

  if (createResult.data?.createUser.success) {
    console.log('User created:', createResult.data.createUser.user);
  }
}