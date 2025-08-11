/**
 * Mock implementations for testing
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Data from 'effect/Data';
import { BrandedTypes } from '@cqrs/framework/core/branded/factories';
import type { UserQueryResults } from './application/queries';
import type { UserId, Email, Username } from './core/types';
import { UserTypes } from './core/types';

/**
 * Create a mock user DTO
 */
export const createMockUserDTO = (overrides?: Partial<UserQueryResults.UserDTO>): UserQueryResults.UserDTO => {
  const defaultUser: UserQueryResults.UserDTO = {
    id: UserTypes.userId('user-123'),
    email: UserTypes.email('test@example.com'),
    username: UserTypes.username('testuser'),
    status: 'ACTIVE',
    role: 'USER',
    profile: {
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      bio: 'Test bio',
      avatarUrl: 'https://example.com/avatar.jpg',
      location: 'Test City',
      website: 'https://example.com'
    },
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    twoFactorEnabled: false
  };
  
  return { ...defaultUser, ...overrides };
};

/**
 * Mock projection store for testing
 */
export class MockProjectionStore {
  private users: Map<string, UserQueryResults.UserDTO> = new Map();
  
  constructor() {
    // Add some default users
    const user1 = createMockUserDTO({
      id: UserTypes.userId('user-1'),
      email: UserTypes.email('user1@example.com'),
      username: UserTypes.username('user1')
    });
    
    const user2 = createMockUserDTO({
      id: UserTypes.userId('user-2'),
      email: UserTypes.email('user2@example.com'),
      username: UserTypes.username('user2')
    });
    
    this.users.set('user-1', user1);
    this.users.set('user-2', user2);
  }
  
  getUserById(id: UserId): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const user = this.users.get(id as string);
    return Effect.succeed(Option.fromNullable(user));
  }
  
  getUserByEmail(email: Email): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    return Effect.succeed(Option.fromNullable(user));
  }
  
  getUserByUsername(username: Username): Effect.Effect<Option.Option<UserQueryResults.UserDTO>, never, never> {
    const user = Array.from(this.users.values()).find(u => u.username === username);
    return Effect.succeed(Option.fromNullable(user));
  }
  
  listUsers(params: any): Effect.Effect<UserQueryResults.UserListResult, never, never> {
    const users = Array.from(this.users.values());
    const offset = params.offset || 0;
    const limit = params.limit || 10;
    
    return Effect.succeed({
      users: users.slice(offset, offset + limit),
      total: users.length,
      offset,
      limit
    });
  }
  
  searchUsers(params: any): Effect.Effect<UserQueryResults.UserListResult, never, never> {
    const users = Array.from(this.users.values());
    const filtered = users.filter(u => {
      const searchTerm = params.searchTerm.toLowerCase();
      return u.username.toLowerCase().includes(searchTerm) ||
             u.email.toLowerCase().includes(searchTerm);
    });
    
    return Effect.succeed({
      users: filtered,
      total: filtered.length,
      offset: params.offset || 0,
      limit: params.limit || 10
    });
  }
  
  getUserStats(params: any): Effect.Effect<UserQueryResults.UserStatsResult, never, never> {
    return Effect.succeed({
      total: this.users.size,
      active: 2,
      pending: 0,
      suspended: 0,
      deleted: 0,
      verified: 2,
      withTwoFactor: 0,
      newToday: 1,
      newThisWeek: 2,
      newThisMonth: 2,
      byRole: { 
        USER: 2,
        MODERATOR: 0,
        ADMIN: 0,
        SUPER_ADMIN: 0
      },
      bySource: {}
    });
  }
  
  getUserSessions(userId: UserId, activeOnly: boolean): Effect.Effect<readonly UserQueryResults.UserSessionDTO[], never, never> {
    return Effect.succeed([]);
  }
  
  checkEmailExists(email: string): Effect.Effect<boolean, never, never> {
    const exists = Array.from(this.users.values()).some(u => u.email === UserTypes.email(email));
    return Effect.succeed(exists);
  }
  
  checkUsernameExists(username: string): Effect.Effect<boolean, never, never> {
    const exists = Array.from(this.users.values()).some(u => u.username === UserTypes.username(username));
    return Effect.succeed(exists);
  }
  
  // Method to add a new user (for createUser mutation)
  addUser(user: UserQueryResults.UserDTO): void {
    this.users.set(user.id as string, user);
  }
}