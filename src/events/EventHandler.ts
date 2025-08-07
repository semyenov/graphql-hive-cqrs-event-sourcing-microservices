import type { Event, UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent } from './generic-types';
import { isUserCreatedEvent, isUserUpdatedEvent, isUserDeletedEvent } from './generic-types';

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
    handler: NonNullable<EventHandlers[T]> extends Array<infer H> ? H : never
  ): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [] as NonNullable<EventHandlers[T]>;
    }
    const handlers = this.handlers[eventType]!;
    (handlers as Array<typeof handler>).push(handler);
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

// User projection type
interface UserProjection {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

// Example projection handler
export class UserProjectionHandler {
  private projections = new Map<string, UserProjection>();

  constructor(private registry: EventHandlerRegistry) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.registry.on('UserCreated', async (event: UserCreatedEvent) => {
      this.projections.set(event.aggregateId, {
        id: event.aggregateId,
        name: event.data.name,
        email: event.data.email,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        deleted: false,
      });
    });

    this.registry.on('UserUpdated', async (event: UserUpdatedEvent) => {
      const existing = this.projections.get(event.aggregateId);
      if (existing) {
        this.projections.set(event.aggregateId, {
          ...existing,
          ...(event.data.name && { name: event.data.name }),
          ...(event.data.email && { email: event.data.email }),
          updatedAt: event.timestamp,
        });
      }
    });

    this.registry.on('UserDeleted', async (event: UserDeletedEvent) => {
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

  getProjection(aggregateId: string): UserProjection | undefined {
    return this.projections.get(aggregateId);
  }

  getAllProjections(): UserProjection[] {
    return Array.from(this.projections.values()).filter(p => !p.deleted);
  }
}