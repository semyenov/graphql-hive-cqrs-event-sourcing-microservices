/**
 * Application Layer: Command Handlers
 * 
 * Exports all command handlers for the user domain.
 * Each handler represents a specific business use case.
 */

export { createUserHandler } from './create-user.handler';
export { updateUserHandler } from './update-user.handler';
export { deleteUserHandler } from './delete-user.handler';
export { verifyEmailHandler } from './verify-email.handler';
export { updateProfileHandler } from './update-profile.handler';
export { changePasswordHandler } from './change-password.handler'; 