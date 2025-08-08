/**
 * User Domain: GraphQL Resolvers
 * 
 * GraphQL resolvers for the user domain using the CQRS bridge.
 */

import { 
  createMutationResolver, 
  createQueryResolver,
  createResolverMap,
} from '../../framework/graphql';
import { BrandedTypes } from '../../framework/core/branded/factories';
import type { UserDomainContext } from './index';
import { UserCommandTypes } from './commands/types';
import { UserQueryTypes } from './queries/types';

/**
 * Create user domain resolvers
 */
export function createUserDomainResolvers(context: UserDomainContext) {
  return createResolverMap({
    Query: {
      // Get single user by ID
      user: createQueryResolver({
        queryType: UserQueryTypes.GetUserById,
        mapParams: (args: { id: string }) => ({
          userId: BrandedTypes.aggregateId(args.id),
        }),
      }),
      
      // Get user by email
      userByEmail: createQueryResolver({
        queryType: UserQueryTypes.GetUserByEmail,
        mapParams: (args: { email: string }) => ({
          email: BrandedTypes.email(args.email),
        }),
      }),
      
      // List users with pagination
      users: createQueryResolver({
        queryType: UserQueryTypes.ListUsers,
        mapParams: (args: { 
          pagination: { offset: number; limit: number; sortBy?: string; sortOrder?: string };
          includeDeleted?: boolean;
        }) => ({
          pagination: {
            offset: args.pagination.offset,
            limit: args.pagination.limit,
            sortBy: args.pagination.sortBy,
            sortOrder: args.pagination.sortOrder as 'asc' | 'desc' | undefined,
          },
          includeDeleted: args.includeDeleted,
        }),
      }),
      
      // Search users
      searchUsers: createQueryResolver({
        queryType: UserQueryTypes.SearchUsers,
        mapParams: (args: { input: { searchTerm: string; fields?: string[] } }) => ({
          searchTerm: args.input.searchTerm,
          fields: args.input.fields as ('name' | 'email')[] | undefined,
        }),
      }),
      
      // Get user statistics
      userStats: createQueryResolver({
        queryType: UserQueryTypes.GetUserStats,
        mapParams: (_args: Record<string, never>) => ({}),
        cache: {
          ttl: 30000, // Cache for 30 seconds
          key: () => 'user-stats',
        },
      }),
    },
    
    Mutation: {
      // Create user
      createUser: createMutationResolver({
        commandType: UserCommandTypes.CreateUser,
        mapInput: (args: { input: { name: string; email: string } }) => ({
          aggregateId: BrandedTypes.aggregateId(crypto.randomUUID()),
          payload: {
            name: args.input.name,
            email: args.input.email,
          },
        }),
        mapResult: (result, args) => ({
          success: result.success,
          user: result.success && result.data ? {
            id: (result.data as { userId?: string }).userId,
            name: args.input.name,
            email: args.input.email,
            emailVerified: false,
            deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } : null,
          errors: result.error ? [{ message: result.error.message }] : undefined,
        }),
      }),
      
      // Update user
      updateUser: createMutationResolver({
        commandType: UserCommandTypes.UpdateUser,
        mapInput: (args: { id: string; input: { name?: string; email?: string } }) => ({
          aggregateId: BrandedTypes.aggregateId(args.id),
          payload: {
            name: args.input.name,
            email: args.input.email,
          },
        }),
        mapResult: (result) => ({
          success: result.success,
          user: null, // Would need to fetch updated user
          errors: result.error ? [{ message: result.error.message }] : undefined,
        }),
      }),
      
      // Delete user
      deleteUser: createMutationResolver({
        commandType: UserCommandTypes.DeleteUser,
        mapInput: (args: { id: string; reason?: string }) => ({
          aggregateId: BrandedTypes.aggregateId(args.id),
          payload: {
            reason: args.reason,
          },
        }),
        mapResult: (result) => ({
          success: result.success,
          user: null,
          errors: result.error ? [{ message: result.error.message }] : undefined,
        }),
      }),
      
      // Verify user email
      verifyUserEmail: createMutationResolver({
        commandType: UserCommandTypes.VerifyUserEmail,
        mapInput: (args: { id: string; token: string }) => ({
          aggregateId: BrandedTypes.aggregateId(args.id),
          payload: {
            verificationToken: args.token,
          },
        }),
        mapResult: (result) => ({
          success: result.success,
          user: null,
          errors: result.error ? [{ message: result.error.message }] : undefined,
        }),
      }),
      
      // Update user profile
      updateUserProfile: createMutationResolver({
        commandType: UserCommandTypes.UpdateUserProfile,
        mapInput: (args: { 
          id: string; 
          input: { bio?: string; avatar?: string; location?: string } 
        }) => ({
          aggregateId: BrandedTypes.aggregateId(args.id),
          payload: {
            bio: args.input.bio,
            avatar: args.input.avatar,
            location: args.input.location,
          },
        }),
        mapResult: (result) => ({
          success: result.success,
          user: null,
          errors: result.error ? [{ message: result.error.message }] : undefined,
        }),
      }),
    },
  });
}