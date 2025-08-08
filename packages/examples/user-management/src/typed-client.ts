import { type ResultOf, type VariablesOf, readFragment } from './graphql';
import type { TadaDocumentNode } from 'gql.tada';
import * as UserFragments from './graphql/operations/fragments/user.fragments';
import {
  GET_USER_QUERY,
  LIST_USERS_QUERY,
  SEARCH_USERS_QUERY
} from './graphql/operations/queries';
import {
  CREATE_USER_MUTATION,
  UPDATE_USER_MUTATION,
  DELETE_USER_MUTATION
} from './graphql/operations/mutations';

// Type-safe GraphQL client with full typing support
class TypedGraphQLClient {
  constructor(private endpoint: string) {}

  async request<TResult, TVariables>(
    query: TadaDocumentNode<TResult, TVariables>,
    variables?: TVariables
  ): Promise<TResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-name': 'typed-client',
        'client-version': '1.0.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    return result.data;
  }

  // Typed query methods
  async getUser(id: string) {
    const result = await this.request<
      ResultOf<typeof GET_USER_QUERY>,
      VariablesOf<typeof GET_USER_QUERY>
    >(GET_USER_QUERY, { id });

    // Access fragment data with type safety
    if (result.getUser) {
      const userData = readFragment(UserFragments.UserDetailFieldsFragment, result.getUser);
      // Unmask the nested UserBasicFields fragment
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userData);
      return {
        ...userBasic,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      };
    }
    return null;
  }

  async listUsers(limit?: number, offset?: number) {
    const result = await this.request<
      ResultOf<typeof LIST_USERS_QUERY>,
      VariablesOf<typeof LIST_USERS_QUERY>
    >(LIST_USERS_QUERY, { limit, offset });

    // Map and unmask fragment data
    const users = result.listUsers.users.map(user => {
      const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, user);
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
      return {
        ...userBasic,
        createdAt: userDetail.createdAt,
        updatedAt: userDetail.updatedAt
      };
    });

    return {
      users,
      total: result.listUsers.total,
      hasMore: result.listUsers.hasMore,
    };
  }

  async searchUsers(query: string) {
    const result = await this.request<
      ResultOf<typeof SEARCH_USERS_QUERY>,
      VariablesOf<typeof SEARCH_USERS_QUERY>
    >(SEARCH_USERS_QUERY, { query });

    return result.searchUsers.map(user => {
      const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, user);
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
      return {
        ...userBasic,
        createdAt: user.createdAt,
        updatedAt: userDetail.updatedAt
      };
    });
  }

  // Typed mutation methods
  async createUser(name: string, email: string) {
    const result = await this.request<
      ResultOf<typeof CREATE_USER_MUTATION>,
      VariablesOf<typeof CREATE_USER_MUTATION>
    >(CREATE_USER_MUTATION, { input: { name, email } });

    const { success, user, errors } = result.createUser;
    
    if (user) {
      // Unmask the UserDetailFields fragment and then the nested UserBasicFields
      const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, user);
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
      
      return {
        success,
        user: {
          ...userBasic,
          createdAt: userDetail.createdAt,
          updatedAt: userDetail.updatedAt
        },
        errors: errors?.map(error => readFragment(UserFragments.ErrorFieldsFragment, error)) || [],
      };
    }
    
    return {
      success,
      user: null,
      errors: errors?.map(error => readFragment(UserFragments.ErrorFieldsFragment, error)) || [],
    };
  }

  async updateUser(id: string, updates: { name?: string; email?: string }) {
    const result = await this.request<
      ResultOf<typeof UPDATE_USER_MUTATION>,
      VariablesOf<typeof UPDATE_USER_MUTATION>
    >(UPDATE_USER_MUTATION, { id, input: updates });

    const { success, user, errors } = result.updateUser;
    
    if (user) {
      // Unmask the UserDetailFields fragment and then the nested UserBasicFields
      const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, user);
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
      
      return {
        success,
        user: {
          ...userBasic,
          createdAt: userDetail.createdAt,
          updatedAt: userDetail.updatedAt
        },
        errors: errors?.map(error => readFragment(UserFragments.ErrorFieldsFragment, error)) || [],
      };
    }
    
    return {
      success,
      user: null,
      errors: errors?.map(error => readFragment(UserFragments.ErrorFieldsFragment, error)) || [],
    };
  }

  async deleteUser(id: string) {
    const result = await this.request<
      ResultOf<typeof DELETE_USER_MUTATION>,
      VariablesOf<typeof DELETE_USER_MUTATION>
    >(DELETE_USER_MUTATION, { id });

    const { success, errors } = result.deleteUser;
    
    return {
      success,
      errors: errors?.map(error => readFragment(UserFragments.ErrorFieldsFragment, error)) || [],
    };
  }
}

// Example usage with full type safety
async function demonstrateTypedClient() {
  const client = new TypedGraphQLClient('http://localhost:3000/graphql');

  console.log('🎯 Fully Typed GraphQL Client Demo\n');

  // 1. Create a user - all types are inferred
  console.log('1️⃣ Creating user with type-safe mutation...');
  const createResult = await client.createUser('Alice Cooper', 'alice@example.com');
  
  if (createResult.success && createResult.user) {
    // TypeScript knows all the properties available
    console.log(`✅ Created user: ${createResult.user.name} (${createResult.user.id})`);
    console.log(`   Email: ${createResult.user.email}`);
  } else {
    // Error handling with typed errors
    createResult.errors.forEach(error => {
      console.log(`❌ Error: ${error.message} ${error.field ? `(field: ${error.field})` : ''}`);
    });
  }

  // 2. Get user details
  console.log('\n2️⃣ Fetching user with detailed fragment...');
  const userId = createResult.user?.id;
  if (userId) {
    const user = await client.getUser(userId);
    if (user) {
      // All UserDetail fields are available and typed
      console.log(`✅ User details:`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Updated: ${user.updatedAt}`);
    }
  }

  // 3. List users with pagination
  console.log('\n3️⃣ Listing users with typed pagination...');
  const listResult = await client.listUsers(10, 0);
  console.log(`✅ Found ${listResult.total} users`);
  listResult.users.forEach(user => {
    // Only UserFragment fields are available here
    console.log(`   - ${user.name} (${user.email})`);
  });
  console.log(`   Has more: ${listResult.hasMore}`);

  // 4. Search users
  console.log('\n4️⃣ Searching users with mixed fragment/inline fields...');
  const searchResults = await client.searchUsers('alice');
  searchResults.forEach(user => {
    // Both fragment fields and inline fields are typed
    console.log(`   - ${user.name} created at ${user.createdAt}`);
  });

  // 5. Update user
  console.log('\n5️⃣ Updating user with partial input...');
  if (userId) {
    const updateResult = await client.updateUser(userId, { 
      name: 'Alice Cooper-Smith' 
    });
    if (updateResult.success && updateResult.user) {
      console.log(`✅ Updated user: ${updateResult.user.name}`);
    }
  }

  console.log('\n📊 Type Safety Benefits:');
  console.log('- All GraphQL operations are fully typed');
  console.log('- Variable types are inferred from the schema');
  console.log('- Result types match exactly what you query');
  console.log('- Fragments provide reusable, typed data shapes');
  console.log('- TypeScript catches GraphQL errors at compile time! 🎉');
}

// Run the demo
if (import.meta.main) {
  demonstrateTypedClient().catch(console.error);
}