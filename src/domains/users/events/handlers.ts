/**
 * User Domain: Event Handlers
 * 
 * Event handlers for user domain events.
 */

import type { IEventBus } from '../../../framework/core/event';
import type { ProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserEvent } from './types';
import type { UserState } from '../aggregates/user';
import type { UserListItem } from '../projections/user-list.projection';
import type { UserStats } from '../projections/user-stats.projection';
import { UserEventTypes } from './types';

/**
 * Projection event handler
 */
export class ProjectionEventHandler {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>,
    private readonly userListProjection?: ProjectionBuilder<UserEvent, UserListItem>,
    private readonly userStatsProjection?: ProjectionBuilder<UserEvent, UserStats>
  ) {}

  /**
   * Handle user events for projections
   */
  async handleEvent(event: UserEvent): Promise<void> {
    // Update user projection
    await this.userProjection.updateProjection(event.aggregateId, [event]);
    
    // Update user list projection if available
    if (this.userListProjection) {
      await this.userListProjection.updateProjection(event.aggregateId, [event]);
    }
    
    // Update user stats projection if available
    if (this.userStatsProjection) {
      // For stats, we need to process all events for the 'global' aggregate
      await this.userStatsProjection.updateProjection('global' as any, [event]);
    }
  }
}

/**
 * Simple notification and audit handler
 */
export class NotificationHandler {
  private readonly auditLog: Array<{ timestamp: string; eventType: string; aggregateId: string }> = [];

  async handleEvent(event: UserEvent): Promise<void> {
    // Log event for audit
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      eventType: event.type,
      aggregateId: event.aggregateId as string,
    });

    // Handle notifications based on event type
    switch (event.type) {
      case UserEventTypes.UserCreated:
        console.log(`[Notification] Welcome email sent to ${(event as any).data.email}`);
        break;
      case UserEventTypes.UserEmailVerified:
        console.log(`[Notification] Email verification confirmed for user ${event.aggregateId}`);
        break;
      case UserEventTypes.UserPasswordChanged:
        console.log(`[Notification] Password change notification sent for user ${event.aggregateId}`);
        break;
    }
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

/**
 * Register all user event handlers
 */
export function registerUserEventHandlers(
  eventBus: IEventBus<UserEvent>,
  projections: {
    userProjection: ProjectionBuilder<UserEvent, UserState>;
    userListProjection?: ProjectionBuilder<UserEvent, any>;
    userStatsProjection?: ProjectionBuilder<UserEvent, any>;
  }
): void {
  const projectionHandler = new ProjectionEventHandler(
    projections.userProjection,
    projections.userListProjection,
    projections.userStatsProjection
  );
  
  const notificationHandler = new NotificationHandler();

  // Subscribe to all user events for both projections and notifications
  eventBus.subscribeAll(async (event) => {
    await projectionHandler.handleEvent(event);
    await notificationHandler.handleEvent(event);
  });
}