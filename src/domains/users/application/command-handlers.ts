/**
 * User Domain: Command Handlers
 * 
 * Effect-based command handlers for the user domain.
 * Implements business logic with dependency injection and error handling.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import { 
  createCommandHandler,
  type EffectCommandHandler,
  type CommandContext,
  CommandValidationError,
  CommandExecutionError,
  withCommandRetry,
  withCommandCircuitBreaker,
  exponentialBackoff,
  type CommandError,
  type EffectRepository,
  type IAggregateBehavior,
  AggregateNotFoundError
} from '@cqrs/framework/effect';
import { UserAggregate } from '../core/aggregate';
import { Email, IPAddress, UserTypes, type UserId, type UserState, type Username } from '../core/types';
import * as Errors from '../core/errors';
import type {
  CreateUserCommand,
  UpdateUserCommand,
  DeleteUserCommand,
  SuspendUserCommand,
  VerifyEmailCommand,
  ChangePasswordCommand,
  UpdateProfileCommand,
  LoginCommand,
  ChangeRoleCommand,
  UserDomainCommand
} from './commands';
import { UserCommandType } from './commands';
import type { UserDomainEvent } from '../core/events';

/**
 * User command handler dependencies
 */
export interface UserCommandContext extends CommandContext {
  readonly passwordHasher: PasswordHasher;
  readonly emailService: EmailService;
  readonly sessionManager: SessionManager;
  readonly userRepository: UserRepository;
}

/**
 * Password hasher service
 */
export interface PasswordHasher {
  readonly hash: (password: string) => Effect.Effect<string, never, never>;
  readonly verify: (password: string, hash: string) => Effect.Effect<boolean, never, never>;
}

/**
 * Email service
 */
export interface EmailService {
  readonly sendVerificationEmail: (email: string, token: string) => Effect.Effect<void, never, never>;
  readonly sendPasswordResetEmail: (email: string, token: string) => Effect.Effect<void, never, never>;
}

/**
 * Session manager service
 */
export interface SessionManager {
  readonly createSession: (userId: string, metadata?: unknown) => Effect.Effect<string, never, never>;
  readonly revokeSession: (sessionId: string) => Effect.Effect<void, never, never>;
  readonly revokeAllSessions: (userId: string) => Effect.Effect<void, never, never>;
}

/**
 * User repository interface
 */
export interface UserRepository extends EffectRepository<UserState, UserDomainEvent, UserId, UserAggregate>  {
  readonly get: (id: UserId) => Effect.Effect<UserAggregate, AggregateNotFoundError, never>;
  readonly save: (aggregate: UserAggregate) => Effect.Effect<UserAggregate, never, never>;
  readonly findByEmail: (email: Email) => Effect.Effect<UserAggregate | null, never, never>;
  readonly findByUsername: (username: Username) => Effect.Effect<UserAggregate | null, never, never>;
}

/**
 * Context tags for dependency injection
 */
export const UserCommandContext = Context.GenericTag<UserCommandContext>('UserCommandContext');
export const PasswordHasherTag = Context.GenericTag<PasswordHasher>('PasswordHasher');
export const EmailServiceTag = Context.GenericTag<EmailService>('EmailService');
export const SessionManagerTag = Context.GenericTag<SessionManager>('SessionManager');
export const UserRepositoryTag = Context.GenericTag<UserRepository>('UserRepository');

/**
 * Create user command handler
 */
export const createUserHandler = createCommandHandler<CreateUserCommand, { userId: string }>({
  canHandle: (cmd) => cmd.type === UserCommandType.CREATE_USER,
  
  validate: (command) => Effect.gen(function* (_) {
    const { email, username, password } = command.payload;
    
    const errors: string[] = [];
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push('Invalid email format');
    }
    
    if (!username || username.length < 3 || username.length > 30) {
      errors.push('Username must be between 3 and 30 characters');
    }
    
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    
    if (errors.length > 0) {
      yield* _(Effect.fail(new CommandValidationError({ command, errors })));
    }
  }),
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { passwordHasher, emailService, userRepository } = context;
    
    // Check if user already exists
    const existingByEmail = yield* _(userRepository.findByEmail(UserTypes.email(command.payload.email)));
    if (existingByEmail) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.alreadyExists({ 
          email: UserTypes.email(command.payload.email) 
        })
      })));
    }
    
    const existingByUsername = yield* _(userRepository.findByUsername(UserTypes.username(command.payload.username)));
    if (existingByUsername) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.alreadyExists({ 
          username: UserTypes.username(command.payload.username) 
        })
      })));
    }
    
    // Hash password
    const passwordHash = yield* _(passwordHasher.hash(command.payload.password));
    const verificationToken = UserTypes.verificationToken(crypto.randomUUID());
    
    // Create aggregate
    const aggregate = UserAggregate.create(command.aggregateId);
    const createUser = aggregate.createUser.bind(aggregate);
    yield* _(createUser(
      command.payload,
      UserTypes.hashedPassword(passwordHash)
    ).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate));
    
    // Send verification email
    yield* _(emailService.sendVerificationEmail(
      command.payload.email,
      verificationToken
    ));
    
    return { userId: command.aggregateId as string };
  }),
  
  onSuccess: (result, command) => Effect.gen(function* (_) {
    yield* _(Effect.log(`User created successfully: ${result.userId}`));
  }),
  
  onError: (error, command) => Effect.gen(function* (_) {
    yield* _(Effect.logError(`Failed to create user: ${error._tag}`));
  })
});

/**
 * Update user command handler
 */
export const updateUserHandler = createCommandHandler<UpdateUserCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.UPDATE_USER,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Update user
    yield* _(aggregate!.updateUser(
      command.payload,
      command.metadata?.causedBy
    ).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
  })
});

/**
 * Delete user command handler
 */
export const deleteUserHandler = createCommandHandler<DeleteUserCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.DELETE_USER,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository, sessionManager } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Delete user
    yield* _(aggregate!.deleteUser(
      command.payload.deletedBy,
      command.payload.reason
    ).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
    
    // Revoke all sessions
    yield* _(sessionManager.revokeAllSessions(command.aggregateId));
  })
});

/**
 * Suspend user command handler
 */
export const suspendUserHandler = createCommandHandler<SuspendUserCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.SUSPEND_USER,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository, sessionManager } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Suspend user 
    yield* _(aggregate!.suspendUser(
      command.payload.suspendedBy,
      command.payload.reason,
      command.payload.suspendedUntil
    ).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
    
    // Revoke all sessions
    yield* _(sessionManager.revokeAllSessions(command.aggregateId));
  })
});

/**
 * Verify email command handler
 */
export const verifyEmailHandler = createCommandHandler<VerifyEmailCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.VERIFY_EMAIL,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Verify email
    yield* _(aggregate!.verifyEmail(command.payload.verificationToken).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
  })
});

/**
 * Change password command handler
 */
export const changePasswordHandler = createCommandHandler<ChangePasswordCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.CHANGE_PASSWORD,
  
  validate: (command) => Effect.gen(function* (_) {
    const { newPassword } = command.payload;
    
    if (!newPassword || newPassword.length < 8) {
      yield* _(Effect.fail(new CommandValidationError({
        command,
        errors: ['Password must be at least 8 characters']
      })));
    }
  }),
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository, passwordHasher, sessionManager } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate || !aggregate.state) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Verify current password
    const isValid = yield* _(passwordHasher.verify(
      command.payload.currentPassword,
      aggregate!.state!.security.passwordHash
    ));
    
    if (!isValid) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.invalidCredentials()
      })));
    }
    
    // Hash new password
    const newPasswordHash = yield* _(passwordHasher.hash(command.payload.newPassword));
    
    // Change password
    yield* _(aggregate!.changePassword(UserTypes.hashedPassword(newPasswordHash)).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
    
    // Revoke all sessions except current
    yield* _(sessionManager.revokeAllSessions(command.aggregateId));
  })
});

/**
 * Update profile command handler
 */
export const updateProfileHandler = createCommandHandler<UpdateProfileCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.UPDATE_PROFILE,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Update profile
    yield* _(aggregate!.updateProfile(command.payload).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
  })
});

/**
 * Login command handler with resilience patterns
 */
export const loginHandler = withRetry(
  createCommandHandler<LoginCommand, { sessionId: string; token: string }>({
    canHandle: (cmd) => cmd.type === UserCommandType.LOGIN,
    
    execute: (command) => Effect.gen(function* (_) {
      const context = yield* _(UserCommandContext);
      const { userRepository, passwordHasher, sessionManager } = context;
      
      // Find user by email or username
      let aggregate: UserAggregate | null = null;
      
      if (command.payload.email) {
        aggregate = yield* _(userRepository.findByEmail(UserTypes.email(command.payload.email)));
      } else if (command.payload.username) {
        aggregate = yield* _(userRepository.findByUsername(UserTypes.username(command.payload.username)));
      }
      
      if (!aggregate || !aggregate.state) {
        yield* _(Effect.fail(new CommandExecutionError({
          command,
          cause: Errors.UserErrors.invalidCredentials()
        })));
      }
      
      // Check if user can login
      if (aggregate && aggregate.state && UserGuards.isLocked(aggregate.state)) {
        yield* _(aggregate.recordLoginFailure(
          'ACCOUNT_LOCKED',
          command.metadata?.ipAddress || 'unknown' as IPAddress  
        ).pipe(
          Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
        ));
        yield* _(userRepository.save(aggregate));
        
        yield* _(Effect.fail(new CommandExecutionError({
          command,
          cause: Errors.UserErrors.locked(
            aggregate.id,
            aggregate.state.security.lockedUntil!,
            aggregate.state.security.loginAttempts
          )
        })));
      }
      
      // Verify password
      const isValid = yield* _(passwordHasher.verify(
        command.payload.password,
        aggregate!.state!.security.passwordHash
      ));
      
      if (!isValid) {
        yield* _(aggregate!.recordLoginFailure(
          'INVALID_CREDENTIALS',
          command.metadata?.ipAddress || 'unknown' as IPAddress
        ).pipe(
          Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
        ));
        yield* _(userRepository.save(aggregate!));
        
        yield* _(Effect.fail(new CommandExecutionError({
          command,
                      cause: Errors.UserErrors.invalidCredentials()
        })));
      }
      
      // Check two-factor if enabled
      if (aggregate && aggregate.state && UserGuards.hasTwoFactor(aggregate.state)) {
        if (!command.payload.twoFactorCode) {
          yield* _(Effect.fail(new CommandExecutionError({
            command,
            cause: Errors.UserErrors.twoFactorRequired(aggregate!.id)
          })));
        }
        // TODO: Verify two-factor code
      }
      
      // Create session
      const sessionId = yield* _(sessionManager.createSession(
        aggregate!.id,
        { rememberMe: command.payload.rememberMe }
      ));
      
      // Record successful login
      yield* _(aggregate!.recordLoginSuccess(
        UserTypes.sessionId(sessionId),
        command.metadata?.ipAddress || 'unknown' as IPAddress,
        command.metadata?.userAgent,
        !!command.payload.twoFactorCode
      ).pipe(
        Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
      ));
      
      // Save aggregate
      yield* _(userRepository.save(aggregate!));
      
      // Generate JWT token (simplified)
      const token = `jwt_${sessionId}_${Date.now()}`;
      
      return { sessionId, token };
    })
  }),
  exponentialBackoff({ maxAttempts: 3 })
);

/**
 * Change role command handler
 */
export const changeRoleHandler = createCommandHandler<ChangeRoleCommand, void>({
  canHandle: (cmd) => cmd.type === UserCommandType.CHANGE_ROLE,
  
  execute: (command) => Effect.gen(function* (_) {
    const context = yield* _(UserCommandContext);
    const { userRepository } = context;
    
    // Load aggregate
    const aggregate = yield* _(userRepository.get(command.aggregateId));
    if (!aggregate) {
      yield* _(Effect.fail(new CommandExecutionError({
        command,
        cause: Errors.UserErrors.notFound({ userId: command.aggregateId })
      })));
    }
    
    // Change role
    yield* _(aggregate!.changeRole(
      command.payload.newRole,
      command.payload.changedBy
    ).pipe(
      Effect.mapError(error => new CommandExecutionError({ command, cause: error }))
    ));
    
    // Save aggregate
    yield* _(userRepository.save(aggregate!));
  })
});

/**
 * Collection of all user command handlers
 */
export const userCommandHandlers = [
  createUserHandler as EffectCommandHandler<UserDomainCommand, any>,
  updateUserHandler as EffectCommandHandler<UserDomainCommand, any>,
  deleteUserHandler as EffectCommandHandler<UserDomainCommand, any>,
  suspendUserHandler as EffectCommandHandler<UserDomainCommand, any>,
  verifyEmailHandler as EffectCommandHandler<UserDomainCommand, any>,
  changePasswordHandler as EffectCommandHandler<UserDomainCommand, any>,
  updateProfileHandler as EffectCommandHandler<UserDomainCommand, any>,
  loginHandler as EffectCommandHandler<UserDomainCommand, any>,
  changeRoleHandler as EffectCommandHandler<UserDomainCommand, any>
];

import { UserGuards } from '../core/types';
import { withRetry } from '@cqrs/framework/effect/core/command-effects';

