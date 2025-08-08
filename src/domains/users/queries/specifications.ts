/**
 * User Domain: Query Filters
 * 
 * Simple filter functions for user queries (replacing complex specification pattern).
 */

import type { UserState } from '../aggregates/user';

/**
 * Basic user filter functions
 */
export const UserFilters = {
  /**
   * Filter for active (non-deleted) users
   */
  active: (user: UserState): boolean => !user.deleted,
  
  /**
   * Filter for deleted users
   */
  deleted: (user: UserState): boolean => user.deleted,
  
  /**
   * Filter for users with verified email
   */
  emailVerified: (user: UserState): boolean => user.emailVerified,
  
  /**
   * Filter for users with unverified email
   */
  emailUnverified: (user: UserState): boolean => !user.emailVerified,
  
  /**
   * Filter for users with profile
   */
  hasProfile: (user: UserState): boolean => !!user.profile && Object.keys(user.profile).length > 0,
  
  /**
   * Filter for users created within date range
   */
  createdBetween: (startDate: Date, endDate: Date) => (user: UserState): boolean => {
    const createdDate = new Date(user.createdAt);
    return createdDate >= startDate && createdDate <= endDate;
  },
  
  /**
   * Filter for users with specific email domain
   */
  emailDomain: (domain: string) => (user: UserState): boolean => {
    const emailDomain = (user.email as string).split('@')[1];
    return emailDomain === domain;
  },
  
  /**
   * Filter for users matching name pattern
   */
  nameMatches: (pattern: RegExp) => (user: UserState): boolean => {
    return pattern.test(user.name as string);
  },
};

/**
 * Combine multiple filters with AND logic
 */
export function combineFilters<T>(
  ...filters: Array<(item: T) => boolean>
): (item: T) => boolean {
  return (item: T) => filters.every(filter => filter(item));
}

/**
 * Apply filter to array
 */
export function filterUsers(
  users: UserState[],
  filter: (user: UserState) => boolean
): UserState[] {
  return users.filter(filter);
}