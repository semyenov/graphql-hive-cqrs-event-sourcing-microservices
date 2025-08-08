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
export function createUserDomainResolvers(_context: UserDomainContext) {
  return createResolverMap({
    Query: {
      // Get single user by ID
      user: createQueryResolver({
        queryType: UserQueryTypes.GetUserById,
        mapParams: (args: unknown) => ({
          userId: BrandedTypes.aggregateId((args as { id: string }).id),
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
        mapParams: (args: unknown) => {
          const typedArgs = args as { 
            pagination: { offset: number; limit: number; sortBy?: string; sortOrder?: string };
            includeDeleted?: boolean;
          };
          return {
            pagination: {
              offset: typedArgs.pagination.offset,
              limit: typedArgs.pagination.limit,
              sortBy: typedArgs.pagination.sortBy,
              sortOrder: typedArgs.pagination.sortOrder as 'asc' | 'desc' | undefined,
            },
            includeDeleted: typedArgs.includeDeleted,
          };
        },
      }),
      
      // Search users
      searchUsers: createQueryResolver({
        queryType: UserQueryTypes.SearchUsers,
        mapParams: (args: unknown) => {
          const typedArgs = args as { input: { searchTerm: string; fields?: string[] } };
          return {
            searchTerm: typedArgs.input.searchTerm,
            fields: typedArgs.input.fields as ('name' | 'email')[] | undefined,
          };
        },
      }),
      
      // Get user statistics
      userStats: createQueryResolver({
        queryType: UserQueryTypes.GetUserStats,
        mapParams: (_args: unknown) => ({}),
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
        mapInput: (args: unknown) => {
          const typedArgs = args as { input: { name: string; email: string } };
          return {
            aggregateId: BrandedTypes.aggregateId(crypto.randomUUID()),
            payload: {
              name: typedArgs.input.name,
              email: typedArgs.input.email,
            },
          };
        },
        mapResult: (result: unknown, args: unknown) => {
          const typedArgs = args as { input: { name: string; email: string } };
          return {
            success: (result as any).success,
            user: (result as any).success && (result as any).data ? {
              id: ((result as any).data as { userId?: string; user?: any }).userId,
              name: ((result as any).data as { user?: any }).user?.name || typedArgs.input.name,
              email: ((result as any).data as { user?: any }).user?.email || typedArgs.input.email,
              emailVerified: ((result as any).data as { user?: any }).user?.emailVerified || false,
              deleted: ((result as any).data as { user?: any }).user?.deleted || false,
              createdAt: ((result as any).data as { user?: any }).user?.createdAt || new Date().toISOString(),
              updatedAt: ((result as any).data as { user?: any }).user?.updatedAt || new Date().toISOString(),
          } : null,
          errors: (result as any).error ? [{ message: (result as any).error.message }] : undefined,
        };
        },
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