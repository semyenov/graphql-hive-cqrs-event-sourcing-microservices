/**
 * User Domain: Constants
 * 
 * Domain-specific constants and special values.
 */

import { BrandedTypes } from '../../../framework/core/branded/factories';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * Special aggregate ID for statistics aggregation
 */
export const STATS_AGGREGATE_ID: AggregateId = BrandedTypes.aggregateId('stats');

/**
 * Default values
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_CACHE_TTL = 60000; // 1 minute