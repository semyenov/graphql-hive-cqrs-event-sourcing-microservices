/**
 * User Domain: Aggregate
 * 
 * User aggregate implementing business logic with Effect-TS.
 * Pure functional approach without inheritance.
 */

import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import { pipe } from 'effect/Function';
import { 
  UserRole,
  UserStatus,
  type UserId,
  type Email,
  type Username,
  type HashedPassword,
  type VerificationToken,
  type ResetToken,
  type UserState,
  type UserProfile,
  type UserPreferences,
  type CreateUserInput,
  type UpdateUserInput,
  type UpdateProfileInput,
  type UpdatePreferencesInput,
  type ChangePasswordInput,
  type UserMetadata,
  type SessionId,
  type UserSecurity,
  type IPAddress
} from './types';
import { UserTypes, UserGuards } from './types';
import * as Errors from './errors';
import { 
  type UserCreatedEvent,
  type UserUpdatedEvent,
  type UserDomainEvent, 
  UserEventType,
  UserEventFactories, 
  type PasswordChangedEvent,
  type ProfileUpdatedEvent,
  type LoginSucceededEvent,
  type LoginFailedEvent,
  type TwoFactorEnabledEvent,
  type RoleChangedEvent,
  type EmailVerifiedEvent
} from './events';
import type { AggregateVersion, IAggregateBehavior, Timestamp } from '@cqrs/framework';

/**
 * User aggregate class - pure functional with Effect
 */
export class UserAggregate implements IAggregateBehavior<UserState, UserDomainEvent, UserId> {
  #state: UserState | null = null;
  #uncommittedEvents: UserDomainEvent[] = [];
  #version: number = 0;

  private constructor(readonly id: UserId) {}

  /**
   * Factory method to create a new aggregate
   */
  static create(id: UserId): UserAggregate {
    return new UserAggregate(id);
  }

  /**
   * Factory method to reconstitute from events
   */
  static fromHistory(
    id: UserId, 
    events: UserDomainEvent[]
  ): Effect.Effect<UserAggregate, never, never> {
    return Effect.gen(function* () {
      const aggregate = new UserAggregate(id);
      
      for (const event of events) {
        aggregate.applyEvent(event, false);
      }
      
      return aggregate;
    });
  }

  // Getters
  get state(): UserState | null { return this.#state; }
  get version(): AggregateVersion { return this.#version as AggregateVersion; }
  get uncommittedEvents(): readonly UserDomainEvent[] { return [...this.#uncommittedEvents]; }

  /**
   * Create a new user
   */
  createUser(
    input: CreateUserInput,
    passwordHash: HashedPassword
  ): Effect.Effect<void, Errors.UserAlreadyExistsError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.#version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (state !== null && !UserGuards.isDeleted(state)) {
      return Effect.fail(new Errors.UserAlreadyExistsError({
        email: state.email,
        username: state.username
      }));
    }

    return Effect.gen(function* (_) {
      const profile = Data.struct<UserProfile>({
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName || `${input.firstName} ${input.lastName}`,
        bio: undefined,
        avatarUrl: undefined,
        location: undefined,
        website: undefined,
        socialLinks: undefined
      });

      const event = UserEventFactories.userCreated({
        userId: id,
        email: UserTypes.email(input.email),
        username: UserTypes.username(input.username),
        passwordHash,
        role: UserRole.USER,
        profile,
        preferences: UserTypes.createDefaultPreferences(),
        metadata: UserTypes.createDefaultMetadata(input.source),
        version,
      });

      applyEvent(event, true);
    });
  }

  /**
   * Update user basic information
   */
  updateUser(
    input: UpdateUserInput,
    updatedBy?: UserId
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);
    return Effect.gen(function* (_) {
      if (!state) {
        yield* _(Effect.fail(new Errors.UserNotFoundError({ userId: id })));
      }

      if (state && UserGuards.isDeleted(state)) {
        yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'update'
        })));
      }

      const event = UserEventFactories.userUpdated({
        userId: id,
        version,
        email: input.email ? UserTypes.email(input.email) : undefined,
        username: input.username ? UserTypes.username(input.username) : undefined,
        previousEmail: input.email ? state!.email : undefined,
        previousUsername: input.username ? state!.username : undefined,
        causedBy: updatedBy
      });

      if (input.email || input.username) {
        applyEvent(event, true);
      }
    });
  }

  /**
   * Delete user (soft delete)
   */
  deleteUser(
    deletedBy?: UserId,
    reason?: string
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.UserDeletedError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.#version + 1 as AggregateVersion;
    const timestamp = new Date().toISOString() as Timestamp;
    const applyEvent = this.applyEvent.bind(this);
    return Effect.gen(function* (_) {
      if (!state || UserGuards.isDeleted(state)) {
        yield* _(Effect.fail(new Errors.UserNotFoundError({ userId: id })));
      }

      const purgeDate = new Date();
      purgeDate.setDate(purgeDate.getDate() + 30); // 30 days retention

      const event = UserEventFactories.userDeleted({
        userId: id,
        version,
        deletedBy,
        reason,
        scheduledPurgeDate: purgeDate.toISOString() as Timestamp
      });

      applyEvent(event, true);
    });
  }

  /**
   * Suspend user account
   */
  suspendUser(
    suspendedBy: UserId,
    reason: string,
    suspendedUntil?: string
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const timestamp = new Date().toISOString() as Timestamp;
    const applyEvent = this.applyEvent.bind(this);
    return Effect.gen(function* (_) {

      if (!state) {
        yield* _(Effect.fail(new Errors.UserNotFoundError({ userId: id })));
      }

      if (state && UserGuards.isDeleted(state)) {
        yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'delete'
        })));
      }

      const event = UserEventFactories.userSuspended({
        userId: id,
        version,
        suspendedBy,
        reason,
        suspendedUntil: suspendedUntil ? new Date(suspendedUntil).toISOString() as Timestamp : undefined
      });

      applyEvent(event, true);
    });
  }

  /**
   * Verify user email
   */
  verifyEmail(
    token: VerificationToken
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.EmailAlreadyVerifiedError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (!state) { 
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (state.emailVerified) {
        yield* _(Effect.fail(new Errors.EmailAlreadyVerifiedError({
          userId: id,
          email: state.email
        })));
      }

      const event = UserEventFactories.emailVerified({
        userId: id,
        version,
        email: state.email,
        verificationToken: token,
      });

      applyEvent(event, true);
    });
  }

  /**
   * Change user password
   */
  changePassword(
    newPasswordHash: HashedPassword,
    changedBy: 'USER' | 'ADMIN' | 'SYSTEM' = 'USER'
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (UserGuards.canLogin(state)) {
          yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'change password'
        })));
      }

      const event = UserEventFactories.passwordChanged({
        userId: id,
        version,
        newPasswordHash,
        changedBy,
        requiresVerification: changedBy === 'ADMIN',
      });

        applyEvent(event, true);
    });
  }

  /**
   * Update user profile
   */
  updateProfile(
    updates: UpdateProfileInput
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (!state) {
        yield* _(Effect.fail(new Errors.UserNotFoundError({ userId: id })));
      }

      if (UserGuards.isDeleted(state)) {
        yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'update profile'
        })));
      }

      const event = UserEventFactories.profileUpdated({
        userId: id,
        version,
        updates,
        previousProfile: state!.profile
      });

      applyEvent(event, true);
    });
  }

  /**
   * Record successful login
   */
  recordLoginSuccess(
    sessionId: SessionId,
    ipAddress: IPAddress,
    userAgent?: string,
    twoFactorUsed = false
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (!UserGuards.canLogin(state)) {
        yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'login'
        })));
      }

      const event = UserEventFactories.loginSucceeded({
        userId: id,
        version,
        sessionId,
        ipAddress,
        userAgent,
        twoFactorUsed,
      });

      applyEvent(event, true);
    });
  }

  /**
   * Record failed login attempt
   */
  recordLoginFailure(
    reason: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'TWO_FACTOR_FAILED',
    ipAddress: IPAddress
  ): Effect.Effect<void, Errors.UserNotFoundError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);
    
    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      const event = UserEventFactories.loginFailed({
        userId: id,
        version,
        reason,
        attemptNumber: state!.security.loginAttempts + 1,
        ipAddress
      }); 

      applyEvent(event, true);
    });
  }

  /**
   * Enable two-factor authentication
   */
  enableTwoFactor(
    method: 'TOTP' | 'SMS' | 'EMAIL' = 'TOTP',
    backupCodes: number = 8
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.TwoFactorAlreadyEnabledError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);
    
    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (UserGuards.hasTwoFactor(state)) {
        yield* _(Effect.fail(new Errors.TwoFactorAlreadyEnabledError({ userId: id })));
      }

      const event = UserEventFactories.twoFactorEnabled({
        userId: id,
        version,
        method,
        backupCodesGenerated: backupCodes
      });

      applyEvent(event, true);
    }); 
  }

  /**
   * Change user role
   */
  changeRole( 
    newRole: UserRole,
    changedBy: UserId
  ): Effect.Effect<void, Errors.UserNotFoundError | Errors.InvalidUserStatusError, never> {
    const state = this.state;
    const id = this.id;
    const version = this.version + 1 as AggregateVersion;
    const applyEvent = this.applyEvent.bind(this);

    if (!state) {
      return Effect.fail(new Errors.UserNotFoundError({ userId: id }));
    }

    return Effect.gen(function* (_) {
      if (UserGuards.isDeleted(state)) {
        yield* _(Effect.fail(new Errors.InvalidUserStatusError({
          userId: id,
          currentStatus: state.status,
          attemptedAction: 'change role'
        })));
      }

      const event = UserEventFactories.roleChanged({
        userId: id,
        version,
        previousRole: state.role, 
        newRole,
        changedBy
      });

      applyEvent(event, true);
    });
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.#uncommittedEvents = [];
  }

  /**
   * Apply event to aggregate state
   */
  private applyEvent(event: UserDomainEvent, isNew: boolean = false): void {
    this.#state = this.reduceEvent(this.#state, event);
    this.#version = event.version;
    
    if (isNew) {
      this.#uncommittedEvents.push(event);
    }
  }

  /**
   * Pure reducer function for events
   */
  private reduceEvent(state: UserState | null, event: UserDomainEvent): UserState {
    switch (event.type) { 
      case UserEventType.USER_CREATED: {
        const data = event.data as UserCreatedEvent['data'];
        return {
          id: this.id,
          email: data.email,  
          username: data.username,
          status: UserStatus.PENDING, 
          role: UserRole.USER,
          profile: data.profile,
          preferences: data.preferences,
          security: UserTypes.createDefaultSecurity(data.passwordHash),
          emailVerified: false,
          emailVerifiedAt: undefined,
          metadata: data.metadata,  
          createdAt: event.timestamp, 
          updatedAt: event.timestamp,
          version: event.version
        }; 
      }

      case UserEventType.USER_UPDATED: {
        if (!state) throw new Error('Cannot update non-existent user');
        const data = event.data as UserUpdatedEvent['data'];
        return {
          ...state,
          email: data.email || state.email,
          username: data.username || state.username,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.USER_DELETED: {
        if (!state) throw new Error('Cannot delete non-existent user');
        return {
          ...state,
          status: UserStatus.DELETED,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.USER_SUSPENDED: {
        if (!state) throw new Error('Cannot suspend non-existent user');
        return {
          ...state,
          status: UserStatus.SUSPENDED,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.EMAIL_VERIFIED: {
        if (!state) throw new Error('Cannot verify email for non-existent user');
        const data = event.data as EmailVerifiedEvent['data'];
        const status = state.status === UserStatus.PENDING ? UserStatus.ACTIVE : state.status;
        return {
          ...state,
          emailVerified: true,
          emailVerifiedAt: data.verifiedAt,
          status,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      } 

      case UserEventType.PASSWORD_CHANGED: {
        if (!state) throw new Error('Cannot change password for non-existent user');
        const data = event.data as PasswordChangedEvent['data'];
        const requiresVerification = data.requiresVerification || false;
        return {
          ...state,
          security: {
            ...state.security,
            passwordHash: data.newPasswordHash,
            passwordChangedAt: event.timestamp,
            loginAttempts: requiresVerification ? 0 : state.security.loginAttempts,
            lockedUntil: requiresVerification ? undefined : state.security.lockedUntil
          },  
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.PROFILE_UPDATED: {
        if (!state) throw new Error('Cannot update profile for non-existent user');
        const data = event.data as ProfileUpdatedEvent['data'];
        return {
          ...state,
          profile: {
            ...state.profile,
            ...data.updates
          },
          updatedAt: event.timestamp,
          version: event.version
        };
      }

      case UserEventType.LOGIN_SUCCEEDED: {
        if (!state) throw new Error('Cannot record login for non-existent user');
        const data = event.data as LoginSucceededEvent['data'];
        return {
          ...state,
          security: {
            ...state.security,
            loginAttempts: 0,
            lastLoginAt: event.timestamp as Timestamp,
            lastLoginIp: data.ipAddress as IPAddress,
            sessions: [...state.security.sessions, data.sessionId]
            },
          updatedAt: event.timestamp as Timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.LOGIN_FAILED: {
        if (!state) throw new Error('Cannot record failed login for non-existent user');
        const data = event.data as LoginFailedEvent['data'];
        const attempts = data.attemptNumber;
        const shouldLock = attempts >= 5;
        
        const lockUntil = shouldLock
          ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
          : undefined;
          
        return {
          ...state,
          security: {
            ...state.security,
            loginAttempts: attempts,
            lockedUntil: lockUntil
          } as UserSecurity,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.TWO_FACTOR_ENABLED: {
        if (!state) throw new Error('Cannot enable 2FA for non-existent user');
        return {
          ...state,
          preferences: {
            ...state.preferences,
            twoFactorEnabled: true
          } as UserPreferences,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      case UserEventType.ROLE_CHANGED: {
        if (!state) throw new Error('Cannot change role for non-existent user');
        const data = event.data as RoleChangedEvent['data'];
        return {
          ...state,
          role: data.newRole,
          updatedAt: event.timestamp,
          version: event.version
        } as UserState;
      }

      default:
        return state || this.createInitialState();
    }
  }

  /**
   * Create initial empty state
   */
  private createInitialState(): UserState {
    return Data.struct<UserState>({
      id: this.id,
      email: UserTypes.email(''),
      username: UserTypes.username(''),
      status: UserStatus.PENDING,
      role: UserRole.USER,
      profile: Data.struct({
        firstName: '',
        lastName: '',
        displayName: ''
      }),
      preferences: UserTypes.createDefaultPreferences(),
      security: UserTypes.createDefaultSecurity(UserTypes.hashedPassword('')),
      metadata: UserTypes.createDefaultMetadata(),
      emailVerified: false,
      createdAt: new Date().toISOString() as Timestamp,
      updatedAt: new Date().toISOString() as Timestamp,
      version: 0 as AggregateVersion
    });
  }
}