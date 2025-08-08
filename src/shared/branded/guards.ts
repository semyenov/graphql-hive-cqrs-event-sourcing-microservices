/**
 * Shared: Branded Type Guards
 * 
 * Type guard functions for runtime type checking of branded types.
 */

import type * as Types from './types';

/**
 * Type guard functions for branded types
 */
export const BrandedTypeGuards = {
  // ID type guards
  isAggregateId: (value: unknown): value is Types.AggregateId => {
    return typeof value === 'string' && value.length > 0;
  },

  isEventId: (value: unknown): value is Types.EventId => {
    return typeof value === 'string' && value.length > 0;
  },

  isUserId: (value: unknown): value is Types.UserId => {
    return typeof value === 'string' && value.length > 0;
  },

  isCorrelationId: (value: unknown): value is Types.CorrelationId => {
    return typeof value === 'string' && value.length > 0;
  },

  // Value object type guards
  isEmail: (value: unknown): value is Types.Email => {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  isPersonName: (value: unknown): value is Types.PersonName => {
    return typeof value === 'string' && 
           value.trim().length >= 2 && 
           value.length <= 100;
  },

  isPhoneNumber: (value: unknown): value is Types.PhoneNumber => {
    return typeof value === 'string' && 
           /^[\d\s\-\+\(\)]+$/.test(value) && 
           value.length >= 10;
  },

  isUUID: (value: unknown): value is Types.UUID => {
    return typeof value === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  },

  isURL: (value: unknown): value is Types.URL => {
    if (typeof value !== 'string') return false;
    try {
      new globalThis.URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Temporal type guards
  isTimestamp: (value: unknown): value is Types.Timestamp => {
    return value instanceof Date && !isNaN(value.getTime());
  },

  isCreatedAt: (value: unknown): value is Types.CreatedAt => {
    return value instanceof Date && !isNaN(value.getTime());
  },

  isUpdatedAt: (value: unknown): value is Types.UpdatedAt => {
    return value instanceof Date && !isNaN(value.getTime());
  },

  // Version type guards
  isEventVersion: (value: unknown): value is Types.EventVersion => {
    return typeof value === 'number' && 
           Number.isInteger(value) && 
           value >= 1;
  },

  isAggregateVersion: (value: unknown): value is Types.AggregateVersion => {
    return typeof value === 'number' && 
           Number.isInteger(value) && 
           value >= 0;
  },

  // Numeric constraint type guards
  isPositiveNumber: (value: unknown): value is Types.PositiveNumber => {
    return typeof value === 'number' && value > 0;
  },

  isNonNegativeNumber: (value: unknown): value is Types.NonNegativeNumber => {
    return typeof value === 'number' && value >= 0;
  },

  isPercentage: (value: unknown): value is Types.Percentage => {
    return typeof value === 'number' && value >= 0 && value <= 100;
  },

  isMoney: (value: unknown): value is Types.Money => {
    return typeof value === 'number' && value >= 0;
  },
} as const;

/**
 * Composite type guard for nullable types
 */
export function isNullable<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): value is T | null {
  return value === null || guard(value);
}

/**
 * Composite type guard for optional types
 */
export function isOptional<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): value is T | undefined {
  return value === undefined || guard(value);
}

/**
 * Composite type guard for maybe types
 */
export function isMaybe<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): value is T | null | undefined {
  return value === null || value === undefined || guard(value);
}