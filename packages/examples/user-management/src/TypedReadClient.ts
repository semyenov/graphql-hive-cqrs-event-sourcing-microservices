  import { type ResultOf, type VariablesOf, readFragment } from './graphql/operations/read-graphql';
import type { TadaDocumentNode } from 'gql.tada';
import * as UserFragments from './graphql/operations/fragments/user.fragments';
import {
  GET_USER_QUERY,
  LIST_USERS_QUERY,
  SEARCH_USERS_QUERY
} from './graphql/operations/read/queries';
import type { IReadClient } from '@cqrs-framework/client';

// Type-safe GraphQL read client
export class TypedReadClient implements IReadClient {
  constructor(private endpoint: string) {}

  private async request<TResult, TVariables>(
    query: TadaDocumentNode<TResult, TVariables>,
    variables?: TVariables
  ): Promise<TResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-name': 'typed-read-client',
        'client-version': '1.0.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new GraphQLError(result.errors);
    }
    
    return result.data;
  }

  // Get user by ID with full type safety
  async getUser(id: string) {
    const data = await this.request<
      ResultOf<typeof GET_USER_QUERY>,
      VariablesOf<typeof GET_USER_QUERY>
    >(GET_USER_QUERY, { id });

    if (!data.getUser) {
      return null;
    }

    // Unmask the fragment to access user data
    const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, data.getUser);
    // Unmask the nested UserBasicFields fragment
    const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
    
    return {
      ...userBasic,
      createdAt: userDetail.createdAt,
      updatedAt: userDetail.updatedAt
    };
  }

  // List users with pagination
  async listUsers(options?: { limit?: number; offset?: number }) {
    const data = await this.request<
      ResultOf<typeof LIST_USERS_QUERY>,
      VariablesOf<typeof LIST_USERS_QUERY>
    >(LIST_USERS_QUERY, options);

    // Unmask the list fragment
    const listData = readFragment(UserFragments.UserListFieldsFragment, data.listUsers);
    
    // Unmask each user in the list
    const users = listData.users.map(user => 
      readFragment(UserFragments.UserBasicFieldsFragment, user)
    );

    return {
      users,
      total: listData.total,
      hasMore: listData.hasMore,
    };
  }

  // Search users with type safety
  async searchUsers(query: string) {
    const data = await this.request<
      ResultOf<typeof SEARCH_USERS_QUERY>,
      VariablesOf<typeof SEARCH_USERS_QUERY>
    >(SEARCH_USERS_QUERY, { query });

    // Unmask each user detail
    return data.searchUsers.map(user => {
      const userDetail = readFragment(UserFragments.UserDetailFieldsFragment, user);
      const userBasic = readFragment(UserFragments.UserBasicFieldsFragment, userDetail);
      
      return {
        ...userBasic,
        createdAt: userDetail.createdAt,
        updatedAt: userDetail.updatedAt
      };
    });
  }

  // Batch get users with caching
  async batchGetUsers(ids: string[]) {
    const cache = new Map<string, any>();
    
    const results = await Promise.all(
      ids.map(async (id) => {
        if (cache.has(id)) {
          return cache.get(id);
        }
        
        const user = await this.getUser(id);
        if (user) {
          cache.set(id, user);
        }
        return user;
      })
    );

    return results.filter(Boolean);
  }

  // Stream users with async iterator
  async *streamUsers(pageSize = 10) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.listUsers({ limit: pageSize, offset });
      
      for (const user of result.users) {
        yield user; // Already unmasked by listUsers
      }

      hasMore = result.hasMore;
      offset += pageSize;
    }
  }

  // Implement IReadClient interface methods
  async query<TResult = unknown, TQuery = unknown>(query: TQuery): Promise<TResult> {
    // Generic query method - delegates to specific methods based on query type
    if (typeof query === 'string') {
      // Handle string-based queries (e.g., user ID)
      return this.getUser(query) as Promise<TResult>;
    }
    
    // Handle object-based queries
    if (typeof query === 'object' && query !== null) {
      const queryObj = query as any;
      
      if (queryObj.type === 'getUser' && queryObj.id) {
        return this.getUser(queryObj.id) as Promise<TResult>;
      }
      
      if (queryObj.type === 'listUsers') {
        return this.listUsers(queryObj.options) as Promise<TResult>;
      }
      
      if (queryObj.type === 'searchUsers' && queryObj.query) {
        return this.searchUsers(queryObj.query) as Promise<TResult>;
      }
    }
    
    throw new Error(`Unsupported query type: ${typeof query}`);
  }

  async queryBatch<TResult = unknown, TQuery = unknown>(queries: TQuery[]): Promise<TResult[]> {
    // Execute multiple queries in parallel
    return Promise.all(queries.map(query => this.query<TResult, TQuery>(query)));
  }
}

// Custom error class for GraphQL errors
export class GraphQLError extends Error {
  constructor(public errors: any[]) {
    super(errors.map(e => e.message).join(', '));
    this.name = 'GraphQLError';
  }
}

// Usage example
export async function demonstrateReadClient() {
  const client = new TypedReadClient('http://localhost:3000/graphql');

  console.log('🔍 Type-Safe Read Client Demo\n');

  // 1. Get single user
  console.log('1️⃣ Getting user by ID...');
  const user = await client.getUser('123');
  if (user) {
    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Created: ${user.createdAt}, Updated: ${user.updatedAt}`);
  }

  // 2. List users with pagination
  console.log('\n2️⃣ Listing users with pagination...');
  const userList = await client.listUsers({ limit: 5, offset: 0 });
  console.log(`Found ${userList.total} users total`);
  userList.users.forEach(u => {
    console.log(`- ${u.name} (${u.email})`);
  });

  // 3. Search users
  console.log('\n3️⃣ Searching for users...');
  const searchResults = await client.searchUsers('alice');
  console.log(`Found ${searchResults.length} matching users`);

  // 4. Stream all users
  console.log('\n4️⃣ Streaming all users...');
  let count = 0;
  for await (const user of client.streamUsers(3)) {
    console.log(`Streamed: ${user.name}`);
    count++;
    if (count >= 10) break; // Limit for demo
  }

  console.log('\n✅ All operations completed with full type safety!');
}