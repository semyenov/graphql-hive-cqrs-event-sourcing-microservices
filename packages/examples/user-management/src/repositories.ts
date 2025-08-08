// Repository instances for the user management example
import { InMemoryEventStore } from '@cqrs-framework/core';
import { UserRepository } from './domains/user/aggregates/UserAggregate';
import type { UserEvent } from './events/domain-events';

// Create event store instance for user events
export const eventStore = new InMemoryEventStore<UserEvent>();

// Create user repository instance
export const userRepository = new UserRepository(eventStore);

// Export for use in resolvers and services
export { UserRepository };