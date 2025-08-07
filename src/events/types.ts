// Re-export from generic types for backward compatibility
export type {
  Event,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  UserEvent,
  EventMetadata,
  EnhancedEvent,
} from './generic-types';

// Re-export IEventStore as EventStore for backward compatibility
export type { IEventStore as EventStore } from './interfaces';