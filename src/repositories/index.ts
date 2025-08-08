import { InMemoryEventStore } from '../infrastructure/event-store/memory';
import { UserRepository } from '../domain/aggregates/user';
import type { AllEvents, UserEvent } from '../domain/events/types';

// Create a shared event store instance with proper typing for all events
export const eventStore = new InMemoryEventStore<UserEvent>();

// User repository instance - we need to cast the event store to be compatible with UserEvent
export const userRepository = new UserRepository(eventStore);