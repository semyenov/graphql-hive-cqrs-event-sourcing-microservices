/**
 * Property-Based Testing Framework
 * 
 * Advanced property-based testing for CQRS/Event Sourcing systems:
 * - Generative testing with custom generators
 * - Property verification for domain invariants
 * - State-based testing for aggregates
 * - Command/Event property testing
 * - Shrinking strategies for minimal failing cases
 * - Integration with fast-check and hypothesis testing
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import type { ICommand, IEvent, IAggregate } from '../effect/core/types';
import type { AggregateId } from '../core/branded';

/**
 * Property test result
 */
export interface PropertyTestResult {
  readonly success: boolean;
  readonly iterations: number;
  readonly counterExample?: any;
  readonly shrunkCounterExample?: any;
  readonly seed: number;
  readonly duration: Duration.Duration;
  readonly property: string;
  readonly error?: Error;
}

/**
 * Generator interface
 */
export interface Generator<T> {
  readonly generate: (size: number, seed: number) => T;
  readonly shrink: (value: T) => T[];
  readonly name: string;
}

/**
 * Property interface
 */
export interface Property<T> {
  readonly name: string;
  readonly predicate: (value: T) => boolean | Effect.Effect<boolean, Error, never>;
  readonly precondition?: (value: T) => boolean;
}

/**
 * Test configuration
 */
export interface PropertyTestConfig {
  readonly iterations: number;
  readonly maxShrinks: number;
  readonly timeout: Duration.Duration;
  readonly seed?: number;
  readonly verbose: boolean;
}

/**
 * Basic generators
 */
export class Generators {
  /**
   * Integer generator
   */
  static integer(min: number = -1000, max: number = 1000): Generator<number> {
    return {
      name: `integer(${min}, ${max})`,
      generate: (size: number, seed: number) => {
        const random = this.seededRandom(seed);
        const range = Math.min(max - min, size * 10);
        return Math.floor(random() * range) + min;
      },
      shrink: (value: number) => {
        const shrinks: number[] = [];
        if (value !== 0) shrinks.push(0);
        if (value > 0) {
          shrinks.push(Math.floor(value / 2));
          if (value > 1) shrinks.push(value - 1);
        }
        if (value < 0) {
          shrinks.push(Math.ceil(value / 2));
          if (value < -1) shrinks.push(value + 1);
        }
        return shrinks.filter(v => v !== value);
      },
    };
  }

  /**
   * String generator
   */
  static string(minLength: number = 0, maxLength: number = 100): Generator<string> {
    return {
      name: `string(${minLength}, ${maxLength})`,
      generate: (size: number, seed: number) => {
        const random = this.seededRandom(seed);
        const length = minLength + Math.floor(random() * Math.min(maxLength - minLength, size));
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(random() * chars.length));
        }
        return result;
      },
      shrink: (value: string) => {
        const shrinks: string[] = [];
        if (value.length > 0) {
          shrinks.push('');
          shrinks.push(value.substring(0, Math.floor(value.length / 2)));
          if (value.length > 1) {
            shrinks.push(value.substring(0, value.length - 1));
            shrinks.push(value.substring(1));
          }
        }
        return shrinks.filter(v => v !== value);
      },
    };
  }

  /**
   * Array generator
   */
  static array<T>(elementGenerator: Generator<T>, minLength: number = 0, maxLength: number = 20): Generator<T[]> {
    return {
      name: `array(${elementGenerator.name}, ${minLength}, ${maxLength})`,
      generate: (size: number, seed: number) => {
        const random = this.seededRandom(seed);
        const length = minLength + Math.floor(random() * Math.min(maxLength - minLength, size));
        const result: T[] = [];
        for (let i = 0; i < length; i++) {
          result.push(elementGenerator.generate(size, this.combineSeed(seed, i)));
        }
        return result;
      },
      shrink: (value: T[]) => {
        const shrinks: T[][] = [];
        if (value.length > 0) {
          shrinks.push([]);
          shrinks.push(value.slice(0, Math.floor(value.length / 2)));
          if (value.length > 1) {
            shrinks.push(value.slice(0, value.length - 1));
            shrinks.push(value.slice(1));
          }
        }
        
        // Try shrinking individual elements
        for (let i = 0; i < value.length; i++) {
          const elementShrinks = elementGenerator.shrink(value[i]);
          for (const shrunk of elementShrinks) {
            const newArray = [...value];
            newArray[i] = shrunk;
            shrinks.push(newArray);
          }
        }
        
        return shrinks.filter(v => !this.arrayEquals(v, value));
      },
    };
  }

  /**
   * Choice generator
   */
  static choice<T>(...choices: T[]): Generator<T> {
    return {
      name: `choice(${choices.length} options)`,
      generate: (size: number, seed: number) => {
        const random = this.seededRandom(seed);
        return choices[Math.floor(random() * choices.length)];
      },
      shrink: (value: T) => {
        const index = choices.indexOf(value);
        return choices.slice(0, index);
      },
    };
  }

  /**
   * Object generator
   */
  static object<T>(schema: { [K in keyof T]: Generator<T[K]> }): Generator<T> {
    const keys = Object.keys(schema) as (keyof T)[];
    
    return {
      name: `object(${keys.length} fields)`,
      generate: (size: number, seed: number) => {
        const result = {} as T;
        for (const key of keys) {
          result[key] = schema[key].generate(size, this.combineSeed(seed, key.toString()));
        }
        return result;
      },
      shrink: (value: T) => {
        const shrinks: T[] = [];
        
        for (const key of keys) {
          const fieldShrinks = schema[key].shrink(value[key]);
          for (const shrunk of fieldShrinks) {
            shrinks.push({ ...value, [key]: shrunk });
          }
        }
        
        return shrinks;
      },
    };
  }

  /**
   * Seeded random number generator
   */
  private static seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  /**
   * Combine seeds
   */
  private static combineSeed(seed: number, additional: string | number): number {
    const add = typeof additional === 'string' 
      ? additional.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
      : additional;
    return (seed + add) & 0x7fffffff;
  }

  /**
   * Array equality check
   */
  private static arrayEquals<T>(a: T[], b: T[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }
}

/**
 * CQRS-specific generators
 */
export class CQRSGenerators {
  /**
   * Command generator
   */
  static command(types: string[]): Generator<ICommand> {
    return {
      name: 'command',
      generate: (size: number, seed: number) => {
        const random = Generators.seededRandom(seed);
        const type = types[Math.floor(random() * types.length)];
        
        return {
          id: this.generateId(seed),
          type,
          aggregateId: this.generateAggregateId(seed + 1),
          payload: this.generatePayload(size, seed + 2),
          timestamp: new Date(Date.now() - Math.floor(random() * 86400000)), // Last 24h
          metadata: {
            correlationId: this.generateId(seed + 3),
            userId: this.generateId(seed + 4),
          },
        };
      },
      shrink: (command: ICommand) => {
        const shrinks: ICommand[] = [];
        
        // Try simpler payload
        if (typeof command.payload === 'object' && command.payload !== null) {
          const keys = Object.keys(command.payload);
          if (keys.length > 0) {
            shrinks.push({ ...command, payload: {} });
            
            // Remove one field at a time
            for (const key of keys) {
              const { [key]: removed, ...rest } = command.payload;
              shrinks.push({ ...command, payload: rest });
            }
          }
        }
        
        return shrinks;
      },
    };
  }

  /**
   * Event generator
   */
  static event(types: string[]): Generator<IEvent> {
    return {
      name: 'event',
      generate: (size: number, seed: number) => {
        const random = Generators.seededRandom(seed);
        const type = types[Math.floor(random() * types.length)];
        
        return {
          id: this.generateId(seed),
          type,
          aggregateId: this.generateAggregateId(seed + 1),
          version: Math.floor(random() * 100) + 1,
          data: this.generatePayload(size, seed + 2),
          timestamp: new Date(Date.now() - Math.floor(random() * 86400000)),
          causationId: this.generateId(seed + 3),
          correlationId: this.generateId(seed + 4),
        };
      },
      shrink: (event: IEvent) => {
        const shrinks: IEvent[] = [];
        
        // Try smaller version
        if (event.version > 1) {
          shrinks.push({ ...event, version: 1 });
          shrinks.push({ ...event, version: Math.floor(event.version / 2) });
        }
        
        // Try simpler data
        if (typeof event.data === 'object' && event.data !== null) {
          const keys = Object.keys(event.data);
          if (keys.length > 0) {
            shrinks.push({ ...event, data: {} });
          }
        }
        
        return shrinks;
      },
    };
  }

  /**
   * Event sequence generator
   */
  static eventSequence(types: string[], minLength: number = 1, maxLength: number = 10): Generator<IEvent[]> {
    return {
      name: 'eventSequence',
      generate: (size: number, seed: number) => {
        const random = Generators.seededRandom(seed);
        const length = minLength + Math.floor(random() * Math.min(maxLength - minLength, size));
        const aggregateId = this.generateAggregateId(seed);
        const events: IEvent[] = [];
        
        for (let i = 0; i < length; i++) {
          const event = CQRSGenerators.event(types).generate(size, seed + i + 1);
          events.push({
            ...event,
            aggregateId,
            version: i + 1,
          });
        }
        
        return events;
      },
      shrink: (events: IEvent[]) => {
        const shrinks: IEvent[][] = [];
        
        if (events.length > 0) {
          shrinks.push([]);
          shrinks.push(events.slice(0, Math.floor(events.length / 2)));
          if (events.length > 1) {
            shrinks.push(events.slice(0, events.length - 1));
          }
        }
        
        return shrinks;
      },
    };
  }

  /**
   * Generate ID
   */
  private static generateId(seed: number): string {
    const random = Generators.seededRandom(seed);
    return Math.floor(random() * 1000000).toString(36).padStart(6, '0');
  }

  /**
   * Generate aggregate ID
   */
  private static generateAggregateId(seed: number): AggregateId {
    return this.generateId(seed) as AggregateId;
  }

  /**
   * Generate payload
   */
  private static generatePayload(size: number, seed: number): any {
    const random = Generators.seededRandom(seed);
    const complexity = Math.min(size, 5);
    
    const payload: any = {};
    
    for (let i = 0; i < complexity; i++) {
      const key = `field${i}`;
      const type = Math.floor(random() * 4);
      
      switch (type) {
        case 0:
          payload[key] = Math.floor(random() * 1000);
          break;
        case 1:
          payload[key] = this.generateId(seed + i);
          break;
        case 2:
          payload[key] = random() > 0.5;
          break;
        case 3:
          payload[key] = new Date(Date.now() - Math.floor(random() * 86400000));
          break;
      }
    }
    
    return payload;
  }
}

/**
 * Property test runner
 */
export class PropertyTestRunner {
  constructor(private readonly config: PropertyTestConfig) {}

  /**
   * Run property test
   */
  runTest<T>(
    generator: Generator<T>,
    property: Property<T>
  ): Effect.Effect<PropertyTestResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const seed = this.config.seed ?? Date.now();
      let iterations = 0;
      
      for (let i = 0; i < this.config.iterations; i++) {
        const value = generator.generate(i, seed + i);
        iterations++;
        
        // Check precondition
        if (property.precondition && !property.precondition(value)) {
          continue;
        }
        
        // Run property test
        const result = yield* _(
          pipe(
            this.runPropertyCheck(property, value),
            Effect.timeout(this.config.timeout),
            Effect.catchAll(() => Effect.succeed(false))
          )
        );
        
        if (!result) {
          // Property failed, try to shrink
          const shrunk = yield* _(this.shrinkCounterExample(generator, property, value));
          
          return {
            success: false,
            iterations,
            counterExample: value,
            shrunkCounterExample: shrunk,
            seed,
            duration: Duration.millis(Date.now() - startTime),
            property: property.name,
          };
        }
      }
      
      return {
        success: true,
        iterations,
        seed,
        duration: Duration.millis(Date.now() - startTime),
        property: property.name,
      };
    });
  }

  /**
   * Run property check
   */
  private runPropertyCheck<T>(
    property: Property<T>,
    value: T
  ): Effect.Effect<boolean, Error, never> {
    const result = property.predicate(value);
    
    if (typeof result === 'boolean') {
      return Effect.succeed(result);
    } else {
      return result;
    }
  }

  /**
   * Shrink counter example
   */
  private shrinkCounterExample<T>(
    generator: Generator<T>,
    property: Property<T>,
    counterExample: T
  ): Effect.Effect<T, Error, never> {
    return Effect.gen(function* (_) {
      let current = counterExample;
      let shrinkAttempts = 0;
      
      while (shrinkAttempts < this.config.maxShrinks) {
        const shrinks = generator.shrink(current);
        let foundSmaller = false;
        
        for (const shrunk of shrinks) {
          // Check if precondition still holds
          if (property.precondition && !property.precondition(shrunk)) {
            continue;
          }
          
          // Check if property still fails
          const result = yield* _(
            pipe(
              this.runPropertyCheck(property, shrunk),
              Effect.timeout(this.config.timeout),
              Effect.catchAll(() => Effect.succeed(true)) // Assume passes on timeout
            )
          );
          
          if (!result) {
            current = shrunk;
            foundSmaller = true;
            break;
          }
        }
        
        if (!foundSmaller) break;
        shrinkAttempts++;
      }
      
      return current;
    });
  }
}

/**
 * CQRS property test suite
 */
export class CQRSPropertyTests {
  constructor(
    private readonly runner: PropertyTestRunner
  ) {}

  /**
   * Test command handling idempotency
   */
  testCommandIdempotency<T extends IAggregate>(
    commandTypes: string[],
    createAggregate: () => T,
    handleCommand: (aggregate: T, command: ICommand) => Effect.Effect<void, Error, never>
  ): Effect.Effect<PropertyTestResult, Error, never> {
    const generator = CQRSGenerators.command(commandTypes);
    const property: Property<ICommand> = {
      name: 'Command handling is idempotent',
      predicate: (command) => Effect.gen(function* (_) {
        const aggregate1 = createAggregate();
        const aggregate2 = createAggregate();
        
        // Handle command twice on first aggregate
        yield* _(handleCommand(aggregate1, command));
        yield* _(handleCommand(aggregate1, command));
        
        // Handle command once on second aggregate  
        yield* _(handleCommand(aggregate2, command));
        
        // States should be identical
        return JSON.stringify(aggregate1) === JSON.stringify(aggregate2);
      }),
    };
    
    return this.runner.runTest(generator, property);
  }

  /**
   * Test event sequence validity
   */
  testEventSequenceValidity(
    eventTypes: string[],
    isValidSequence: (events: IEvent[]) => boolean
  ): Effect.Effect<PropertyTestResult, Error, never> {
    const generator = CQRSGenerators.eventSequence(eventTypes);
    const property: Property<IEvent[]> = {
      name: 'Event sequences are valid',
      predicate: (events) => isValidSequence(events),
      precondition: (events) => events.length > 0,
    };
    
    return this.runner.runTest(generator, property);
  }

  /**
   * Test aggregate state transitions
   */
  testAggregateStateTransitions<T extends IAggregate>(
    eventTypes: string[],
    createAggregate: () => T,
    applyEvent: (aggregate: T, event: IEvent) => void,
    isValidState: (aggregate: T) => boolean
  ): Effect.Effect<PropertyTestResult, Error, never> {
    const generator = CQRSGenerators.eventSequence(eventTypes);
    const property: Property<IEvent[]> = {
      name: 'Aggregate state transitions are valid',
      predicate: (events) => Effect.gen(function* (_) {
        const aggregate = createAggregate();
        
        // Apply events sequentially
        for (const event of events) {
          applyEvent(aggregate, event);
          
          // Check state validity after each event
          if (!isValidState(aggregate)) {
            return false;
          }
        }
        
        return true;
      }),
    };
    
    return this.runner.runTest(generator, property);
  }

  /**
   * Test command/event causation
   */
  testCommandEventCausation(
    commandTypes: string[],
    eventTypes: string[],
    handleCommand: (command: ICommand) => Effect.Effect<IEvent[], Error, never>
  ): Effect.Effect<PropertyTestResult, Error, never> {
    const generator = CQRSGenerators.command(commandTypes);
    const property: Property<ICommand> = {
      name: 'Command handling produces causally related events',
      predicate: (command) => Effect.gen(function* (_) {
        const events = yield* _(handleCommand(command));
        
        // All events should have the command as causation
        return events.every(event => 
          event.causationId === command.id &&
          event.correlationId === command.metadata?.correlationId &&
          event.aggregateId === command.aggregateId
        );
      }),
    };
    
    return this.runner.runTest(generator, property);
  }

  /**
   * Test event store consistency
   */
  testEventStoreConsistency<T>(
    eventTypes: string[],
    eventStore: {
      append: (events: IEvent[]) => Effect.Effect<void, Error, never>;
      readStream: (aggregateId: AggregateId, fromVersion?: number) => Effect.Effect<IEvent[], Error, never>;
    }
  ): Effect.Effect<PropertyTestResult, Error, never> {
    const generator = CQRSGenerators.eventSequence(eventTypes);
    const property: Property<IEvent[]> = {
      name: 'Event store maintains consistency',
      predicate: (events) => Effect.gen(function* (_) {
        if (events.length === 0) return true;
        
        const aggregateId = events[0].aggregateId;
        
        // Append events
        yield* _(eventStore.append(events));
        
        // Read back events
        const readEvents = yield* _(eventStore.readStream(aggregateId));
        
        // Should get the same events in the same order
        return events.length === readEvents.length &&
               events.every((event, i) => 
                 event.id === readEvents[i].id &&
                 event.version === readEvents[i].version
               );
      }),
    };
    
    return this.runner.runTest(generator, property);
  }
}

/**
 * Property test configuration presets
 */
export const PropertyTestPresets = {
  /**
   * Fast testing preset
   */
  fast: (): PropertyTestConfig => ({
    iterations: 100,
    maxShrinks: 10,
    timeout: Duration.seconds(1),
    verbose: false,
  }),

  /**
   * Thorough testing preset  
   */
  thorough: (): PropertyTestConfig => ({
    iterations: 1000,
    maxShrinks: 100,
    timeout: Duration.seconds(5),
    verbose: true,
  }),

  /**
   * Stress testing preset
   */
  stress: (): PropertyTestConfig => ({
    iterations: 10000,
    maxShrinks: 1000,
    timeout: Duration.seconds(10),
    verbose: true,
  }),

  /**
   * CI testing preset
   */
  ci: (): PropertyTestConfig => ({
    iterations: 500,
    maxShrinks: 50,
    timeout: Duration.seconds(3),
    verbose: false,
  }),
};

/**
 * Create property test suite
 */
export const createPropertyTestSuite = (config?: Partial<PropertyTestConfig>): CQRSPropertyTests => {
  const fullConfig = {
    ...PropertyTestPresets.fast(),
    ...config,
  };
  
  const runner = new PropertyTestRunner(fullConfig);
  return new CQRSPropertyTests(runner);
};