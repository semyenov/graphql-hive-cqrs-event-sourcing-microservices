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
import { getEventMetadata, type UserEventMetadata } from './enhanced-types';
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
 * Audit log handler
 */
export class AuditLogHandler {
  private readonly auditLog: Array<{
    timestamp: string;
    eventType: string;
    aggregateId: string;
    userId?: string;
  }> = [];

  async handleEvent(event: UserEvent): Promise<void> {
    const metadata = getEventMetadata(event) as UserEventMetadata | undefined;
    
    this.auditLog.push({
      timestamp: event.timestamp.toString(),
      eventType: event.type,
      aggregateId: event.aggregateId as string,
      userId: metadata?.userId as string | undefined,
    });
    
    // In production, persist to audit log storage
    console.log(`[Audit] Event ${event.type} for aggregate ${event.aggregateId}`);
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

export function registerUserEventHandlersWithPattern(
  eventBus: EventBus<UserEvent>,
  projections: {
    userProjection: ProjectionBuilder<UserEvent, UserState>;
    userListProjection?: ProjectionBuilder<UserEvent, any>;
    userStatsProjection?: ProjectionBuilder<UserEvent, any>;
  }
): Array<() => void> {
  const projectionHandler = new ProjectionEventHandler(
    projections.userProjection,
    projections.userListProjection,
    projections.userStatsProjection
  );

  const emailHandler = new EmailNotificationHandler();
  const auditHandler = new AuditLogHandler();

  const unsubAll = eventBus.subscribeAll(async (event) => {
    await projectionHandler.handleEvent(event);
    await auditHandler.handleEvent(event);
  });

  const pattern = {
    [UserEventTypes.UserCreated]: async (event: Extract<UserEvent, { type: typeof UserEventTypes.UserCreated }>) => emailHandler.handleUserCreated(event),
    [UserEventTypes.UserEmailVerified]: async (event: Extract<UserEvent, { type: typeof UserEventTypes.UserEmailVerified }>) => emailHandler.handleEmailVerified(event),
    [UserEventTypes.UserPasswordChanged]: async (event: Extract<UserEvent, { type: typeof UserEventTypes.UserPasswordChanged }>) => emailHandler.handlePasswordChanged(event),
  } as const;

  const unsubPattern = subscribeEventPattern(eventBus as any, pattern as any);
  return [unsubAll, ...unsubPattern];
}