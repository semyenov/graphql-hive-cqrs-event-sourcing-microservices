// Universal Event Handler system for CQRS framework
import type { Event, IEventHandler } from '../event-sourcing/interfaces';
import type { EventHandlers } from '../event-sourcing/types';

// Generic event handler function type
export type EventHandlerFunction<T extends Event> = (event: T) => Promise<void> | void;

// Event handler registry with type safety
export class EventHandlerRegistry<TEvent extends Event = Event> {
  private handlers = new Map<TEvent['type'], EventHandlerFunction<TEvent>[]>();
  private wildcardHandlers: EventHandlerFunction<TEvent>[] = [];

  // Register a handler for a specific event type
  on<T extends TEvent['type']>(
    eventType: T,
    handler: EventHandlerFunction<Extract<TEvent, { type: T }>>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    const handlers = this.handlers.get(eventType)!;
    const typedHandler = handler as EventHandlerFunction<TEvent>;
    handlers.push(typedHandler);

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(typedHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  // Register a wildcard handler that receives all events
  onAny(handler: EventHandlerFunction<TEvent>): () => void {
    this.wildcardHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.wildcardHandlers.indexOf(handler);
      if (index > -1) {
        this.wildcardHandlers.splice(index, 1);
      }
    };
  }

  // Handle a single event with type safety
  async handle(event: TEvent): Promise<void> {
    const specificHandlers = this.handlers.get(event.type) || [];
    const allHandlers = [...specificHandlers, ...this.wildcardHandlers];

    if (allHandlers.length === 0) {
      return;
    }

    // Execute all handlers in parallel
    const promises = allHandlers.map(handler => 
      Promise.resolve(handler(event)).catch(error => {
        console.error(`Error in event handler for ${event.type}:`, error);
        throw error;
      })
    );

    await Promise.all(promises);
  }

  // Handle multiple events in batch
  async handleBatch(events: TEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.handle(event)));
  }

  // Handle events sequentially (useful when order matters)
  async handleSequential(events: TEvent[]): Promise<void> {
    for (const event of events) {
      await this.handle(event);
    }
  }

  // Get registered event types
  getRegisteredTypes(): TEvent['type'][] {
    return Array.from(this.handlers.keys());
  }

  // Get handler count for an event type
  getHandlerCount(eventType: TEvent['type']): number {
    return (this.handlers.get(eventType) || []).length + this.wildcardHandlers.length;
  }

  // Clear all handlers
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.length = 0;
  }

  // Clear handlers for specific event type
  clearType(eventType: TEvent['type']): void {
    this.handlers.delete(eventType);
  }
}

// Event dispatcher that integrates with event stores and handlers
export class EventDispatcher<TEvent extends Event = Event> {
  private registry = new EventHandlerRegistry<TEvent>();
  private middlewares: EventMiddleware<TEvent>[] = [];

  // Register an event handler
  on<T extends TEvent['type']>(
    eventType: T,
    handler: EventHandlerFunction<Extract<TEvent, { type: T }>>
  ): () => void {
    return this.registry.on(eventType, handler);
  }

  // Register wildcard handler
  onAny(handler: EventHandlerFunction<TEvent>): () => void {
    return this.registry.onAny(handler);
  }

  // Add middleware
  use(middleware: EventMiddleware<TEvent>): void {
    this.middlewares.push(middleware);
  }

  // Dispatch a single event
  async dispatch(event: TEvent): Promise<void> {
    let processedEvent = event;

    // Apply middlewares
    for (const middleware of this.middlewares) {
      processedEvent = await middleware(processedEvent);
    }

    // Handle the event
    await this.registry.handle(processedEvent);
  }

  // Dispatch multiple events
  async dispatchBatch(events: TEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.dispatch(event)));
  }

  // Get metrics
  getMetrics(): EventDispatcherMetrics {
    return {
      registeredTypes: this.registry.getRegisteredTypes().length,
      totalHandlers: this.registry.getRegisteredTypes()
        .reduce((sum, type) => sum + this.registry.getHandlerCount(type), 0),
      middlewareCount: this.middlewares.length,
    };
  }
}

// Middleware type for event processing
export type EventMiddleware<TEvent extends Event> = (event: TEvent) => Promise<TEvent> | TEvent;

// Event dispatcher metrics
export interface EventDispatcherMetrics {
  registeredTypes: number;
  totalHandlers: number;
  middlewareCount: number;
}

// Projection builder base class
export abstract class ProjectionBuilder<TEvent extends Event, TProjection> {
  protected projections = new Map<string, TProjection>();
  protected eventHandlerRegistry = new EventHandlerRegistry<TEvent>();

  constructor() {
    this.setupHandlers();
  }

  // Abstract method for subclasses to implement handler setup
  protected abstract setupHandlers(): void;

  // Handle a single event
  async handleEvent(event: TEvent): Promise<void> {
    await this.eventHandlerRegistry.handle(event);
  }

  // Rebuild projections from events
  async rebuild(events: TEvent[]): Promise<void> {
    this.projections.clear();
    await this.eventHandlerRegistry.handleSequential(events);
  }

  // Get projection by ID
  getProjection(id: string): TProjection | null {
    return this.projections.get(id) || null;
  }

  // Get all projections
  getAllProjections(): TProjection[] {
    return Array.from(this.projections.values());
  }

  // Search projections with predicate
  searchProjections(predicate: (projection: TProjection) => boolean): TProjection[] {
    return this.getAllProjections().filter(predicate);
  }

  // Clear all projections
  clear(): void {
    this.projections.clear();
  }

  // Get projection count
  getCount(): number {
    return this.projections.size;
  }

  // Protected helper for subclasses
  protected setProjection(id: string, projection: TProjection): void {
    this.projections.set(id, projection);
  }

  protected deleteProjection(id: string): boolean {
    return this.projections.delete(id);
  }
}

// Saga base class for handling cross-aggregate workflows
export abstract class Saga<TEvent extends Event = Event> implements IEventHandler<TEvent> {
  protected eventRegistry = new EventHandlerRegistry<TEvent>();
  protected state = new Map<string, unknown>();

  constructor() {
    this.setupHandlers();
  }

  // Abstract methods for subclasses
  abstract canHandle(event: TEvent): boolean;
  protected abstract setupHandlers(): void;

  // Handle event through the saga
  async handle(event: TEvent): Promise<void> {
    if (this.canHandle(event)) {
      await this.eventRegistry.handle(event);
    }
  }

  // Protected helper methods for subclasses
  protected setState(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  protected getState<T>(key: string): T | null {
    return (this.state.get(key) as T) || null;
  }

  protected clearState(key?: string): void {
    if (key) {
      this.state.delete(key);
    } else {
      this.state.clear();
    }
  }
}

// Event handler decorator for automatic registration
export const EventHandler = (eventType: string) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Store metadata for later registration
    if (!target.__eventHandlers) {
      target.__eventHandlers = [];
    }
    target.__eventHandlers.push({
      eventType,
      method: propertyKey,
      handler: descriptor.value,
    });
  };
};

// Utility to register handlers from decorated class
export const registerHandlers = <TEvent extends Event>(
  instance: any,
  registry: EventHandlerRegistry<TEvent>
): void => {
  const handlers = instance.__eventHandlers || [];
  handlers.forEach(({ eventType, handler }: any) => {
    registry.on(eventType, handler.bind(instance));
  });
};

// Factory for creating event dispatchers
export const createEventDispatcher = <TEvent extends Event>(): EventDispatcher<TEvent> => {
  return new EventDispatcher<TEvent>();
};