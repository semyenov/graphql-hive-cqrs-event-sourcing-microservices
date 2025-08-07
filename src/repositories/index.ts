import { InMemoryEventStore } from '../events/InMemoryEventStore';
import { UserRepository } from '../events/UserAggregate';
import type { AllEvents } from '../events/generic-types';

// Create a shared event store instance with proper typing for all events
export const eventStore = new InMemoryEventStore<AllEvents>();

// User repository instance - we need to cast the event store to be compatible with UserEvent
export const userRepository = new UserRepository(eventStore as any);