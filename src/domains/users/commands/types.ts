/**
 * User Domain: Command Types
 * 
 * Commands for the User domain.
 */

import type { ICommand } from '../../../framework/core/command';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * User command types enum
 */
export enum UserCommandTypes {
  CreateUser = 'CREATE_USER',
  UpdateUser = 'UPDATE_USER',
  DeleteUser = 'DELETE_USER',
  VerifyUserEmail = 'VERIFY_USER_EMAIL',
  ChangeUserPassword = 'CHANGE_USER_PASSWORD',
  UpdateUserProfile = 'UPDATE_USER_PROFILE',
}

/**
 * Create user command
 */
export interface CreateUserCommand extends ICommand<
  UserCommandTypes.CreateUser,
  {
    name: string;
    email: string;
  }
> {}

/**
 * Update user command
 */
export interface UpdateUserCommand extends ICommand<
  UserCommandTypes.UpdateUser,
  {
    name?: string;
    email?: string;
  }
> {}

/**
 * Delete user command
 */
export interface DeleteUserCommand extends ICommand<
  UserCommandTypes.DeleteUser,
  {
    reason?: string;
  }
> {}

/**
 * Verify user email command
 */
export interface VerifyUserEmailCommand extends ICommand<
  UserCommandTypes.VerifyUserEmail,
  {
    verificationToken: string;
  }
> {}

/**
 * Change user password command
 */
export interface ChangeUserPasswordCommand extends ICommand<
  UserCommandTypes.ChangeUserPassword,
  {
    currentPassword: string;
    newPassword: string;
  }
> {}

/**
 * Update user profile command
 */
export interface UpdateUserProfileCommand extends ICommand<
  UserCommandTypes.UpdateUserProfile,
  {
    bio?: string;
    avatar?: string;
    location?: string;
  }
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