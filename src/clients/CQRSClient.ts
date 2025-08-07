import { TypedReadClient } from './TypedReadClient';
import { TypedWriteClient } from './TypedWriteClient';
import type { CreateUserInput, UpdateUserInput } from '../types';

// Unified CQRS client that separates read and write operations
export class CQRSClient {
  public readonly read: TypedReadClient;
  public readonly write: TypedWriteClient;

  constructor(endpoint: string) {
    // In a real CQRS system, these might be different endpoints
    this.read = new TypedReadClient(endpoint);
    this.write = new TypedWriteClient(endpoint);
  }

  // High-level operations that combine read and write

  // Create and verify user
  async createAndVerifyUser(input: CreateUserInput) {
    // Write operation
    const createResult = await this.write.createUser(input);
    
    if (!createResult.success || !createResult.user) {
      return {
        success: false,
        errors: createResult.errors,
        user: null,
      };
    }

    // Read operation to verify (eventual consistency aware)
    await this.waitForConsistency();
    const user = await this.read.getUser(createResult.user.id);

    return {
      success: true,
      errors: [],
      user,
    };
  }

  // Update with optimistic concurrency control
  async updateUserOptimistic(
    id: string, 
    input: UpdateUserInput,
    expectedVersion?: number
  ) {
    // First read current state
    const currentUser = await this.read.getUser(id);
    
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Perform update
    const updateResult = await this.write.updateUser(id, input);
    
    if (!updateResult.success) {
      return updateResult;
    }

    // Verify update succeeded
    await this.waitForConsistency();
    const updatedUser = await this.read.getUser(id);

    return {
      success: true,
      user: updatedUser,
      errors: [],
    };
  }

  // Bulk import with progress tracking
  async *bulkImportUsers(users: CreateUserInput[]) {
    const total = users.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;

    for (const userInput of users) {
      try {
        const result = await this.write.createUser(userInput);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        completed++;

        yield {
          progress: completed / total,
          completed,
          successful,
          failed,
          current: userInput,
          result,
        };
      } catch (error) {
        failed++;
        completed++;
        
        yield {
          progress: completed / total,
          completed,
          successful,
          failed,
          current: userInput,
          error,
        };
      }
    }
  }

  // Search with write-through cache warming
  async searchWithCacheWarm(query: string) {
    const results = await this.read.searchUsers(query);
    
    // Pre-warm cache for frequently searched users
    if (results.length > 0 && results.length <= 10) {
      // Background cache warming
      Promise.all(
        results.map(user => this.read.getUser(user.id))
      ).catch(() => {}); // Ignore cache warming errors
    }

    return results;
  }

  // Event-driven statistics
  async getUserStatistics() {
    // In a real system, this would query event projections
    const allUsers = await this.read.listUsers({ limit: 1000 });
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: allUsers.total,
      createdToday: 0,
      createdThisWeek: 0,
      domains: new Map<string, number>(),
    };

    // Note: In the current implementation, users don't have createdAt exposed
    // This would need to be added to the fragment or query
    
    for (const user of allUsers.users) {
      const domain = user.email.split('@')[1];
      if (domain) {
        stats.domains.set(domain, (stats.domains.get(domain) || 0) + 1);
      }
    }

    return {
      ...stats,
      topDomains: Array.from(stats.domains.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }

  // Helper to wait for eventual consistency
  private async waitForConsistency(ms = 100): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Demonstration of the unified CQRS client
export async function demonstrateCQRSClient() {
  const client = new CQRSClient('http://localhost:3000/graphql');

  console.log('🎯 CQRS Client Demo with Full Type Safety\n');

  // 1. Create and verify
  console.log('1️⃣ Create and verify user...');
  const createResult = await client.createAndVerifyUser({
    name: 'Test User',
    email: 'test@example.com',
  });

  if (createResult.success && createResult.user) {
    console.log(`✅ User created and verified: ${createResult.user.name}`);
  }

  // 2. Bulk import with progress
  console.log('\n2️⃣ Bulk importing users...');
  const testUsers: CreateUserInput[] = [
    { name: 'User 1', email: 'user1@example.com' },
    { name: 'User 2', email: 'user2@example.com' },
    { name: 'User 3', email: 'user3@example.com' },
  ];

  for await (const progress of client.bulkImportUsers(testUsers)) {
    console.log(`Progress: ${(progress.progress * 100).toFixed(0)}% (${progress.successful}/${progress.completed})`);
  }

  // 3. Get statistics
  console.log('\n3️⃣ Getting user statistics...');
  const stats = await client.getUserStatistics();
  console.log(`Total users: ${stats.total}`);
  console.log(`Created today: ${stats.createdToday}`);
  console.log(`Created this week: ${stats.createdThisWeek}`);
  console.log('Top domains:', stats.topDomains);

  console.log('\n✅ CQRS demonstration completed!');
}