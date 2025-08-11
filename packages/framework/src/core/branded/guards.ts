/**
 * Shared: Branded Type Guards
 * 
 * Type guard functions for branded types.
 */

import type * as Types from './types';

/**
 * Branded type guards
 */
export const BrandedTypeGuards = {
  isAggregateId: <T extends Types.AggregateId<string>>(value: unknown): value is T => {
    return typeof value === 'string' && value.length > 0;
  },

  isEventId: (value: unknown): value is Types.EventId => {
    return typeof value === 'string' && value.length > 0;
  },

  isCommandId: (value: unknown): value is Types.CommandId => {
    return typeof value === 'string' && value.length > 0;
  },

  isEventVersion: (value: unknown): value is Types.EventVersion => {
    return typeof value === 'number' && value >= 0;
  },

  isAggregateVersion: (value: unknown): value is Types.AggregateVersion => {
    return typeof value === 'number' && value >= 0;
  },

  isTimestamp: (value: unknown): value is Types.Timestamp => {
    return value instanceof Date && !isNaN(value.getTime());
  }
};