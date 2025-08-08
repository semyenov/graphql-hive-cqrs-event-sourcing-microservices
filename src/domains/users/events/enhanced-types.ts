/**
 * User Domain: Enhanced Event Types
 * 
 * Event types with metadata for distributed systems.
 */

import type { IEnhancedEvent, IEventMetadata } from '../../../framework/core/event';
import type { UserEvent } from './types';

/**
 * User event with metadata
 */
export type EnhancedUserEvent = IEnhancedEvent<UserEvent, IEventMetadata>;

/**
 * Type guard for enhanced events
 */
export function isEnhancedUserEvent(event: unknown): event is EnhancedUserEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'event' in event &&
    'metadata' in event
  );
}

/**
 * Extract metadata from event if available
 */
export function getEventMetadata(event: UserEvent | EnhancedUserEvent): IEventMetadata | undefined {
  if (isEnhancedUserEvent(event)) {
    return event.metadata;
  }
  return undefined;
}