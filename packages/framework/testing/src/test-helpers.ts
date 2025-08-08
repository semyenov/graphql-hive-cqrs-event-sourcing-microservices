// Test helper utilities for CQRS/Event Sourcing
import type { Event, IEventStore, AggregateId } from '@cqrs-framework/core';

// Mock event store for testing
export class MockEventStore<TEvent extends Event> implements IEventStore<TEvent> {
  private events: TEvent[] = [];
  private subscribers: ((event: TEvent) => void)[] = [];

  async append(event: TEvent): Promise<void> {
    this.events.push(event);
    this.subscribers.forEach(sub => sub(event));
  }

  async appendBatch(events: TEvent[]): Promise<void> {
    this.events.push(...events);
    events.forEach(event => this.subscribers.forEach(sub => sub(event)));
  }

  async getEvents<TAggregateId extends AggregateId>(
    aggregateId: TAggregateId,
    fromVersion?: number
  ): Promise<Array<Extract<TEvent, { aggregateId: TAggregateId }>>> {
    return this.events.filter(
      e => String(e.aggregateId) === String(aggregateId) && 
      (!fromVersion || (typeof e.version === 'number' ? e.version : (e.version as unknown as number)) > fromVersion)
    ) as Array<Extract<TEvent, { aggregateId: TAggregateId }>>;
  }

  async getAllEvents(fromPosition?: number): Promise<TEvent[]> {
    return fromPosition ? this.events.slice(fromPosition) : [...this.events];
  }

  async getEventsByType<TType extends TEvent['type']>(
    type: TType
  ): Promise<Array<Extract<TEvent, { type: TType }>>> {
    return this.events.filter(e => e.type === type) as Array<Extract<TEvent, { type: TType }>>;
  }

  subscribe(callback: (event: TEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.events = [];
  }

  getAll(): TEvent[] {
    return [...this.events];
  }
}

// Test event factory
export function createTestEvent<T extends Event>(
  overrides: Partial<T> = {}
): T {
  return {
    id: 'test-event-id',
    aggregateId: 'test-aggregate-id',
    type: 'TestEvent',
    version: 1,
    timestamp: new Date(),
    data: {},
    ...overrides,
  } as T;
}

// Wait helper for eventual consistency testing
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Condition not met within timeout');
}

// Snapshot testing helper
export function createSnapshot<T>(value: T): string {
  return JSON.stringify(value, null, 2);
}

export function compareSnapshots(actual: string, expected: string): boolean {
  return actual === expected;
}