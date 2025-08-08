/**
 * Event factory functions for creating domain events
 */

import { BrandedTypes } from '../../core/branded';
import type { AggregateId } from '../../core/branded';
import { EventTypes } from './types';
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  IUserCreatedData,
  IUserUpdatedData,
  IUserDeletedData,
} from './user-events';

// ============================================================================
// Generic Event Factory
// ============================================================================

/**
 * Create a generic event
 */
export const createEvent = <TType extends string, TData>(
  type: TType,
  aggregateId: AggregateId,
  version: number,
  data: TData
) => ({
  aggregateId,
  type,
  version: BrandedTypes.eventVersion(version),
  timestamp: BrandedTypes.timestamp(),
  data,
});

// ============================================================================
// User Event Factories
// ============================================================================

/**
 * Factory for creating UserCreatedEvent
 */
export const createUserCreatedEvent = (
  aggregateId: AggregateId | string,
  data: IUserCreatedData
): UserCreatedEvent => {
  const id = typeof aggregateId === 'string' 
    ? BrandedTypes.aggregateId(aggregateId) 
    : aggregateId;
    
  return createEvent(EventTypes.UserCreated, id, 1, data);
};

/**
 * Factory for creating UserUpdatedEvent
 */
export const createUserUpdatedEvent = (
  aggregateId: AggregateId | string,
  version: number,
  data: IUserUpdatedData
): UserUpdatedEvent => {
  const id = typeof aggregateId === 'string'
    ? BrandedTypes.aggregateId(aggregateId)
    : aggregateId;
    
  return createEvent(EventTypes.UserUpdated, id, version, data);
};

/**
 * Factory for creating UserDeletedEvent
 */
export const createUserDeletedEvent = (
  aggregateId: AggregateId | string,
  version: number,
  data: IUserDeletedData = {}
): UserDeletedEvent => {
  const id = typeof aggregateId === 'string'
    ? BrandedTypes.aggregateId(aggregateId)
    : aggregateId;
    
  return createEvent(EventTypes.UserDeleted, id, version, data);
};

// ============================================================================
// Event Factory Registry
// ============================================================================

/**
 * Centralized event factory registry
 */
export const EventFactories = {
  // User events
  userCreated: createUserCreatedEvent,
  userUpdated: createUserUpdatedEvent,
  userDeleted: createUserDeletedEvent,
} as const;

// ============================================================================
// Event Builder Pattern
// ============================================================================

/**
 * Fluent event builder for complex event creation
 */
export class EventBuilder<TType extends string, TData> {
  private aggregateId?: AggregateId;
  private version?: number;
  private data?: TData;
  
  constructor(private readonly type: TType) {}
  
  withAggregateId(id: AggregateId | string): this {
    this.aggregateId = typeof id === 'string'
      ? BrandedTypes.aggregateId(id)
      : id;
    return this;
  }
  
  withVersion(version: number): this {
    this.version = version;
    return this;
  }
  
  withData(data: TData): this {
    this.data = data;
    return this;
  }
  
  build() {
    if (!this.aggregateId) {
      throw new Error('Aggregate ID is required');
    }
    if (this.version === undefined) {
      throw new Error('Version is required');
    }
    if (this.data === undefined) {
      throw new Error('Data is required');
    }
    
    return createEvent(this.type, this.aggregateId, this.version, this.data);
  }
}

/**
 * Create a new event builder
 */
export const eventBuilder = <TType extends string, TData>(type: TType) =>
  new EventBuilder<TType, TData>(type);