import { 
  Aggregate, 
  type AggregateRepository,
  type AggregateId,
  BrandedTypes
} from '@cqrs-framework/core';
import type { EventReducer } from '@cqrs-framework/core';
import { matchEvent } from '@cqrs-framework/core';
import type { IEventStore } from '@cqrs-framework/core';
import {
  EventFactories,
  EventTypes,
  isUserCreatedEvent,
  isUserUpdatedEvent,
  isUserDeletedEvent,
} from '../../../events/domain-events';
import type {
  UserEvent,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
} from '../../../events/domain-events';
import type { CreateUserInput, UpdateUserInput, User } from '../models/User';

// User aggregate state with proper typing
export interface UserAggregateState {
  id: AggregateId;
  name: string;
  email: string;
  deleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// User event reducer with pattern matching
const userReducer: EventReducer<UserAggregateState, UserEvent> = (state, event)   => {
  return matchEvent(event, {
    [EventTypes.UserCreated]: (e: UserCreatedEvent) => ({
      id: BrandedTypes.aggregateId(e.aggregateId),
      ...e.data,
      deleted: false,
      version: e.version,
      createdAt: e.timestamp.toISOString(),
      updatedAt: e.timestamp.toISOString(),
    }),
    
    [EventTypes.UserUpdated]: (e: UserUpdatedEvent) => {
      if (!state) throw new Error('Cannot update non-existent user');
      return {
        ...state,
        ...(e.data.name !== undefined && e.data.name !== null && { name: e.data.name }),
        ...(e.data.email !== undefined && e.data.email !== null && { email: e.data.email }),
        version: e.version,
        updatedAt: e.timestamp.toISOString(),
      };
    },
    
    [EventTypes.UserDeleted]: (e: UserDeletedEvent) => {
      if (!state) throw new Error('Cannot delete non-existent user');
      return {
        ...state,
        deleted: true,
        version: e.version,
        updatedAt: e.timestamp.toISOString(),
      };
    },
  });
};

// Initial state factory
const createInitialState = (id: AggregateId): UserAggregateState => ({
  id,
  name: '',
  email: '',
  deleted: false,
  version: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// User aggregate extending generic base
export class UserAggregate extends Aggregate<UserAggregateState, UserEvent> {
  constructor(id: string | AggregateId) {
    const aggregateId = typeof id === 'string' ? BrandedTypes.aggregateId(id) : id;
    super(aggregateId, userReducer, createInitialState(aggregateId));
  }

  // Command: Create user
  create(input: CreateUserInput): void {
    if (this.state && !this.state.deleted) {
      throw new Error('User already exists');
    }

    const event = EventFactories.createUserCreated(this.id, input);
    this.applyEvent(event, true);
  }

  // Command: Update user with type-safe input
  update(input: UpdateUserInput): void {
    if (!this.state || this.state.deleted) {
      throw new Error('User not found or deleted');
    }

    // Filter out undefined values for partial update
    const updates = Object.entries(input)
      .filter(([_, value]) => value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    const event = EventFactories.createUserUpdated(
      this.id,
      this.state.version + 1,
      updates
    );
    this.applyEvent(event, true);
  }

  // Command: Delete user
  delete(): void {
    if (!this.state || this.state.deleted) {
      throw new Error('User not found or already deleted');
    }

    const event = EventFactories.createUserDeleted(
      this.id,
      this.state.version + 1
    );
    this.applyEvent(event, true);
  }

  // Required handleEvent method for framework compatibility
  protected handleEvent(event: UserEvent): void {
    // Apply the event to state using the reducer
    this.state = userReducer(this.state, event);
    this.version = typeof event.version === 'number' ? event.version : (event.version as unknown as number);
  }

  // Query methods with type safety
  isDeleted(): boolean {
    return this.state?.deleted ?? false;
  }

  getUser(): User | null {
    if (!this.state || this.state.deleted) {
      return null;
    }

    const { deleted, version, ...user } = this.state;
    // Return domain model without GraphQL __typename
    return user as User;
  }

  getUserWithTimestamps(): User | null {
    if (!this.state || this.state.deleted) {
      return null;
    }

    const { deleted, version, ...user } = this.state;
    // Return domain model without GraphQL __typename
    return user as User;
  }

  // Static factory method with type inference
  static async fromEventsStatic(
    id: string | AggregateId,
    events: UserEvent[]
  ): Promise<UserAggregate> {
    const aggregate = new UserAggregate(id);
    events.forEach(event => aggregate.applyEvent(event, false));
    return aggregate;
  }

  // Validation methods
  canUpdate(): boolean {
    return this.state !== null && !this.state.deleted;
  }

  canDelete(): boolean {
    return this.state !== null && !this.state.deleted;
  }

  // Get projection-ready data
  toProjection(): User | null {
    return this.getUserWithTimestamps();
  }
}

// Type-safe user repository
export class UserRepository {
  private aggregates = new Map<string, UserAggregate>();

  constructor(
    protected eventStore: Pick<IEventStore<UserEvent>, 'append' | 'appendBatch' | 'getEvents'>
  ) {
    // Simple constructor without inheritance
  }

  async get(id: AggregateId): Promise<UserAggregate | null> {
    // Check cache first
    const key = id; // AggregateId is a string type
    if (this.aggregates.has(key)) {
      return this.aggregates.get(key)!;
    }

    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      return null;
    }

    const aggregate = await UserAggregate.fromEventsStatic(id, events);
    this.aggregates.set(key, aggregate);
    return aggregate;
  }

  async save(aggregate: UserAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventStore.appendBatch(events as UserEvent[]);
      aggregate.markEventsAsCommitted();
      this.aggregates.set(aggregate.getId(), aggregate);
    }
  }

  async exists(id: AggregateId): Promise<boolean> {
    const key = id; // AggregateId is a string type
    if (this.aggregates.has(key)) {
      return true;
    }
    const events = await this.eventStore.getEvents(id);
    return events.length > 0;
  }

  // Clear cache
  clearCache(): void {
    this.aggregates.clear();
  }

  // Required by AggregateRepository
  createAggregate(id: AggregateId): UserAggregate {
    return new UserAggregate(id);
  }
}