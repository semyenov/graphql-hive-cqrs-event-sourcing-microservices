// Event Stream Processing Utilities for CQRS/Event Sourcing Framework
import type { Event } from './events';

// Event stream for reactive processing
export interface EventStream<TEvent extends Event> {
  subscribe(handler: EventHandler<TEvent>): () => void;
  pipe<TResult>(transform: (event: TEvent) => TResult): EventStream<Event>;
  filter(predicate: (event: TEvent) => boolean): EventStream<TEvent>;
  take(count: number): EventStream<TEvent>;
  skip(count: number): EventStream<TEvent>;
  throttle(ms: number): EventStream<TEvent>;
  debounce(ms: number): EventStream<TEvent>;
  buffer(size: number): BufferedEventStream<TEvent>;
  window(duration: number): BufferedEventStream<TEvent>;
  merge(other: EventStream<TEvent>): EventStream<TEvent>;
  concat(other: EventStream<TEvent>): EventStream<TEvent>;
  distinct(keySelector?: (event: TEvent) => unknown): EventStream<TEvent>;
}

// Buffered event stream for batch processing
export interface BufferedEventStream<TEvent extends Event> {
  subscribe(handler: (events: TEvent[]) => void | Promise<void>): () => void;
  unbuffer(): EventStream<TEvent>;
}

// Event handler type
export type EventHandler<TEvent extends Event, TResult = void> = 
  (event: TEvent) => TResult | Promise<TResult>;

// Event processor with backpressure
export interface EventProcessor<TEvent extends Event> {
  process(event: TEvent): Promise<void>;
  pause(): void;
  resume(): void;
  getQueueSize(): number;
  setMaxQueueSize(size: number): void;
  getProcessingRate(): number;
  getErrorRate(): number;
  reset(): void;
}

// Subscription options
export interface SubscriptionOptions {
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  batchSize?: number;
  filter?: (event: Event) => boolean;
  autoAck?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Event subscription
export interface EventSubscription<TEvent extends Event> {
  id: string;
  eventTypes: TEvent['type'][];
  handler: EventHandler<TEvent>;
  options?: SubscriptionOptions;
  pause(): void;
  resume(): void;
  unsubscribe(): void;
  getStatus(): SubscriptionStatus;
  getMetrics(): SubscriptionMetrics;
}

// Subscription status
export type SubscriptionStatus = 'active' | 'paused' | 'error' | 'completed';

// Subscription metrics
export interface SubscriptionMetrics {
  eventsProcessed: number;
  eventsSkipped: number;
  errors: number;
  lastProcessedVersion?: number;
  lastProcessedTimestamp?: Date;
  processingRate: number; // events per second
  averageProcessingTime: number; // milliseconds
}

// Event bus interface
export interface EventBus<TEvent extends Event = Event> {
  publish(event: TEvent): Promise<void>;
  publishBatch(events: TEvent[]): Promise<void>;
  subscribe<TSpecificEvent extends TEvent>(
    eventType: TSpecificEvent['type'] | TSpecificEvent['type'][],
    handler: EventHandler<TSpecificEvent>,
    options?: SubscriptionOptions
  ): EventSubscription<TSpecificEvent>;
  subscribeAll(
    handler: EventHandler<TEvent>,
    options?: SubscriptionOptions
  ): EventSubscription<TEvent>;
  unsubscribe(subscriptionId: string): void;
  unsubscribeAll(): void;
  getSubscriptions(): EventSubscription<TEvent>[];
  getMetrics(): EventBusMetrics;
}

// Event bus metrics
export interface EventBusMetrics {
  totalPublished: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  queueSize: number;
  processingRate: number;
  errorRate: number;
}

// Event replay options
export interface ReplayOptions {
  speed?: number; // 1 = normal, 2 = 2x speed, 0.5 = half speed
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  filter?: (event: Event) => boolean;
  transform?: (event: Event) => Event;
}

// Event replayer for debugging and testing
export interface EventReplayer<TEvent extends Event> {
  replay(events: TEvent[], options?: ReplayOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  getProgress(): ReplayProgress;
}

// Replay progress
export interface ReplayProgress {
  currentIndex: number;
  totalEvents: number;
  currentVersion?: number;
  currentTimestamp?: Date;
  isPaused: boolean;
  isCompleted: boolean;
}