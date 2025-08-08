/**
 * User Domain: Enhanced GraphQL Resolvers
 * 
 * Demonstrates the enhanced resolver system with automatic CQRS integration,
 * validation, caching, and monitoring.
 */

import { ResolverFactory, ResolverMiddleware, type IResolverContext } from '../../framework/graphql/enhanced-resolvers';
import type { GraphQLFieldConfig } from 'graphql';
import type * as UserCommands from './commands/types';
import type * as UserQueries from './queries/types';

/**
 * Enhanced user resolvers with automatic features
 */
export const enhancedUserResolvers = {
  Query: {
    // Smart query resolver with caching and performance monitoring
    user: ResolverFactory
      .query<UserQueries.GetUserByIdQuery>('GET_USER_BY_ID')
      .withCaching(600000) // 10 minutes cache
      .withAuth(['user:read'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.correlation())
      .configure({
        enableMetrics: true,
        enableValidation: true,
        enableErrorHandling: true,
      })
      .build(),

    // List users with pagination and filtering
    users: ResolverFactory
      .query<UserQueries.ListUsersQuery>('LIST_USERS')
      .withCaching(300000) // 5 minutes cache
      .withAuth(['user:list'])
      .use(ResolverMiddleware.sanitization())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: limit pagination size
        (context) => {
          const limit = context.args.pagination?.limit as number;
          if (limit && limit > 100) {
            throw new Error('Maximum limit is 100 items per page');
          }
        },
        // Custom business rule: validate filter criteria
        (context) => {
          const filters = context.args.filters as Record<string, unknown>;
          if (filters?.email && typeof filters.email !== 'string') {
            throw new Error('Email filter must be a string');
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableRateLimit: true,
        rateLimit: 200, // 200 requests per minute
      })
      .build(),

    // Search users with advanced filtering
    searchUsers: ResolverFactory
      .query<UserQueries.SearchUsersQuery>('SEARCH_USERS')
      .withCaching(180000) // 3 minutes cache (shorter for search)
      .withAuth(['user:search'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.businessRules([
        // Require minimum search term length
        (context) => {
          const searchTerm = context.args.searchTerm as string;
          if (!searchTerm || searchTerm.length < 3) {
            throw new Error('Search term must be at least 3 characters');
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableRateLimit: true,
        rateLimit: 50, // Lower rate limit for search
      })
      .build(),

    // User statistics (admin only)
    userStats: ResolverFactory
      .query<UserQueries.GetUserStatsQuery>('GET_USER_STATS')
      .withCaching(900000) // 15 minutes cache
      .withAuth(['admin', 'user:stats'])
      .configure({
        enableMetrics: true,
        enableValidation: false, // No input validation needed
      })
      .build(),
  },

  Mutation: {
    // Create user with comprehensive validation
    createUser: ResolverFactory
      .command<UserCommands.CreateUserCommand>('CREATE_USER')
      .withValidation()
      .withAuth(['user:create'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.correlation())
      .use(ResolverMiddleware.sanitization())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: check email domain
        async (context) => {
          const email = context.args.input?.email as string;
          if (email) {
            const domain = email.split('@')[1];
            const blockedDomains = ['tempmail.com', '10minutemail.com'];
            if (blockedDomains.includes(domain?.toLowerCase())) {
              throw new Error('Email domain is not allowed');
            }
          }
        },
        // Custom business rule: rate limit user creation per IP
        async (context) => {
          // In a real implementation, this would check IP-based rate limiting
          console.log('Checking user creation rate limit...');
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
        enableRateLimit: true,
        rateLimit: 10, // 10 user creations per minute
      })
      .build(),

    // Update user with optimistic concurrency
    updateUser: ResolverFactory
      .command<UserCommands.UpdateUserCommand>('UPDATE_USER')
      .withValidation()
      .withAuth(['user:update'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: users can only update their own profile
        (context) => {
          const targetUserId = context.args.id as string;
          const currentUserId = context.context.userId;
          const isAdmin = context.context.permissions?.includes('admin');
          
          if (!isAdmin && targetUserId !== currentUserId) {
            throw new Error('You can only update your own profile');
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
      })
      .build(),

    // Delete user (admin only)
    deleteUser: ResolverFactory
      .command<UserCommands.DeleteUserCommand>('DELETE_USER')
      .withValidation()
      .withAuth(['admin', 'user:delete'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.correlation())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: prevent self-deletion
        (context) => {
          const targetUserId = context.args.id as string;
          const currentUserId = context.context.userId;
          
          if (targetUserId === currentUserId) {
            throw new Error('You cannot delete your own account');
          }
        },
        // Custom business rule: require deletion reason for audit
        (context) => {
          const reason = context.args.input?.reason as string;
          if (!reason || reason.length < 10) {
            throw new Error('Deletion reason must be at least 10 characters');
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
        enableRateLimit: true,
        rateLimit: 5, // Very low rate limit for deletions
      })
      .build(),

    // Verify user email
    verifyUserEmail: ResolverFactory
      .command<UserCommands.VerifyUserEmailCommand>('VERIFY_USER_EMAIL')
      .withValidation()
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: validate token format
        (context) => {
          const token = context.args.input?.verificationToken as string;
          if (token && !token.match(/^[a-zA-Z0-9]{32,}$/)) {
            throw new Error('Invalid verification token format');
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
        enableRateLimit: true,
        rateLimit: 20, // 20 verification attempts per minute
      })
      .build(),

    // Update user profile
    updateUserProfile: ResolverFactory
      .command<UserCommands.UpdateUserProfileCommand>('UPDATE_USER_PROFILE')
      .withValidation()
      .withAuth(['user:update'])
      .use(ResolverMiddleware.sanitization())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: validate profile data
        (context) => {
          const bio = context.args.input?.bio as string;
          if (bio && bio.length > 1000) {
            throw new Error('Bio cannot exceed 1000 characters');
          }
        },
        // Custom business rule: validate avatar URL
        (context) => {
          const avatar = context.args.input?.avatar as string;
          if (avatar) {
            try {
              const url = new URL(avatar);
              if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Avatar must be HTTP or HTTPS URL');
              }
            } catch {
              throw new Error('Invalid avatar URL format');
            }
          }
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
      })
      .build(),

    // Change user password
    changeUserPassword: ResolverFactory
      .command<UserCommands.ChangeUserPasswordCommand>('CHANGE_USER_PASSWORD')
      .withValidation()
      .withAuth(['user:update'])
      .use(ResolverMiddleware.logging())
      .use(ResolverMiddleware.businessRules([
        // Custom business rule: password strength validation
        (context) => {
          const newPassword = context.args.input?.newPassword as string;
          if (newPassword) {
            if (newPassword.length < 8) {
              throw new Error('Password must be at least 8 characters');
            }
            if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
              throw new Error('Password must contain uppercase, lowercase, number, and special character');
            }
          }
        },
        // Custom business rule: rate limit password changes
        (context) => {
          // In production, implement proper rate limiting
          console.log('Checking password change rate limit...');
        },
      ]))
      .configure({
        enableMetrics: true,
        enableValidation: true,
        enableRateLimit: true,
        rateLimit: 3, // 3 password changes per minute
      })
      .build(),
  },
};

/**
 * Automatic CRUD resolvers using factory
 */
export const userCrudResolvers = ResolverFactory.crud('User', {
  enableCreate: true,
  enableRead: true,
  enableUpdate: true,
  enableDelete: true,
  enableList: true,
});

/**
 * Resolver performance monitoring
 */
export class ResolverMetrics {
  private static metrics = new Map<string, {
    totalExecutions: number;
    totalTime: number;
    avgTime: number;
    errors: number;
    lastExecution: number;
  }>();

  static record(resolverName: string, executionTime: number, hasError: boolean = false): void {
    const existing = this.metrics.get(resolverName) || {
      totalExecutions: 0,
      totalTime: 0,
      avgTime: 0,
      errors: 0,
      lastExecution: 0,
    };

    existing.totalExecutions++;
    existing.totalTime += executionTime;
    existing.avgTime = existing.totalTime / existing.totalExecutions;
    if (hasError) existing.errors++;
    existing.lastExecution = Date.now();

    this.metrics.set(resolverName, existing);
  }

  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, metrics] of this.metrics) {
      result[name] = { ...metrics };
    }
    return result;
  }

  static getTopSlowestResolvers(limit = 5): Array<{ name: string; avgTime: number }> {
    return Array.from(this.metrics.entries())
      .map(([name, metrics]) => ({ name, avgTime: metrics.avgTime }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  static reset(): void {
    this.metrics.clear();
  }
}

/**
 * Custom middleware for user domain
 */
export const UserResolverMiddleware = {
  /**
   * User context enrichment
   */
  userContext(): import('../../framework/graphql/enhanced-resolvers').ResolverMiddleware {
    return async (context, next) => {
      // Enrich context with user-specific data
      if (context.context.userId) {
        context.context.metadata = {
          ...context.context.metadata,
          userDomain: 'users',
          timestamp: Date.now(),
        };
      }
      return next();
    };
  },

  /**
   * User-specific metrics
   */
  userMetrics(): import('../../framework/graphql/enhanced-resolvers').ResolverMiddleware {
    return async (context, next) => {
      const start = performance.now();
      let hasError = false;
      
      try {
        return await next();
      } catch (error) {
        hasError = true;
        throw error;
      } finally {
        const duration = performance.now() - start;
        ResolverMetrics.record(`user.${context.fieldName}`, duration, hasError);
      }
    };
  },

  /**
   * User privacy filters
   */
  privacyFilter(): import('../../framework/graphql/enhanced-resolvers').ResolverMiddleware {
    return async (context, next) => {
      const result = await next();
      
      // Filter sensitive data based on user permissions
      if (result && typeof result === 'object' && 'data' in result) {
        const currentUserId = context.context.userId;
        const isAdmin = context.context.permissions?.includes('admin');
        
        // Example: Hide email for non-owners/non-admins
        if (!isAdmin && result.data && typeof result.data === 'object') {
          const data = result.data as any;
          if (data.id !== currentUserId && data.email) {
            data.email = '[HIDDEN]';
          }
        }
      }
      
      return result;
    };
  },
};

/**
 * Enhanced resolver configuration presets
 */
export const ResolverPresets = {
  /**
   * Public API resolvers (high security, rate limiting)
   */
  publicApi: {
    enableValidation: true,
    enableMetrics: true,
    enableErrorHandling: true,
    enableCaching: true,
    cacheTTL: 300000, // 5 minutes
    enableAuth: true,
    enableRateLimit: true,
    rateLimit: 100,
  },

  /**
   * Internal API resolvers (moderate security, performance focused)
   */
  internalApi: {
    enableValidation: true,
    enableMetrics: true,
    enableErrorHandling: true,
    enableCaching: true,
    cacheTTL: 600000, // 10 minutes
    enableAuth: false,
    enableRateLimit: false,
  },

  /**
   * Admin API resolvers (full features, comprehensive logging)
   */
  adminApi: {
    enableValidation: true,
    enableMetrics: true,
    enableErrorHandling: true,
    enableCaching: false, // No caching for admin operations
    enableAuth: true,
    enableRateLimit: true,
    rateLimit: 50,
  },

  /**
   * Development resolvers (minimal restrictions, maximum visibility)
   */
  development: {
    enableValidation: false,
    enableMetrics: true,
    enableErrorHandling: true,
    enableCaching: false,
    enableAuth: false,
    enableRateLimit: false,
  },
};

/**
 * Resolver health check
 */
export class ResolverHealthCheck {
  static async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, any>;
    issues: string[];
  }> {
    const metrics = ResolverMetrics.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for slow resolvers
    const slowResolvers = ResolverMetrics.getTopSlowestResolvers(3);
    slowResolvers.forEach(resolver => {
      if (resolver.avgTime > 1000) {
        issues.push(`Resolver ${resolver.name} is slow (${resolver.avgTime.toFixed(2)}ms avg)`);
        status = 'degraded';
      }
      if (resolver.avgTime > 5000) {
        status = 'unhealthy';
      }
    });

    // Check error rates
    Object.entries(metrics).forEach(([name, metric]: [string, any]) => {
      const errorRate = metric.errors / metric.totalExecutions;
      if (errorRate > 0.05) { // 5% error rate
        issues.push(`Resolver ${name} has high error rate (${(errorRate * 100).toFixed(1)}%)`);
        status = 'degraded';
      }
      if (errorRate > 0.20) { // 20% error rate
        status = 'unhealthy';
      }
    });

    return { status, metrics, issues };
  }
}

/**
 * Export enhanced resolvers
 */
export default enhancedUserResolvers;