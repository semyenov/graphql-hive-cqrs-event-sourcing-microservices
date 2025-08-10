/**
 * Effect-TS Integration Demo
 * 
 * Demonstrates the full Effect implementation in the CQRS framework
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

// Import framework Effect modules
import { 
  createCommandHandler,
  CommandContext,
  CommandValidationError,
  commandPipeline,
  exponentialBackoff,
  withCircuitBreaker,
  EventStoreService,
  CommandBusService,
  LoggerService,
  CoreServicesLive,
  adaptLegacyServices,
} from '@cqrs/framework/effect';

// Import domain types
import { BrandedTypes } from '@cqrs/framework';
import type { ICommand } from '@cqrs/framework';

/**
 * Example command
 */
interface CreateUserCommand extends ICommand {
  readonly type: 'CreateUser';
  readonly payload: {
    readonly name: string;
    readonly email: string;
  };
}

/**
 * Example: Basic Effect command handler
 */
const createUserHandler = createCommandHandler<CreateUserCommand, { userId: string }>({
  canHandle: (cmd) => cmd.type === 'CreateUser',
  
  // Validation phase
  validate: (command) => {
    if (!command.payload.email.includes('@')) {
      return Effect.fail(
        new CommandValidationError({
          command,
          errors: ['Invalid email format'],
        })
      );
    }
    return Effect.succeed(undefined);
  },
  
  // Execution phase with dependency injection
  execute: (command) =>
    Effect.gen(function* (_) {
      // Access services via context
      const logger = yield* _(LoggerService);
      
      // Log the command
      yield* _(logger.info(`Creating user: ${command.payload.name}`));
      
      // Simulate async operation
      yield* _(Effect.sleep(Duration.millis(100)));
      
      // Return result
      return { userId: BrandedTypes.aggregateId(`user-${Date.now()}`) };
    }),
  
  // Success callback
  onSuccess: (result, command) =>
    Effect.log(`User created successfully: ${result.userId}`),
  
  // Error callback
  onError: (error, command) =>
    Effect.log(`Failed to create user: ${error}`),
});

/**
 * Example: Command handler with resilience patterns
 */
const resilientHandler = pipe(
  createUserHandler,
  // Add retry with exponential backoff
  (handler) => commandPipeline(handler)
    .retry(exponentialBackoff({ maxAttempts: 3 }))
    .timeout(Duration.seconds(5))
    .circuitBreaker({
      maxFailures: 3,
      resetTimeout: Duration.seconds(30),
    })
    .build()
);

/**
 * Example: Service layer composition
 */
const createAppLayer = () => {
  // Mock implementations for demo
  const mockEventStore = {
    getEvents: async () => [],
    getAllEvents: async () => [],
    subscribe: () => {},
  };
  
  const mockCommandBus = {};
  const mockQueryBus = {};
  
  // Compose all services
  return Layer.mergeAll(
    CoreServicesLive,
    adaptLegacyServices({
      eventStore: mockEventStore as any,
      commandBus: mockCommandBus as any,
      queryBus: mockQueryBus as any,
    })
  );
};

/**
 * Example: Running effects with full context
 */
async function runExample() {
  console.log('🚀 Effect-TS Integration Demo\n');
  
  const command: CreateUserCommand = {
    type: 'CreateUser',
    payload: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  };
  
  // Create the service layer
  const appLayer = createAppLayer();
  
  // Execute command with all services provided
  const program = pipe(
    resilientHandler.handle(command),
    Effect.provideService(
      CommandContext,
      {
        eventStore: {} as any,
        commandBus: {} as any,
      }
    )
  );
  
  try {
    const result = await Effect.runPromise(program);
    console.log('✅ Success:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example: Effect composition patterns
 */
const demonstrateComposition = () => {
  // Sequential composition
  const sequential = pipe(
    Effect.log('Step 1'),
    Effect.flatMap(() => Effect.log('Step 2')),
    Effect.flatMap(() => Effect.log('Step 3'))
  );
  
  // Parallel composition
  const parallel = Effect.all([
    Effect.log('Parallel 1'),
    Effect.log('Parallel 2'),
    Effect.log('Parallel 3'),
  ], { concurrency: 'unbounded' });
  
  // Error handling
  const withErrorHandling = pipe(
    Effect.fail('Something went wrong'),
    Effect.catchAll((error) => Effect.log(`Handled error: ${error}`))
  );
  
  // Resource management
  const withResource = Effect.acquireUseRelease(
    Effect.log('Acquiring resource'),
    () => Effect.log('Using resource'),
    () => Effect.log('Releasing resource')
  );
  
  return { sequential, parallel, withErrorHandling, withResource };
};

/**
 * Example: Stream processing with Effect
 */
import * as Stream from 'effect/Stream';

const streamExample = () => {
  // Create an event stream
  const eventStream = Stream.fromIterable([1, 2, 3, 4, 5]).pipe(
    Stream.map((n) => n * 2),
    Stream.filter((n) => n > 5),
    Stream.tap((n) => Effect.log(`Processing: ${n}`))
  );
  
  // Run the stream
  return Stream.runCollect(eventStream);
};

// Run the demo
if (import.meta.main) {
  runExample()
    .then(() => {
      console.log('\n📊 Running composition examples...\n');
      const examples = demonstrateComposition();
      return Effect.runPromise(Effect.all([
        examples.sequential,
        examples.parallel,
        examples.withErrorHandling,
        examples.withResource,
      ], { concurrency: 1 }));
    })
    .then(() => {
      console.log('\n🌊 Running stream example...\n');
      return Effect.runPromise(streamExample());
    })
    .then((streamResult) => {
      console.log('Stream result:', Array.from(streamResult));
      console.log('\n✨ Demo completed!');
    })
    .catch(console.error);
}