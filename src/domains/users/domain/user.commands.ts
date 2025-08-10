/**
 * User Domain: Domain Commands
 * 
 * Commands represent intentions to change user state.
 * These are the business operations that can be performed on users.
 */

import type { ICommand } from '../../../framework/core/command';
import type {
  CreateUserData,
  UpdateUserData,
  DeleteUserData,
  VerifyEmailData,
  UpdateProfileData,
  ChangePasswordData,
} from './user.types';

/**
 * User command types - string literals for better type safety
 */
export const UserCommandTypes = {
  CreateUser: 'CREATE_USER',
  UpdateUser: 'UPDATE_USER',
  DeleteUser: 'DELETE_USER',
  VerifyUserEmail: 'VERIFY_USER_EMAIL',
  ChangeUserPassword: 'CHANGE_USER_PASSWORD',
  UpdateUserProfile: 'UPDATE_USER_PROFILE',
} as const;

export type UserCommandType = typeof UserCommandTypes[keyof typeof UserCommandTypes];

/**
 * Create user command - register a new user in the system
 */
export interface CreateUserCommand extends ICommand<
  typeof UserCommandTypes.CreateUser,
  CreateUserData
> {}

/**
 * Update user command - modify basic user information
 */
export interface UpdateUserCommand extends ICommand<
  typeof UserCommandTypes.UpdateUser,
  UpdateUserData
> {}

/**
 * Delete user command - remove user from the system
 */
export interface DeleteUserCommand extends ICommand<
  typeof UserCommandTypes.DeleteUser,
  DeleteUserData
> {}

/**
 * Verify user email command - confirm user's email address
 */
export interface VerifyUserEmailCommand extends ICommand<
  typeof UserCommandTypes.VerifyUserEmail,
  VerifyEmailData
> {}

/**
 * Change user password command - update user's password
 */
export interface ChangeUserPasswordCommand extends ICommand<
  typeof UserCommandTypes.ChangeUserPassword,
  ChangePasswordData
> {}

/**
 * Update user profile command - modify user's profile information
 */
export interface UpdateUserProfileCommand extends ICommand<
  typeof UserCommandTypes.UpdateUserProfile,
  UpdateProfileData
> {}

/**
 * Union type of all user commands
 */
export type UserCommand =
  | CreateUserCommand
  | UpdateUserCommand
  | DeleteUserCommand
  | VerifyUserEmailCommand
  | ChangeUserPasswordCommand
  | UpdateUserProfileCommand; 