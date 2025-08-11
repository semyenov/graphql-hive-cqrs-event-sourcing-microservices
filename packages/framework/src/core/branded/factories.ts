/**
 * Shared: Branded Type Factories
 *
 * Factory functions for creating and validating branded types.
 * These ensure runtime validation matches compile-time constraints.
 */

import type * as Types from './types';

/**
 * Branded type factory functions with validation
 */
export const BrandedTypes = {
  // ID factories
  aggregateId: (id: string): Types.AggregateId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid aggregate ID');
    }
    return id as Types.AggregateId;
  },

  aggregateType: (type: string): Types.AggregateType => {
    if (!type || typeof type !== 'string') {
      throw new Error('Invalid aggregate type');
    }
    return type as Types.AggregateType;
  },

  eventId: (id: string): Types.EventId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid event ID');
    }
    return id as Types.EventId;
  },

  commandId: (id: string): Types.CommandId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid command ID');
    }
    return id as Types.CommandId;
  },

  correlationId: (id: string): Types.CorrelationId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid correlation ID');
    }
    return id as Types.CorrelationId;
  },

  causationId: (id: string): Types.CausationId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid causation ID');
    }
    return id as Types.CausationId;
  },

  // Value object factories
  uuid: (uuid: string): Types.UUID => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new Error('Invalid UUID format');
    }
    return uuid.toLowerCase() as Types.UUID;
  },

  url: (url: string): Types.URL => {
    try {
      return url as Types.URL;
    } catch {
      throw new Error('Invalid URL format');
    }
  },

  // Temporal factories
  timestamp: (date: Date = new Date()): Types.Timestamp => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    return date as Types.Timestamp;
  },

  createdAt: (date: Date = new Date()): Types.CreatedAt => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid created date');
    }
    return date as Types.CreatedAt;
  },

  updatedAt: (date: Date = new Date()): Types.UpdatedAt => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid updated date');
    }
    return date as Types.UpdatedAt;
  },

  // Version factories
  eventVersion: (version: number): Types.EventVersion => {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('Event version must be a positive integer');
    }
    return version as Types.EventVersion;
  },

  aggregateVersion: (version: number): Types.AggregateVersion => {
    if (!Number.isInteger(version) || version < 0) {
      throw new Error('Aggregate version must be a non-negative integer');
    }
    return version as Types.AggregateVersion;
  },

  // Numeric constraint factories
  positiveNumber: (num: number): Types.PositiveNumber => {
    if (typeof num !== 'number' || num <= 0) {
      throw new Error('Must be a positive number');
    }
    return num as Types.PositiveNumber;
  },

  nonNegativeNumber: (num: number): Types.NonNegativeNumber => {
    if (typeof num !== 'number' || num < 0) {
      throw new Error('Must be a non-negative number');
    }
    return num as Types.NonNegativeNumber;
  },

  percentage: (num: number): Types.Percentage => {
    if (typeof num !== 'number' || num < 0 || num > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return num as Types.Percentage;
  },

  money: (amount: number): Types.Money => {
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('Money amount must be non-negative');
    }
    // Round to 2 decimal places
    return Math.round(amount * 100) / 100 as Types.Money;
  },
} as const;
