/**
 * User Domain: Domain Types
 * 
 * Core domain types and value objects for the user domain.
 * These represent the fundamental concepts in the user domain.
 */

import type { Brand } from '@cqrs/framework/core/branded/types';

/**
 * User domain branded types for type safety
 */
export type UserId = Brand<string, 'UserId'>;
export type Email = Brand<string, 'Email'>;
export type PersonName = Brand<string, 'PersonName'>;
export type PhoneNumber = Brand<string, 'PhoneNumber'>;

/**
 * User profile information
 */
export interface UserProfile {
  readonly bio?: string;
  readonly avatar?: string;
  readonly location?: string;
}

/**
 * User entity state representation
 */
export interface UserState {
  readonly id: string;
  readonly name: PersonName;
  readonly email: Email;
  readonly emailVerified: boolean;
  readonly deleted: boolean;
  readonly profile?: UserProfile;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * User creation data
 */
export interface CreateUserData {
  readonly name: string;
  readonly email: string;
}

/**
 * User update data
 */
export interface UpdateUserData {
  readonly name?: string;
  readonly email?: string;
}

/**
 * User deletion data
 */
export interface DeleteUserData {
  readonly reason?: string;
}

/**
 * Email verification data
 */
export interface VerifyEmailData {
  readonly verificationToken?: string;
}

/**
 * Profile update data
 */
export interface UpdateProfileData {
  readonly bio?: string;
  readonly avatar?: string;
  readonly location?: string;
}

/**
 * Password change data
 */
export interface ChangePasswordData {
  readonly newPassword: string;
} 