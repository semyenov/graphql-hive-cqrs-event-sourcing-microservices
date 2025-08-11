/**
 * User Domain: Command Definitions
 * 
 * Command types for the user domain.
 * All commands are immutable and use Data.struct.
 */

import * as Data from 'effect/Data';
import type { CorrelationId, ICommand, Timestamp } from '@cqrs/framework';
import type { 
  UserId,
  Email,
  Username,
  UserRole,
  UserStatus,
  VerificationToken,
  ResetToken,
  SessionId,
  CreateUserInput,
  UpdateUserInput,
  UpdateProfileInput,
  UpdatePreferencesInput,
  ChangePasswordInput,
  ResetPasswordInput,
  SetupTwoFactorInput,
  IPAddress
} from '../core/types';

/**
 * User command types enumeration
 */
export enum UserCommandType {
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  RESTORE_USER = 'RESTORE_USER',
  SUSPEND_USER = 'SUSPEND_USER',
  ACTIVATE_USER = 'ACTIVATE_USER',
  DEACTIVATE_USER = 'DEACTIVATE_USER',
  
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  REQUEST_EMAIL_VERIFICATION = 'REQUEST_EMAIL_VERIFICATION',
  CHANGE_EMAIL = 'CHANGE_EMAIL',
  
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  REQUEST_PASSWORD_RESET = 'REQUEST_PASSWORD_RESET',
  RESET_PASSWORD = 'RESET_PASSWORD',
  
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  UPDATE_PREFERENCES = 'UPDATE_PREFERENCES',
  
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_SESSION = 'REFRESH_SESSION',
  REVOKE_SESSION = 'REVOKE_SESSION',
  REVOKE_ALL_SESSIONS = 'REVOKE_ALL_SESSIONS',
  
  ENABLE_TWO_FACTOR = 'ENABLE_TWO_FACTOR',
  DISABLE_TWO_FACTOR = 'DISABLE_TWO_FACTOR',
  VERIFY_TWO_FACTOR = 'VERIFY_TWO_FACTOR',
  REGENERATE_BACKUP_CODES = 'REGENERATE_BACKUP_CODES',
  
  CHANGE_ROLE = 'CHANGE_ROLE',
  GRANT_PERMISSIONS = 'GRANT_PERMISSIONS',
  REVOKE_PERMISSIONS = 'REVOKE_PERMISSIONS'
}

/**
 * Base user command interface
 */
export interface UserCommand extends ICommand {
  readonly type: UserCommandType;
  readonly aggregateId: UserId;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: CorrelationId;
    readonly causedBy?: UserId;
    readonly ipAddress?: IPAddress;
    readonly userAgent?: string;
  };
}

/**
 * Create user command
 */
export interface CreateUserCommand extends UserCommand {
  readonly type: UserCommandType.CREATE_USER;
  readonly payload: CreateUserInput;
}

/**
 * Update user command
 */
export interface UpdateUserCommand extends UserCommand {
  readonly type: UserCommandType.UPDATE_USER;
  readonly payload: UpdateUserInput;
}

/**
 * Delete user command
 */
export interface DeleteUserCommand extends UserCommand {
  readonly type: UserCommandType.DELETE_USER;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly reason?: string;
    readonly deletedBy?: UserId;
  }>>;
}

/**
 * Suspend user command
 */
export interface SuspendUserCommand extends UserCommand {
  readonly type: UserCommandType.SUSPEND_USER;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly reason: string;
    readonly suspendedBy: UserId;
    readonly suspendedUntil?: Timestamp;
  }>>;
}

/**
 * Verify email command
 */
export interface VerifyEmailCommand extends UserCommand {
  readonly type: UserCommandType.VERIFY_EMAIL;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly verificationToken: VerificationToken;
  }>>;
}

/**
 * Change password command
 */
export interface ChangePasswordCommand extends UserCommand {
  readonly type: UserCommandType.CHANGE_PASSWORD;
  readonly payload: ChangePasswordInput;
}

/**
 * Reset password command
 */
export interface ResetPasswordCommand extends UserCommand {
  readonly type: UserCommandType.RESET_PASSWORD;
  readonly payload: ResetPasswordInput;
}

/**
 * Update profile command
 */
export interface UpdateProfileCommand extends UserCommand {
  readonly type: UserCommandType.UPDATE_PROFILE;
  readonly payload: UpdateProfileInput;
}

/**
 * Update preferences command
 */
export interface UpdatePreferencesCommand extends UserCommand {
  readonly type: UserCommandType.UPDATE_PREFERENCES;
  readonly payload: UpdatePreferencesInput;
}

/**
 * Login command
 */
export interface LoginCommand extends UserCommand {
  readonly type: UserCommandType.LOGIN;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly email?: string;
    readonly username?: string;
    readonly password: string;
    readonly twoFactorCode?: string;
    readonly rememberMe?: boolean;
  }>>;
}

/**
 * Logout command
 */
export interface LogoutCommand extends UserCommand {
  readonly type: UserCommandType.LOGOUT;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly sessionId: SessionId;
    readonly everywhere?: boolean;
  }>>;
}

/**
 * Enable two-factor command
 */
export interface EnableTwoFactorCommand extends UserCommand {
  readonly type: UserCommandType.ENABLE_TWO_FACTOR;
  readonly payload: SetupTwoFactorInput;
}

/**
 * Disable two-factor command
 */
export interface DisableTwoFactorCommand extends UserCommand {
  readonly type: UserCommandType.DISABLE_TWO_FACTOR;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly password: string;
    readonly verificationCode: string;
  }>>;
}

/**
 * Change role command
 */
export interface ChangeRoleCommand extends UserCommand {
  readonly type: UserCommandType.CHANGE_ROLE;
  readonly payload: ReturnType<typeof Data.struct<{
    readonly newRole: UserRole;
    readonly changedBy: UserId;
  }>>;
}

/**
 * Union type of all user commands
 */
export type UserDomainCommand =
  | CreateUserCommand
  | UpdateUserCommand
  | DeleteUserCommand
  | SuspendUserCommand
  | VerifyEmailCommand
  | ChangePasswordCommand
  | ResetPasswordCommand
  | UpdateProfileCommand
  | UpdatePreferencesCommand
  | LoginCommand
  | LogoutCommand
  | EnableTwoFactorCommand
  | DisableTwoFactorCommand
  | ChangeRoleCommand;

/**
 * Command factory functions
 */
export const UserCommandFactories = {
  createUser: (params: {
    userId: UserId;
    input: CreateUserInput;
    metadata?: UserCommand['metadata'];
  }): CreateUserCommand => Data.struct({
    type: UserCommandType.CREATE_USER,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  updateUser: (params: {
    userId: UserId;
    input: UpdateUserInput;
    metadata?: UserCommand['metadata'];
  }): UpdateUserCommand => Data.struct({
    type: UserCommandType.UPDATE_USER,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  deleteUser: (params: {
    userId: UserId;
    reason?: string;
    deletedBy?: UserId;
    metadata?: UserCommand['metadata'];
  }): DeleteUserCommand => Data.struct({
    type: UserCommandType.DELETE_USER,
    aggregateId: params.userId,
    payload: Data.struct({
      reason: params.reason,
      deletedBy: params.deletedBy
    }),
    metadata: params.metadata
  }),

  suspendUser: (params: {
    userId: UserId;
    reason: string;
    suspendedBy: UserId;
    suspendedUntil?: Timestamp;
    metadata?: UserCommand['metadata'];
  }): SuspendUserCommand => Data.struct({
    type: UserCommandType.SUSPEND_USER,
    aggregateId: params.userId,
    payload: Data.struct({
      reason: params.reason,
      suspendedBy: params.suspendedBy,
      suspendedUntil: params.suspendedUntil
    }),
    metadata: params.metadata
  }),

  verifyEmail: (params: {
    userId: UserId;
    verificationToken: VerificationToken;
    metadata?: UserCommand['metadata'];
  }): VerifyEmailCommand => Data.struct({
    type: UserCommandType.VERIFY_EMAIL,
    aggregateId: params.userId,
    payload: Data.struct({
      verificationToken: params.verificationToken
    }),
    metadata: params.metadata
  }),

  changePassword: (params: {
    userId: UserId;
    input: ChangePasswordInput;
    metadata?: UserCommand['metadata'];
  }): ChangePasswordCommand => Data.struct({
    type: UserCommandType.CHANGE_PASSWORD,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  resetPassword: (params: {
    userId: UserId;
    input: ResetPasswordInput;
    metadata?: UserCommand['metadata'];
  }): ResetPasswordCommand => Data.struct({
    type: UserCommandType.RESET_PASSWORD,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  updateProfile: (params: {
    userId: UserId;
    input: UpdateProfileInput;
    metadata?: UserCommand['metadata'];
  }): UpdateProfileCommand => Data.struct({
    type: UserCommandType.UPDATE_PROFILE,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  updatePreferences: (params: {
    userId: UserId;
    input: UpdatePreferencesInput;
    metadata?: UserCommand['metadata'];
  }): UpdatePreferencesCommand => Data.struct({
    type: UserCommandType.UPDATE_PREFERENCES,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  login: (params: {
    email?: string;
    username?: string;
    password: string;
    twoFactorCode?: string;
    rememberMe?: boolean;
    metadata?: UserCommand['metadata'];
  }): LoginCommand => {
    const userId = params.email 
      ? UserTypes.userId(params.email) 
      : UserTypes.userId(params.username || '');
      
    return Data.struct({
      type: UserCommandType.LOGIN,
      aggregateId: userId,
      payload: Data.struct({
        email: params.email,
        username: params.username,
        password: params.password,
        twoFactorCode: params.twoFactorCode,
        rememberMe: params.rememberMe
      }),
      metadata: params.metadata
    });
  },

  logout: (params: {
    userId: UserId;
    sessionId: SessionId;
    everywhere?: boolean;
    metadata?: UserCommand['metadata'];
  }): LogoutCommand => Data.struct({
    type: UserCommandType.LOGOUT,
    aggregateId: params.userId,
    payload: Data.struct({
      sessionId: params.sessionId,
      everywhere: params.everywhere
    }),
    metadata: params.metadata
  }),

  enableTwoFactor: (params: {
    userId: UserId;
    input: SetupTwoFactorInput;
    metadata?: UserCommand['metadata'];
  }): EnableTwoFactorCommand => Data.struct({
    type: UserCommandType.ENABLE_TWO_FACTOR,
    aggregateId: params.userId,
    payload: params.input,
    metadata: params.metadata
  }),

  disableTwoFactor: (params: {
    userId: UserId;
    password: string;
    verificationCode: string;
    metadata?: UserCommand['metadata'];
  }): DisableTwoFactorCommand => Data.struct({
    type: UserCommandType.DISABLE_TWO_FACTOR,
    aggregateId: params.userId,
    payload: Data.struct({
      password: params.password,
      verificationCode: params.verificationCode
    }),
    metadata: params.metadata
  }),

  changeRole: (params: {
    userId: UserId;
    newRole: UserRole;
    changedBy: UserId;
    metadata?: UserCommand['metadata'];
  }): ChangeRoleCommand => Data.struct({
    type: UserCommandType.CHANGE_ROLE,
    aggregateId: params.userId,
    payload: Data.struct({
      newRole: params.newRole,
      changedBy: params.changedBy
    }),
    metadata: params.metadata
  })
} as const;

import { UserTypes } from '../core/types';