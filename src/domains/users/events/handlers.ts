/**
 * User Domain: Event Handlers
 * 
 * Side effect handlers that react to domain events.
 */

import type { EventBus } from '../../../framework/infrastructure/bus';
import type { ProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import type { UserEvent } from './types';
import type { UserState } from '../aggregates/user';
import type { UserListItem } from '../projections/user-list.projection';
import type { UserStats } from '../projections/user-stats.projection';
import { UserEventTypes } from './types';
import { STATS_AGGREGATE_ID } from '../helpers/constants';
import { subscribeEventPattern } from '../../../framework/infrastructure/bus/event-bus';

/**
 * Update projections when events occur
 */
export class ProjectionEventHandler {
  constructor(
    private readonly userProjection: ProjectionBuilder<UserEvent, UserState>,
    private readonly userListProjection?: ProjectionBuilder<UserEvent, UserListItem>,
    private readonly userStatsProjection?: ProjectionBuilder<UserEvent, UserStats>
  ) {}

  /**
   * Handle any user event
   */
  async handleEvent(event: UserEvent): Promise<void> {
    // Update main user projection
    await this.userProjection.updateProjection(event.aggregateId, [event]);
    
    // Update list projection if available
    if (this.userListProjection) {
      await this.userListProjection.updateProjection(event.aggregateId, [event]);
    }
    
    // Update stats projection if available
    if (this.userStatsProjection) {
      // Stats uses a special 'stats' key for aggregation
      await this.userStatsProjection.updateProjection(STATS_AGGREGATE_ID, [{
        ...event,
        aggregateId: STATS_AGGREGATE_ID
      }]);
    }
  }
}

/**
 * Email notification handler
 */
export class EmailNotificationHandler {
  async handleUserCreated(event: Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }>): Promise<void> {
    // In production, send welcome email
    console.log(`[Email] Welcome email would be sent to ${event.data.email}`);
  }

  async handleEmailVerified(event: Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }>): Promise<void> {
    // In production, send confirmation email
    console.log(`[Email] Verification confirmation would be sent for user ${event.aggregateId}`);
  }

  async handlePasswordChanged(event: Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }>): Promise<void> {
    // In production, send security notification
    console.log(`[Email] Password change notification would be sent for user ${event.aggregateId}`);
  }
}

/**
 * Build user event handlers
 */
export const buildUserEventHandlers = (
  projections: {
    userProjection: ProjectionBuilder<UserEvent, UserState>;
    userListProjection?: ProjectionBuilder<UserEvent, UserListItem>;
    userStatsProjection?: ProjectionBuilder<UserEvent, UserStats>;
  }
) => {
  const projectionHandler = new ProjectionEventHandler(
    projections.userProjection,
    projections.userListProjection,
    projections.userStatsProjection,
  );

  const emailHandler = new EmailNotificationHandler();

  return {
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
    [UserEventTypes.UserUpdated]: (event: UserEvent) => projectionHandler.handleEvent(event),
    [UserEventTypes.UserDeleted]: (event: UserEvent) => projectionHandler.handleEvent(event),
    [UserEventTypes.UserProfileUpdated]: (event: UserEvent) => projectionHandler.handleEvent(event),
  } as const;
};

export function registerUserEventHandlers(
  eventBus: EventBus<UserEvent>,
  projections: {
    userProjection: ProjectionBuilder<UserEvent, UserState>;
    userListProjection?: ProjectionBuilder<UserEvent, any>;
    userStatsProjection?: ProjectionBuilder<UserEvent, any>;
  }
): Array<() => void> {
  return subscribeEventPattern(
    eventBus, 
    buildUserEventHandlers(projections)
  );
}