# Migration Guide: Framework v1/v2 → v3 Ultra-Clean Architecture

This guide helps you migrate from the class-based framework (v1/v2) to the ultra-clean, schema-first, Effect-native framework (v3).

## 🔄 Architecture Changes

### Before: Class-Based Architecture
```typescript
// v1/v2 - Class-based aggregates with inheritance
class UserAggregate extends Aggregate {
  constructor(id: UserId) {
    super(id)
  }
  
  handle(command: Command): void {
    if (command instanceof CreateUserCommand) {
      if (this.isCreated()) {
        throw new DomainError("User already exists")
      }
      this.apply(new UserCreatedEvent(command.data))
    }
  }
  
  private apply(event: DomainEvent): void {
    this.applyEvent(event)
    this.addEvent(event)
  }
}
```

### After: Pure Functional Architecture
```typescript
// v3 - Schema-first with pure functions
const UserState = Schema.Struct({
  id: AggregateId,
  email: Email,
  status: Schema.Literal("active", "suspended")
})

const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    status: "active"
  })
})

const handleUserCommand = createCommandHandler<UserState, UserCommand, UserEvent, UserError>({
  CreateUser: (state, command) =>
    state !== null
      ? Effect.fail(new UserAlreadyExists())
      : Effect.succeed({ type: "success", events: [createUserCreatedEvent(command)] })
})
```

## 📦 Package Structure Changes

### Old Structure
```
src/
├── core/
│   ├── Aggregate.ts          # Base class
│   ├── Command.ts            # Base interfaces
│   ├── Event.ts              # Base interfaces
│   └── Repository.ts         # Abstract class
├── infrastructure/
│   ├── EventStore.ts         # Concrete implementations
│   └── InMemoryRepository.ts
└── domains/
    └── users/
        ├── UserAggregate.ts  # Class extending Aggregate
        ├── UserCommands.ts   # Command classes
        └── UserEvents.ts     # Event classes
```

### New Structure  
```
packages/framework/src/
├── schema/                   # Single source of truth
│   └── core/
│       ├── primitives.ts     # Branded types
│       └── messages.ts       # Command/Event/Query schemas
├── functions/                # Pure functions only
│   └── event-sourcing.ts     # Event application, command handling
├── effects/                  # Effect-native services
│   └── services.ts           # EventStore, CommandBus, QueryBus
├── patterns/                 # Advanced patterns
│   └── saga.ts               # Process managers
├── graphql/                  # GraphQL Federation
│   ├── federation.ts         # Entity resolution
│   └── base.schema.graphql   # Complete schema
└── examples/                 # Domain implementations
    ├── user-domain.ts        # Complete user domain
    └── product-domain.ts     # E-commerce example
```

## 🏗️ Step-by-Step Migration

### Step 1: Define Schemas First

**Before:**
```typescript
// Multiple definitions scattered across files
interface UserData {
  email: string;
  name: string;
}

class CreateUserCommand {
  constructor(public readonly data: UserData) {}
}

class UserCreatedEvent {
  constructor(public readonly data: UserData) {}
}
```

**After:**
```typescript
// Single source of truth using Effect Schema
const UserCreated = createEventSchema(
  "UserCreated", 
  Schema.Struct({
    email: Email,
    name: Username
  })
)

const CreateUser = createCommandSchema(
  "CreateUser",
  Schema.Struct({
    email: Email, 
    name: Username
  })
)

// Types automatically derived
type UserCreated = Schema.Schema.Type<typeof UserCreated>
type CreateUser = Schema.Schema.Type<typeof CreateUser>
```

### Step 2: Replace Class Hierarchies with Pure Functions

**Before:**
```typescript
class UserAggregate extends Aggregate {
  private state: UserState

  handle(command: CreateUserCommand): void {
    this.guardAgainstDuplicateCreation()
    this.apply(new UserCreatedEvent(command.data))
  }

  protected applyUserCreated(event: UserCreatedEvent): void {
    this.state = new UserState(event.data)
  }
}
```

**After:**
```typescript
// Pure event application
const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    name: event.data.name,
    status: "active"
  })
})

// Pure command handling  
const handleUserCommand = createCommandHandler<UserState, UserCommand, UserEvent, UserError>({
  CreateUser: (state, command) =>
    state !== null
      ? Effect.fail(new UserAlreadyExists())
      : Effect.succeed({ 
          type: "success", 
          events: [createUserCreatedEvent(command)] 
        })
})
```

### Step 3: Replace Repositories with Effect Services

**Before:**
```typescript
class UserRepository extends Repository<UserAggregate> {
  async save(aggregate: UserAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents()
    await this.eventStore.append(aggregate.id, events)
  }

  async load(id: UserId): Promise<UserAggregate | null> {
    const events = await this.eventStore.read(id)
    if (events.length === 0) return null
    
    const aggregate = new UserAggregate(id)
    aggregate.loadFromHistory(events)
    return aggregate
  }
}
```

**After:**
```typescript
// Effect-native service with dependency injection
const UserRepository = createRepository(
  "User",
  loadUserFromEvents,
  (aggregate) => aggregate.uncommittedEvents,
  (aggregate) => aggregate.version,
  (aggregate) => aggregate.id
)

// Usage with Effect
const saveUser = (aggregate: UserAggregate) =>
  Effect.gen(function* () {
    const repo = yield* Repository<UserAggregate>
    yield* repo.save(aggregate)
    return { success: true }
  })
```

### Step 4: Convert Command/Query Handlers

**Before:**
```typescript
@Handler(CreateUserCommand)
class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private repo: UserRepository) {}

  async handle(command: CreateUserCommand): Promise<void> {
    const user = await this.repo.load(command.userId)
    if (user) throw new Error("User exists")
    
    const newUser = new UserAggregate(command.userId)
    newUser.handle(command)
    await this.repo.save(newUser)
  }
}
```

**After:**
```typescript
// Effect-native handler with full composability
const CreateUserHandler: ServiceCommandHandler<CreateUserCommand, { userId: AggregateId }> = 
  (command) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      
      // Create new aggregate
      const aggregate = createUserAggregate(command.aggregateId)
      
      // Execute command
      const result = yield* executeCommand(
        handleUserCommand,
        applyUserEvent
      )(aggregate, command)
      
      // Save events
      const streamName = `User-${command.aggregateId}` as StreamName
      yield* eventStore.append(streamName, result.uncommittedEvents, result.version)
      
      return { userId: command.aggregateId }
    })
```

### Step 5: Add GraphQL Federation Support

**Before:**
```typescript
// Separate GraphQL layer with resolvers
const userResolvers = {
  User: {
    id: (user: User) => user.id,
    email: (user: User) => user.email
  },
  
  Query: {
    user: async (_, { id }) => {
      const user = await userService.findById(id)
      return user ? userToDto(user) : null
    }
  }
}
```

**After:**
```typescript
// Federation-native entity with automatic schema generation
export const UserEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id", 
  schema: UserState,
  
  resolveReference: (reference) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const streamName = `User-${reference.id}` as StreamName
      
      const events = yield* eventStore.read<UserEvent>(streamName)
      if (events.length === 0) {
        return yield* Effect.fail(new UserNotFound(reference.id))
      }
      
      const aggregate = loadUserFromEvents(events)
      return aggregate.state
    }),
  
  fields: {
    displayName: (user) => user.name,
    isActive: (user) => user.status === "active"
  }
}
```

## 🔧 Common Migration Patterns

### Exception Handling → Tagged Errors

**Before:**
```typescript
if (!user) {
  throw new UserNotFoundError(id)
}

try {
  await userService.create(data)
} catch (error) {
  if (error instanceof ValidationError) {
    // handle validation
  }
}
```

**After:**
```typescript
// Tagged errors in Effect channel
class UserNotFound {
  readonly _tag = "UserNotFound"
  constructor(readonly userId: AggregateId) {}
}

const result = yield* pipe(
  createUser(data),
  Effect.catchTag("UserNotFound", (error) => 
    Effect.succeed({ type: "not_found", id: error.userId })
  ),
  Effect.catchTag("ValidationError", (error) =>
    Effect.succeed({ type: "validation_error", details: error.details })
  )
)
```

### Dependency Injection → Effect Layers

**Before:**
```typescript
// Manual DI container
class UserService {
  constructor(
    private repo: UserRepository,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}
}

const container = new Container()
container.bind(UserRepository).to(PostgresUserRepository)
container.bind(IEventBus).to(InMemoryEventBus)
```

**After:**
```typescript
// Compose services with Effect Layers
const program = Effect.gen(function* () {
  const eventStore = yield* EventStore
  const commandBus = yield* CommandBus
  const logger = yield* Logger
  
  // All dependencies injected automatically
})

const AppLive = Layer.mergeAll(
  InMemoryEventStore,
  InMemoryCommandBus,
  ConsoleLogger
)

await Effect.runPromise(Effect.provide(program, AppLive))
```

### Async/Promise → Effect

**Before:**
```typescript
async function processCommand(command: Command): Promise<Result> {
  try {
    const user = await userRepo.load(command.userId)
    if (!user) throw new Error("Not found")
    
    user.handle(command)
    await userRepo.save(user)
    await eventBus.publish(user.getEvents())
    
    return { success: true }
  } catch (error) {
    logger.error(error)
    throw error
  }
}
```

**After:**
```typescript
const processCommand = (command: Command) =>
  Effect.gen(function* () {
    const userRepo = yield* Repository<UserAggregate>
    const eventBus = yield* CommandBus
    const logger = yield* Logger
    
    const user = yield* userRepo.load(command.userId)
    const result = yield* executeUserCommand(user, command)
    
    yield* userRepo.save(result)
    yield* eventBus.send(command)
    
    return { success: true }
  }).pipe(
    Effect.tapError((error) => 
      Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.error(`Command failed: ${error}`)
      })
    )
  )
```

## ⚡ Performance Improvements

### Memory Usage
- **Before**: Class instances with prototypes and inheritance chains
- **After**: Plain objects and pure functions - lower memory footprint

### Garbage Collection
- **Before**: Long-lived objects with complex reference graphs
- **After**: Immutable data structures, easier GC

### Type Safety
- **Before**: Runtime validation and potential type errors
- **After**: Compile-time guarantees with Effect Schema

### Composition
- **Before**: Limited by inheritance hierarchies
- **After**: Unlimited composition with Effect combinators

## 🧪 Testing Migration

### Before: Mock-Heavy Testing
```typescript
describe("UserService", () => {
  let userService: UserService
  let mockRepo: jest.Mocked<UserRepository>
  
  beforeEach(() => {
    mockRepo = jest.mocked(createMock<UserRepository>())
    userService = new UserService(mockRepo)
  })
  
  it("should create user", async () => {
    mockRepo.load.mockResolvedValue(null)
    mockRepo.save.mockResolvedValue(undefined)
    
    await userService.createUser({ email: "test@example.com" })
    
    expect(mockRepo.save).toHaveBeenCalled()
  })
})
```

### After: Pure Function Testing
```typescript
describe("User Domain", () => {
  it("should create user", async () => {
    await testAggregate(
      loadUserFromEvents,
      executeUserCommand,
      scenario<UserState, UserCommand, UserEvent, UserError>()
        .given([])
        .when(createUserCommand({ email: "test@example.com" }))
        .thenEvents([
          userCreatedEvent({ email: "test@example.com" })
        ])
    )
  })
  
  // Integration testing with real services
  it("should handle user creation flow", async () => {
    await integrationTest(
      Effect.gen(function* () {
        const commandBus = yield* CommandBus
        const result = yield* commandBus.send(createUserCommand)
        
        expect(result.success).toBe(true)
      })
    )
  })
})
```

## 🚀 Migration Strategy

### Incremental Migration (Recommended)

1. **Start with New Domains**
   - Implement new features using v3 patterns
   - Keep existing domains on v1/v2 temporarily

2. **Migrate Domain by Domain**
   ```typescript
   // Create adapter for gradual migration
   const adaptLegacyCommand = (legacyCommand: LegacyCommand): NewCommand => ({
     type: legacyCommand.constructor.name,
     aggregateId: legacyCommand.aggregateId,
     payload: legacyCommand.data,
     metadata: createMetadata()
   })
   ```

3. **Update Integration Points**
   - Event buses can bridge between old and new
   - GraphQL resolvers can call both systems

4. **Test Thoroughly**
   - Run both systems in parallel during transition
   - Compare results to ensure behavior consistency

### Big Bang Migration (Advanced)

For smaller codebases or when you need full benefits immediately:

1. **Schema First**
   - Define all schemas using Effect Schema
   - Generate types and GraphQL schema

2. **Pure Functions**
   - Convert all aggregates to pure functions
   - Replace command handlers with Effect-native versions

3. **Service Layer**
   - Implement all services using Effect Layers
   - Set up dependency injection

4. **Testing**
   - Rewrite tests using new testing harness
   - Add integration tests

## 📋 Migration Checklist

### Pre-Migration
- [ ] Backup current system
- [ ] Document existing behavior
- [ ] Set up v3 framework in separate package/directory
- [ ] Create test environment

### Domain Migration
- [ ] Define domain schemas using Effect Schema
- [ ] Convert aggregates to pure functions
- [ ] Implement event applicators
- [ ] Create command handlers with Effect
- [ ] Set up projections
- [ ] Add GraphQL Federation entities
- [ ] Write comprehensive tests

### Infrastructure Migration  
- [ ] Replace repositories with Effect services
- [ ] Convert command/query buses to Effect-native
- [ ] Set up Event Store with proper streams
- [ ] Implement projection updates
- [ ] Configure service layers
- [ ] Set up monitoring and logging

### Testing & Validation
- [ ] Unit tests for all pure functions
- [ ] Integration tests with real services
- [ ] Performance testing and comparison
- [ ] End-to-end testing of critical paths
- [ ] Load testing with realistic data

### Deployment
- [ ] Gradual rollout strategy
- [ ] Feature flags for switching between systems
- [ ] Monitoring and alerting
- [ ] Rollback plan
- [ ] Documentation updates

## 🎯 Success Metrics

Track these metrics to validate your migration:

- **Type Safety**: Fewer runtime type errors
- **Performance**: Lower memory usage, faster GC
- **Developer Experience**: Faster development cycles
- **Code Quality**: Lower complexity, higher maintainability
- **Test Coverage**: Better testability with pure functions
- **GraphQL Integration**: Native federation support

## 🆘 Common Issues & Solutions

### Issue: "Too Much Boilerplate"
```typescript
// Instead of repeating patterns, create helpers
const createDomainCommand = <T extends string, P>(
  type: T,
  payloadSchema: Schema.Schema<P>
) => createCommandSchema(type, payloadSchema)

const createDomainEvent = <T extends string, D>(
  type: T, 
  dataSchema: Schema.Schema<D>
) => createEventSchema(type, dataSchema)
```

### Issue: "Complex Effect Chains"
```typescript
// Use pipe for better readability
const processUser = (command: CreateUser) =>
  pipe(
    loadUserAggregate(command.aggregateId),
    Effect.flatMap(user => executeCommand(user, command)),
    Effect.flatMap(result => saveUserAggregate(result)),
    Effect.map(() => ({ success: true }))
  )
```

### Issue: "Hard to Debug Effect Chains"  
```typescript
// Add logging throughout the chain
const processUser = (command: CreateUser) =>
  pipe(
    Effect.log("Processing user creation"),
    Effect.flatMap(() => loadUserAggregate(command.aggregateId)),
    Effect.tap(() => Effect.log("User aggregate loaded")),
    Effect.flatMap(user => executeCommand(user, command)),
    Effect.tap(() => Effect.log("Command executed successfully")),
    Effect.flatMap(result => saveUserAggregate(result))
  )
```

## 📚 Additional Resources

- [Effect-TS Documentation](https://effect.website/)
- [Effect Schema Guide](https://effect.website/docs/schema/introduction)
- [GraphQL Federation Specification](https://www.apollographql.com/docs/federation/)
- [ts-pattern Documentation](https://github.com/gvergnaud/ts-pattern)
- [Framework Examples](./src/examples/)

---

**Need help with migration?** Check the examples in `src/examples/` or create an issue in the repository.