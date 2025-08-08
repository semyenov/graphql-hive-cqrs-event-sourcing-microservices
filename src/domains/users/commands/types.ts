/**
 * User Domain: Command Types
 * 
 * Commands for the User domain.
 */

import type { ICommand, IAggregateCommand } from '../../../framework/core/command';
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
export interface CreateUserCommand extends IAggregateCommand<
  UserCommandTypes.CreateUser,
  {
    name: string;
    email: string;
  },
  AggregateId
> {}

/**
 * Update user command
 */
export interface UpdateUserCommand extends IAggregateCommand<
  UserCommandTypes.UpdateUser,
  {
    name?: string;
    email?: string;
  },
  AggregateId
> {}

/**
 * Delete user command
 */
export interface DeleteUserCommand extends IAggregateCommand<
  UserCommandTypes.DeleteUser,
  {
    reason?: string;
  },
  AggregateId
> {}

/**
 * Verify user email command
 */
export interface VerifyUserEmailCommand extends IAggregateCommand<
  UserCommandTypes.VerifyUserEmail,
  {
    verificationToken: string;
  },
  AggregateId
> {}

/**
 * Change user password command
 */
export interface ChangeUserPasswordCommand extends IAggregateCommand<
  UserCommandTypes.ChangeUserPassword,
  {
    currentPassword: string;
    newPassword: string;
  },
  AggregateId
> {}

/**
 * Update user profile command
 */
export interface UpdateUserProfileCommand extends IAggregateCommand<
  UserCommandTypes.UpdateUserProfile,
  {
    bio?: string;
    avatar?: string;
    location?: string;
  },
  AggregateId
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