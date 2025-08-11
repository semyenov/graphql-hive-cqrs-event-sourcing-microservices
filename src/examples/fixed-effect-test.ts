import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { pipe } from 'effect/Function';
import { createCommandHandler, CommandContext } from '@cqrs/framework/effect';
import { aggregateId } from '@cqrs/framework';

// Simple service
interface TestService {
  getValue(): Effect.Effect<string, never, never>;
}

const TestServiceTag = Context.GenericTag<TestService>('TestService');

// Simple command
interface TestCommand {
  type: 'TEST';
  aggregateId: any;
  payload: { value: string };
}

// Create handler
const handler = createCommandHandler<TestCommand, string>({
  canHandle: (cmd) => cmd.type === 'TEST',
  execute: (command) =>
    Effect.gen(function* () {
      const service = yield* TestServiceTag;
      const value = yield* service.getValue();
      return `${command.payload.value}: ${value}`;
    }),
});

// Service implementation
const TestServiceLive = Layer.succeed(
  TestServiceTag,
  {
    getValue: () => Effect.succeed('service-value'),
  }
);

// Command context
const CommandContextLive = Layer.succeed(
  CommandContext,
  {
    eventStore: {} as any,
    commandBus: {} as any,
  }
);

// Combined layer
const AppLive = Layer.mergeAll(TestServiceLive, CommandContextLive);

// Run the demo - fixed approach
const runTest = async () => {
  const command: TestCommand = {
    type: 'TEST',
    aggregateId: aggregateId('test'),
    payload: { value: 'test' },
  };

  // Don't use handler.handle inside a generator, use pipe directly
  const result = await pipe(
    handler.handle(command),
    Effect.provide(AppLive),
    Effect.runPromise
  );
  
  console.log('Result:', result);
  console.log('Success!');
};

runTest().catch((error) => console.error('Error:', error));