/**
 * Effect Test Mocks
 * 
 * Mock implementations for testing Effect-based components
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Layer from 'effect/Layer';
import { pipe } from 'effect/Function';

import type { IEvent, ICommand, IEventStore, ICommandBus, IQueryBus, IAggregateBehavior } from '../core/types';
import type { AggregateId, AggregateVersion } from '../../core/branded/types';
import { BrandedTypes } from '../../core/branded';

/**
 * Mock command bus that records all sent commands
 */
export class MockCommandBus implements ICommandBus {
  private sentCommands: ICommand[] = [];

  async send<TCommand extends ICommand>(command: TCommand): Promise<unknown> {
    this.sentCommands.push(command);
    return { success: true };
  }

  getSentCommands(): ICommand[] {
    return [...this.sentCommands];
  }

  getCommandsOfType<T extends ICommand>(type: string): T[] {
    return this.sentCommands.filter(cmd => cmd.type === type) as T[];
  }

  clear(): void {
    this.sentCommands = [];
  }
}

/**
 * Mock query bus that can be configured with responses
 */
export class MockQueryBus implements IQueryBus {
  private responses = new Map<string, any>();
  private queriesAsked: any[] = [];

  async ask<TQuery>(query: TQuery): Promise<unknown> {
    this.queriesAsked.push(query);
    
    const queryType = (query as any).type;
    if (this.responses.has(queryType)) {
      const response = this.responses.get(queryType);
      if (typeof response === 'function') {
        return response(query);
      }
      return response;
    }
    
    return null;
  }

  setResponse<TResult>(queryType: string, response: TResult | ((query: any) => TResult)): void {
    this.responses.set(queryType, response);
  }

  getQueriesAsked(): any[] {
    return [...this.queriesAsked];
  }

  clear(): void {
    this.responses.clear();
    this.queriesAsked = [];
  }
}

/**
 * Mock aggregate for testing
 */
export class MockAggregate<TEvent extends IEvent, TId extends AggregateId = AggregateId> implements IAggregateBehavior<any, TEvent, TId> {
  public uncommittedEvents: TEvent[] = [];
  private _version: number = 0;

  constructor(public readonly id: TId) {
    this.id = id;
  }

  get version(): AggregateVersion {
    return BrandedTypes.aggregateVersion(this._version);
  }

  applyEvent(event: TEvent, isNew: boolean = false): void {
    if (isNew) {
      this.uncommittedEvents.push(event);
    }
    this._version++;
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  // Helper methods for testing
  addEvent(event: TEvent): void {
    this.applyEvent(event, true);
  }

  getUncommittedEventCount(): number {
    return this.uncommittedEvents.length;
  }

  getUncommittedEvents(): TEvent[] {
    return [...this.uncommittedEvents];
  }
}


export class MockAggregateBehavior<
  TState,
  TEvent extends IEvent,
  TId extends AggregateId = AggregateId
> implements IAggregateBehavior<TState, TEvent, TId> {
  public uncommittedEvents: TEvent[] = [];
  private _version: number = 0;

  constructor(public readonly id: TId) {
    this.id = id;
  }

  get version(): AggregateVersion {
    return BrandedTypes.aggregateVersion(this._version);
  }

  applyEvent(event: TEvent, isNew: boolean = false): void {
    if (isNew) {
      this.uncommittedEvents.push(event);
    }
    this._version++;
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  getUncommittedEventCount(): number {
    return this.uncommittedEvents.length;
  }

  getUncommittedEvents(): TEvent[] {
    return [...this.uncommittedEvents];
  }

  addEvent(event: TEvent): void {
    this.applyEvent(event, true);
  }
}

/**
 * Event builder for creating test events
 */
export class EventBuilder<TEvent extends IEvent> {
  private event: Partial<TEvent> = {};

  static create<T extends IEvent>(): EventBuilder<T> {
    return new EventBuilder<T>();
  }

  withType(type: string): this {
    (this.event as any).type = type;
    return this;
  }

  withAggregateId(aggregateId: AggregateId): this {
    (this.event as any).aggregateId = aggregateId;
    return this;
  }

  withVersion(version: number): this {
    (this.event as any).version = version;
    return this;
  }

  withData(data: unknown): this {
    (this.event as any).data = data;
    return this;
  }

  withTimestamp(timestamp: string): this {
    (this.event as any).timestamp = timestamp;
    return this;
  }

  build(): TEvent {
    const now = new Date().toISOString();
    return {
      type: 'TestEvent',
      aggregateId: 'test-id' as AggregateId,
      version: 1 as any,
      timestamp: now,
      data: {},
      ...this.event
    } as TEvent;
  }
}

/**
 * Command builder for creating test commands
 */
export class CommandBuilder<TCommand extends ICommand> {
  private command: Partial<TCommand> = {};

  static create<T extends ICommand>(): CommandBuilder<T> {
    return new CommandBuilder<T>();
  }

  withType(type: string): this {
    (this.command as any).type = type;
    return this;
  }

  withAggregateId(aggregateId: AggregateId): this {
    (this.command as any).aggregateId = aggregateId;
    return this;
  }

  withPayload(payload: unknown): this {
    (this.command as any).payload = payload;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    (this.command as any).metadata = metadata;
    return this;
  }

  build(): TCommand {
    return {
      type: 'TestCommand',
      aggregateId: 'test-id' as AggregateId,
      payload: {},
      ...this.command
    } as TCommand;
  }
}

/**
 * Spy utility for tracking function calls
 */
export class FunctionSpy<TArgs extends any[] = any[], TReturn = any> {
  private calls: TArgs[] = [];
  private returnValue: TReturn | undefined;
  private throwError: Error | undefined;

  constructor(private originalFn?: (...args: TArgs) => TReturn) {}

  // Create the spy function
  get fn(): (...args: TArgs) => TReturn {
    return (...args: TArgs) => {
      this.calls.push(args);
      
      if (this.throwError) {
        throw this.throwError;
      }
      
      if (this.returnValue !== undefined) {
        return this.returnValue;
      }
      
      if (this.originalFn) {
        return this.originalFn(...args);
      }
      
      return undefined as TReturn;
    };
  }

  // Configure spy behavior
  mockReturnValue(value: TReturn): this {
    this.returnValue = value;
    return this;
  }

  mockThrow(error: Error): this {
    this.throwError = error;
    return this;
  }

  // Assertions
  getCallCount(): number {
    return this.calls.length;
  }

  getCalls(): TArgs[] {
    return [...this.calls];
  }

  getCall(index: number): TArgs | undefined {
    return this.calls[index];
  }

  wasCalledWith(...expectedArgs: TArgs): boolean {
    return this.calls.some(args => 
      args.length === expectedArgs.length &&
      args.every((arg, i) => Object.is(arg, expectedArgs[i]))
    );
  }

  wasCalledTimes(expectedCount: number): boolean {
    return this.calls.length === expectedCount;
  }

  clear(): void {
    this.calls = [];
    this.returnValue = undefined;
    this.throwError = undefined;
  }
}

/**
 * Create a spy function
 */
export function createSpy<TArgs extends any[] = any[], TReturn = any>(
  originalFn?: (...args: TArgs) => TReturn
): FunctionSpy<TArgs, TReturn> {
  return new FunctionSpy(originalFn);
}

/**
 * Effect-based mock factories
 */
export const MockFactories = {
  /**
   * Create a mock command bus effect
   */
  createMockCommandBus: () => {
    const mockBus = new MockCommandBus();
    return {
      bus: mockBus,
      layer: Layer.succeed(
        {} as any, // Would need proper command bus service tag
        mockBus
      )
    };
  },

  /**
   * Create a mock query bus effect
   */
  createMockQueryBus: () => {
    const mockBus = new MockQueryBus();
    return {
      bus: mockBus,
      layer: Layer.succeed(
        {} as any, // Would need proper query bus service tag
        mockBus
      )
    };
  },

  /**
   * Create a counting effect for testing
   */
  createCounter: () => 
    pipe(
      Ref.make(0),
      Effect.map(ref => ({
        increment: Ref.update<number>(ref, n => n + 1),
        decrement: Ref.update<number>(ref, n => n - 1),
        get: Ref.get<number>(ref),
        reset: Ref.set<number>(ref, 0)
      }))
    ),

  /**
   * Create a delayed effect for testing timing
   */
  createDelayedEffect: <A>(value: A, delayMs: number = 100) =>
    pipe(
      Effect.sleep(`${delayMs} millis` as any),
      Effect.map(() => value)
    ),

  /**
   * Create a failing effect for error testing
   */
  createFailingEffect: <E>(error: E) => 
    Effect.fail(error)
};