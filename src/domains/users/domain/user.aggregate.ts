/**
 * User Domain: User Aggregate Root
 * 
 * The User aggregate root that encapsulates user business logic and state.
 * This is the main entry point for all user-related business operations.
 */

import { Aggregate } from '../../../framework/core/aggregate';
import type { EventReducer } from '../../../framework/core/event';
import type { AggregateId } from '../../../framework/core/branded/types';
import { BrandedTypes } from '../../../framework/core/branded/factories';
import { createReducerFromEventPattern } from '../../../framework/core/event';
import { InvalidStateError } from '../../../framework/core/errors';

// Domain imports
import type { 
  UserState, 
  Email, 
  PersonName,
  CreateUserData,
  UpdateUserData,
  DeleteUserData,
  UpdateProfileData,
  ChangePasswordData,
} from './user.types';
import type { UserEvent, UserEventData, UserEventType } from './user.events';
import { UserEventTypes } from './user.events';
import { 
  UserAlreadyExistsError, 
  EmailAlreadyVerifiedError,
  UserDeletedError,
} from './user.errors';

/**
 * User aggregate root - manages user business logic
 */
export class UserAggregate extends Aggregate<UserState, UserEvent, AggregateId> {
  constructor(id: AggregateId) {
    super(
      id,
      userReducer,
      createInitialState(id)
    );
  }

  /**
   * Domain Commands - Business Operations
   */

  /**
   * Create a new user - register them in the system
   */
  create(data: CreateUserData): void {
    if (this._state && !this._state.deleted) {
      throw new UserAlreadyExistsError(this._state.email);
    }

    const event = this.createEvent(UserEventTypes.UserCreated, {
      name: data.name as PersonName,
      email: data.email as Email,
      createdAt: new Date().toISOString(),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Update user basic information
   */
  update(data: UpdateUserData): void {
    this.ensureNotDeleted();
    this.ensureExists();

    if (!data.name && !data.email) {
      throw new InvalidStateError('No updates provided');
    }

    const event = this.createEvent(UserEventTypes.UserUpdated, {
      ...(data.name && { name: data.name as PersonName }),
      ...(data.email && { email: data.email as Email }),
      updatedAt: new Date().toISOString(),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Delete user from the system
   */
  delete(reason?: string): void {
    this.ensureExists();
    this.ensureNotDeleted();

    const event = this.createEvent(UserEventTypes.UserDeleted, {
      deletedAt: new Date().toISOString(),
      ...(reason && { reason }),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Verify user's email address
   */
  verifyEmail(): void {
    this.ensureExists();
    this.ensureNotDeleted();

    if (this._state!.emailVerified) {
      throw new EmailAlreadyVerifiedError();
    }

    const event = this.createEvent(UserEventTypes.UserEmailVerified, {
      verifiedAt: new Date().toISOString(),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Change user's password
   */
  changePassword(data: ChangePasswordData): void {
    this.ensureExists();
    this.ensureNotDeleted();

    const event = this.createEvent(UserEventTypes.UserPasswordChanged, {
      changedAt: new Date().toISOString(),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Update user's profile information
   */
  updateProfile(data: UpdateProfileData): void {
    this.ensureExists();
    this.ensureNotDeleted();

    const event = this.createEvent(UserEventTypes.UserProfileUpdated, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    
    this.applyEvent(event, true);
  }

  /**
   * Domain Queries - State Inspection
   */

  /**
   * Check if user is deleted
   */
  isDeleted(): boolean {
    return this._state?.deleted ?? false;
  }

  /**
   * Check if email is verified
   */
  isEmailVerified(): boolean {
    return this._state?.emailVerified ?? false;
  }

  /**
   * Get user data (returns null if deleted)
   */
  getUserData(): UserState | null {
    if (!this._state || this._state.deleted) {
      return null;
    }
    return { ...this._state };
  }

  /**
   * Get user email
   */
  getEmail(): Email | null {
    return this._state?.email ?? null;
  }

  /**
   * Get user name
   */
  getName(): PersonName | null {
    return this._state?.name ?? null;
  }

  /**
   * Private helper methods
   */

  private ensureExists(): void {
    if (!this._state) {
      throw new InvalidStateError('User not found');
    }
  }

  private ensureNotDeleted(): void {
    if (this._state?.deleted) {
      throw new UserDeletedError();
    }
  }

  private createEvent<T extends UserEventType>(
    type: T,
    data: UserEventData
  ): UserEvent {
    return {
      aggregateId: this.id,
      type,
      version: BrandedTypes.eventVersion(this._version + 1),
      timestamp: BrandedTypes.timestamp(),
      data,
    } as UserEvent;
  }
}

/**
 * Event reducer for user state transitions
 */
const userReducer: EventReducer<UserEvent, UserState> = createReducerFromEventPattern<UserEvent, UserState>({
  [UserEventTypes.UserCreated]: (_state, event) => ({
    id: event.aggregateId as string,
    name: event.data.name,
    email: event.data.email,
    emailVerified: false,
    deleted: false,
    createdAt: event.data.createdAt,
    updatedAt: event.data.createdAt,
  }),

  [UserEventTypes.UserUpdated]: (state, event) => {
    if (!state) throw new InvalidStateError('Cannot update non-existent user');
    return {
      ...state,
      ...(event.data.name && { name: event.data.name }),
      ...(event.data.email && { 
        email: event.data.email, 
        emailVerified: false // Reset verification when email changes
      }),
      updatedAt: event.data.updatedAt,
    };
  },

  [UserEventTypes.UserDeleted]: (state, event) => {
    if (!state) throw new InvalidStateError('Cannot delete non-existent user');
    return {
      ...state,
      deleted: true,
      updatedAt: event.data.deletedAt,
    };
  },

  [UserEventTypes.UserEmailVerified]: (state, event) => {
    if (!state) throw new InvalidStateError('Cannot verify email for non-existent user');
    return {
      ...state,
      emailVerified: true,
      updatedAt: event.data.verifiedAt,
    };
  },

  [UserEventTypes.UserPasswordChanged]: (state, event) => {
    if (!state) throw new InvalidStateError('Cannot change password for non-existent user');
    return {
      ...state,
      updatedAt: event.data.changedAt,
    };
  },

  [UserEventTypes.UserProfileUpdated]: (state, event) => {
    if (!state) throw new InvalidStateError('Cannot update profile for non-existent user');
    return {
      ...state,
      profile: {
        ...state.profile,
        bio: event.data.bio,
        avatar: event.data.avatar,
        location: event.data.location,
      },
      updatedAt: event.data.updatedAt,
    };
  },
});

/**
 * Create initial user state
 */
function createInitialState(id: AggregateId): UserState {
  return {
    id: id as string,
    name: '' as PersonName,
    email: '' as Email,
    emailVerified: false,
    deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
} 