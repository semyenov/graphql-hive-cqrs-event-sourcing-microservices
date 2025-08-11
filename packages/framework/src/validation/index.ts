/**
 * Framework Validation Module
 * 
 * Runtime validation with Zod for commands, events, and domain models.
 * Provides type-safe validation with automatic TypeScript type inference.
 */

// Core schemas
export * from './schemas';

// Validators
export * from './validators';

// Decorators for class-based validation
export * from './decorators';

// Type utilities and inference
export * from './types';

// Re-export Zod for convenience
export { z } from 'zod';
export type { ZodError, ZodIssue, ZodSchema } from 'zod';

/**
 * Quick start guide for validation:
 * 
 * 1. Define schemas:
 * ```typescript
 * import { z, createCommandSchema } from '@cqrs/framework/validation';
 * 
 * const CreateUserSchema = createCommandSchema({
 *   type: z.literal('CREATE_USER'),
 *   payload: z.object({
 *     email: z.string().email(),
 *     username: z.string().min(3).max(20),
 *     password: z.string().min(8),
 *   }),
 * });
 * ```
 * 
 * 2. Use validation middleware:
 * ```typescript
 * import { withValidation } from '@cqrs/framework/validation';
 * 
 * const handler = withValidation(
 *   CreateUserSchema,
 *   async (command) => {
 *     // Command is validated and typed
 *     return createUser(command.payload);
 *   }
 * );
 * ```
 * 
 * 3. Use decorators:
 * ```typescript
 * import { Validate } from '@cqrs/framework/validation';
 * 
 * class UserCommandHandler {
 *   @Validate(CreateUserSchema)
 *   async handleCreateUser(command: CreateUserCommand) {
 *     // Command is automatically validated
 *   }
 * }
 * ```
 */