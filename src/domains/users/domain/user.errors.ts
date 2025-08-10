/**
 * User Domain: Domain Errors
 * 
 * Errors that represent violations of business rules in the user domain.
 * These capture domain-specific error conditions.
 */

import { DomainError } from '../../../framework/core/errors';

/**
 * User already exists error - attempt to create a user that already exists
 */
export class UserAlreadyExistsError extends DomainError {
  constructor(identifier?: string) {
    super(`User already exists${identifier ? `: ${identifier}` : ''}`);
    this.name = 'UserAlreadyExistsError';
  }
}

/**
 * User not found error - attempt to access a user that doesn't exist
 */
export class UserNotFoundError extends DomainError {
  constructor(identifier?: string) {
    super(`User not found${identifier ? `: ${identifier}` : ''}`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Email already verified error - attempt to verify an already verified email
 */
export class EmailAlreadyVerifiedError extends DomainError {
  constructor() {
    super('Email address is already verified');
    this.name = 'EmailAlreadyVerifiedError';
  }
}

/**
 * Email not verified error - attempt to perform action requiring verified email
 */
export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super('Email address must be verified to perform this action');
    this.name = 'EmailNotVerifiedError';
  }
}

/**
 * Invalid email format error - email format is invalid
 */
export class InvalidEmailFormatError extends DomainError {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailFormatError';
  }
}

/**
 * User deleted error - attempt to modify a deleted user
 */
export class UserDeletedError extends DomainError {
  constructor() {
    super('Cannot perform operation on deleted user');
    this.name = 'UserDeletedError';
  }
}

/**
 * Invalid verification token error - verification token is invalid
 */
export class InvalidVerificationTokenError extends DomainError {
  constructor() {
    super('Invalid or expired verification token');
    this.name = 'InvalidVerificationTokenError';
  }
} 