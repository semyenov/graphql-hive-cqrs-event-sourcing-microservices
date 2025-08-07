// Re-export everything from generic-types for backward compatibility
export * from './generic-types';

// Additional helpers for backward compatibility
import {
  EventFactories,
  type Event,
  type EventMetadata,
  type EnhancedEvent,
} from './generic-types';

// Legacy event factory functions (deprecated - use EventFactories instead)
export const createUserCreatedEvent = EventFactories.createUserCreated;
export const createUserUpdatedEvent = EventFactories.createUserUpdated;
export const createUserDeletedEvent = EventFactories.createUserDeleted;

import { BrandedTypes } from '../types';

// Legacy enhanced event creator
export const createEnhancedEvent = <TEvent extends Event>(
  event: TEvent,
  metadata: Partial<EventMetadata> = {}
): EnhancedEvent<TEvent> => ({
  event,
  metadata: {
    timestamp: BrandedTypes.timestamp(),
    ...metadata,
  },
});