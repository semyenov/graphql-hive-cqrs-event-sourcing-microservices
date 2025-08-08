import type { 
  Event, 
  Command, 
  Snapshot,
  IAggregate,
  EventReducer,
  IEventStore,
} from '@cqrs-framework/core';
import type { 
  AggregateId, 
  EventVersion, 
  Timestamp,
  Result,
  BaseError,
  ErrorCode,
} from '@cqrs-framework/types';

// Enhanced aggregate with advanced patterns
export abstract class EnhancedAggregate<
  TState,
  TEvent extends Event,
  TAggregateId extends AggregateId = AggregateId
> implements IAggregate<TState, TEvent, TAggregateId> {
  protected state: TState | null = null;
  protected version = 0;
  protected uncommittedEvents: TEvent[] = [];
  protected readonly snapshots: Map<number, Snapshot<TState, TAggregateId>> = new Map();
  protected lastSnapshotVersion = 0;
  
  // Performance tracking
  protected readonly metrics = {
    eventCount: 0,
    snapshotCount: 0,
    rehydrationTime: 0,
    commandsProcessed: 0,
  };

  constructor(
    protected readonly id: TAggregateId,
    protected readonly reducer: (state: TState | null, event: TEvent) => TState,
    protected readonly initialState: TState,
    protected readonly options: EnhancedAggregateOptions = {}
  ) {
    this.options = { ...DEFAULT_ENHANCED_OPTIONS, ...options };
  }

  // Core IAggregate implementation
  getState(): TState | null {
    return this.state;
  }

  getVersion(): number {
    return this.version;
  }

  getId(): TAggregateId {
    return this.id;
  }

  getUncommittedEvents(): readonly TEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
    this.metrics.eventCount += this.uncommittedEvents.length;
  }

  applyEvent(event: TEvent, isNew = false): void {
    if (event.aggregateId !== this.id) {
      throw new AggregateError(
        `Event aggregate ID mismatch: ${event.aggregateId} !== ${this.id}`,
        'AGGREGATE_MISMATCH'
      );
    }

    const previousState = this.state;
    try {
      this.state = this.reducer(this.state ?? this.initialState, event);
      this.version = event.version;

      if (isNew) {
        this.uncommittedEvents.push(event);
      }

      // Auto-snapshot if configured
      if (this.shouldCreateSnapshot()) {
        this.createSnapshot();
      }
    } catch (error) {
      // Rollback state on error
      this.state = previousState;
      throw new AggregateError(
        `Failed to apply event: ${error}`,
        'EVENT_APPLICATION_FAILED'
      );
    }
  }

  // Enhanced snapshot management
  createSnapshot(): Snapshot<TState, TAggregateId> {
    if (!this.state) {
      throw new AggregateError(
        'Cannot create snapshot of aggregate without state',
        'INVALID_STATE'
      );
    }

    const snapshot: Snapshot<TState, TAggregateId> = {
      aggregateId: this.id,
      version: this.version as EventVersion,
      state: structuredClone(this.state), // Deep copy for safety
      timestamp: new Date() as Timestamp,
    };

    this.snapshots.set(this.version, snapshot);
    this.lastSnapshotVersion = this.version;
    this.metrics.snapshotCount++;

    return snapshot;
  }

  // Get most recent snapshot
  getLatestSnapshot(): Snapshot<TState, TAggregateId> | null {
    if (this.snapshots.size === 0) {
      return null;
    }

    const latestVersion = Math.max(...this.snapshots.keys());
    return this.snapshots.get(latestVersion) ?? null;
  }

  // Load from snapshot with validation
  async loadFromSnapshot(
    snapshot: Snapshot<TState, TAggregateId>,
    subsequentEvents: TEvent[] = []
  ): Promise<void> {
    if (snapshot.aggregateId !== this.id) {
      throw new AggregateError(
        `Snapshot aggregate ID mismatch: ${snapshot.aggregateId} !== ${this.id}`,
        'SNAPSHOT_MISMATCH'
      );
    }

    const startTime = performance.now();

    // Restore state from snapshot
    this.state = structuredClone(snapshot.state);
    this.version = snapshot.version;
    this.lastSnapshotVersion = snapshot.version;

    // Apply subsequent events
    for (const event of subsequentEvents) {
      if (event.version > snapshot.version) {
        this.applyEvent(event, false);
      }
    }

    this.metrics.rehydrationTime = performance.now() - startTime;
  }

  // Enhanced command execution with validation and error handling
  protected async executeCommand<TCommand extends Command>(
    command: TCommand,
    handler: (command: TCommand, currentState: TState | null) => Promise<TEvent[]> | TEvent[]
  ): Promise<Result<TEvent[], AggregateError>> {
    try {
      // Pre-command validation
      const validationResult = await this.validateCommand(command);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
        };
      }

      // Execute command handler
      const events = await handler(command, this.state);
      const eventArray = Array.isArray(events) ? events : [events];

      // Validate generated events
      for (const event of eventArray) {
        const eventValidation = await this.validateEvent(event);
        if (!eventValidation.success) {
          return {
            success: false,
            error: eventValidation.error,
          };
        }
      }

      // Apply events
      eventArray.forEach(event => this.applyEvent(event, true));
      this.metrics.commandsProcessed++;

      return {
        success: true,
        value: eventArray,
      };
    } catch (error) {
      return {
        success: false,
        error: new AggregateError(
          `Command execution failed: ${error}`,
          'COMMAND_EXECUTION_FAILED'
        ),
      };
    }
  }

  // Concurrency control
  async ensureVersion(expectedVersion: number): Promise<void> {
    if (this.version !== expectedVersion) {
      throw new AggregateError(
        `Version conflict: expected ${expectedVersion}, actual ${this.version}`,
        'VERSION_CONFLICT'
      );
    }
  }

  // Pattern matching for complex event handling
  protected matchEvents<TResult>(
    events: TEvent[],
    patterns: Record<string, (event: TEvent) => TResult>
  ): TResult[] {
    return events.map(event => {
      const handler = patterns[event.type];
      if (!handler) {
        throw new AggregateError(
          `No handler for event type: ${event.type}`,
          'MISSING_EVENT_HANDLER'
        );
      }
      return handler(event);
    });
  }

  // Validation hooks (to be implemented by subclasses)
  protected async validateCommand(command: Command): Promise<Result<void, AggregateError>> {
    return { success: true, value: undefined };
  }

  protected async validateEvent(event: TEvent): Promise<Result<void, AggregateError>> {
    return { success: true, value: undefined };
  }

  // Metrics and observability
  getMetrics(): AggregateMetrics {
    return {
      ...this.metrics,
      currentVersion: this.version,
      stateSize: this.state ? JSON.stringify(this.state).length : 0,
      uncommittedEventCount: this.uncommittedEvents.length,
      snapshotCount: this.snapshots.size,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  // Private helper methods
  private shouldCreateSnapshot(): boolean {
    if (!this.options.autoSnapshot) return false;
    
    const eventsSinceSnapshot = this.version - this.lastSnapshotVersion;
    return eventsSinceSnapshot >= (this.options.snapshotFrequency ?? 100);
  }

  private getSnapshotReason(): string {
    if (this.version - this.lastSnapshotVersion >= (this.options.snapshotFrequency ?? 100)) {
      return 'frequency';
    }
    return 'manual';
  }

  private calculateMemoryUsage(): number {
    const stateSize = this.state ? JSON.stringify(this.state).length : 0;
    const eventsSize = JSON.stringify(this.uncommittedEvents).length;
    const snapshotsSize = Array.from(this.snapshots.values())
      .reduce((total, snapshot) => total + JSON.stringify(snapshot).length, 0);
    
    return stateSize + eventsSize + snapshotsSize;
  }
}

// Enhanced aggregate options
export interface EnhancedAggregateOptions {
  readonly autoSnapshot?: boolean;
  readonly snapshotFrequency?: number;
  readonly enableMetrics?: boolean;
  readonly maxUncommittedEvents?: number;
}

// Default options
export const DEFAULT_ENHANCED_OPTIONS: Required<EnhancedAggregateOptions> = {
  autoSnapshot: true,
  snapshotFrequency: 100,
  enableMetrics: true,
  maxUncommittedEvents: 1000,
} as const;

// Aggregate-specific error class
export class AggregateError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'AGGREGATE' as const;
  public readonly timestamp: Date;
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: AggregateErrorCode,
    public readonly aggregateId?: AggregateId
  ) {
    super(message);
    this.name = 'AggregateError';
    this.code = code as ErrorCode;
    this.timestamp = new Date();
  }
}

// Aggregate error codes
export type AggregateErrorCode =
  | 'AGGREGATE_MISMATCH'
  | 'SNAPSHOT_MISMATCH'
  | 'EVENT_APPLICATION_FAILED'
  | 'COMMAND_EXECUTION_FAILED'
  | 'VERSION_CONFLICT'
  | 'INVALID_STATE'
  | 'MISSING_EVENT_HANDLER'
  | 'VALIDATION_FAILED';

// Aggregate metrics interface
export interface AggregateMetrics {
  readonly eventCount: number;
  readonly snapshotCount: number;
  readonly rehydrationTime: number;
  readonly commandsProcessed: number;
  readonly currentVersion: number;
  readonly stateSize: number;
  readonly uncommittedEventCount: number;
  readonly memoryUsage: number;
}