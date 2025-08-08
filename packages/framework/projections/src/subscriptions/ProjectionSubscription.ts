import type { Event, IEventStore } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';
import type { ProjectionBuilder, Projection } from '../builders/ProjectionBuilder';

// Projection subscription for real-time updates
export class ProjectionSubscription<TEvent extends Event = Event, TReadModel = unknown> {
  private isRunning = false;
  private unsubscribe: (() => void) | undefined = undefined;
  private readonly subscribers = new Set<ProjectionSubscriber<TReadModel>>();
  private lastProcessedEventId?: string;
  private processedEventCount = 0;
  private errorCount = 0;

  constructor(
    private readonly projectionBuilder: ProjectionBuilder<TEvent, TReadModel>,
    private readonly eventStore: IEventStore<TEvent>,
    private readonly options: ProjectionSubscriptionOptions = {}
  ) {
    this.options = { ...DEFAULT_SUBSCRIPTION_OPTIONS, ...options };
  }

  // Start the subscription
  async start(): Promise<Result<void, SubscriptionError>> {
    if (this.isRunning) {
      return {
        success: false,
        error: new SubscriptionError(
          'Subscription is already running',
          'ALREADY_RUNNING'
        ),
      };
    }

    try {
      // Subscribe to new events
      this.unsubscribe = this.eventStore.subscribe((event) => {
        this.processEvent(event).catch(error => {
          this.handleError(error, event);
        });
      });

      // Catch up on missed events if needed
      if (this.options.catchUpOnStart) {
        await this.catchUp();
      }

      this.isRunning = true;
      
      return {
        success: true,
        value: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: new SubscriptionError(
          `Failed to start subscription: ${error}`,
          'START_FAILED'
        ),
      };
    }
  }

  // Stop the subscription
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    
    this.isRunning = false;
  }

  // Subscribe to projection updates
  subscribe(subscriber: ProjectionSubscriber<TReadModel>): () => void {
    this.subscribers.add(subscriber);
    
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  // Get subscription status
  getStatus(): ProjectionSubscriptionStatus {
    const baseStatus = {
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      processedEventCount: this.processedEventCount,
      errorCount: this.errorCount,
    };
    
    return {
      ...baseStatus,
      ...(this.lastProcessedEventId !== undefined ? { lastProcessedEventId: this.lastProcessedEventId } : {}),
    };
  }

  // Manually trigger catch-up
  async catchUp(): Promise<Result<number, SubscriptionError>> {
    try {
      let fromPosition = 0;
      
      // If we have a last processed event ID, find its position
      if (this.lastProcessedEventId) {
        const allEvents = await this.eventStore.getAllEvents();
        const lastIndex = allEvents.findIndex(e => e.id === this.lastProcessedEventId);
        if (lastIndex !== -1) {
          fromPosition = lastIndex + 1;
        }
      }

      // Get events to catch up on
      const events = await this.eventStore.getAllEvents(fromPosition);
      let processedCount = 0;

      for (const event of events) {
        try {
          await this.processEvent(event);
          processedCount++;
        } catch (error) {
          this.handleError(error, event);
        }
      }

      return {
        success: true,
        value: processedCount,
      };
    } catch (error) {
      return {
        success: false,
        error: new SubscriptionError(
          `Catch-up failed: ${error}`,
          'CATCHUP_FAILED'
        ),
      };
    }
  }

  // Private helper methods
  private async processEvent(event: TEvent): Promise<void> {
    // Apply filters if configured
    if (this.options.eventFilter && !this.options.eventFilter(event)) {
      return;
    }

    // Process event through projection builder
    const result = await this.projectionBuilder.processEvent(event);
    
    if (result.success && result.value) {
      // Notify subscribers
      await this.notifySubscribers({
        type: 'projection_updated',
        projection: result.value,
        event,
        timestamp: new Date(),
      });
      
      this.lastProcessedEventId = event.id;
      this.processedEventCount++;
    } else if (!result.success) {
      throw result.error;
    }
  }

  private async notifySubscribers(update: ProjectionUpdate<TReadModel>): Promise<void> {
    const notifications = Array.from(this.subscribers).map(async (subscriber) => {
      try {
        await subscriber(update);
      } catch (error) {
        console.error('Projection subscriber error:', error);
      }
    });

    await Promise.allSettled(notifications);
  }

  private handleError(error: unknown, event?: TEvent): void {
    this.errorCount++;
    
    // Notify error subscribers
    const baseUpdate = {
      type: 'projection_error' as const,
      error: error as Error,
      timestamp: new Date(),
    };
    
    const errorUpdate: ProjectionUpdate<TReadModel> = {
      ...baseUpdate,
      ...(event !== undefined ? { event } : {}),
    };

    this.notifySubscribers(errorUpdate).catch(() => {
      // Ignore notification errors to prevent infinite loops
    });

    if (this.options.onError) {
      this.options.onError(error as Error, event);
    }
  }
}

// Projection subscriber function type
export type ProjectionSubscriber<TReadModel> = (
  update: ProjectionUpdate<TReadModel>
) => Promise<void> | void;

// Projection update interface
export interface ProjectionUpdate<TReadModel> {
  readonly type: 'projection_updated' | 'projection_error';
  readonly projection?: Projection<TReadModel>;
  readonly error?: Error;
  readonly event?: Event;
  readonly timestamp: Date;
}

// Subscription configuration
export interface ProjectionSubscriptionOptions {
  readonly catchUpOnStart?: boolean;
  readonly eventFilter?: (event: Event) => boolean;
  readonly onError?: (error: Error, event?: Event) => void;
  readonly batchSize?: number;
}

export const DEFAULT_SUBSCRIPTION_OPTIONS: Required<ProjectionSubscriptionOptions> = {
  catchUpOnStart: true,
  eventFilter: () => true,
  onError: (error) => console.error('Projection subscription error:', error),
  batchSize: 100,
} as const;

// Subscription status
export interface ProjectionSubscriptionStatus {
  readonly isRunning: boolean;
  readonly subscriberCount: number;
  readonly processedEventCount: number;
  readonly errorCount: number;
  readonly lastProcessedEventId?: string;
}

// Subscription-specific error class
export class SubscriptionError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'SUBSCRIPTION' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: SubscriptionErrorCode
  ) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code as ErrorCode;
  }
}

export type SubscriptionErrorCode =
  | 'ALREADY_RUNNING'
  | 'START_FAILED'
  | 'CATCHUP_FAILED'
  | 'PROCESSING_FAILED';

// Projection manager for managing multiple subscriptions
export class ProjectionManager {
  private readonly subscriptions = new Map<string, ProjectionSubscription<Event, unknown>>();

  // Register a projection subscription
  register<TEvent extends Event, TReadModel>(
    name: string,
    subscription: ProjectionSubscription<TEvent, TReadModel>
  ): void {
    this.subscriptions.set(name, subscription as unknown as ProjectionSubscription<Event, unknown>);
  }

  // Start all subscriptions
  async startAll(): Promise<Result<void, SubscriptionError>> {
    const results = await Promise.allSettled(
      Array.from(this.subscriptions.values()).map(sub => sub.start())
    );

    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);

    if (failures.length > 0) {
      return {
        success: false,
        error: new SubscriptionError(
          `${failures.length} subscriptions failed to start`,
          'START_FAILED'
        ),
      };
    }

    return {
      success: true,
      value: undefined,
    };
  }

  // Stop all subscriptions
  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.subscriptions.values()).map(sub => sub.stop())
    );
  }

  // Get subscription by name
  get(name: string): ProjectionSubscription<Event, unknown> | undefined {
    return this.subscriptions.get(name);
  }

  // Get all subscription statuses
  getStatuses(): Record<string, ProjectionSubscriptionStatus> {
    const statuses: Record<string, ProjectionSubscriptionStatus> = {};
    
    for (const [name, subscription] of this.subscriptions.entries()) {
      statuses[name] = subscription.getStatus();
    }
    
    return statuses;
  }

  // Remove subscription
  remove(name: string): boolean {
    const subscription = this.subscriptions.get(name);
    if (subscription) {
      subscription.stop().catch(() => {
        // Ignore stop errors during removal
      });
      return this.subscriptions.delete(name);
    }
    return false;
  }
}

// Global projection manager instance
export const projectionManager = new ProjectionManager();