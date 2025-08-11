/**
 * Shared: Domain Constants
 * 
 * Shared constants used across the user domain.
 * Provides consistent values for domain operations.
 */

import { BrandedTypes } from "@cqrs/framework";

/**
 * Special aggregate ID used for statistics projection
 */
export const STATS_AGGREGATE_ID = BrandedTypes.aggregateId('stats');

/**
 * User validation constants
 */
export const USER_VALIDATION = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_OFFSET: 0,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  USER_DETAILS: 300, // 5 minutes
  USER_LIST: 60,     // 1 minute
  USER_STATS: 30,    // 30 seconds
} as const; 