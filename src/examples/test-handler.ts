import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { createCommandHandler } from '@cqrs/framework/effect';

const handler = createCommandHandler({
  canHandle: (cmd) => true,
  execute: (cmd) => Effect.succeed('test'),
});

console.log('Handler:', handler);
console.log('Handle method:', handler.handle);

// Try to use it
const result = pipe(
  handler.handle({ type: 'TEST', aggregateId: 'test' as any, payload: {} }),
  Effect.runPromise
).then(
  (value: any) => console.log('Success:', value),
  (error: any) => console.log('Error:', error)
);