/**
 * Effect Test Harness
 *
 * Main testing utilities for Effect-based CQRS framework
 */

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Ref from "effect/Ref";
import * as Duration from "effect/Duration";
import * as TestContext from "effect/TestContext";
import { pipe } from "effect/Function";

import type {
  IAggregateBehavior,
  ICommand,
  IEvent,
  IEventStore,
  ISnapshot,
} from "../core/types";
import type { AggregateId, AggregateVersion } from "../../core/branded/types";
import {
  createRepository,
  EffectRepository,
  type RepositoryContext,
  RepositoryContextTag,
} from "../core/repository-effects";

/**
 * Test event store that captures all operations for testing
 */
export class TestEventStore<
  TEvent extends IEvent,
  TId extends AggregateId,
  TState extends unknown = unknown,
> implements IEventStore<TEvent, TId> {
  private events = new Map<string, TEvent[]>();
  private allEvents: TEvent[] = [];
  private subscribers: Array<(event: TEvent) => void> = [];

  public readonly snapshotStore = new Map<string, ISnapshot<TState>>();

  async getEvents<TType extends TEvent["type"]>(
    aggregateId: TId,
    fromVersion?: AggregateVersion,
  ): Promise<ReadonlyArray<Extract<TEvent, { type: TType }>>> {
    const events = this.events.get(aggregateId as string) || [];
    return fromVersion !== undefined
      ? events.filter((e) =>
        e.version >= fromVersion
      ) as unknown as readonly Extract<TEvent, { type: TType }>[]
      : events as unknown as readonly Extract<TEvent, { type: TType }>[];
  }

  async appendBatch(
    events: readonly TEvent[],
    expectedVersion?: AggregateVersion,
  ): Promise<void> {
    for (const event of events) {
      const aggregateEvents = this.events.get(event.aggregateId as string) ||
        [];

      if (
        expectedVersion !== undefined &&
        aggregateEvents.length !== expectedVersion
      ) {
        throw new Error(
          `Version conflict: expected ${expectedVersion}, got ${aggregateEvents.length}`,
        );
      }

      aggregateEvents.push(event);
      this.events.set(event.aggregateId as string, aggregateEvents);
      this.allEvents.push(event);

      // Notify subscribers
      this.subscribers.forEach((handler) => handler(event));
    }
  }

  async getAllEvents<TType extends TEvent["type"]>(): Promise<
    readonly Extract<TEvent, { type: TType }>[]
  > {
    return [...this.allEvents] as unknown as readonly Extract<
      TEvent,
      { type: TType }
    >[];
  }

  subscribe(handler: (event: TEvent) => void): void {
    this.subscribers.push(handler);
  }

  // Test utilities
  getEventsForAggregate(aggregateId: TId): readonly TEvent[] {
    return this.events.get(aggregateId) || [];
  }

  getEventCount(): number {
    return this.allEvents.length;
  }

  clear(): void {
    this.events.clear();
    this.allEvents = [];
    this.subscribers = [];
  }
}

/**
 * Test harness for Effect-based CQRS testing
 */
export class EffectTestHarness<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId = AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId> =
    IAggregateBehavior<TState, TEvent, TId>,
> {
  private testEventStore: TestEventStore<TEvent, TId, TState>;
  private testLayer: Layer.Layer<
    RepositoryContext<TState, TEvent, TId>,
    never,
    never
  >;

  constructor() {
    this.testEventStore = new TestEventStore<TEvent, TId, TState>();
    this.testLayer = Layer.succeed(
      RepositoryContextTag<TState, TEvent, TId>(),
      {
        eventStore: this.testEventStore,
        snapshotStore: this.testEventStore.snapshotStore,
        cache: undefined,
      },
    );
  }

  /**
   * Run an effect with the test context
   */
  runTest<A, E>(
    effect: Effect.Effect<A, E, RepositoryContext<TState, TEvent, TId>>,
  ): Promise<A> {
    return pipe(
      effect,
      Effect.provide(this.testLayer),
      Effect.runPromise,
    );
  }

  /**
   * Run an effect with test clock for time-based testing
   */
  runTestWithTime<A, E>(
    effect: Effect.Effect<A, E, RepositoryContext<TState, TEvent, TId>>,
  ): Effect.Effect<A, E, typeof TestContext.TestContext> {
    return pipe(
      effect,
      Effect.provide(this.testLayer),
    );
  }

  /**
   * Create a repository for testing
   */
  createRepository<
    TState,
    TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  >(
    createAggregate: (id: AggregateId) => TAggregate,
    options?: {
      snapshotFrequency?: number;
      cacheCapacity?: number;
      cacheTTL?: Duration.DurationInput;
    },
  ): EffectRepository<TState, TEvent, TId, TAggregate> {
    return createRepository({
      createAggregate: (id) => createAggregate(id),
      ...options,
    });
  }

  /**
   * Get test event store for assertions
   */
  getEventStore(): TestEventStore<TEvent, TId, TState> {
    return this.testEventStore;
  }

  /**
   * Clear all test data
   */
  clear(): void {
    this.testEventStore.snapshotStore.clear();
    this.testEventStore.clear();
  }

  /**
   * Assert that events were stored
   */
  assertEventsStored(aggregateId: TId, expectedEventTypes: string[]): void {
    const events = this.testEventStore.getEventsForAggregate(aggregateId);
    const actualTypes = events.map((e) => e.type);

    if (actualTypes.length !== expectedEventTypes.length) {
      throw new Error(
        `Expected ${expectedEventTypes.length} events, got ${actualTypes.length}`,
      );
    }

    expectedEventTypes.forEach((expectedType, index) => {
      if (actualTypes[index] !== expectedType) {
        throw new Error(
          `Expected event ${index} to be ${expectedType}, got ${
            actualTypes[index]
          }`,
        );
      }
    });
  }

  /**
   * Assert total event count
   */
  assertTotalEventCount(expectedCount: number): void {
    const actualCount = this.testEventStore.getEventCount();
    if (actualCount !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} total events, got ${actualCount}`,
      );
    }
  }

  /**
   * Wait for events to be processed
   */
  waitForEvents(
    count: number,
    timeout: Duration.Duration = Duration.seconds(5),
  ): Effect.Effect<void, Error, never> {
    return pipe(
      Ref.make(0),
      Effect.flatMap((countRef) =>
        pipe(
          Effect.async<void, Error, never>((resume) => {
            const handler = () => {
              Ref.updateAndGet(countRef, (n) => n + 1)
                .pipe(
                  Effect.flatMap((current) => {
                    if (current >= count) {
                      resume(Effect.succeed(undefined));
                    }
                    return Effect.succeed(undefined);
                  }),
                  Effect.runSync,
                );
            };

            this.testEventStore.subscribe(handler);

            // Check if we already have enough events
            const currentCount = this.testEventStore.getEventCount();
            if (currentCount >= count) {
              resume(Effect.succeed(undefined));
            }

            return Effect.sync(() => {
              // Cleanup function
            });
          }),
          Effect.timeoutFail({
            duration: timeout,
            onTimeout: () => new Error(`Timeout waiting for ${count} events`),
          }),
        )
      ),
    );
  }
}

/**
 * Create a test harness instance
 */
export function createTestHarness<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId,
  TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
>(): EffectTestHarness<TState, TEvent, TId, TAggregate> {
  return new EffectTestHarness<TState, TEvent, TId, TAggregate>();
}

/**
 * Test utilities for Effect-based testing
 */
export const TestUtils = {
  /**
   * Create a test layer with mocked dependencies
   */
  createTestLayer<
    TState,
    TEvent extends IEvent,
    TId extends AggregateId,
    TAggregate extends IAggregateBehavior<TState, TEvent, TId>,
  >(): Layer.Layer<RepositoryContext<TState, TEvent, TId>, never, never> {
    const testEventStore = new TestEventStore<TEvent, TId, TState>();

    return Layer.succeed(
      RepositoryContextTag<TState, TEvent, TId>(),
      {
        eventStore: testEventStore,
        snapshotStore: testEventStore.snapshotStore,
        cache: undefined,
      },
    );
  },

  /**
   * Run an effect in test mode
   */
  runEffect<A, E>(effect: Effect.Effect<A, E, never>): Promise<A> {
    return Effect.runPromise(effect);
  },

  /**
   * Test an effect that should succeed
   */
  expectSuccess: <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.runPromise(effect),

  /**
   * Test an effect that should fail
   */
  expectFailure: <A, E>(effect: Effect.Effect<A, E, never>) =>
    pipe(
      effect,
      Effect.flip,
      Effect.runPromise,
    ),

  /**
   * Test timing with test clock
   */
  withTestClock: <A, E>(effect: Effect.Effect<A, E, never>) =>
    TestContext.TestContext.pipe((_) => {
      return effect;
    }),
};
