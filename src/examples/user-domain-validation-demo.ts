/**
 * User Domain Validation Demo
 * 
 * Demonstrates validation patterns for a user domain using the framework's
 * validation utilities including:
 * - Command validation with Zod schemas
 * - Event validation
 * - Domain invariants
 * - Value objects
 * - Validation composition
 * - Error handling
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  // Core imports
  type ICommand,
  type IEvent,
  type IAggregate,
  
  // Validation imports
  BaseCommandSchema,
  BaseEventSchema,
  ValidatedCommand,
  ValidatedEvent,
  validateCommand,
  validateEvent,
  createValidationMiddleware,
  createCommandValidator,
  createEventValidator,
  ValidationError,
  
  // Domain modeling imports
  type AggregateId,
  type CommandId,
  type EventId,
  type AggregateVersion,
  type EventName,
  type ValueObject,
  type Entity,
  Result,
  
  // Branded types
  BrandedTypes,
  BrandedTypeGuards,
} from '@cqrs/framework';

// ============================================================================
// Domain Types with Value Objects
// ============================================================================

type UserRole = 'admin' | 'user' | 'moderator';
type UserStatus = 'active' | 'suspended' | 'deleted';

// Value objects using framework utilities
type UserEmail = ValueObject<'UserEmail', string>;
type UserName = ValueObject<'UserName', string>;

const UserEmail = {
  of: (value: string): UserEmail => {
    if (!value.includes('@')) {
      throw new Error('Invalid email format');
    }
    return { __brand: 'UserEmail', __valueObject: true, value } as any;
  },
};

const UserName = {
  of: (value: string): UserName => {
    if (value.length < 2 || value.length > 50) {
      throw new Error('User name must be between 2 and 50 characters');
    }
    return { __brand: 'UserName', __valueObject: true, value } as any;
  },
};

// ============================================================================
// Command Schemas with Zod
// ============================================================================

const CreateUserCommandSchema = BaseCommandSchema.extend({
  type: z.literal('CREATE_USER'),
  payload: z.object({
    email: z.string().email(),
    name: z.string().min(2).max(50),
    role: z.enum(['admin', 'user', 'moderator']),
    metadata: z.object({
      ipAddress: z.string().ip().optional(),
      userAgent: z.string().optional(),
    }).optional(),
  }),
});

const UpdateUserCommandSchema = BaseCommandSchema.extend({
  type: z.literal('UPDATE_USER'),
  payload: z.object({
    name: z.string().min(2).max(50).optional(),
    email: z.string().email().optional(),
    role: z.enum(['admin', 'user', 'moderator']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});

const DeleteUserCommandSchema = BaseCommandSchema.extend({
  type: z.literal('DELETE_USER'),
  payload: z.object({
    reason: z.string(),
    permanentDelete: z.boolean().default(false),
  }),
});

// Union of all command schemas
const UserCommandSchema = z.discriminatedUnion('type', [
  CreateUserCommandSchema,
  UpdateUserCommandSchema,
  DeleteUserCommandSchema,
]);

// Type inference from schemas
type CreateUserCommand = z.infer<typeof CreateUserCommandSchema>;
type UpdateUserCommand = z.infer<typeof UpdateUserCommandSchema>;
type DeleteUserCommand = z.infer<typeof DeleteUserCommandSchema>;
type UserCommand = z.infer<typeof UserCommandSchema>;

// ============================================================================
// Event Schemas
// ============================================================================

const UserCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_CREATED'),
  data: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'moderator']),
    createdAt: z.date(),
  }),
});

const UserUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_UPDATED'),
  data: z.object({
    changes: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(['admin', 'user', 'moderator']).optional(),
      status: z.enum(['active', 'suspended']).optional(),
    }),
    updatedAt: z.date(),
  }),
});

const UserDeletedEventSchema = BaseEventSchema.extend({
  type: z.literal('USER_DELETED'),
  data: z.object({
    reason: z.string(),
    permanentDelete: z.boolean(),
    deletedAt: z.date(),
  }),
});

// Union of all event schemas
const UserEventSchema = z.discriminatedUnion('type', [
  UserCreatedEventSchema,
  UserUpdatedEventSchema,
  UserDeletedEventSchema,
]);

// Type inference from schemas
type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;
type UserUpdatedEvent = z.infer<typeof UserUpdatedEventSchema>;
type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;
type UserEvent = z.infer<typeof UserEventSchema>;

// ============================================================================
// Command Handlers with Validation
// ============================================================================

const createUserHandler = (command: ValidatedCommand<CreateUserCommand>): UserCreatedEvent => {
  // Command is already validated, safe to use
  return {
    type: 'USER_CREATED',
    data: {
      name: command.payload.name,
      email: command.payload.email,
      role: command.payload.role,
      createdAt: new Date(),
    },
    aggregateId: command.aggregateId,
    id: BrandedTypes.eventId(randomUUID()),
    aggregateVersion: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(),
  };
};

const updateUserHandler = (command: ValidatedCommand<UpdateUserCommand>): UserUpdatedEvent => {
  const changes: any = {};
  
  if (command.payload.name) changes.name = command.payload.name;
  if (command.payload.email) changes.email = command.payload.email;
  if (command.payload.role) changes.role = command.payload.role;
  if (command.payload.status) changes.status = command.payload.status;
  
  return {
    type: 'USER_UPDATED',
    data: {
      changes,
      updatedAt: new Date(),
    },
    aggregateId: command.aggregateId,
    id: BrandedTypes.eventId(randomUUID()),
    aggregateVersion: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(),
  };
};

const deleteUserHandler = (command: ValidatedCommand<DeleteUserCommand>): UserDeletedEvent => {
  return {
    type: 'USER_DELETED',
    data: {
      reason: command.payload.reason,
      permanentDelete: command.payload.permanentDelete,
      deletedAt: new Date(),
    },
    aggregateId: command.aggregateId,
    id: BrandedTypes.eventId(randomUUID()),
    aggregateVersion: BrandedTypes.aggregateVersion(1),
    timestamp: BrandedTypes.timestamp(),
  };
};

// ============================================================================
// Command Router with Validation
// ============================================================================

const commandValidators = {
  CREATE_USER: createCommandValidator(CreateUserCommandSchema),
  UPDATE_USER: createCommandValidator(UpdateUserCommandSchema),
  DELETE_USER: createCommandValidator(DeleteUserCommandSchema),
};

const commandRouter = async (command: UserCommand): Promise<Result<UserEvent, ValidationError>> => {
  // Validate command based on type
  const validator = commandValidators[command.type as keyof typeof commandValidators];
  if (!validator) {
    return Result.err(new ValidationError(`Unknown command type: ${command.type}`));
  }
  
  const validationResult = await validator(command);
  if (Result.isErr(validationResult)) {
    return validationResult;
  }
  
  // Route to appropriate handler
  switch (command.type) {
    case 'CREATE_USER':
      return Result.ok(createUserHandler(validationResult.value as ValidatedCommand<CreateUserCommand>));
    case 'UPDATE_USER':
      return Result.ok(updateUserHandler(validationResult.value as ValidatedCommand<UpdateUserCommand>));
    case 'DELETE_USER':
      return Result.ok(deleteUserHandler(validationResult.value as ValidatedCommand<DeleteUserCommand>));
    default:
      return Result.err(new ValidationError(`Unhandled command type: ${command.type}`));
  }
};

// ============================================================================
// Event Validation and Processing
// ============================================================================

const eventValidators = {
  USER_CREATED: createEventValidator(UserCreatedEventSchema),
  USER_UPDATED: createEventValidator(UserUpdatedEventSchema),
  USER_DELETED: createEventValidator(UserDeletedEventSchema),
};

const eventRouter = async (event: UserEvent): Promise<void> => {
  // Validate event
  const validator = eventValidators[event.type as keyof typeof eventValidators];
  if (!validator) {
    throw new ValidationError(`Unknown event type: ${event.type}`);
  }
  
  const validationResult = await validator(event);
  if (Result.isErr(validationResult)) {
    throw validationResult.error;
  }
  
  // Process validated event
  switch (event.type) {
    case 'USER_CREATED':
      console.log('📧 Sending welcome email to:', (event as UserCreatedEvent).data.email);
      break;
    case 'USER_UPDATED':
      console.log('📝 User updated with changes:', (event as UserUpdatedEvent).data.changes);
      break;
    case 'USER_DELETED':
      console.log('🗑️ User deleted:', (event as UserDeletedEvent).data.reason);
      break;
  }
};

// ============================================================================
// Domain Aggregate with Validation
// ============================================================================

type UserState = {
  id: AggregateId;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  version: AggregateVersion;
};

type UserId = AggregateId & { __brand: 'UserId' };

// User entity
type UserEntity = Entity<'User', UserId, {
  name: UserName;
  email: UserEmail;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}>;

// Maybe type definition for Option-like behavior
type Maybe<T> = T | null | undefined;

const Maybe = {
  of: <T>(value: T | null | undefined): Maybe<T> => value,
  map: <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> => {
    if (maybe === null || maybe === undefined) return null;
    return fn(maybe);
  },
  flatMap: <T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U> => {
    if (maybe === null || maybe === undefined) return null;
    return fn(maybe);
  },
  getOrElse: <T>(maybe: Maybe<T>, defaultValue: T): T => {
    if (maybe === null || maybe === undefined) return defaultValue;
    return maybe;
  },
  isNone: <T>(maybe: Maybe<T>): maybe is null | undefined => {
    return maybe === null || maybe === undefined;
  },
  isSome: <T>(maybe: Maybe<T>): maybe is T => {
    return maybe !== null && maybe !== undefined;
  },
};

const userReducer = (state: UserState | null, event: UserEvent): UserState => {
  switch (event.type) {
    case 'USER_CREATED':
      return {
        id: event.aggregateId,
        name: event.data.name,
        email: event.data.email,
        role: event.data.role,
        status: 'active',
        createdAt: event.data.createdAt,
        updatedAt: event.data.createdAt,
        version: event.aggregateVersion,
      };
      
    case 'USER_UPDATED':
      if (!state) throw new Error('Cannot update non-existent user');
      return {
        ...state,
        ...event.data.changes,
        updatedAt: event.data.updatedAt,
        version: event.aggregateVersion,
      };
      
    case 'USER_DELETED':
      if (!state) throw new Error('Cannot delete non-existent user');
      return {
        ...state,
        status: 'deleted',
        updatedAt: event.data.deletedAt,
        version: event.aggregateVersion,
      };
      
    default:
      return state || {} as UserState;
  }
};

// ============================================================================
// Validation Middleware
// ============================================================================

const userCommandMiddleware = createValidationMiddleware({
  validateCommand: async (command: ICommand) => {
    try {
      const parsed = UserCommandSchema.parse(command);
      return Result.ok(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Result.err(new ValidationError('Command validation failed', error.errors));
      }
      return Result.err(new ValidationError('Unknown validation error'));
    }
  },
  
  validateDomainRules: async (command: ICommand) => {
    // Example domain rules
    if (command.type === 'DELETE_USER') {
      // Check if user exists, has no active subscriptions, etc.
      console.log('🔍 Checking domain rules for user deletion');
    }
    return Result.ok(undefined);
  },
});

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('🚀 User Domain Validation Demo\n');
  console.log('=' .repeat(60));
  
  // Test 1: Valid CREATE_USER command
  console.log('\n📌 Test 1: Valid CREATE_USER command');
  const validCommand: CreateUserCommand = {
    type: 'CREATE_USER',
    aggregateId: BrandedTypes.aggregateId(randomUUID()),
    id: BrandedTypes.commandId(randomUUID()),
    timestamp: BrandedTypes.timestamp(),
    payload: {
      email: 'john.doe@example.com',
      name: 'John Doe',
      role: 'user',
      metadata: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    },
    metadata: {
      userId: BrandedTypes.aggregateId(randomUUID()) as any,
      timestamp: BrandedTypes.timestamp(),
      correlationId: BrandedTypes.correlationId(randomUUID()),
    },
  };
  
  try {
    const result1 = await commandRouter(validCommand);
    if (Result.isOk(result1)) {
      console.log('✅ Command executed successfully');
      console.log('Generated event:', result1.value);
      
      // Apply event to state
      const newState = userReducer(null, result1.value);
      console.log('New state:', newState);
      
      // Trigger side effects
      await eventRouter(result1.value);
    }
  } catch (error: any) {
    console.log('❌ Command failed:', error.message);
    if (error.issues) {
      console.log('Validation issues:', error.issues);
    }
  }
  
  // Test 2: Invalid command (validation failure)
  console.log('\n📌 Test 2: Invalid CREATE_USER command (bad email)');
  const invalidCommand: any = {
    type: 'CREATE_USER',
    aggregateId: BrandedTypes.aggregateId(randomUUID()),
    id: BrandedTypes.commandId(randomUUID()),
    timestamp: BrandedTypes.timestamp(),
    payload: {
      email: 'not-an-email',
      name: 'J', // Too short
      role: 'superadmin', // Invalid role
    },
  };
  
  const result2 = await commandRouter(invalidCommand);
  if (Result.isErr(result2)) {
    console.log('❌ Validation failed as expected');
    console.log('Error:', Result.getError(result2).message);
    const error = Result.getError(result2);
    if (error.details) {
      console.log('Details:', error.details);
    }
  }
  
  // Test 3: UPDATE_USER command
  console.log('\n📌 Test 3: UPDATE_USER command');
  const updateCommand: UpdateUserCommand = {
    type: 'UPDATE_USER',
    aggregateId: validCommand.aggregateId,
    timestamp: BrandedTypes.timestamp(),
    payload: {
      name: 'John Smith',
      role: 'admin',
    },
  };
  
  const result3 = await commandRouter(updateCommand);
  if (Result.isOk(result3)) {
    console.log('✅ Update command executed');
    console.log('Update event:', result3.value);
    await eventRouter(result3.value);
  }
  
  // Test 4: DELETE_USER command with middleware
  console.log('\n📌 Test 4: DELETE_USER command with middleware');
  const deleteCommand: DeleteUserCommand = {
    type: 'DELETE_USER',
    aggregateId: validCommand.aggregateId,
    timestamp: BrandedTypes.timestamp(),
    payload: {
      reason: 'User requested account deletion',
      permanentDelete: false,
    },
  };
  
  // Apply middleware
  const middlewareResult = await userCommandMiddleware(deleteCommand);
  if (Result.isOk(middlewareResult)) {
    console.log('✅ Middleware validation passed');
    const result4 = await commandRouter(deleteCommand);
    if (Result.isOk(result4)) {
      console.log('✅ Delete command executed');
      await eventRouter(result4.value);
    }
  }
  
  // Test 5: Using Value Objects
  console.log('\n📌 Test 5: Value Objects');
  try {
    const email = UserEmail.of('valid@email.com');
    const name = UserName.of('Valid Name');
    console.log('✅ Valid value objects created:', { email, name });
    
    try {
      UserEmail.of('invalid-email');
    } catch (error: any) {
      console.log('❌ Invalid email rejected:', error.message);
    }
    
    try {
      UserName.of('A'); // Too short
    } catch (error: any) {
      console.log('❌ Invalid name rejected:', error.message);
    }
  } catch (error: any) {
    console.log('Error with value objects:', error.message);
  }
  
  // Test 6: Result monad pattern
  console.log('\n📌 Test 6: Result Monad Pattern');
  
  const getUser = (userId: string) => {
    if (userId === 'exists') {
      return { id: userId, name: 'Existing User' };
    }
    return null;
  };
  
  const findUserResult = (userId: string): Result<any, Error> => {
    const user = getUser(userId);
    if (user) {
      return Result.ok(user);
    }
    return Result.err(new Error('User not found'));
  };
  
  const result5 = findUserResult('exists');
  const result6 = findUserResult('not-exists');
  
  console.log('Finding existing user:', Result.isOk(result5) ? '✅ Found' : '❌ Not found');
  console.log('Finding non-existent user:', Result.isOk(result6) ? '✅ Found' : '❌ Not found');
  
  // Test 7: Maybe monad pattern  
  console.log('\n📌 Test 7: Maybe Monad Pattern');
  
  const maybeUser = Maybe.of(getUser('exists'));
  const maybeNone = Maybe.of(getUser('not-exists'));
  
  console.log('Maybe with value:', Maybe.isSome(maybeUser) ? '✅ Has value' : '❌ Empty');
  console.log('Maybe without value:', Maybe.isNone(maybeNone) ? '✅ Empty' : '❌ Has value');
  
  const mapped = Maybe.map(maybeUser, (u: any) => u.name);
  const withDefault = Maybe.getOrElse(maybeUser, 'Unknown User' as any);
  
  console.log('Mapped value:', mapped);
  console.log('With default:', withDefault);
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Demo completed successfully!');
}

// Run the demo
runDemo().catch(console.error);