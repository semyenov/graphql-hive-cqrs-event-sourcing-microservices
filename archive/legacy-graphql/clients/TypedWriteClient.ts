import { writeGraphql, type ResultOf, type VariablesOf, readFragment } from '../graphql/write-graphql';
import type { TadaDocumentNode } from 'gql.tada';
import * as UserFragments from '../graphql/fragments/user.fragments';
import {
  CREATE_USER_MUTATION,
  UPDATE_USER_MUTATION,
  DELETE_USER_MUTATION
} from '../graphql/write/mutations';
import type { CreateUserInput, UpdateUserInput } from '../types';

// Type-safe GraphQL write client
export class TypedWriteClient {
  constructor(private endpoint: string) {}

  private async request<TResult, TVariables>(
    query: TadaDocumentNode<TResult, TVariables>,
    variables?: TVariables
  ): Promise<TResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-name': 'typed-write-client',
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

  // Create user with full type safety
  async createUser(input: CreateUserInput) {
    const data = await this.request<
      ResultOf<typeof CREATE_USER_MUTATION>,
      VariablesOf<typeof CREATE_USER_MUTATION>
    >(CREATE_USER_MUTATION, { input });

    // Unmask the payload fragment
    const payload = readFragment(UserFragments.CreateUserPayloadFragment, data.createUser);
    
    // Unmask the nested MutationPayloadFields fragment to access success and errors
    const payloadFields = readFragment(UserFragments.MutationPayloadFieldsFragment, payload);
    
    // Unmask nested fragments
    const user = payload.user 
      ? readFragment(UserFragments.WriteUserFieldsFragment, payload.user)
      : null;
    
    const errors = payloadFields.errors?.map(error => 
      readFragment(UserFragments.ErrorFieldsFragment, error)
    ) || [];

    return {
      success: payloadFields.success,
      user,
      errors,
    };
  }

  // Update user with type safety
  async updateUser(id: string, input: UpdateUserInput) {
    const data = await this.request<
      ResultOf<typeof UPDATE_USER_MUTATION>,
      VariablesOf<typeof UPDATE_USER_MUTATION>
    >(UPDATE_USER_MUTATION, { id, input });

    const payload = readFragment(UserFragments.UpdateUserPayloadFragment, data.updateUser);
    
    const user = payload.user 
      ? readFragment(UserFragments.WriteUserFieldsFragment, payload.user)
      : null;
    
    const errors = payload.errors?.map(error => 
      readFragment(UserFragments.ErrorFieldsFragment, error)
    ) || [];

    return {
      success: payload.success,
      user,
      errors,
    };
  }

  // Delete user
  async deleteUser(id: string) {
    const data = await this.request<
      ResultOf<typeof DELETE_USER_MUTATION>,
      VariablesOf<typeof DELETE_USER_MUTATION>
    >(DELETE_USER_MUTATION, { id });

    const payload = readFragment(UserFragments.DeleteUserPayloadFragment, data.deleteUser);
    
    const errors = payload.errors?.map(error => 
      readFragment(UserFragments.ErrorFieldsFragment, error)
    ) || [];

    return {
      success: payload.success,
      errors,
    };
  }

  // Batch operations with transaction-like behavior
  async batchOperations<T>(
    operations: Array<() => Promise<T>>
  ): Promise<{ successful: T[]; failed: Array<{ error: Error; index: number }> }> {
    const results = await Promise.allSettled(operations.map(op => op()));
    
    const successful: T[] = [];
    const failed: Array<{ error: Error; index: number }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({ error: result.reason, index });
      }
    });

    return { successful, failed };
  }

  // Retry logic for mutations
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    backoff = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
        }
      }
    }

    throw lastError;
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
export async function demonstrateWriteClient() {
  const client = new TypedWriteClient('http://localhost:3000/graphql');

  console.log('✍️ Type-Safe Write Client Demo\n');

  // 1. Create a new user
  console.log('1️⃣ Creating new user...');
  const createResult = await client.createUser({
    name: 'John Doe',
    email: 'john@example.com',
  });

  if (createResult.success && createResult.user) {
    console.log(`✅ Created user: ${createResult.user.name} (ID: ${createResult.user.id})`);
  } else {
    console.log('❌ Failed to create user:', createResult.errors);
  }

  // 2. Update the user
  if (createResult.user) {
    console.log('\n2️⃣ Updating user...');
    const updateResult = await client.updateUser(createResult.user.id, {
      name: 'John Smith',
    });

    if (updateResult.success && updateResult.user) {
      console.log(`✅ Updated user: ${updateResult.user.name}`);
    }
  }

  // 3. Batch create users
  console.log('\n3️⃣ Batch creating users...');
  const batchResult = await client.batchOperations([
    () => client.createUser({ name: 'Alice', email: 'alice@example.com' }),
    () => client.createUser({ name: 'Bob', email: 'bob@example.com' }),
    () => client.createUser({ name: 'Charlie', email: 'charlie@example.com' }),
  ]);

  console.log(`✅ Successfully created ${batchResult.successful.length} users`);
  if (batchResult.failed.length > 0) {
    console.log(`❌ Failed to create ${batchResult.failed.length} users`);
  }

  // 4. Retry example
  console.log('\n4️⃣ Demonstrating retry logic...');
  try {
    const result = await client.withRetry(
      () => client.createUser({ name: 'Retry Test', email: 'retry@example.com' }),
      3,
      500
    );
    console.log('✅ Operation succeeded with retry');
  } catch (error) {
    console.log('❌ Operation failed after retries');
  }

  console.log('\n✅ All write operations completed with full type safety!');
}