/**
 * Infrastructure Layer: Event Handlers
 * 
 * Side effect handlers that react to domain events.
 * Manages projection updates and external system notifications.
 */

import type { EventBus } from '../../../../framework/infrastructure/bus';
import type { ProjectionBuilder } from '../../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';
import type { UserState } from '../../domain/user.types';
import type { UserListItem } from '../projections/user-list.projection';
import type { UserStats } from '../projections/user-stats.projection';
import { UserEventTypes } from '../../domain/user.events';
import { subscribeEventPattern } from '../../../../framework/infrastructure/bus/event-bus';

/**
 * Projection update handler - manages read model consistency
 */
export class ProjectionEventHandler {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>,
    private readonly userListProjection?: ProjectionBuilder<UserEvent, UserListItem>,
    private readonly userStatsProjection?: ProjectionBuilder<UserEvent, UserStats>
  ) {}

  /**
   * Handle any user event and update relevant projections
   */
  async handleEvent(event: UserEvent): Promise<void> {
    const aggregateId = event.aggregateId;

    // Update main user projection
    await this.userProjection.updateProjection(aggregateId, [event]);

    // Update list projection if available
    if (this.userListProjection) {
      await this.userListProjection.updateProjection(aggregateId, [event]);
    }

    // Update stats projection if available
    if (this.userStatsProjection) {
      // Stats projection uses special aggregate ID
      await this.userStatsProjection.updateProjection('stats' as any, [event]);
    }
  }
}

/**
 * Email notification handler - sends emails for user events
 */
export class EmailNotificationHandler {
  /**
   * Handle user created event - send welcome email
   */
  async handleUserCreated(event: Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }>): Promise<void> {
    console.log(`📧 Sending welcome email to ${event.data.email}`);
    // In a real application, you would integrate with an email service
    // For now, we just log the action
  }

  /**
   * Handle email verified event - send confirmation
   */
  async handleEmailVerified(event: Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }>): Promise<void> {
    console.log(`✅ Email verified for user ${event.aggregateId}`);
    // Send email verification confirmation
  }

  /**
   * Handle password changed event - send security notification
   */
  async handlePasswordChanged(event: Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }>): Promise<void> {
    console.log(`🔐 Password changed for user ${event.aggregateId}`);
    // Send password change notification
  }
}

/**
 * Register all user event handlers with the event bus
 */
export function registerUserEventHandlers(
  eventBus: EventBus<UserEvent>,
  projectionHandler: ProjectionEventHandler,
  emailHandler: EmailNotificationHandler
): void {
  
  subscribeEventPattern<UserEvent>(eventBus, {
    [UserEventTypes.UserCreated]: async (event: UserEvent) => {
      await projectionHandler.handleEvent(event);
      if (event.type === UserEventTypes.UserCreated) {
        await emailHandler.handleUserCreated(event);
      }
    },
    
    [UserEventTypes.UserEmailVerified]: async (event: UserEvent) => {
      await projectionHandler.handleEvent(event);
      if (event.type === UserEventTypes.UserEmailVerified) {
        await emailHandler.handleEmailVerified(event);
      }
    },
    
    [UserEventTypes.UserPasswordChanged]: async (event: UserEvent) => {
      await projectionHandler.handleEvent(event);
      if (event.type === UserEventTypes.UserPasswordChanged) {
        await emailHandler.handlePasswordChanged(event);
      }
    },
    
    [UserEventTypes.UserUpdated]: (event: UserEvent) => 
      projectionHandler.handleEvent(event),
    
    [UserEventTypes.UserDeleted]: (event: UserEvent) => 
      projectionHandler.handleEvent(event),
    
    [UserEventTypes.UserProfileUpdated]: (event: UserEvent) => 
      projectionHandler.handleEvent(event),
  });
} 