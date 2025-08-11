/**
 * User Domain: Event Definitions
 * 
 * Event types and factories for the user domain.
 * All events are immutable and use Data.struct for structural equality.
 */

import * as Data from 'effect/Data';
import * as Types from 'effect/Types';
import { BrandedTypes } from '@cqrs/framework';
import type { Timestamp, EventVersion, IEvent, CorrelationId, AggregateVersion } from '@cqrs/framework';
import type { 
  UserId, 
  Email, 
  Username, 
  HashedPassword,
  VerificationToken,
  ResetToken,
  SessionId,
  UserStatus,
  UserRole,
  UserProfile,
  UserPreferences,
  UserMetadata,
  IPAddress
} from './types';

/**
 * User event types enumeration
 */
export enum UserEventType {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_RESTORED = 'USER_RESTORED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  EMAIL_VERIFICATION_REQUESTED = 'EMAIL_VERIFICATION_REQUESTED',
  
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  PREFERENCES_UPDATED = 'PREFERENCES_UPDATED',
  
  LOGIN_ATTEMPTED = 'LOGIN_ATTEMPTED',
  LOGIN_SUCCEEDED = 'LOGIN_SUCCEEDED',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT_COMPLETED = 'LOGOUT_COMPLETED',
  
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_VERIFIED = 'TWO_FACTOR_VERIFIED',
  
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  ALL_SESSIONS_REVOKED = 'ALL_SESSIONS_REVOKED',
  
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSIONS_UPDATED = 'PERMISSIONS_UPDATED'
}

/**
 * Base user event interface
 */
export interface UserEvent extends IEvent {
  readonly type: UserEventType;
  readonly aggregateId: UserId;
  readonly version: AggregateVersion;
  readonly timestamp: Timestamp;
  readonly metadata?: {
    readonly causedBy?: UserId;
    readonly reason?: string;
    readonly ipAddress?: IPAddress;
    readonly userAgent?: string;
    readonly correlationId?: CorrelationId;
  };
}

/**
 * User created event
 */
export interface UserCreatedEvent extends UserEvent {
  readonly type: UserEventType.USER_CREATED;
  readonly data: {
    readonly email: Email;
    readonly username: Username;
    readonly passwordHash: HashedPassword;
    readonly role: UserRole;
    readonly profile: UserProfile;
    readonly preferences: UserPreferences;
    readonly metadata: UserMetadata;
  };
}

/**
 * User updated event
 */
export interface UserUpdatedEvent extends UserEvent {
  readonly type: UserEventType.USER_UPDATED;
  readonly data: {
    readonly email?: Email;
    readonly username?: Username;
    readonly previousEmail?: Email;
    readonly previousUsername?: Username;
  };
}

/**
 * User deleted event
 */
export interface UserDeletedEvent extends UserEvent {
  readonly type: UserEventType.USER_DELETED;
  readonly data: {
      readonly deletedBy?: UserId;
      readonly reason?: string;
      readonly scheduledPurgeDate?: Timestamp;
    };
}

/**
 * User suspended event
 */
export interface UserSuspendedEvent extends UserEvent {
  readonly type: UserEventType.USER_SUSPENDED;
  readonly data: {
    readonly suspendedBy: UserId;
    readonly reason: string;
    readonly suspendedUntil?: Timestamp;
  }; 
}

/**
 * Email verified event
 */
export interface EmailVerifiedEvent extends UserEvent {
  readonly type: UserEventType.EMAIL_VERIFIED;
  readonly data: {
    readonly email: Email;
    readonly verificationToken: VerificationToken;
    readonly verifiedAt: Timestamp;
  }; 
}

/**
 * Password changed event
 */
export interface PasswordChangedEvent extends UserEvent {
  readonly type: UserEventType.PASSWORD_CHANGED;
  readonly data: {
    readonly newPasswordHash: HashedPassword;
    readonly changedBy: 'USER' | 'ADMIN' | 'SYSTEM';
    readonly requiresVerification?: boolean;
  }; 
}

/**
 * Profile updated event
 */
export interface ProfileUpdatedEvent extends UserEvent {
  readonly type: UserEventType.PROFILE_UPDATED;
  readonly data: {
    readonly updates: Partial<UserProfile>;
    readonly previousProfile: UserProfile;
  }; 
}

/**
 * Login succeeded event
 */
export interface LoginSucceededEvent extends UserEvent {
  readonly type: UserEventType.LOGIN_SUCCEEDED;
  readonly data: {
    readonly sessionId: SessionId;
    readonly ipAddress: IPAddress;
    readonly userAgent?: string;
    readonly twoFactorUsed: boolean;
  };
}

/**
 * Login failed event
 */
export interface LoginFailedEvent extends UserEvent {
  readonly type: UserEventType.LOGIN_FAILED;
  readonly data: {
    readonly reason: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'TWO_FACTOR_FAILED';
    readonly attemptNumber: number;
    readonly ipAddress: IPAddress;
  }; 
}

/**
 * Two-factor enabled event
 */
export interface TwoFactorEnabledEvent extends UserEvent {
  readonly type: UserEventType.TWO_FACTOR_ENABLED;
  readonly data: {
    readonly method: 'TOTP' | 'SMS' | 'EMAIL';
    readonly backupCodesGenerated: number;
  }; 
}

/**
 * Role changed event
 */
export interface RoleChangedEvent extends UserEvent {
  readonly type: UserEventType.ROLE_CHANGED;
  readonly data: {
    readonly previousRole: UserRole;
    readonly newRole: UserRole;
    readonly changedBy: UserId;
  };
}

/**
 * Union type of all user events
 */
export type UserDomainEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserSuspendedEvent
  | EmailVerifiedEvent
  | PasswordChangedEvent
  | ProfileUpdatedEvent
  | LoginSucceededEvent
  | LoginFailedEvent
  | TwoFactorEnabledEvent
  | RoleChangedEvent
  | UserEvent;

/**
 * Event factory functions
 */
export const UserEventFactories = {
  userCreated: (params: {
    userId: UserId;
    email: Email;
    username: Username;
    passwordHash: HashedPassword;
    role: UserRole;
    profile: UserProfile;
    preferences: UserPreferences;
    metadata: UserMetadata;
    version?: AggregateVersion;
  }): UserCreatedEvent => Data.struct({
    type: UserEventType.USER_CREATED,
    aggregateId: params.userId,
    version: params.version || 1 as AggregateVersion,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      email: params.email,
      username: params.username,
      passwordHash: params.passwordHash,
      role: params.role,
      profile: params.profile,
      preferences: params.preferences,
      metadata: params.metadata
    })
  }),

  userUpdated: (params: {
    userId: UserId;
    version: AggregateVersion;
    email?: Email;
    username?: Username;
    previousEmail?: Email;
    previousUsername?: Username;
    causedBy?: UserId;
  }): UserUpdatedEvent => Data.struct({
    type: UserEventType.USER_UPDATED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      email: params.email,
      username: params.username,
      previousEmail: params.previousEmail,
      previousUsername: params.previousUsername
      }),
    metadata: params.causedBy ? { causedBy: params.causedBy } : undefined
  }),

  userDeleted: (params: {
    userId: UserId;
    version: AggregateVersion;
    deletedBy?: UserId;
    reason?: string;
    scheduledPurgeDate?: Timestamp;
  }): UserDeletedEvent => Data.struct({
    type: UserEventType.USER_DELETED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      deletedBy: params.deletedBy,
      reason: params.reason,
      scheduledPurgeDate: params.scheduledPurgeDate
    })
  }),

  userSuspended: (params: {
    userId: UserId;
    version: AggregateVersion;
    suspendedBy: UserId;
    reason: string;
    suspendedUntil?: Timestamp;
  }): UserSuspendedEvent => Data.struct({
    type: UserEventType.USER_SUSPENDED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      suspendedBy: params.suspendedBy,
      reason: params.reason,
      suspendedUntil: params.suspendedUntil
    })
  }),

  emailVerified: (params: {
    userId: UserId;
    version: AggregateVersion;
    email: Email;
    verificationToken: VerificationToken;
  }): EmailVerifiedEvent => Data.struct({
    type: UserEventType.EMAIL_VERIFIED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      email: params.email,
      verificationToken: params.verificationToken,
      verifiedAt: new Date().toISOString() as Timestamp
    })
  }),

  passwordChanged: (params: {
    userId: UserId;
    version: AggregateVersion;
    newPasswordHash: HashedPassword;
    changedBy: 'USER' | 'ADMIN' | 'SYSTEM';
    requiresVerification?: boolean;
  }): PasswordChangedEvent => Data.struct({
    type: UserEventType.PASSWORD_CHANGED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      newPasswordHash: params.newPasswordHash,
      changedBy: params.changedBy,
      requiresVerification: params.requiresVerification
    })
  }),

  profileUpdated: (params: {
    userId: UserId;
    version: AggregateVersion;
    updates: Partial<UserProfile>;
    previousProfile: UserProfile;
  }): ProfileUpdatedEvent => Data.struct({
    type: UserEventType.PROFILE_UPDATED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      updates: params.updates,
      previousProfile: params.previousProfile
    })
  }),

  loginSucceeded: (params: {
    userId: UserId;
    version: AggregateVersion;
    sessionId: SessionId;
    ipAddress: IPAddress;
    userAgent?: string;
    twoFactorUsed?: boolean;
  }): LoginSucceededEvent => Data.struct({
    type: UserEventType.LOGIN_SUCCEEDED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      twoFactorUsed: params.twoFactorUsed || false
    })
  }),

  loginFailed: (params: {
    userId: UserId;
    version: AggregateVersion;
    reason: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'TWO_FACTOR_FAILED';
    attemptNumber: number;
    ipAddress: IPAddress;
  }): LoginFailedEvent => Data.struct({
    type: UserEventType.LOGIN_FAILED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      reason: params.reason,
      attemptNumber: params.attemptNumber,
      ipAddress: params.ipAddress
    })
  }),

  twoFactorEnabled: (params: {
    userId: UserId;
    version: AggregateVersion;
    method: 'TOTP' | 'SMS' | 'EMAIL';
    backupCodesGenerated: number;
  }): TwoFactorEnabledEvent => Data.struct({
    type: UserEventType.TWO_FACTOR_ENABLED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      method: params.method,
      backupCodesGenerated: params.backupCodesGenerated
    })
  }),

  roleChanged: (params: {
    userId: UserId;
    version: AggregateVersion;
    previousRole: UserRole;
    newRole: UserRole;
    changedBy: UserId;
  }): RoleChangedEvent => Data.struct({
    type: UserEventType.ROLE_CHANGED,
    aggregateId: params.userId,
    version: params.version,
    timestamp: new Date().toISOString() as Timestamp,
    data: Data.struct({
      previousRole: params.previousRole,
      newRole: params.newRole,
      changedBy: params.changedBy
    })
  })
} as const;

/**
 * Type guard functions for events
 */
export const UserEventGuards = {
  isUserCreated: (event: UserDomainEvent): event is UserCreatedEvent =>
    event.type === UserEventType.USER_CREATED,
    
  isUserUpdated: (event: UserDomainEvent): event is UserUpdatedEvent =>
    event.type === UserEventType.USER_UPDATED,
    
  isUserDeleted: (event: UserDomainEvent): event is UserDeletedEvent =>
    event.type === UserEventType.USER_DELETED,
    
  isEmailVerified: (event: UserDomainEvent): event is EmailVerifiedEvent =>
    event.type === UserEventType.EMAIL_VERIFIED,
    
  isPasswordChanged: (event: UserDomainEvent): event is PasswordChangedEvent =>
    event.type === UserEventType.PASSWORD_CHANGED,
    
  isLoginSucceeded: (event: UserDomainEvent): event is LoginSucceededEvent =>
    event.type === UserEventType.LOGIN_SUCCEEDED,
    
  isLoginFailed: (event: UserDomainEvent): event is LoginFailedEvent =>
    event.type === UserEventType.LOGIN_FAILED,
} as const;