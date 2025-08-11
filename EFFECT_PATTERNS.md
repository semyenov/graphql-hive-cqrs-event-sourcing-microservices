# Effect Framework Patterns Guide

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Generator Syntax](#generator-syntax)
3. [Error Handling](#error-handling)
4. [Services and Context](#services-and-context)
5. [Retry and Resilience](#retry-and-resilience)
6. [Testing Patterns](#testing-patterns)
7. [Common Mistakes](#common-mistakes)
8. [Real-World Examples](#real-world-examples)

## Core Concepts

### Effect Type Signature
```typescript
Effect<Success, Error, Requirements>
```
- **Success**: The type of the successful value
- **Error**: The type of expected errors (tracked at compile time)
- **Requirements**: Services/context required to run the effect

## Generator Syntax

### ✅ CORRECT: Using Effect.gen

```typescript
// Simple generator
const program = Effect.gen(function* () {
  const value = yield* Effect.succeed(42)
  const result = yield* Effect.succeed(value * 2)
  return result
})

// With error handling
const safeProgram = Effect.gen(function* () {
  const user = yield* getUserById(userId)
  if (!user) {
    return yield* Effect.fail(new UserNotFoundError(userId))
  }
  return user
})

// With services
const serviceProgram = Effect.gen(function* () {
  const logger = yield* LoggerService
  const database = yield* DatabaseService
  
  yield* logger.info("Starting operation")
  const result = yield* database.query("SELECT * FROM users")
  
  return result
})
```

### ❌ INCORRECT: Common Mistakes

```typescript
// WRONG: Extra parenthesis
const wrong1 = Effect.gen((function* () {
  // ...
}))

// WRONG: Not using yield*
const wrong2 = Effect.gen(function* () {
  const value = Effect.succeed(42) // Missing yield*
  return value
})

// WRONG: Using underscore parameter incorrectly
const wrong3 = Effect.gen(function* (_) {
  const value = yield* _(Effect.succeed(42)) // Don't wrap with _
  return value
})
```

## Error Handling

### Expected Errors (Tracked in Type System)

```typescript
// Define custom errors
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string
}> {}

// ✅ CORRECT: Using Effect.fail for expected errors
const validateUser = (input: unknown): Effect.Effect<User, ValidationError> =>
  Effect.gen(function* () {
    if (!isValidEmail(input.email)) {
      return yield* Effect.fail(new ValidationError({
        field: "email",
        message: "Invalid email format"
      }))
    }
    return createUser(input)
  })

// ✅ CORRECT: Handling specific errors
const handleErrors = pipe(
  validateUser(input),
  Effect.catchTag("ValidationError", (error) =>
    Effect.succeed({ status: "invalid", field: error.field })
  ),
  Effect.catchTag("NotFoundError", (error) =>
    Effect.succeed({ status: "not_found", id: error.id })
  ),
  Effect.catchAll((error) =>
    Effect.succeed({ status: "error", message: String(error) })
  )
)
```

### ❌ INCORRECT: Error Handling Mistakes

```typescript
// WRONG: Throwing in Effect.sync
const wrong1 = Effect.sync(() => {
  if (!valid) {
    throw new Error("Invalid") // Don't throw in sync
  }
  return value
})

// CORRECT: Use Effect.fail or wrap with try/catch
const correct1 = Effect.sync(() => {
  if (!valid) {
    return Effect.fail(new Error("Invalid"))
  }
  return Effect.succeed(value)
}).pipe(Effect.flatten)

// Or use Effect.try
const correct2 = Effect.try({
  try: () => {
    if (!valid) throw new Error("Invalid")
    return value
  },
  catch: (error) => new ValidationError({ message: String(error) })
})
```

## Services and Context

### ✅ CORRECT: Defining and Using Services

```typescript
// 1. Define service interface
interface LoggerService {
  readonly info: (message: string) => Effect.Effect<void>
  readonly error: (message: string) => Effect.Effect<void>
}

// 2. Create service tag
class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  LoggerService
>() {}

// 3. Create service implementation
const LoggerServiceLive = Layer.succeed(
  LoggerService,
  LoggerService.of({
    info: (message) => Effect.sync(() => console.log(`[INFO] ${message}`)),
    error: (message) => Effect.sync(() => console.error(`[ERROR] ${message}`))
  })
)

// 4. Use service in effect
const program = Effect.gen(function* () {
  const logger = yield* LoggerService
  
  yield* logger.info("Starting program")
  const result = yield* businessLogic()
  yield* logger.info("Program completed")
  
  return result
})

// 5. Provide service when running
const runnable = pipe(
  program,
  Effect.provide(LoggerServiceLive)
)

// Or compose multiple services
const AppLive = Layer.mergeAll(
  LoggerServiceLive,
  DatabaseServiceLive,
  CacheServiceLive
)

const runnableWithAll = pipe(
  program,
  Effect.provide(AppLive)
)
```

### Testing with Mock Services

```typescript
// Create mock implementation for testing
const LoggerServiceTest = Layer.succeed(
  LoggerService,
  LoggerService.of({
    info: (message) => Effect.succeed(undefined),
    error: (message) => Effect.succeed(undefined)
  })
)

// Use in tests
test("should log messages", async () => {
  const result = await pipe(
    program,
    Effect.provide(LoggerServiceTest),
    Effect.runPromise
  )
  
  expect(result).toBeDefined()
})
```

## Retry and Resilience

### ✅ CORRECT: Using Schedule for Retry

```typescript
import * as Schedule from "effect/Schedule"

// Exponential backoff with max 5 attempts
const retryPolicy = Schedule.exponential(Duration.millis(100)).pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(4)) // 5 total attempts (initial + 4 retries)
)

// Apply retry to an effect
const resilientOperation = pipe(
  httpRequest("/api/data"),
  Effect.retry(retryPolicy)
)

// Retry with custom logic
const customRetry = pipe(
  httpRequest("/api/data"),
  Effect.retry({
    schedule: retryPolicy,
    while: (error) => error._tag === "TransientError" // Only retry specific errors
  })
)

// Retry with fallback
const withFallback = pipe(
  httpRequest("/api/data"),
  Effect.retryOrElse(
    retryPolicy,
    (error, attemptNumber) => Effect.succeed(defaultData)
  )
)
```

### Circuit Breaker Pattern

```typescript
const circuitBreakerPolicy = {
  maxFailures: 5,
  resetTimeout: Duration.seconds(60),
  onOpen: Effect.log("Circuit breaker opened"),
  onClose: Effect.log("Circuit breaker closed")
}

const protectedOperation = pipe(
  httpRequest("/api/data"),
  Effect.withCircuitBreaker(circuitBreakerPolicy)
)
```

## Testing Patterns

### ✅ CORRECT: Testing Effect Code

```typescript
import { describe, test, expect } from "bun:test"

describe("Effect Tests", () => {
  test("successful effect", async () => {
    const effect = Effect.succeed(42)
    const result = await Effect.runPromise(effect)
    expect(result).toBe(42)
  })

  test("failing effect", async () => {
    const effect = Effect.fail(new Error("Expected failure"))
    const exit = await Effect.runPromiseExit(effect)
    
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause)
      expect(Option.isSome(error)).toBe(true)
    }
  })

  test("effect with service", async () => {
    const program = Effect.gen(function* () {
      const service = yield* TestService
      return yield* service.getData()
    })

    const TestServiceMock = Layer.succeed(
      TestService,
      TestService.of({
        getData: () => Effect.succeed("test data")
      })
    )

    const result = await pipe(
      program,
      Effect.provide(TestServiceMock),
      Effect.runPromise
    )

    expect(result).toBe("test data")
  })

  test("effect with timeout", async () => {
    const slowEffect = pipe(
      Effect.sleep(Duration.seconds(5)),
      Effect.as("done")
    )

    const withTimeout = pipe(
      slowEffect,
      Effect.timeout(Duration.millis(100))
    )

    const result = await Effect.runPromise(withTimeout)
    expect(Option.isNone(result)).toBe(true)
  })
})
```

## Common Mistakes

### 1. Incorrect Generator Syntax

```typescript
// ❌ WRONG
Effect.gen((function* () { }))  // Extra parenthesis
Effect.gen(function* (_) { yield* _(effect) })  // Wrapping with _

// ✅ CORRECT
Effect.gen(function* () { })
Effect.gen(function* () { yield* effect })
```

### 2. Throwing Errors in Sync Effects

```typescript
// ❌ WRONG
Effect.sync(() => {
  throw new Error("Failed")
})

// ✅ CORRECT
Effect.try(() => {
  if (condition) throw new Error("Failed")
  return value
})
// Or
Effect.gen(function* () {
  if (condition) {
    return yield* Effect.fail(new Error("Failed"))
  }
  return value
})
```

### 3. Not Providing Required Services

```typescript
// ❌ WRONG - Missing service
const program = Effect.gen(function* () {
  const logger = yield* Logger // Will fail at runtime
  return "done"
})
await Effect.runPromise(program) // Runtime error!

// ✅ CORRECT - Provide service
await pipe(
  program,
  Effect.provide(LoggerLive),
  Effect.runPromise
)
```

### 4. Incorrect Error Handling

```typescript
// ❌ WRONG - Using try/catch with effects
try {
  const result = await Effect.runPromise(effect)
} catch (error) {
  // This might not catch Effect errors properly
}

// ✅ CORRECT - Use Exit or handle errors in Effect
const exit = await Effect.runPromiseExit(effect)
if (Exit.isFailure(exit)) {
  // Handle error
} else {
  // Handle success
}

// Or handle in Effect
const handled = pipe(
  effect,
  Effect.catchAll((error) => Effect.succeed(defaultValue))
)
```

## Real-World Examples

### Command Handler with Full Error Handling

```typescript
class CreateUserCommand {
  constructor(
    readonly email: string,
    readonly name: string,
    readonly password: string
  ) {}
}

const createUserHandler = Effect.gen(function* () {
  // Get services
  const validator = yield* ValidationService
  const repository = yield* UserRepository
  const eventBus = yield* EventBus
  const logger = yield* Logger

  return (command: CreateUserCommand) => Effect.gen(function* () {
    yield* logger.info(`Creating user: ${command.email}`)

    // Validate
    const validation = yield* validator.validateEmail(command.email)
    if (!validation.valid) {
      return yield* Effect.fail(new ValidationError({
        field: "email",
        message: validation.error
      }))
    }

    // Check if exists
    const existing = yield* repository.findByEmail(command.email)
    if (Option.isSome(existing)) {
      return yield* Effect.fail(new ConflictError({
        message: "User already exists"
      }))
    }

    // Create user
    const user = {
      id: generateId(),
      email: command.email,
      name: command.name,
      passwordHash: yield* hashPassword(command.password),
      createdAt: new Date()
    }

    // Save
    yield* repository.save(user)

    // Publish event
    yield* eventBus.publish(new UserCreatedEvent(user))

    yield* logger.info(`User created: ${user.id}`)
    
    return user
  })
})

// Usage with retry and timeout
const createUser = pipe(
  createUserHandler,
  Effect.flatMap((handler) => handler(command)),
  Effect.retry(Schedule.exponential(Duration.millis(100))),
  Effect.timeout(Duration.seconds(30)),
  Effect.catchTag("ValidationError", (error) => 
    Effect.fail(new BadRequestError(error.message))
  ),
  Effect.provide(AppServicesLive)
)
```

### Repository Pattern with Effect

```typescript
interface UserRepository {
  findById: (id: string) => Effect.Effect<Option.Option<User>, DatabaseError>
  findByEmail: (email: string) => Effect.Effect<Option.Option<User>, DatabaseError>
  save: (user: User) => Effect.Effect<void, DatabaseError>
  update: (id: string, updates: Partial<User>) => Effect.Effect<void, DatabaseError>
}

class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepository
>() {}

const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* DatabaseConnection
    const cache = yield* CacheService
    
    return UserRepository.of({
      findById: (id) => Effect.gen(function* () {
        // Check cache first
        const cached = yield* cache.get(`user:${id}`)
        if (Option.isSome(cached)) {
          return cached
        }
        
        // Query database
        const result = yield* db.query(
          "SELECT * FROM users WHERE id = $1",
          [id]
        )
        
        const user = result.rows[0] 
          ? Option.some(result.rows[0] as User)
          : Option.none()
        
        // Cache result
        if (Option.isSome(user)) {
          yield* cache.set(`user:${id}`, user.value)
        }
        
        return user
      }),
      
      save: (user) => Effect.gen(function* () {
        yield* db.query(
          "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
          [user.id, user.email, user.name]
        )
        yield* cache.set(`user:${user.id}`, user)
      }),
      
      // ... other methods
    })
  })
)
```

### Event Sourcing with Effect

```typescript
const eventSourcingProgram = Effect.gen(function* () {
  const eventStore = yield* EventStore
  const snapshotStore = yield* SnapshotStore
  
  // Load aggregate
  const loadAggregate = (id: string) => Effect.gen(function* () {
    // Try to load from snapshot
    const snapshot = yield* snapshotStore.get(id)
    
    const fromVersion = Option.match(snapshot, {
      onNone: () => 0,
      onSome: (s) => s.version
    })
    
    // Load events after snapshot
    const events = yield* eventStore.getEvents(id, fromVersion)
    
    // Rebuild aggregate
    const aggregate = Option.match(snapshot, {
      onNone: () => new Aggregate(id),
      onSome: (s) => Aggregate.fromSnapshot(s)
    })
    
    // Apply events
    for (const event of events) {
      aggregate.apply(event)
    }
    
    return aggregate
  })
  
  // Save aggregate
  const saveAggregate = (aggregate: Aggregate) => Effect.gen(function* () {
    const events = aggregate.getUncommittedEvents()
    
    if (events.length === 0) {
      return
    }
    
    // Save events
    yield* eventStore.saveEvents(aggregate.id, events, aggregate.version)
    
    // Save snapshot every 10 events
    if (aggregate.version % 10 === 0) {
      yield* snapshotStore.save(aggregate.id, aggregate.toSnapshot())
    }
    
    aggregate.markEventsAsCommitted()
  })
  
  return { loadAggregate, saveAggregate }
})
```

## Best Practices

1. **Always use `yield*`** when working with effects in generators
2. **Define errors as tagged classes** extending `Data.TaggedError`
3. **Make service dependencies explicit** in the Requirements type parameter
4. **Use Layer for dependency injection** instead of manual provision
5. **Prefer `Effect.gen` over `pipe`** for sequential operations
6. **Use `Schedule` for retry logic** instead of custom implementations
7. **Test with `Effect.runPromiseExit`** to properly handle both success and failure
8. **Use `Option` and `Either`** for nullable values and results
9. **Compose effects** using combinators like `Effect.all`, `Effect.race`, etc.
10. **Handle errors at the appropriate level** - don't catch too early

## Migration Guide

### From Promises to Effect

```typescript
// Before: Promise-based
async function getUser(id: string): Promise<User> {
  try {
    const user = await db.query(`SELECT * FROM users WHERE id = ?`, [id])
    if (!user) throw new Error("User not found")
    return user
  } catch (error) {
    logger.error("Failed to get user", error)
    throw error
  }
}

// After: Effect-based
const getUser = (id: string): Effect.Effect<User, GetUserError, Database | Logger> =>
  Effect.gen(function* () {
    const db = yield* Database
    const logger = yield* Logger
    
    const result = yield* db.query(`SELECT * FROM users WHERE id = ?`, [id]).pipe(
      Effect.tapError((error) => logger.error(`Failed to get user: ${error}`))
    )
    
    if (!result) {
      return yield* Effect.fail(new UserNotFoundError({ id }))
    }
    
    return result
  })
```

### From Callbacks to Effect

```typescript
// Before: Callback-based
function readFile(path: string, callback: (error: Error | null, data?: string) => void) {
  fs.readFile(path, 'utf-8', callback)
}

// After: Effect-based
const readFile = (path: string): Effect.Effect<string, ReadFileError> =>
  Effect.async<string, ReadFileError>((resume) => {
    fs.readFile(path, 'utf-8', (error, data) => {
      if (error) {
        resume(Effect.fail(new ReadFileError({ path, message: error.message })))
      } else {
        resume(Effect.succeed(data))
      }
    })
  })
```

## Resources

- [Effect Documentation](https://effect.website/docs)
- [Effect Discord](https://discord.gg/effect-ts)
- [Effect GitHub](https://github.com/Effect-TS/effect)
- [Effect Guide](https://effect.website/docs/guides)