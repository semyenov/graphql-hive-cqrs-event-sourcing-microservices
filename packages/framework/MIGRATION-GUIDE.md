# Framework Migration Guide

## From Class-Based to Schema-First Pure Functional

This guide shows how to migrate from the old class-based approach to the new schema-first, pure functional approach.

## 1. Message Definitions

### ❌ OLD: Class-Based Messages

```typescript
// src/core/messages.ts
import { Data } from "effect/Data"

export class UserCreatedEvent extends DomainEvent<"UserCreated", {
  email: string
  username: string
}> {
  static create(data: { email: string; username: string }) {
    return new UserCreatedEvent({ 
      type: "UserCreated", 
      payload: data, 
      metadata: createMetadata() 
    })
  }
}
```

### ✅ NEW: Schema-First Messages

```typescript
// src/schema/events.ts
import * as Schema from "@effect/schema/Schema"
import { createEventSchema, Email, Username } from "@cqrs/framework"

export const UserCreatedEvent = createEventSchema(
  "UserCreated",
  Schema.Struct({
    email: Email,
    username: Username,
  })
)

// TypeScript type is automatically derived
export type UserCreatedEvent = Schema.Schema.Type<typeof UserCreatedEvent>
```

## 2. Aggregate Implementation

### ❌ OLD: Class-Based Aggregate

```typescript
// src/domain/user-aggregate.ts
import { Aggregate } from "@cqrs/framework"

export class UserAggregate extends Aggregate<UserState, UserEvent, UserCommand> {
  protected applyEvent(event: UserEvent): UserState {
    switch (event.type) {
      case "UserCreated":
        return {
          id: event.aggregateId,
          email: event.data.email,
          username: event.data.username,
          createdAt: event.metadata.timestamp
        }
      case "UserDeleted":
        return { ...this.state, deletedAt: Date.now() }
      default:
        return this.state
    }
  }

  protected validateCommand(command: UserCommand): Effect.Effect<void, AggregateError> {
    if (command.type === "CreateUser" && this.state !== null) {
      return Effect.fail(new InvalidStateError({
        aggregateId: this.id,
        reason: "User already exists"
      }))
    }
    return Effect.succeed(undefined)
  }

  protected executeCommand(command: UserCommand): Effect.Effect<UserEvent[], AggregateError> {
    switch (command.type) {
      case "CreateUser":
        return Effect.succeed([
          UserCreatedEvent.create({
            email: command.email,
            username: command.username
          })
        ])
      default:
        return Effect.succeed([])
    }
  }
}
```

### ✅ NEW: Pure Functional Aggregate

```typescript
// src/domain/user.ts
import { Effect, match } from "@cqrs/framework"
import { 
  processCommand, 
  Decision, 
  InvalidState,
  type AggregateError 
} from "@cqrs/framework"

// State type
export interface UserState {
  readonly id: AggregateId
  readonly email: Email
  readonly username: Username
  readonly createdAt: Timestamp
  readonly deletedAt?: Timestamp
}

// Pure event applicator
export const applyUserEvent = (
  state: UserState | null, 
  event: UserEvent
): UserState | null =>
  match(event)
    .with({ type: "UserCreated" }, e => ({
      id: e.metadata.aggregateId,
      email: e.data.email,
      username: e.data.username,
      createdAt: e.metadata.timestamp,
    }))
    .with({ type: "UserDeleted" }, () => null)
    .exhaustive()

// Pure command handler
export const handleUserCommand = processCommand<UserState, UserCommand, UserEvent>(
  // Validation
  (state, command) =>
    match(command)
      .with({ type: "CreateUser" }, () =>
        state !== null
          ? Effect.fail(new InvalidState({
              aggregateId: command.aggregateId,
              reason: "User already exists",
            }))
          : Effect.succeed(undefined)
      )
      .with({ type: "DeleteUser" }, () =>
        state === null
          ? Effect.fail(new InvalidState({
              aggregateId: command.aggregateId,
              reason: "User not found",
            }))
          : Effect.succeed(undefined)
      )
      .exhaustive(),

  // Decision
  (state, command) =>
    Effect.succeed(
      match(command)
        .with({ type: "CreateUser" }, cmd =>
          Decision.success([
            {
              type: "UserCreated",
              data: { email: cmd.payload.email, username: cmd.payload.username },
              metadata: createEventMetadata(cmd),
            },
          ])
        )
        .with({ type: "DeleteUser" }, cmd =>
          Decision.success([
            {
              type: "UserDeleted",
              data: {},
              metadata: createEventMetadata(cmd),
            },
          ])
        )
        .exhaustive()
    )
)
```

## 3. Repository Pattern

### ❌ OLD: Class-Based Repository

```typescript
// src/infrastructure/user-repository.ts
export class UserRepository implements AggregateRepository<UserAggregate> {
  async load(id: AggregateId): Promise<UserAggregate> {
    const events = await this.eventStore.getEvents(id)
    return UserAggregate.fromEvents(events, initialState)
  }

  async save(aggregate: UserAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents()
    await this.eventStore.append(aggregate.id, events)
    aggregate.markEventsAsCommitted()
  }
}
```

### ✅ NEW: Effect-Based Repository

```typescript
// src/infrastructure/user-repository.ts
import { Effect, EventStore, rebuildFromEvents } from "@cqrs/framework"

export interface UserRepository {
  readonly load: (id: AggregateId) => Effect.Effect<UserState | null, EventStoreError>
  readonly save: (id: AggregateId, events: ReadonlyArray<UserEvent>) => Effect.Effect<void, EventStoreError>
}

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepository
>() {}

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const store = yield* EventStore

    return {
      load: (id) =>
        Effect.gen(function* () {
          const events = yield* store.getEvents(id)
          return rebuildFromEvents(applyUserEvent, null, events)
        }),

      save: (id, events) => store.append(id, events),
    }
  })
)
```

## 4. Command Handling

### ❌ OLD: Command Handler Service

```typescript
// src/application/user-command-handler.ts
export class UserCommandHandler {
  constructor(
    private repository: UserRepository,
    private eventBus: EventBus
  ) {}

  async handle(command: UserCommand): Promise<void> {
    const aggregate = await this.repository.load(command.aggregateId)
    await aggregate.handle(command)
    await this.repository.save(aggregate)
    
    for (const event of aggregate.getUncommittedEvents()) {
      await this.eventBus.publish(event)
    }
  }
}
```

### ✅ NEW: Effect-Based Command Processing

```typescript
// src/application/user-service.ts
import { Effect, executeCommand } from "@cqrs/framework"

export const processUserCommand = (command: UserCommand) =>
  Effect.gen(function* () {
    const store = yield* EventStore
    const bus = yield* EventBus

    // Load current state
    const events = yield* store.getEvents(command.aggregateId)
    const currentState = rebuildFromEvents(applyUserEvent, null, events)

    // Execute command
    const result = yield* executeCommand(
      handleUserCommand,
      applyUserEvent
    )(currentState, command)

    // Persist events
    if (result.events.length > 0) {
      yield* store.append(command.aggregateId, result.events)
      yield* Effect.forEach(result.events, event => bus.publish(event))
    }

    return result.decision
  })
```

## 5. Projections

### ❌ OLD: Class-Based Projection

```typescript
// src/projections/user-list.ts
export class UserListProjection extends Projection {
  private users: Map<string, UserView> = new Map()

  handle(event: DomainEvent): void {
    switch (event.type) {
      case "UserCreated":
        this.users.set(event.aggregateId, {
          id: event.aggregateId,
          email: event.data.email,
          username: event.data.username,
        })
        break
      case "UserDeleted":
        this.users.delete(event.aggregateId)
        break
    }
  }

  getUsers(): UserView[] {
    return Array.from(this.users.values())
  }
}
```

### ✅ NEW: Pure Functional Projection

```typescript
// src/projections/user-list.ts
import { createProjection } from "@cqrs/framework"

export interface UserListState {
  readonly users: ReadonlyMap<AggregateId, UserView>
}

export const UserListProjection = createProjection<UserListState, UserEvent>(
  "UserList",
  { users: new Map() },
  {
    UserCreated: (state, event) => ({
      users: new Map(state.users).set(
        event.metadata.aggregateId,
        {
          id: event.metadata.aggregateId,
          email: event.data.email,
          username: event.data.username,
        }
      ),
    }),
    UserDeleted: (state, event) => {
      const newUsers = new Map(state.users)
      newUsers.delete(event.metadata.aggregateId)
      return { users: newUsers }
    },
  }
)

// Query handler
export const getUserList = Effect.gen(function* () {
  const projectionStore = yield* ProjectionStore
  const state = yield* projectionStore.get("UserList")
  return Array.from(state.users.values())
})
```

## 6. Service Composition

### ❌ OLD: Dependency Injection Container

```typescript
// src/container.ts
export class Container {
  private eventStore = new InMemoryEventStore()
  private eventBus = new EventBus()
  private userRepository = new UserRepository(this.eventStore)
  private commandHandler = new UserCommandHandler(
    this.userRepository,
    this.eventBus
  )

  async handleCommand(command: Command): Promise<void> {
    await this.commandHandler.handle(command)
  }
}
```

### ✅ NEW: Effect Layers

```typescript
// src/services.ts
import { Layer } from "@cqrs/framework"

// Compose all services
export const AppServicesLive = Layer.mergeAll(
  EventStoreServiceLive,
  EventBusServiceLive,
  UserRepositoryLive,
  ProjectionStoreLive,
)

// Run the program
export const runCommand = (command: UserCommand) =>
  pipe(
    processUserCommand(command),
    Effect.provide(AppServicesLive),
    Effect.runPromise
  )
```

## 7. Testing

### ❌ OLD: Mock-Based Testing

```typescript
// src/__tests__/user-aggregate.test.ts
describe("UserAggregate", () => {
  it("should create user", async () => {
    const aggregate = new UserAggregate(null)
    const command = new CreateUserCommand({
      email: "test@example.com",
      username: "testuser",
    })

    await aggregate.handle(command)

    const events = aggregate.getUncommittedEvents()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("UserCreated")
  })
})
```

### ✅ NEW: Effect-Based Testing

```typescript
// src/__tests__/user.test.ts
import { Effect, Exit } from "@cqrs/framework"

describe("User Domain", () => {
  it("should create user", async () => {
    const command = {
      type: "CreateUser" as const,
      aggregateId: "user123" as AggregateId,
      payload: {
        email: "test@example.com" as Email,
        username: "testuser" as Username,
      },
      metadata: createCommandMetadata(),
    }

    const result = await pipe(
      handleUserCommand(null, command),
      Effect.runPromiseExit
    )

    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) {
      const decision = result.value
      expect(decision._tag).toBe("Success")
      if (decision._tag === "Success") {
        expect(decision.events).toHaveLength(1)
        expect(decision.events[0].type).toBe("UserCreated")
      }
    }
  })

  it("should prevent duplicate users", async () => {
    const existingState: UserState = {
      id: "user123" as AggregateId,
      email: "test@example.com" as Email,
      username: "testuser" as Username,
      createdAt: Date.now() as Timestamp,
    }

    const command = {
      type: "CreateUser" as const,
      aggregateId: "user123" as AggregateId,
      payload: {
        email: "test2@example.com" as Email,
        username: "testuser2" as Username,
      },
      metadata: createCommandMetadata(),
    }

    const result = await pipe(
      handleUserCommand(existingState, command),
      Effect.runPromiseExit
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const error = Cause.failureOption(result.cause)
      expect(Option.isSome(error)).toBe(true)
      if (Option.isSome(error)) {
        expect(error.value._tag).toBe("InvalidState")
      }
    }
  })
})
```

## Key Benefits of the New Approach

1. **Type Safety**: All types are derived from schemas, ensuring runtime and compile-time safety
2. **Pure Functions**: No hidden state or side effects, making code easier to test and reason about
3. **Composability**: Functions can be easily composed using Effect's pipe and flow
4. **Error Handling**: Explicit error types in function signatures
5. **Testability**: Pure functions are trivial to test without mocks
6. **Performance**: No class instantiation overhead, better tree-shaking
7. **Maintainability**: Clear separation of concerns, no inheritance hierarchies

## Migration Checklist

- [ ] Replace class-based messages with schema definitions
- [ ] Convert aggregate classes to pure event applicators and command handlers
- [ ] Replace repositories with Effect-based services
- [ ] Update command handlers to use Effect.gen
- [ ] Convert projections to pure functional style
- [ ] Replace DI container with Effect Layers
- [ ] Update tests to use Effect.runPromiseExit
- [ ] Remove all class inheritance
- [ ] Ensure all operations return Effects
- [ ] Add proper error types to all operations