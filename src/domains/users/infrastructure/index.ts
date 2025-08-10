/**
 * Infrastructure Layer
 * 
 * Exports all infrastructure components for the user domain.
 * Technical implementations that support domain operations.
 */

// Persistence
export { UserRepository, createUserRepository } from './persistence/user.repository';

// Projections
export * from './projections';

// Validation
export {
  CreateUserCommandValidator,
  UpdateUserCommandValidator,
  createCreateUserValidator,
  createUpdateUserValidator,
} from './validation/command.validators';

// Event Handling
export {
  ProjectionEventHandler,
  EmailNotificationHandler,
  registerUserEventHandlers,
} from './events/event.handlers'; 