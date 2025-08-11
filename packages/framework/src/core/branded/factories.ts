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
  aggregateId: <T extends Types.AggregateId<string>>(id: string): T => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid aggregate ID');
    }
    return id as T;
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

  // Version factories
  eventVersion: (version: number): Types.EventVersion => {
    if (typeof version !== 'number' || version < 0) {
      throw new Error('Invalid event version');
    }
    return version as Types.EventVersion;
  },

  aggregateVersion: (version: number): Types.AggregateVersion => {
    if (typeof version !== 'number' || version < 0) {
      throw new Error('Invalid aggregate version');
    }
    return version as Types.AggregateVersion;
  },

  // Temporal factories
  timestamp: (date: Date = new Date()): Types.Timestamp => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    return date.toISOString() as Types.Timestamp;
  }
};

// Export individual functions for convenience
export const aggregateId = BrandedTypes.aggregateId;
export const eventId = BrandedTypes.eventId;
export const commandId = BrandedTypes.commandId;
export const correlationId = BrandedTypes.correlationId;
export const causationId = BrandedTypes.causationId;
export const eventVersion = BrandedTypes.eventVersion;
export const aggregateVersion = BrandedTypes.aggregateVersion;
export const timestamp = BrandedTypes.timestamp;