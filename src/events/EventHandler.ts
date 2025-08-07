import type { Event, UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent } from './types';
import { isUserCreatedEvent, isUserUpdatedEvent, isUserDeletedEvent } from './typed-events';

// Event handler type definitions
export type EventHandlerFunction<T extends Event> = (event: T) => Promise<void> | void;

export interface EventHandlers {
  UserCreated?: EventHandlerFunction<UserCreatedEvent>[];
  UserUpdated?: EventHandlerFunction<UserUpdatedEvent>[];
  UserDeleted?: EventHandlerFunction<UserDeletedEvent>[];
}

// Type-safe event handler registry
export class EventHandlerRegistry {
  private handlers: EventHandlers = {};

  // Register a handler for a specific event type
  on<T extends keyof EventHandlers>(
    eventType: T,
    handler: NonNullable<EventHandlers[T]>[number]
  ): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType]!.push(handler as any);
  }

  // Handle an event with type safety
  async handle(event: Event): Promise<void> {
    if (isUserCreatedEvent(event) && this.handlers.UserCreated) {
      await Promise.all(this.handlers.UserCreated.map(handler => handler(event)));
    } else if (isUserUpdatedEvent(event) && this.handlers.UserUpdated) {
      await Promise.all(this.handlers.UserUpdated.map(handler => handler(event)));
    } else if (isUserDeletedEvent(event) && this.handlers.UserDeleted) {
      await Promise.all(this.handlers.UserDeleted.map(handler => handler(event)));
    }
  }

  // Batch handle multiple events
  async handleBatch(events: Event[]): Promise<void> {
    await Promise.all(events.map(event => this.handle(event)));
  }
}

// Example projection handler
export class UserProjectionHandler {
  private projections = new Map<string, any>();

  constructor(private registry: EventHandlerRegistry) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.registry.on('UserCreated', async (event) => {
      this.projections.set(event.aggregateId, {
        id: event.aggregateId,
        name: event.data.name,
        email: event.data.email,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        deleted: false,
      });
    });

    this.registry.on('UserUpdated', async (event) => {
      const existing = this.projections.get(event.aggregateId);
      if (existing) {
        this.projections.set(event.aggregateId, {
          ...existing,
          ...event.data,
          updatedAt: event.timestamp,
        });
      }
    });

    this.registry.on('UserDeleted', async (event) => {
      const existing = this.projections.get(event.aggregateId);
      if (existing) {
        this.projections.set(event.aggregateId, {
          ...existing,
          deleted: true,
          updatedAt: event.timestamp,
        });
      }
    });
  }

  getProjection(aggregateId: string): any {
    return this.projections.get(aggregateId);
  }

  getAllProjections(): any[] {
    return Array.from(this.projections.values()).filter(p => !p.deleted);
  }
}