// Domain-specific events that extend the framework Event interface
import type { Event as FrameworkEvent, AggregateId, Brand } from '@cqrs-framework/core';

// Domain-specific branded types  
export type UserId = Brand<string, 'UserId'>;
import type { CreateUserInput, UpdateUserInput } from '../domains/user/models/User';

// Domain Event interface that properly extends framework
export interface DomainEvent<TType extends string = string, TData extends Record<string, unknown> = Record<string, unknown>> extends FrameworkEvent {
  readonly type: TType;
  readonly data: TData;
}

// Specific User Events
export interface UserCreatedEvent extends DomainEvent<'UserCreated', CreateUserInput> {}
export interface UserUpdatedEvent extends DomainEvent<'UserUpdated', Partial<UpdateUserInput>> {}
export interface UserDeletedEvent extends DomainEvent<'UserDeleted', Record<string, never>> {}

// Union type for all user events
export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

// Event type constants
export const EventTypes = {
  UserCreated: 'UserCreated' as const,
  UserUpdated: 'UserUpdated' as const,  
  UserDeleted: 'UserDeleted' as const,
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// Event factories
import { BrandedTypes } from '@cqrs-framework/core';
// Simple ID generation function
const generateId = () => `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const EventFactories = {
  createUserCreated: (
    aggregateId: string,
    data: CreateUserInput
  ): UserCreatedEvent => ({
    id: generateId(),
    aggregateId: BrandedTypes.aggregateId(aggregateId),
    type: EventTypes.UserCreated,
    version: BrandedTypes.eventVersion(1),
    timestamp: BrandedTypes.timestamp(),
    data,
  }),
  
  createUserUpdated: (
    aggregateId: string,
    version: number,
    data: Partial<UpdateUserInput>
  ): UserUpdatedEvent => ({
    id: generateId(),
    aggregateId: BrandedTypes.aggregateId(aggregateId),
    type: EventTypes.UserUpdated,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data,
  }),
  
  createUserDeleted: (
    aggregateId: string,
    version: number
  ): UserDeletedEvent => ({
    id: generateId(),
    aggregateId: BrandedTypes.aggregateId(aggregateId),
    type: EventTypes.UserDeleted,
    version: BrandedTypes.eventVersion(version),
    timestamp: BrandedTypes.timestamp(),
    data: {},
  }),
} as const;

// Type guards
export const isUserCreatedEvent = (event: FrameworkEvent): event is UserCreatedEvent => {
  return event.type === EventTypes.UserCreated;
};

export const isUserUpdatedEvent = (event: FrameworkEvent): event is UserUpdatedEvent => {
  return event.type === EventTypes.UserUpdated;
};

export const isUserDeletedEvent = (event: FrameworkEvent): event is UserDeletedEvent => {
  return event.type === EventTypes.UserDeleted;
};