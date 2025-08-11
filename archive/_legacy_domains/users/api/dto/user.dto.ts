/**
 * API Layer: User Data Transfer Objects
 * 
 * DTOs for converting between domain models and API representations.
 * Provides clean separation between internal domain types and external API contracts.
 */

import type { UserState, UserProfile } from '../../domain/user.types';
import type { UserListItem } from '../../infrastructure/projections/user-list.projection';
import type { UserStats } from '../../infrastructure/projections/user-stats.projection';

/**
 * User DTO for API responses
 */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfileDTO;
}

/**
 * User profile DTO
 */
export interface UserProfileDTO {
  bio?: string;
  avatar?: string;
  location?: string;
}

/**
 * User list item DTO
 */
export interface UserListItemDTO {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  deleted: boolean;
  createdAt: string;
}

/**
 * User statistics DTO
 */
export interface UserStatsDTO {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  verifiedEmails: number;
  createdToday: number;
  lastActivity: string;
}

/**
 * Users list result DTO
 */
export interface UsersResultDTO {
  users: UserDTO[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Command result DTO
 */
export interface CommandResultDTO {
  success: boolean;
  message?: string;
  userId?: string;
}

/**
 * Pagination input DTO
 */
export interface PaginationInputDTO {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Create user input DTO
 */
export interface CreateUserInputDTO {
  name: string;
  email: string;
}

/**
 * Update user input DTO
 */
export interface UpdateUserInputDTO {
  name?: string;
  email?: string;
}

/**
 * Update profile input DTO
 */
export interface UpdateUserProfileInputDTO {
  bio?: string;
  avatar?: string;
  location?: string;
}

/**
 * Change password input DTO
 */
export interface ChangePasswordInputDTO {
  newPassword: string;
}

/**
 * Delete user input DTO
 */
export interface DeleteUserInputDTO {
  reason?: string;
}

/**
 * Mapper functions to convert between domain models and DTOs
 */
export class UserDTOMapper {
  /**
   * Convert UserState to UserDTO
   */
  static toUserDTO(userState: UserState): UserDTO {
    return {
      id: userState.id,
      name: userState.name,
      email: userState.email,
      emailVerified: userState.emailVerified,
      deleted: userState.deleted,
      createdAt: userState.createdAt,
      updatedAt: userState.updatedAt,
      profile: userState.profile ? this.toUserProfileDTO(userState.profile) : undefined,
    };
  }

  /**
   * Convert UserProfile to UserProfileDTO
   */
  static toUserProfileDTO(profile: UserProfile): UserProfileDTO {
    return {
      bio: profile.bio,
      avatar: profile.avatar,
      location: profile.location,
    };
  }

  /**
   * Convert UserListItem to UserListItemDTO
   */
  static toUserListItemDTO(item: UserListItem): UserListItemDTO {
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      emailVerified: item.emailVerified,
      deleted: item.deleted,
      createdAt: item.createdAt,
    };
  }

  /**
   * Convert UserStats to UserStatsDTO
   */
  static toUserStatsDTO(stats: UserStats): UserStatsDTO {
    return {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      deletedUsers: stats.deletedUsers,
      verifiedEmails: stats.verifiedEmails,
      createdToday: stats.createdToday,
      lastActivity: stats.lastActivity,
    };
  }

  /**
   * Create success command result
   */
  static createSuccessResult(userId?: string, message?: string): CommandResultDTO {
    return {
      success: true,
      userId,
      message,
    };
  }

  /**
   * Create error command result
   */
  static createErrorResult(message: string): CommandResultDTO {
    return {
      success: false,
      message,
    };
  }
} 