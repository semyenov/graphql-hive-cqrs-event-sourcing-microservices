/**
 * User Domain: User Aggregate
 * 
 * The User aggregate root that manages user state and business logic.
 */

import { Aggregate } from '../../../framework/core/aggregate';
import type { EventReducer } from '../../../framework/core/event';
import type { AggregateId } from '../../../framework/core/branded/types';
import { BrandedTypes } from '../../../framework/core/branded';
import type { Email, PersonName } from '../helpers/types';
import { UserBrandedTypes } from '../helpers/factories';
import { UserEventTypes, type UserEvent } from '../events/types';
import { UserEventFactories } from '../events/factories';
import { matchUserEvent } from '../helpers/type-guards';
import { createReducerFromEventPattern } from '../../../framework/core/event';
import { InvalidStateError } from '../../../framework';
import { UserAlreadyExistsError, EmailAlreadyVerifiedError } from './errors';

/**
 * User aggregate state
 */
export interface UserState {
  id: string;
  name: PersonName;
  email: Email;
  emailVerified: boolean;
  deleted: boolean;
  profile?: {
    bio?: string;
    avatar?: string;
    location?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * User aggregate
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
   * Commands
   */

  /**
   * Create a new user
   */
  create(data: { name: string; email: string }): void {
    if (this._state && !this._state.deleted) {
      throw new UserAlreadyExistsError();
    }

    const event = UserEventFactories.createUserCreated(this.id, {
      name: data.name,
      email: data.email,
    });
    this.applyEvent(event, true);
  }

  /**
   * Update user details
   */
  update(data: { name?: string; email?: string }): void {
    this.ensureExists();

    if (!data.name && !data.email) {
      throw new InvalidStateError('No updates provided');
    }

    const event = UserEventFactories.createUserUpdated(
      this.id,
      BrandedTypes.eventVersion(this._version + 1),
      {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        updatedAt: new Date().toISOString(),
      }
    );
    this.applyEvent(event, true);
  }

  /**
   * Delete user
   */
  delete(reason?: string): void {
    this.ensureExists();

    const event = UserEventFactories.createUserDeleted(
      this.id,
      BrandedTypes.eventVersion(this._version + 1),
      {
        deletedAt: new Date().toISOString(),
        ...(reason && { reason }),
      }
    );
    this.applyEvent(event, true);
  }

  /**
   * Verify user email
   */
  verifyEmail(): void {
    this.ensureExists();

    if (this._state!.emailVerified) {
      throw new EmailAlreadyVerifiedError();
    }

    const event = UserEventFactories.createEmailVerified(
      this.id,
      BrandedTypes.eventVersion(this._version + 1),
      { verifiedAt: new Date().toISOString() }
    );
    this.applyEvent(event, true);
  }

  /**
   * Change user password
   */
  changePassword(data: { newPassword: string }): void {
    this.ensureExists();

    const event = UserEventFactories.createPasswordChanged(
      this.id,
      BrandedTypes.eventVersion(this._version + 1),
      {
        changedAt: new Date().toISOString(),
      }
    );
    this.applyEvent(event, true);
  }

  /**
   * Update user profile
   */
  updateProfile(data: {
    bio?: string;
    avatar?: string;
    location?: string;
  }): void {
    this.ensureExists();

    const event = UserEventFactories.createProfileUpdated(
      this.id,
      BrandedTypes.eventVersion(this.version + 1),
      {
        ...data,
        updatedAt: new Date().toISOString(),
      }
    );
    this.applyEvent(event, true);
  }

  /**
   * Queries
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
   * Get user data
   */
  getUser(): UserState | null {
    if (!this._state || this._state.deleted) {
      return null;
    }
    return { ...this._state };
  }

  /**
   * Private helper to ensure user exists
   */
  private ensureExists(): void {
    if (!this._state || this._state.deleted) {
      throw new InvalidStateError('User not found or deleted');
    }
  }
}

/**
 * Event reducer for user state
 */
const userReducer: EventReducer<UserEvent, UserState> = createReducerFromEventPattern<UserEvent, UserState>({
  [UserEventTypes.UserCreated]: (_state, e) => ({
    id: e.aggregateId as string,
    name: e.data.name,
    email: e.data.email,
    emailVerified: false,
    deleted: false,
    createdAt: e.data.createdAt,
    updatedAt: e.data.createdAt,
  }),

  [UserEventTypes.UserUpdated]: (state, e) => {
    if (!state) throw new InvalidStateError('Cannot update non-existent user');
    return {
      ...state,
      ...(e.data.name && { name: e.data.name }),
      ...(e.data.email && { email: e.data.email, emailVerified: false }),
      updatedAt: e.data.updatedAt,
    };
  },

  [UserEventTypes.UserDeleted]: (state, e) => {
    if (!state) throw new InvalidStateError('Cannot delete non-existent user');
    return {
      ...state,
      deleted: true,
      updatedAt: e.data.deletedAt,
    };
  },

  [UserEventTypes.UserEmailVerified]: (state, e) => {
    if (!state) throw new InvalidStateError('Cannot verify email for non-existent user');
    return {
      ...state,
      emailVerified: true,
      updatedAt: e.data.verifiedAt,
    };
  },

  [UserEventTypes.UserPasswordChanged]: (state, e) => {
    if (!state) throw new InvalidStateError('Cannot change password for non-existent user');
    return {
      ...state,
      updatedAt: e.data.changedAt,
    };
  },

  [UserEventTypes.UserProfileUpdated]: (state, e) => {
    if (!state) throw new InvalidStateError('Cannot update profile for non-existent user');
    return {
      ...state,
      profile: {
        ...state.profile,
        ...e.data,
      },
      updatedAt: e.data.updatedAt,
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