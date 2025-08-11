/**
 * User Domain: Error Types
 * 
 * Tagged error types for the user domain using Effect-TS Data.TaggedError.
 * These provide type-safe, composable error handling.
 */

import * as Data from 'effect/Data';
import type { UserId, Email, Username } from './types';

/**
 * Base user domain error
 */
export class UserDomainError extends Data.TaggedError('UserDomainError')<{
  readonly message: string;
  readonly context?: unknown;
}> {}

/**
 * User not found error
 */
export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly userId?: UserId;
  readonly email?: Email;
  readonly username?: Username;
}> {
  override get message() {
    if (this.userId) return `User with ID ${this.userId} not found`;
    if (this.email) return `User with email ${this.email} not found`;
    if (this.username) return `User with username ${this.username} not found`;
    return 'User not found';
  }
}

/**
 * User already exists error
 */
export class UserAlreadyExistsError extends Data.TaggedError('UserAlreadyExistsError')<{
  readonly email?: Email;
  readonly username?: Username;
}> {
  override get message() {
    if (this.email && this.username) {
      return `User with email ${this.email} or username ${this.username} already exists`;
    }
    if (this.email) return `User with email ${this.email} already exists`;
    if (this.username) return `User with username ${this.username} already exists`;
    return 'User already exists';
  }
}

/**
 * Invalid user status error
 */
export class InvalidUserStatusError extends Data.TaggedError('InvalidUserStatusError')<{
  readonly userId: UserId;
  readonly currentStatus: string;
  readonly attemptedAction: string;
}> {
  override get message() {
    return `Cannot perform ${this.attemptedAction} on user ${this.userId} with status ${this.currentStatus}`;
  }
}

/**
 * User deleted error
 */
export class UserDeletedError extends Data.TaggedError('UserDeletedError')<{
  readonly userId: UserId;
}> {
  override get message() {
    return `User ${this.userId} has been deleted`;
  }
}

/**
 * User suspended error
 */
export class UserSuspendedError extends Data.TaggedError('UserSuspendedError')<{
  readonly userId: UserId;
  readonly reason?: string;
  readonly suspendedUntil?: string;
}> {
  override get message() {
    const base = `User ${this.userId} is suspended`;
    if (this.suspendedUntil) {
      return `${base} until ${this.suspendedUntil}`;
    }
    if (this.reason) {
      return `${base}: ${this.reason}`;
    }
    return base;
  }
}

/**
 * User locked error (too many login attempts)
 */
export class UserLockedError extends Data.TaggedError('UserLockedError')<{
  readonly userId: UserId;
  readonly lockedUntil: string;
  readonly attempts: number;
}> {
  override get message() {
    return `User ${this.userId} is locked until ${this.lockedUntil} after ${this.attempts} failed attempts`;
  }
}

/**
 * Email not verified error
 */
export class EmailNotVerifiedError extends Data.TaggedError('EmailNotVerifiedError')<{
  readonly userId: UserId;
  readonly email: Email;
}> {
  override get message() {
    return `Email ${this.email} for user ${this.userId} is not verified`;
  }
}

/**
 * Email already verified error
 */
export class EmailAlreadyVerifiedError extends Data.TaggedError('EmailAlreadyVerifiedError')<{
  readonly userId: UserId;
  readonly email: Email;
}> {
  override get message() {
    return `Email ${this.email} for user ${this.userId} is already verified`;
  }
}

/**
 * Invalid credentials error
 */
export class InvalidCredentialsError extends Data.TaggedError('InvalidCredentialsError')<{
  readonly email?: Email;
  readonly username?: Username;
}> {
  override get message() {
    return 'Invalid credentials provided';
  }
}

/**
 * Invalid password error
 */
export class InvalidPasswordError extends Data.TaggedError('InvalidPasswordError')<{
  readonly reason: string;
}> {
  override get message() {
    return `Invalid password: ${this.reason}`;
  }
}

/**
 * Invalid verification token error
 */
export class InvalidVerificationTokenError extends Data.TaggedError('InvalidVerificationTokenError')<{
  readonly token: string;
  readonly type: 'EMAIL' | 'RESET' | 'TWO_FACTOR';
}> {
  override get message() {
    return `Invalid ${this.type.toLowerCase()} verification token`;
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends Data.TaggedError('TokenExpiredError')<{
  readonly token: string;
  readonly type: 'EMAIL' | 'RESET' | 'SESSION';
  readonly expiredAt: string;
}> {
  override get message() {
    return `${this.type} token expired at ${this.expiredAt}`;
  }
}

/**
 * Two-factor authentication required error
 */
export class TwoFactorRequiredError extends Data.TaggedError('TwoFactorRequiredError')<{
  readonly userId: UserId;
}> {
  override get message() {
    return `Two-factor authentication required for user ${this.userId}`;
  }
}

/**
 * Invalid two-factor code error
 */
export class InvalidTwoFactorCodeError extends Data.TaggedError('InvalidTwoFactorCodeError')<{
  readonly userId: UserId;
}> {
  override get message() {
    return `Invalid two-factor authentication code for user ${this.userId}`;
  }
}

/**
 * Two-factor already enabled error
 */
export class TwoFactorAlreadyEnabledError extends Data.TaggedError('TwoFactorAlreadyEnabledError')<{
  readonly userId: UserId;
}> {
  override get message() {
    return `Two-factor authentication is already enabled for user ${this.userId}`;
  }
}

/**
 * Two-factor not enabled error
 */
export class TwoFactorNotEnabledError extends Data.TaggedError('TwoFactorNotEnabledError')<{
  readonly userId: UserId;
}> {
  override get message() {
    return `Two-factor authentication is not enabled for user ${this.userId}`;
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string;
  readonly userId?: UserId;
}> {
  override get message() {
    if (this.userId) {
      return `Session ${this.sessionId} not found for user ${this.userId}`;
    }
    return `Session ${this.sessionId} not found`;
  }
}

/**
 * Insufficient permissions error
 */
export class InsufficientPermissionsError extends Data.TaggedError('InsufficientPermissionsError')<{
  readonly userId: UserId;
  readonly requiredRole: string;
  readonly currentRole: string;
}> {
  override get message() {
    return `User ${this.userId} with role ${this.currentRole} lacks required role ${this.requiredRole}`;
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Data.TaggedError('RateLimitExceededError')<{
  readonly userId?: UserId;
  readonly action: string;
  readonly limit: number;
  readonly resetAt: string;
}> {
  override get message() {
    const user = this.userId ? `User ${this.userId}` : 'Request';
    return `${user} exceeded rate limit of ${this.limit} for action ${this.action}. Resets at ${this.resetAt}`;
  }
}

/**
 * Union type of all user errors
 */
export type UserError =
  | UserDomainError
  | UserNotFoundError
  | UserAlreadyExistsError
  | InvalidUserStatusError
  | UserDeletedError
  | UserSuspendedError
  | UserLockedError
  | EmailNotVerifiedError
  | EmailAlreadyVerifiedError
  | InvalidCredentialsError
  | InvalidPasswordError
  | InvalidVerificationTokenError
  | TokenExpiredError
  | TwoFactorRequiredError
  | InvalidTwoFactorCodeError
  | TwoFactorAlreadyEnabledError
  | TwoFactorNotEnabledError
  | SessionNotFoundError
  | InsufficientPermissionsError
  | RateLimitExceededError;

/**
 * Error factory functions for convenience
 */
export const UserErrors = {
  notFound: (params: { userId?: UserId; email?: Email; username?: Username }) =>
    new UserNotFoundError(params),
    
  alreadyExists: (params: { email?: Email; username?: Username }) =>
    new UserAlreadyExistsError(params),
    
  invalidStatus: (userId: UserId, currentStatus: string, attemptedAction: string) =>
    new InvalidUserStatusError({ userId, currentStatus, attemptedAction }),
    
  deleted: (userId: UserId) =>
    new UserDeletedError({ userId }),
    
  suspended: (userId: UserId, reason?: string, suspendedUntil?: string) =>
    new UserSuspendedError({ userId, reason, suspendedUntil }),
    
  locked: (userId: UserId, lockedUntil: string, attempts: number) =>
    new UserLockedError({ userId, lockedUntil, attempts }),
    
  emailNotVerified: (userId: UserId, email: Email) =>
    new EmailNotVerifiedError({ userId, email }),
    
  emailAlreadyVerified: (userId: UserId, email: Email) =>
    new EmailAlreadyVerifiedError({ userId, email }),
    
  invalidCredentials: (params?: { email?: Email; username?: Username }) =>
    new InvalidCredentialsError(params || {}),
    
  invalidPassword: (reason: string) =>
    new InvalidPasswordError({ reason }),
    
  invalidToken: (token: string, type: 'EMAIL' | 'RESET' | 'TWO_FACTOR') =>
    new InvalidVerificationTokenError({ token, type }),
    
  tokenExpired: (token: string, type: 'EMAIL' | 'RESET' | 'SESSION', expiredAt: string) =>
    new TokenExpiredError({ token, type, expiredAt }),
    
  twoFactorRequired: (userId: UserId) =>
    new TwoFactorRequiredError({ userId }),
    
  invalidTwoFactorCode: (userId: UserId) =>
    new InvalidTwoFactorCodeError({ userId }),
    
  twoFactorAlreadyEnabled: (userId: UserId) =>
    new TwoFactorAlreadyEnabledError({ userId }),
    
  twoFactorNotEnabled: (userId: UserId) =>
    new TwoFactorNotEnabledError({ userId }),
    
  sessionNotFound: (sessionId: string, userId?: UserId) =>
    new SessionNotFoundError({ sessionId, userId }),
    
  insufficientPermissions: (userId: UserId, requiredRole: string, currentRole: string) =>
    new InsufficientPermissionsError({ userId, requiredRole, currentRole }),
    
  rateLimitExceeded: (params: { 
    userId?: UserId; 
    action: string; 
    limit: number; 
    resetAt: string 
  }) => new RateLimitExceededError(params),
} as const;