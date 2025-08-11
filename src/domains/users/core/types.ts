/**
 * User Domain: Core Types
 * 
 * Domain types and value objects for the user domain using Effect-TS.
 * All types are immutable and use branded types for type safety.
 */

import * as Brand from 'effect/Brand';
import { BrandedTypes } from '@cqrs/framework';
import type { AggregateId, AggregateVersion, Timestamp } from '@cqrs/framework';

/**
 * User domain branded types for compile-time safety
 */
export type UserId = AggregateId;
export const UserId = Brand.refined<UserId>(
  (id) => {
    return id.length > 0;
  },
  (id) => Brand.error(`Invalid user ID: ${id}`)
);

// Email type with validation
export type Email = Brand.Branded<string, 'Email'>;
export const Email = Brand.refined<Email>(
  (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  (email) => Brand.error(`Invalid email format: ${email}`)
);

// Username type with validation
export type Username = Brand.Branded<string, 'Username'>;
export const Username = Brand.refined<Username>(
  (username) => {
    const isValid = username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username);
    return isValid;
  },
  (username) => Brand.error(`Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens: ${username}`)
);

// HashedPassword type
export type HashedPassword = Brand.Branded<string, 'HashedPassword'>;
export const HashedPassword = Brand.refined<HashedPassword>(
  (hash) => {
    return hash.length > 0;
  },
  (hash) => Brand.error(`Invalid password hash: ${hash}`)
);

// VerificationToken type
export type VerificationToken = Brand.Branded<string, 'VerificationToken'>;
export const VerificationToken = Brand.refined<VerificationToken>(
  (token) => {
    return token.length > 0;
  },
  (token) => Brand.error(`Invalid verification token: ${token}`)
);

// ResetToken type
export type ResetToken = Brand.Branded<string, 'ResetToken'>;
export const ResetToken = Brand.refined<ResetToken>(
  (token) => {
    return token.length > 0;
  },
  (token) => Brand.error(`Invalid reset token: ${token}`)
);

// SessionId type
export type SessionId = Brand.Branded<string, 'SessionId'>;
export const SessionId = Brand.refined<SessionId>(
  (id) => {
    return id.length > 0;
  },
  (id) => Brand.error(`Invalid session ID: ${id}`)
);

// IPAddress type with validation
export type IPAddress = Brand.Branded<string, 'IPAddress'>;
export const IPAddress = Brand.refined<IPAddress>(
  (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return (ipv4Regex.test(ip) || ipv6Regex.test(ip));
  },
  (ip) => Brand.error(`Invalid IP address format: ${ip}`)
);

/**
 * User status enum
 */
export enum UserStatus {
  PENDING = 'PENDING',           // Awaiting email verification
  ACTIVE = 'ACTIVE',             // Verified and active
  SUSPENDED = 'SUSPENDED',       // Temporarily suspended
  DEACTIVATED = 'DEACTIVATED',  // Self-deactivated
  DELETED = 'DELETED'            // Soft deleted
}

/**
 * User role enum
 */
export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

/**
 * User preferences
 */
export interface UserPreferences {
  readonly theme: 'light' | 'dark' | 'system';
  readonly language: string;
  readonly timezone: string;
  readonly emailNotifications: boolean;
  readonly pushNotifications: boolean;
  readonly twoFactorEnabled: boolean;
}

/**
 * User profile information
 */
export interface UserProfile {
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly location?: string;
  readonly website?: string;
  readonly socialLinks?: {
    readonly twitter?: string;
    readonly github?: string;
    readonly linkedin?: string;
  };
}

/**
 * User security information
 */
export interface UserSecurity {
  readonly passwordHash: HashedPassword;
  readonly passwordChangedAt?: Timestamp;
  readonly twoFactorSecret?: VerificationToken;
  readonly twoFactorBackupCodes?: readonly VerificationToken[];
  readonly loginAttempts: number;
  readonly lockedUntil?: Timestamp;
  readonly lastLoginAt?: Timestamp;
  readonly lastLoginIp?: IPAddress;
  readonly sessions: readonly SessionId[];
}

/**
 * User metadata
 */
export interface UserMetadata {
  readonly tags: readonly string[];
  readonly customFields?: Record<string, unknown>;
  readonly source?: 'SIGNUP' | 'OAUTH' | 'IMPORT' | 'ADMIN';
  readonly referralCode?: string;
  readonly referredBy?: UserId;
}

/**
 * Main user state representation
 */
export interface UserState {
  readonly id: UserId;
  readonly email: Email;
  readonly username: Username;
  readonly status: UserStatus;
  readonly role: UserRole;
  readonly profile: UserProfile;
  readonly preferences: UserPreferences;
  readonly security: UserSecurity;
  readonly metadata: UserMetadata;
  readonly emailVerified: boolean;
  readonly emailVerifiedAt?: Timestamp;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly version: AggregateVersion;
}

/**
 * User creation input
 */
export interface CreateUserInput {
  readonly email: string;
  readonly username: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName?: string;
  readonly source?: UserMetadata['source'];
  readonly referralCode?: string;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  readonly email?: string;
  readonly username?: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
}

/**
 * Profile update input
 */
export interface UpdateProfileInput {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly location?: string;
  readonly website?: string;
  readonly socialLinks?: UserProfile['socialLinks'];
}

/**
 * Preferences update input
 */
export interface UpdatePreferencesInput {
  readonly theme?: UserPreferences['theme'];
  readonly language?: string;
  readonly timezone?: string;
  readonly emailNotifications?: boolean;
  readonly pushNotifications?: boolean;
}

/**
 * Password change input
 */
export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Password reset input
 */
export interface ResetPasswordInput {
  readonly token: ResetToken;
  readonly newPassword: string;
}

/**
 * Two-factor setup input
 */
export interface SetupTwoFactorInput {
  readonly secret: string;
  readonly verificationCode: string;
}

/**
 * Factory functions for creating domain types
 */
export const UserTypes = {
  userId: (id: string): UserId => BrandedTypes.aggregateId<UserId>(id),
  email: (email: string): Email => Email(email.toLowerCase()),
  username: (username: string): Username => Username(username.toLowerCase()),
  hashedPassword: (hash: string): HashedPassword => HashedPassword(hash),
  verificationToken: (token: string): VerificationToken => VerificationToken(token),
  resetToken: (token: string): ResetToken => ResetToken(token),
  sessionId: (id: string): SessionId => SessionId(id),
  
  createDefaultPreferences: (): UserPreferences => ({
    theme: 'system' as UserPreferences['theme'],
    language: 'en',
    timezone: 'UTC',
    emailNotifications: true as UserPreferences['emailNotifications'],
    pushNotifications: false as UserPreferences['pushNotifications'],
    twoFactorEnabled: false as UserPreferences['twoFactorEnabled']
  }),
  
  createDefaultSecurity: (passwordHash: HashedPassword): UserSecurity => ({
    passwordHash,
    loginAttempts: 0,
    lastLoginAt: undefined,
    lastLoginIp: undefined, 
    passwordChangedAt: undefined,
    twoFactorSecret: undefined,
    twoFactorBackupCodes: undefined,
    sessions: []
  }),
  
  createDefaultMetadata: (source?: UserMetadata['source']): UserMetadata => ({
    tags: [],
    source: source || 'SIGNUP'
  })
} as const;

/**
 * Type guards
 */
export const UserGuards = {
  isActive: (user: UserState): boolean => user.status === UserStatus.ACTIVE,
  isPending: (user: UserState): boolean => user.status === UserStatus.PENDING,
  isSuspended: (user: UserState): boolean => user.status === UserStatus.SUSPENDED,
  isDeleted: (user: UserState): boolean => user.status === UserStatus.DELETED,
  isVerified: (user: UserState): boolean => user.emailVerified,
  canLogin: (user: UserState): boolean => 
    (user.status === UserStatus.ACTIVE || user.status === UserStatus.PENDING) && 
    !user.security.lockedUntil,
  isLocked: (user: UserState): boolean => 
    !!user.security.lockedUntil && new Date(user.security.lockedUntil) > new Date(),
  hasTwoFactor: (user: UserState): boolean => user.preferences.twoFactorEnabled,
  isAdmin: (user: UserState): boolean => 
    user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN,
} as const;