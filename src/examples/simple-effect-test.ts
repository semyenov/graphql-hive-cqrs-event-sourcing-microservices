/**
 * ✅ FIXED Simple Effect Test - No "this" keyword issues
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { pipe } from 'effect/Function';
import { CoreServicesLive } from '@cqrs/framework';

// Simple service
interface TestService {
  getValue(): Effect.Effect<string, never, never>;
}

const TestServiceTag = Context.GenericTag<TestService>('TestService');

// Service implementation
const TestServiceLive = Layer.succeed(
  TestServiceTag,
  {
    getValue: () => Effect.succeed('service-value'),
  }
);

// Simple test function using Effect.gen - NO "this" issues
const testEffect = Effect.gen(function* () {
  // ✅ NO "this" keyword - pure function approach
  const service = yield* TestServiceTag;
  const value = yield* service.getValue();
  console.log(`✅ Effect.gen works perfectly: ${value}`);
  return `Result: ${value}`;
});

// Main program
const program = pipe(
  testEffect,
  Effect.provide(TestServiceLive)
);

// Run the demo
if (import.meta.main) {
  pipe(
    program,
    Effect.runPromise
  ).then(
    (result) => console.log(`✨ Demo completed: ${result}`),
    (error) => console.error("❌ Demo failed:", error)
  );
}