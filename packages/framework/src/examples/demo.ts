/**
 * Framework Demonstration
 *
 * Complete working example showing the ultra-clean CQRS/Event Sourcing framework in action
 */

import * as Effect from "effect/Effect";
import * as Schema from "@effect/schema/Schema";
import * as Stream from "effect/Stream";
import { pipe } from "effect/Function";

// Import framework core
import {
  AggregateId,
  CoreServicesLive,
  createAggregate,
  createAggregateId,
  createCausationId,
  createCommandHandler,
  createCommandId,
  createCommandSchema,
  createCorrelationId,
  createEventApplicator,
  createEventId,
  createEventSchema,
  Email,
  EventStore,
  executeCommand,
  loadFromEvents,
  NonEmptyString,
  now,
  Username,
} from "../index";

// ============================================================================
// 1. Define Domain Schemas (Single Source of Truth)
// ============================================================================

/**
 * User state schema
 */
const UserState = Schema.Struct({
  id: AggregateId,
  email: Email,
  username: Username,
  isActive: Schema.Boolean,
});
export type UserState = Schema.Schema.Type<typeof UserState>;

/**
 * User events
 */
export const UserRegistered = createEventSchema(
  "UserRegistered",
  Schema.Struct({
    email: Email,
    username: Username,
  }),
);

export const UserActivated = createEventSchema(
  "UserActivated",
  Schema.Struct({}),
);

export type UserEvent =
  | Schema.Schema.Type<typeof UserRegistered>
  | Schema.Schema.Type<typeof UserActivated>;

/**
 * User commands
 */
export const RegisterUser = createCommandSchema(
  "RegisterUser",
  Schema.Struct({
    email: Email,
    username: Username,
  }),
);

export const ActivateUser = createCommandSchema(
  "ActivateUser",
  Schema.Struct({}),
);

export type UserCommand =
  | Schema.Schema.Type<typeof RegisterUser>
  | Schema.Schema.Type<typeof ActivateUser>;

// ============================================================================
// 2. Domain Errors
// ============================================================================

export class UserAlreadyExists {
  readonly _tag = "UserAlreadyExists";
  constructor(readonly email: Email) {}
}

export class UserNotFound {
  readonly _tag = "UserNotFound";
  constructor(readonly id: AggregateId) {}
}

export type UserError = UserAlreadyExists | UserNotFound;

// ============================================================================
// 3. Pure Event Application
// ============================================================================

/**
 * Apply events to user state - pure function
 */
export const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserRegistered: (_state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    username: event.data.username,
    isActive: false,
  }),

  UserActivated: (state, _event) => state ? { ...state, isActive: true } : null,
});

// ============================================================================
// 4. Pure Command Handling
// ============================================================================

/**
 * Handle user commands - pure function with Effect
 */
export const handleUserCommand = createCommandHandler<
  UserState,
  UserCommand,
  UserEvent,
  UserError
>({
  RegisterUser: (state, command) =>
    Effect.gen(function* () {
      // Business rule: User cannot already exist (this should check if state exists)
      // In a fresh aggregate, state should be our default state, not null
      if (state && state.email !== ("" as Email)) {
        return {
          type: "failure" as const,
          error: new UserAlreadyExists(command.payload.email),
        };
      }

      // Create domain event
      const event: Schema.Schema.Type<typeof UserRegistered> = {
        type: "UserRegistered" as const,
        data: {
          email: command.payload.email,
          username: command.payload.username,
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 0 as any,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      };

      return {
        type: "success" as const,
        events: [event],
      };
    }),

  ActivateUser: (state, command) =>
    Effect.gen(function* () {
      // Business rule: User must exist to be activated
      if (!state || state.email === ("" as Email)) {
        return {
          type: "failure" as const,
          error: new UserNotFound(command.aggregateId),
        };
      }

      // Business rule: User must not already be active
      if (state.isActive) {
        return {
          type: "success" as const,
          events: [], // Already active, no-op
        };
      }

      // Create activation event
      const event: Schema.Schema.Type<typeof UserActivated> = {
        type: "UserActivated" as const,
        data: {},
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: (state as any).version + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor,
        },
      };

      return {
        type: "success" as const,
        events: [event],
      };
    }),
});

// ============================================================================
// 5. Aggregate Operations
// ============================================================================

/**
 * Create a new user aggregate
 */
export const createUserAggregate = (id: AggregateId = createAggregateId()) =>
  createAggregate<UserState, UserEvent>({
    id,
    email: "" as Email,
    username: "" as Username,
    isActive: false,
  });

/**
 * Load user aggregate from events
 */
export const loadUserFromEvents = (events: ReadonlyArray<UserEvent>) =>
  loadFromEvents(applyUserEvent)(events);

/**
 * Execute command against user aggregate
 */
export const executeUserCommand = (
  aggregate: any,
  command: UserCommand,
) => executeCommand(handleUserCommand, applyUserEvent)(aggregate, command);

// ============================================================================
// 6. Application Service
// ============================================================================

/**
 * Complete user service demonstrating the framework
 */
export const UserService = {
  /**
   * Register a new user
   */
  registerUser: (email: Email, username: Username) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore;

      // Create command
      const commandType = "RegisterUser" as const;
      const correlationId = createCorrelationId();
      const userId = createAggregateId();
      const commandId = createCommandId();
      const command: Schema.Schema.Type<typeof RegisterUser> = {
        type: commandType,
        aggregateId: userId,
        payload: { email, username },
        metadata: {
          commandId,
          correlationId,
          timestamp: now(),
          actor: { type: "system", service: "demo" as NonEmptyString },
        },
      };

      // Create new aggregate
      const aggregate = createUserAggregate(userId);

      // Execute command
      const result = yield* executeUserCommand(aggregate, command);

      // Save events to event store
      const streamName = `User-${userId}` as any;
      yield* eventStore.append(
        streamName,
        result.uncommittedEvents,
        -1 as any, // New stream starts at -1
      );

      return {
        userId,
        email,
        username,
        success: true,
      };
    }),

  /**
   * Activate an existing user
   */
  activateUser: (userId: AggregateId) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore;

      // Load existing events
      const streamName = `User-${userId}` as any;
      const events = yield* pipe(
        eventStore.read<UserEvent>(streamName),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.orElseSucceed(() => []),
      );

      if (events.length === 0) {
        return yield* Effect.fail(new UserNotFound(userId));
      }

      // Rebuild aggregate from events
      const aggregate = loadUserFromEvents(events);

      // Create activation command
      const command: Schema.Schema.Type<typeof ActivateUser> = {
        type: "ActivateUser" as const,
        aggregateId: userId,
        payload: {},
        metadata: {
          commandId: createCommandId(),
          correlationId: createCorrelationId(),
          timestamp: now(),
          actor: { type: "system", service: "demo" as NonEmptyString },
        },
      };

      // Execute command
      const result = yield* executeUserCommand(aggregate, command);

      // Save new events - use events.length - 1 as expected version
      yield* eventStore.append(
        streamName,
        result.uncommittedEvents,
        (events.length - 1) as any,
      );

      return {
        userId,
        activated: true,
        success: true,
      };
    }),

  /**
   * Get user current state
   */
  getUser: (userId: AggregateId) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore;

      // Load events
      const streamName = `User-${userId}` as any;
      const events = yield* pipe(
        eventStore.read<UserEvent>(streamName),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.orElseSucceed(() => []),
      );

      if (events.length === 0) {
        return yield* Effect.fail(new UserNotFound(userId));
      }

      // Rebuild current state
      const aggregate = loadUserFromEvents(events);

      return {
        user: aggregate.state,
        version: aggregate.version,
        events: events.length,
      };
    }),
};

// ============================================================================
// 7. Demo Application
// ============================================================================

/**
 * Run the complete demo
 */
export const runDemo = () =>
  Effect.gen(function* () {
    yield* Effect.log("🚀 Starting CQRS/Event Sourcing Framework Demo");

    // 1. Register a new user
    yield* Effect.log("📝 Registering new user...");
    const registerResult = yield* UserService.registerUser(
      "demo@example.com" as Email,
      "demo-user" as Username,
    );
    yield* Effect.log(`✅ User registered: ${JSON.stringify(registerResult)}`);

    // 2. Check user state (should be inactive)
    yield* Effect.log("🔍 Checking user state...");
    const userState1 = yield* UserService.getUser(registerResult.userId);
    yield* Effect.log(`📊 User state: ${JSON.stringify(userState1)}`);

    // 3. Activate the user
    yield* Effect.log("⚡ Activating user...");
    const activateResult = yield* UserService.activateUser(
      registerResult.userId,
    );
    yield* Effect.log(`✅ User activated: ${JSON.stringify(activateResult)}`);

    // 4. Check user state again (should be active)
    yield* Effect.log("🔍 Checking user state after activation...");
    const userState2 = yield* UserService.getUser(registerResult.userId);
    yield* Effect.log(`📊 Final user state: ${JSON.stringify(userState2)}`);

    // 5. Try to activate again (should be no-op)
    yield* Effect.log("🔄 Trying to activate already active user...");
    const activateResult2 = yield* UserService.activateUser(
      registerResult.userId,
    );
    yield* Effect.log(
      `✅ Second activation: ${JSON.stringify(activateResult2)}`,
    );

    yield* Effect.log("🎉 Demo completed successfully!");

    return {
      message: "Framework demo completed successfully!",
      userId: registerResult.userId,
      finalState: userState2.user,
    };
  }).pipe(
    Effect.provide(CoreServicesLive),
    Effect.catchAll((error) => Effect.gen(function* () {
      yield* Effect.logError(`❌ Demo failed: ${JSON.stringify(error)}`);
      return { error: JSON.stringify(error) };
    })),
  );

// ============================================================================
// 8. Run Demo (if executed directly)
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runDemo()).then(
    (result) => {
      console.log("🎯 Demo Result:", result);
      process.exit(0);
    },
    (error) => {
      console.error("💥 Demo Error:", error);
      process.exit(1);
    },
  );
}
