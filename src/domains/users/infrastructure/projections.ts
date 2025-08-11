/**
 * User Domain: Projections
 * 
 * Stream-based projections for building read models from events.
 * Uses Effect.Stream for real-time processing with back-pressure.
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Ref from 'effect/Ref';
import * as Option from 'effect/Option';
import * as HashMap from 'effect/HashMap';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Context from 'effect/Context';
import { pipe } from 'effect/Function';
import type { 
  UserDomainEvent, 
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  EmailVerifiedEvent,
  LoginSucceededEvent,
  ProfileUpdatedEvent,
  RoleChangedEvent
} from '../core/events';
import { UserEventType, UserEventGuards } from '../core/events';
import type { UserId, Email, Username, UserStatus, UserRole } from '../core/types';
import type { UserQueryResults } from '../application/queries';

/**
 * User projection state
 */
export interface UserProjectionState {
  readonly users: HashMap.HashMap<UserId, UserQueryResults.UserDTO>;
  readonly emailIndex: HashMap.HashMap<Email, UserId>;
  readonly usernameIndex: HashMap.HashMap<Username, UserId>;
  readonly stats: UserStatsProjection;
  readonly sessions: HashMap.HashMap<UserId, readonly UserQueryResults.UserSessionDTO[]>;
  readonly lastProcessedVersion: number;
}

/**
 * User stats projection
 */
export interface UserStatsProjection {
  readonly total: number;
  readonly byStatus: Record<UserStatus, number>;
  readonly byRole: Record<UserRole, number>;
  readonly verified: number;
  readonly withTwoFactor: number;
  readonly registrations: {
    readonly today: number;
    readonly thisWeek: number;
    readonly thisMonth: number;
  };
}

/**
 * Projection context for dependencies
 */
export interface ProjectionContext {
  readonly eventStore: EventStore;
  readonly snapshotStore: SnapshotStore;
}

export const ProjectionContextTag = Context.GenericTag<ProjectionContext>('ProjectionContext');

/**
 * Event store interface
 */
export interface EventStore {
  readonly subscribe: (fromVersion: number) => Stream.Stream<UserDomainEvent, Error, never>;
  readonly getEvents: (aggregateId: UserId, fromVersion?: number) => Effect.Effect<readonly UserDomainEvent[], never, never>;
}

/**
 * Snapshot store interface
 */
export interface SnapshotStore {
  readonly save: (projectionId: string, state: UserProjectionState) => Effect.Effect<void, never, never>;
  readonly load: (projectionId: string) => Effect.Effect<Option.Option<UserProjectionState>, never, never>;
}

/**
 * Main user projection processor
 */
export class UserProjectionProcessor {
  private constructor(
    private readonly stateRef: Ref.Ref<UserProjectionState>,
    private readonly projectionId: string
  ) {}

  /**
   * Create a new projection processor
   */
  static create(projectionId: string): Effect.Effect<UserProjectionProcessor, never, never> {
    const initialState: UserProjectionState = Data.struct({
      users: HashMap.empty(),
      emailIndex: HashMap.empty(),
      usernameIndex: HashMap.empty(),
      stats: createInitialStats(),
      sessions: HashMap.empty(),
      lastProcessedVersion: 0
    });
    
    return pipe(
      Ref.make(initialState),
      Effect.map((stateRef) => new UserProjectionProcessor(stateRef, projectionId))
    );
  }

  /**
   * Start processing events as a stream
   */
  startProcessing(): Effect.Effect<void, Error, ProjectionContext> {
    const stateRef = this.stateRef;
    const projectionId = this.projectionId;
    const processEvent = this.processEvent.bind(this);
    const saveSnapshotPeriodically = this.saveSnapshotPeriodically.bind(this);
    
    return ProjectionContextTag.pipe(
      Effect.flatMap((context) =>
        pipe(
          context.snapshotStore.load(projectionId),
          Effect.flatMap((snapshot) =>
            Option.isSome(snapshot)
              ? Ref.set(stateRef, snapshot.value)
              : Effect.succeed(undefined)
          ),
          Effect.flatMap(() => Ref.get(stateRef)),
          Effect.flatMap((currentState) => {
            const fromVersion = currentState.lastProcessedVersion + 1;
            return pipe(
              context.eventStore.subscribe(fromVersion),
              Stream.tap((event) => processEvent(event)),
              Stream.tap(() => saveSnapshotPeriodically()),
              Stream.runDrain
            );
          })
        )
      )
    );
  }

  /**
   * Process a single event
   */
  private processEvent(event: UserDomainEvent): Effect.Effect<void, never, never> {
    const stateRef = this.stateRef;
    return Ref.update(stateRef, (state) => {
        switch (event.type) {
          case UserEventType.USER_CREATED:
            return this.handleUserCreated(state, event as UserCreatedEvent);
            
          case UserEventType.USER_UPDATED:
            return this.handleUserUpdated(state, event as UserUpdatedEvent);
            
          case UserEventType.USER_DELETED:
            return this.handleUserDeleted(state, event as UserDeletedEvent);
            
          case UserEventType.EMAIL_VERIFIED:
            return this.handleEmailVerified(state, event as EmailVerifiedEvent);
            
          case UserEventType.LOGIN_SUCCEEDED:
            return this.handleLoginSucceeded(state, event as LoginSucceededEvent);
            
          case UserEventType.PROFILE_UPDATED:
            return this.handleProfileUpdated(state, event as ProfileUpdatedEvent);
            
          case UserEventType.ROLE_CHANGED:
            return this.handleRoleChanged(state, event as RoleChangedEvent);
            
          default:
            // Update version for unhandled events
            return Data.struct({
              ...state,
              lastProcessedVersion: event.version
            });
        }
      });
  }

  /**
   * Handle user created event
   */
  private handleUserCreated(
    state: UserProjectionState,
    event: UserCreatedEvent
  ): UserProjectionState {
    const userDTO: UserQueryResults.UserDTO = Data.struct({
      id: event.aggregateId,
      email: event.data.email,
      username: event.data.username,
      status: 'PENDING' as UserStatus,
      role: event.data.role,
      profile: {
        firstName: event.data.profile.firstName,
        lastName: event.data.profile.lastName,
        displayName: event.data.profile.displayName,
        bio: event.data.profile.bio,
        avatarUrl: event.data.profile.avatarUrl,
        location: event.data.profile.location,
        website: event.data.profile.website
      },
      emailVerified: false,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      twoFactorEnabled: event.data.preferences.twoFactorEnabled
    });
    
    const newUsers = HashMap.set(state.users, event.aggregateId, userDTO);
    const newEmailIndex = HashMap.set(state.emailIndex, event.data.email, event.aggregateId);
    const newUsernameIndex = HashMap.set(state.usernameIndex, event.data.username, event.aggregateId);
    
    const newStats = updateStatsForCreation(state.stats, userDTO);
    
    return Data.struct({
      ...state,
      users: newUsers,
      emailIndex: newEmailIndex,
      usernameIndex: newUsernameIndex,
      stats: newStats,
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle user updated event
   */
  private handleUserUpdated(
    state: UserProjectionState,
    event: UserUpdatedEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const updatedUser = Data.struct({
      ...existingUser.value,
      email: event.data.email || existingUser.value.email,
      username: event.data.username || existingUser.value.username,
      updatedAt: event.timestamp
    });
    
    let newEmailIndex = state.emailIndex;
    let newUsernameIndex = state.usernameIndex;
    
    // Update email index if email changed
    if (event.data.email && event.data.previousEmail) {
      newEmailIndex = pipe(
        newEmailIndex,
        HashMap.remove(event.data.previousEmail),
        HashMap.set(event.data.email, event.aggregateId)
      );
    }
    
    // Update username index if username changed
    if (event.data.username && event.data.previousUsername) {
      newUsernameIndex = pipe(
        newUsernameIndex,
        HashMap.remove(event.data.previousUsername),
        HashMap.set(event.data.username, event.aggregateId)
      );
    }
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      emailIndex: newEmailIndex,
      usernameIndex: newUsernameIndex,
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle user deleted event
   */
  private handleUserDeleted(
    state: UserProjectionState,
    event: UserDeletedEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const updatedUser = Data.struct({
      ...existingUser.value,
      status: 'DELETED' as UserStatus,
      updatedAt: event.timestamp
    });
    
    const newStats = updateStatsForStatusChange(
      state.stats,
      existingUser.value.status,
      'DELETED' as UserStatus
    );
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      stats: newStats,
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle email verified event
   */
  private handleEmailVerified(
    state: UserProjectionState,
    event: EmailVerifiedEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const wasActive = existingUser.value.status === 'ACTIVE';
    const updatedUser = Data.struct({
      ...existingUser.value,
      emailVerified: true,
      emailVerifiedAt: event.data.verifiedAt,
      status: existingUser.value.status === 'PENDING' ? 'ACTIVE' as UserStatus : existingUser.value.status,
      updatedAt: event.timestamp
    });
    
    let newStats = Data.struct({
      ...state.stats,
      verified: state.stats.verified + 1
    });
    
    // Update status counts if status changed
    if (!wasActive && updatedUser.status === 'ACTIVE') {
      newStats = updateStatsForStatusChange(
        newStats,
        existingUser.value.status,
        'ACTIVE' as UserStatus
      );
    }
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      stats: newStats,
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle login succeeded event
   */
  private handleLoginSucceeded(
    state: UserProjectionState,
    event: LoginSucceededEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const updatedUser = Data.struct({
      ...existingUser.value,
      lastLoginAt: event.timestamp,
      updatedAt: event.timestamp
    });
    
    // Update sessions
    const userSessions = Option.getOrElse(
      HashMap.get(state.sessions, event.aggregateId),
      () => [] as readonly UserQueryResults.UserSessionDTO[]
    );
    
    const newSession: UserQueryResults.UserSessionDTO = Data.struct({
      sessionId: event.data.sessionId,
      userId: event.aggregateId,
      createdAt: event.timestamp,
      lastActivityAt: event.timestamp,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      ipAddress: event.data.ipAddress,
      userAgent: event.data.userAgent,
      isActive: true
    });
    
    const updatedSessions = [...userSessions, newSession];
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      sessions: HashMap.set(state.sessions, event.aggregateId, updatedSessions),
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle profile updated event
   */
  private handleProfileUpdated(
    state: UserProjectionState,
    event: ProfileUpdatedEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const updatedUser = Data.struct({
      ...existingUser.value,
      profile: {
        ...existingUser.value.profile,
        ...event.data.updates
      },
      updatedAt: event.timestamp
    });
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      lastProcessedVersion: event.version
    });
  }

  /**
   * Handle role changed event
   */
  private handleRoleChanged(
    state: UserProjectionState,
    event: RoleChangedEvent
  ): UserProjectionState {
    const existingUser = HashMap.get(state.users, event.aggregateId);
    if (Option.isNone(existingUser)) return state;
    
    const updatedUser = Data.struct({
      ...existingUser.value,
      role: event.data.newRole,
      updatedAt: event.timestamp
    });
    
    const newStats = updateStatsForRoleChange(
      state.stats,
      event.data.previousRole,
      event.data.newRole
    );
    
    return Data.struct({
      ...state,
      users: HashMap.set(state.users, event.aggregateId, updatedUser),
      stats: newStats,
      lastProcessedVersion: event.version
    });
  }

  /**
   * Save snapshot periodically
   */
  private saveSnapshotPeriodically(): Effect.Effect<void, never, ProjectionContext> {
    const stateRef = this.stateRef;
    const projectionId = this.projectionId;
    
    return pipe(
      ProjectionContextTag,
      Effect.flatMap((context) =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            state.lastProcessedVersion % 100 === 0
              ? context.snapshotStore.save(projectionId, state)
              : Effect.succeed(undefined)
          )
        )
      )
    );
  }

  /**
   * Get current state
   */
  getState(): Effect.Effect<UserProjectionState, never, never> {
    return Ref.get(this.stateRef);
  }
}

/**
 * Helper functions for stats updates
 */
function createInitialStats(): UserStatsProjection {
  return Data.struct({
    total: 0,
    byStatus: {
      PENDING: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
      DEACTIVATED: 0,
      DELETED: 0
    } as Record<UserStatus, number>,
    byRole: {
      USER: 0,
      MODERATOR: 0,
      ADMIN: 0,
      SUPER_ADMIN: 0
    } as Record<UserRole, number>,
    verified: 0,
    withTwoFactor: 0,
    registrations: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0
    }
  });
}

function updateStatsForCreation(
  stats: UserStatsProjection,
  user: UserQueryResults.UserDTO
): UserStatsProjection {
  return Data.struct({
    ...stats,
    total: stats.total + 1,
    byStatus: {
      ...stats.byStatus,
      [user.status]: (stats.byStatus[user.status] || 0) + 1
    },
    byRole: {
      ...stats.byRole,
      [user.role]: (stats.byRole[user.role] || 0) + 1
    },
    withTwoFactor: user.twoFactorEnabled ? stats.withTwoFactor + 1 : stats.withTwoFactor,
    registrations: {
      today: stats.registrations.today + 1,
      thisWeek: stats.registrations.thisWeek + 1,
      thisMonth: stats.registrations.thisMonth + 1
    }
  });
}

function updateStatsForStatusChange(
  stats: UserStatsProjection,
  oldStatus: UserStatus,
  newStatus: UserStatus
): UserStatsProjection {
  return Data.struct({
    ...stats,
    byStatus: {
      ...stats.byStatus,
      [oldStatus]: Math.max(0, (stats.byStatus[oldStatus] || 0) - 1),
      [newStatus]: (stats.byStatus[newStatus] || 0) + 1
    }
  });
}

function updateStatsForRoleChange(
  stats: UserStatsProjection,
  oldRole: UserRole,
  newRole: UserRole
): UserStatsProjection {
  return Data.struct({
    ...stats,
    byRole: {
      ...stats.byRole,
      [oldRole]: Math.max(0, (stats.byRole[oldRole] || 0) - 1),
      [newRole]: (stats.byRole[newRole] || 0) + 1
    }
  });
}