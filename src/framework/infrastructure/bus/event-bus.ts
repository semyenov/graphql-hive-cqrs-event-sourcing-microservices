/**
 * Framework Infrastructure: Event Bus
 * 
 * Publishes events to subscribers and manages event flow.
 */

import type { IEvent, IEventBus, EventHandler } from '../../core/event';

/**
 * Event bus implementation
 */
export class EventBus<TEvent extends IEvent = IEvent> implements IEventBus<TEvent> {
  private subscribers = new Map<string, Set<EventHandler<any>>>();
  private allSubscribers = new Set<EventHandler<TEvent>>();

  /**
   * Publish a single event
   */
  async publish(event: TEvent): Promise<void> {
    // Notify type-specific subscribers
    const typeSubscribers = this.subscribers.get(event.type);
    if (typeSubscribers) {
      await this.notifySubscribers(typeSubscribers, event);
    }

    // Notify all-event subscribers
    await this.notifySubscribers(this.allSubscribers, event);
  }

  /**
   * Publish multiple events
   */
  async publishBatch(events: readonly TEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Subscribe to specific event type
   */
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'],
    handler: EventHandler<TSpecificEvent>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(handler as EventHandler<any>);
    
    // Return unsubscribe function
    return () => {
      const typeSubscribers = this.subscribers.get(eventType);
      if (typeSubscribers) {
        typeSubscribers.delete(handler as EventHandler<any>);
        if (typeSubscribers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler<TEvent>): () => void {
    this.allSubscribers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.allSubscribers.delete(handler);
    };
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscribers.clear();
    this.allSubscribers.clear();
  }

  /**
   * Get subscriber count for event type
   */
  getSubscriberCount(eventType?: string): number {
    if (eventType) {
      return (this.subscribers.get(eventType)?.size || 0) + this.allSubscribers.size;
    }
    
    let total = this.allSubscribers.size;
    for (const typeSubscribers of this.subscribers.values()) {
      total += typeSubscribers.size;
    }
    return total;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Private: Notify subscribers with error handling
   */
  private async notifySubscribers<T extends TEvent>(
    subscribers: Set<EventHandler<T>>,
    event: T
  ): Promise<void> {
    const promises = Array.from(subscribers).map(subscriber =>
      Promise.resolve(subscriber(event)).catch(error => {
        console.error(`Event handler error for event ${event.type}:`, error);
        // Could emit error event here for monitoring
      })
    );
    
    await Promise.all(promises);
  }
}

/**
 * Factory for creating event bus
 */
export function createEventBus<TEvent extends IEvent>(): EventBus<TEvent> {
  return new EventBus<TEvent>();
}

/**
 * Event bus with replay capability
 */
export class ReplayableEventBus<TEvent extends IEvent = IEvent> 
  extends EventBus<TEvent> {
  
  private eventHistory: TEvent[] = [];
  private recordingEnabled = false;

  /**
   * Start recording events
   */
  startRecording(): void {
    this.recordingEnabled = true;
    this.eventHistory = [];
  }

  /**
   * Stop recording events
   */
  stopRecording(): void {
    this.recordingEnabled = false;
  }

  /**
   * Clear recorded events
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get recorded events
   */
  getHistory(): TEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Replay recorded events
   */
  async replay(): Promise<void> {
    const events = [...this.eventHistory];
    for (const event of events) {
      await super.publish(event);
    }
  }

  /**
   * Override publish to record events
   */
  async publish(event: TEvent): Promise<void> {
    if (this.recordingEnabled) {
      this.eventHistory.push(event);
    }
    await super.publish(event);
  }
}