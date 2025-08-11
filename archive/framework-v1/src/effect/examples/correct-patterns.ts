/**
 * Correct Effect Patterns - Example Implementations
 * 
 * This file demonstrates the correct way to use Effect framework
 * following best practices and avoiding common mistakes.
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as Exit from "effect/Exit"
import * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"

// ============================================================================
// CORRECT ERROR DEFINITIONS
// ============================================================================

// Define domain errors as tagged classes
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string
  readonly id: string
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string
  readonly cause: string
}> {}

// ============================================================================
// CORRECT SERVICE DEFINITIONS
// ============================================================================

// Service interface
export interface UserService {
  readonly findById: (id: string) => Effect.Effect<Option.Option<User>, DatabaseError>
  readonly save: (user: User) => Effect.Effect<void, DatabaseError>
  readonly delete: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>
}

// Service tag
export class UserService extends Context.Tag("UserService")<
  UserService,
  UserService
>() {}

// Logger service
export interface LoggerService {
  readonly info: (message: string) => Effect.Effect<void>
  readonly error: (message: string, error?: unknown) => Effect.Effect<void>
  readonly debug: (message: string, data?: unknown) => Effect.Effect<void>
}

export class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  LoggerService
>() {}

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly createdAt: Date
}

export interface CreateUserCommand {
  readonly email: string
  readonly name: string
}

// ============================================================================
// CORRECT SERVICE IMPLEMENTATIONS
// ============================================================================

// Logger implementation
export const LoggerServiceLive = Layer.succeed(
  LoggerService,
  LoggerService.of({
    info: (message) => 
      Effect.sync(() => console.log(`[INFO] ${message}`)),
    
    error: (message, error) => 
      Effect.sync(() => console.error(`[ERROR] ${message}`, error)),
    
    debug: (message, data) => 
      Effect.sync(() => console.debug(`[DEBUG] ${message}`, data))
  })
)

// User service implementation
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const logger = yield* LoggerService
    
    // In-memory storage for demo
    const users = new Map<string, User>()
    
    return UserService.of({
      findById: (id) => Effect.gen(function* () {
        yield* logger.debug(`Finding user by id: ${id}`)
        const user = users.get(id)
        return Option.fromNullable(user)
      }),
      
      save: (user) => Effect.gen(function* () {
        yield* logger.info(`Saving user: ${user.id}`)
        users.set(user.id, user)
      }),
      
      delete: (id) => Effect.gen(function* () {
        yield* logger.info(`Deleting user: ${id}`)
        
        if (!users.has(id)) {
          return yield* Effect.fail(new NotFoundError({
            resource: "User",
            id
          }))
        }
        
        users.delete(id)
      })
    })
  })
)

// ============================================================================
// CORRECT BUSINESS LOGIC PATTERNS
// ============================================================================

/**
 * Example 1: Command handler with proper error handling
 */
export const createUserHandler = (command: CreateUserCommand) =>
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const userService = yield* UserService
    
    yield* logger.info(`Creating user with email: ${command.email}`)
    
    // Validate email
    if (!command.email.includes("@")) {
      return yield* Effect.fail(new ValidationError({
        field: "email",
        message: "Invalid email format"
      }))
    }
    
    // Create user
    const user: User = {
      id: `user-${Date.now()}`,
      email: command.email,
      name: command.name,
      createdAt: new Date()
    }
    
    // Save to database
    yield* userService.save(user)
    
    yield* logger.info(`User created successfully: ${user.id}`)
    
    return user
  })

/**
 * Example 2: Query handler with optional result
 */
export const getUserByIdHandler = (id: string) =>
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const userService = yield* UserService
    
    yield* logger.debug(`Getting user: ${id}`)
    
    const userOption = yield* userService.findById(id)
    
    return Option.match(userOption, {
      onNone: () => Effect.fail(new NotFoundError({
        resource: "User",
        id
      })),
      onSome: (user) => Effect.succeed(user)
    })
  }).pipe(Effect.flatten)

/**
 * Example 3: Operation with retry
 */
export const reliableUserCreation = (command: CreateUserCommand) =>
  pipe(
    createUserHandler(command),
    Effect.retry(
      Schedule.exponential(Duration.millis(100)).pipe(
        Schedule.jittered,
        Schedule.compose(Schedule.recurs(3))
      )
    ),
    Effect.catchTag("DatabaseError", (error) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.error("Database error during user creation", error)
        return yield* Effect.fail(error)
      })
    )
  )

/**
 * Example 4: Batch operation with error accumulation
 */
export const createMultipleUsers = (commands: CreateUserCommand[]) =>
  Effect.gen(function* () {
    const logger = yield* LoggerService
    
    yield* logger.info(`Creating ${commands.length} users`)
    
    // Process all commands, collecting both successes and failures
    const results = yield* Effect.all(
      commands.map(cmd => 
        pipe(
          createUserHandler(cmd),
          Effect.either // Convert to Either to handle errors
        )
      ),
      { concurrency: 3 } // Process up to 3 at a time
    )
    
    // Separate successes and failures
    const successes = results.filter(Either.isRight).map(Either.getRight)
    const failures = results.filter(Either.isLeft).map(Either.getLeft)
    
    yield* logger.info(`Created ${successes.length} users, ${failures.length} failed`)
    
    return { successes, failures }
  })

/**
 * Example 5: Transaction-like operation
 */
export const transferUserData = (fromId: string, toId: string) =>
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const userService = yield* UserService
    
    yield* logger.info(`Transferring data from ${fromId} to ${toId}`)
    
    // Get source user
    const sourceOption = yield* userService.findById(fromId)
    const source = yield* Option.match(sourceOption, {
      onNone: () => Effect.fail(new NotFoundError({
        resource: "Source User",
        id: fromId
      })),
      onSome: Effect.succeed
    })
    
    // Get target user
    const targetOption = yield* userService.findById(toId)
    const target = yield* Option.match(targetOption, {
      onNone: () => Effect.fail(new NotFoundError({
        resource: "Target User",
        id: toId
      })),
      onSome: Effect.succeed
    })
    
    // Update target with source data
    const updated = { ...target, name: source.name }
    
    // Save and delete in sequence
    yield* userService.save(updated)
    yield* userService.delete(fromId)
    
    yield* logger.info("Transfer completed successfully")
    
    return updated
  })

// ============================================================================
// CORRECT TESTING PATTERNS
// ============================================================================

/**
 * Example: Testing with mock services
 */
export const testCreateUser = () => {
  // Create mock services for testing
  const LoggerServiceTest = Layer.succeed(
    LoggerService,
    LoggerService.of({
      info: () => Effect.succeed(undefined),
      error: () => Effect.succeed(undefined),
      debug: () => Effect.succeed(undefined)
    })
  )
  
  const UserServiceTest = Layer.succeed(
    UserService,
    UserService.of({
      findById: () => Effect.succeed(Option.none()),
      save: () => Effect.succeed(undefined),
      delete: () => Effect.fail(new NotFoundError({
        resource: "User",
        id: "test"
      }))
    })
  )
  
  // Compose test layers
  const TestLive = Layer.mergeAll(
    LoggerServiceTest,
    UserServiceTest
  )
  
  // Run test
  const program = createUserHandler({
    email: "test@example.com",
    name: "Test User"
  })
  
  return pipe(
    program,
    Effect.provide(TestLive),
    Effect.runPromiseExit
  )
}

// ============================================================================
// CORRECT ERROR HANDLING PATTERNS
// ============================================================================

/**
 * Example: Comprehensive error handling
 */
export const robustUserOperation = (id: string) =>
  pipe(
    getUserByIdHandler(id),
    
    // Handle specific error types
    Effect.catchTag("NotFoundError", (error) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.info(`User not found, creating new one: ${id}`)
        
        return yield* createUserHandler({
          email: `${id}@example.com`,
          name: `User ${id}`
        })
      })
    ),
    
    // Handle validation errors
    Effect.catchTag("ValidationError", (error) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.error(`Validation failed: ${error.field} - ${error.message}`)
        return yield* Effect.fail(error)
      })
    ),
    
    // Handle database errors with retry
    Effect.catchTag("DatabaseError", (error) =>
      pipe(
        Effect.fail(error),
        Effect.retry(Schedule.exponential(Duration.millis(100)))
      )
    ),
    
    // Final fallback
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.error("Unexpected error in user operation", error)
        return yield* Effect.fail(error)
      })
    )
  )

// ============================================================================
// CORRECT RESOURCE MANAGEMENT
// ============================================================================

/**
 * Example: Resource management with acquireRelease
 */
export const withDatabaseConnection = <A>(
  use: (connection: DatabaseConnection) => Effect.Effect<A>
) =>
  Effect.acquireReleaseWith(
    // Acquire
    Effect.gen(function* () {
      const logger = yield* LoggerService
      yield* logger.info("Opening database connection")
      return { id: "connection-1", isOpen: true } as DatabaseConnection
    }),
    
    // Release
    (connection) =>
      Effect.gen(function* () {
        const logger = yield* LoggerService
        yield* logger.info("Closing database connection")
        connection.isOpen = false
      }),
    
    // Use
    use
  )

interface DatabaseConnection {
  readonly id: string
  isOpen: boolean
}

// ============================================================================
// RUNNING EFFECTS
// ============================================================================

/**
 * Example: Different ways to run effects
 */
export const runExamples = async () => {
  // Provide all required services
  const AppLive = Layer.mergeAll(
    LoggerServiceLive,
    UserServiceLive
  )
  
  // Run and get result (throws on error)
  const result1 = await pipe(
    createUserHandler({ email: "user@example.com", name: "John" }),
    Effect.provide(AppLive),
    Effect.runPromise
  )
  console.log("Result 1:", result1)
  
  // Run and get Exit (doesn't throw)
  const exit = await pipe(
    getUserByIdHandler("user-123"),
    Effect.provide(AppLive),
    Effect.runPromiseExit
  )
  
  if (Exit.isSuccess(exit)) {
    console.log("Success:", exit.value)
  } else {
    console.log("Failure:", Cause.pretty(exit.cause))
  }
  
  // Run with timeout
  const withTimeout = await pipe(
    createUserHandler({ email: "slow@example.com", name: "Slow" }),
    Effect.timeout(Duration.seconds(5)),
    Effect.provide(AppLive),
    Effect.runPromise
  )
  
  if (Option.isSome(withTimeout)) {
    console.log("Completed in time:", withTimeout.value)
  } else {
    console.log("Timed out")
  }
}

// ============================================================================
// COMPOSITION PATTERNS
// ============================================================================

/**
 * Example: Composing multiple effects
 */
export const complexWorkflow = Effect.gen(function* () {
  const logger = yield* LoggerService
  
  yield* logger.info("Starting complex workflow")
  
  // Parallel execution
  const [user1, user2] = yield* Effect.all([
    createUserHandler({ email: "user1@example.com", name: "User 1" }),
    createUserHandler({ email: "user2@example.com", name: "User 2" })
  ], { concurrency: "unbounded" })
  
  // Sequential execution
  const updated = yield* pipe(
    getUserByIdHandler(user1.id),
    Effect.flatMap((user) => 
      Effect.succeed({ ...user, name: "Updated Name" })
    )
  )
  
  // Race multiple operations
  const fastest = yield* Effect.race(
    Effect.delay(Effect.succeed("fast"), Duration.millis(100)),
    Effect.delay(Effect.succeed("slow"), Duration.seconds(1))
  )
  
  yield* logger.info(`Fastest result: ${fastest}`)
  
  return { user1, user2, updated, fastest }
})

// Export for testing
export const examples = {
  createUserHandler,
  getUserByIdHandler,
  reliableUserCreation,
  createMultipleUsers,
  transferUserData,
  robustUserOperation,
  withDatabaseConnection,
  complexWorkflow,
  testCreateUser,
  runExamples
}