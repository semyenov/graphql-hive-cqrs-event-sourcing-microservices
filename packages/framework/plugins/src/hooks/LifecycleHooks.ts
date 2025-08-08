import type { Event, Command, IAggregate } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Hook execution priority levels
export enum HookPriority {
  HIGHEST = 1000,
  HIGH = 500,
  NORMAL = 100,
  LOW = 50,
  LOWEST = 10,
}

// Generic hook interface
export interface Hook<TArgs extends readonly unknown[] = readonly unknown[]> {
  readonly name: string;
  readonly priority?: number;
  execute(...args: TArgs): Promise<void> | void;
}

// Hook manager for managing and executing hooks
export class HookManager<TArgs extends readonly unknown[] = readonly unknown[]> {
  private readonly hooks: Hook<TArgs>[] = [];

  // Register a hook
  register(hook: Hook<TArgs>): this {
    this.hooks.push(hook);
    // Sort by priority (higher first)
    this.hooks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  // Unregister a hook by name
  unregister(name: string): boolean {
    const index = this.hooks.findIndex(h => h.name === name);
    if (index !== -1) {
      this.hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  // Execute all hooks
  async execute(...args: TArgs): Promise<HookExecutionResult[]> {
    const results: HookExecutionResult[] = [];

    for (const hook of this.hooks) {
      const startTime = Date.now();
      try {
        await hook.execute(...args);
        results.push({
          hookName: hook.name,
          success: true,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          hookName: hook.name,
          success: false,
          error: error as Error,
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  // Get registered hook names
  getHookNames(): string[] {
    return this.hooks.map(h => h.name);
  }

  // Get hook count
  getHookCount(): number {
    return this.hooks.length;
  }

  // Clear all hooks
  clear(): void {
    this.hooks.length = 0;
  }
}

// Lifecycle hooks for CQRS operations

// Command lifecycle hooks
export interface CommandLifecycleHooks<TCommand extends Command = Command, TEvent extends Event = Event> {
  beforeCommandExecution: HookManager<[TCommand]>;
  afterCommandExecution: HookManager<[TCommand, TEvent[]]>;
  onCommandExecutionError: HookManager<[TCommand, Error]>;
}

// Event lifecycle hooks
export interface EventLifecycleHooks<TEvent extends Event = Event> {
  beforeEventPersistence: HookManager<[TEvent[]]>;
  afterEventPersistence: HookManager<[TEvent[]]>;
  onEventPersistenceError: HookManager<[TEvent[], Error]>;
  beforeEventProcessing: HookManager<[TEvent]>;
  afterEventProcessing: HookManager<[TEvent]>;
  onEventProcessingError: HookManager<[TEvent, Error]>;
}

// Aggregate lifecycle hooks
export interface AggregateLifecycleHooks<TEvent extends Event = Event> {
  beforeAggregateLoad: HookManager<[string]>; // aggregateId
  afterAggregateLoad: HookManager<[IAggregate<unknown, TEvent>]>;
  onAggregateLoadError: HookManager<[string, Error]>;
  beforeAggregateSnapshot: HookManager<[IAggregate<unknown, TEvent>]>;
  afterAggregateSnapshot: HookManager<[IAggregate<unknown, TEvent>]>;
  onAggregateSnapshotError: HookManager<[IAggregate<unknown, TEvent>, Error]>;
}

// Application lifecycle hooks
export interface ApplicationLifecycleHooks {
  onApplicationStart: HookManager<[]>;
  onApplicationStop: HookManager<[]>;
  onApplicationError: HookManager<[Error]>;
  onHealthCheck: HookManager<[]>;
}

// Comprehensive lifecycle hook registry
export class LifecycleHookRegistry<TCommand extends Command = Command, TEvent extends Event = Event> {
  readonly command: CommandLifecycleHooks<TCommand, TEvent>;
  readonly event: EventLifecycleHooks<TEvent>;
  readonly aggregate: AggregateLifecycleHooks<TEvent>;
  readonly application: ApplicationLifecycleHooks;

  constructor() {
    this.command = {
      beforeCommandExecution: new HookManager(),
      afterCommandExecution: new HookManager(),
      onCommandExecutionError: new HookManager(),
    };

    this.event = {
      beforeEventPersistence: new HookManager(),
      afterEventPersistence: new HookManager(),
      onEventPersistenceError: new HookManager(),
      beforeEventProcessing: new HookManager(),
      afterEventProcessing: new HookManager(),
      onEventProcessingError: new HookManager(),
    };

    this.aggregate = {
      beforeAggregateLoad: new HookManager(),
      afterAggregateLoad: new HookManager(),
      onAggregateLoadError: new HookManager(),
      beforeAggregateSnapshot: new HookManager(),
      afterAggregateSnapshot: new HookManager(),
      onAggregateSnapshotError: new HookManager(),
    };

    this.application = {
      onApplicationStart: new HookManager(),
      onApplicationStop: new HookManager(),
      onApplicationError: new HookManager(),
      onHealthCheck: new HookManager(),
    };
  }

  // Get statistics for all hook managers
  getStatistics(): HookRegistryStatistics {
    return {
      command: {
        beforeCommandExecution: this.command.beforeCommandExecution.getHookCount(),
        afterCommandExecution: this.command.afterCommandExecution.getHookCount(),
        onCommandExecutionError: this.command.onCommandExecutionError.getHookCount(),
      },
      event: {
        beforeEventPersistence: this.event.beforeEventPersistence.getHookCount(),
        afterEventPersistence: this.event.afterEventPersistence.getHookCount(),
        onEventPersistenceError: this.event.onEventPersistenceError.getHookCount(),
        beforeEventProcessing: this.event.beforeEventProcessing.getHookCount(),
        afterEventProcessing: this.event.afterEventProcessing.getHookCount(),
        onEventProcessingError: this.event.onEventProcessingError.getHookCount(),
      },
      aggregate: {
        beforeAggregateLoad: this.aggregate.beforeAggregateLoad.getHookCount(),
        afterAggregateLoad: this.aggregate.afterAggregateLoad.getHookCount(),
        onAggregateLoadError: this.aggregate.onAggregateLoadError.getHookCount(),
        beforeAggregateSnapshot: this.aggregate.beforeAggregateSnapshot.getHookCount(),
        afterAggregateSnapshot: this.aggregate.afterAggregateSnapshot.getHookCount(),
        onAggregateSnapshotError: this.aggregate.onAggregateSnapshotError.getHookCount(),
      },
      application: {
        onApplicationStart: this.application.onApplicationStart.getHookCount(),
        onApplicationStop: this.application.onApplicationStop.getHookCount(),
        onApplicationError: this.application.onApplicationError.getHookCount(),
        onHealthCheck: this.application.onHealthCheck.getHookCount(),
      },
    };
  }

  // Clear all hooks
  clearAll(): void {
    // Command hooks
    this.command.beforeCommandExecution.clear();
    this.command.afterCommandExecution.clear();
    this.command.onCommandExecutionError.clear();

    // Event hooks
    this.event.beforeEventPersistence.clear();
    this.event.afterEventPersistence.clear();
    this.event.onEventPersistenceError.clear();
    this.event.beforeEventProcessing.clear();
    this.event.afterEventProcessing.clear();
    this.event.onEventProcessingError.clear();

    // Aggregate hooks
    this.aggregate.beforeAggregateLoad.clear();
    this.aggregate.afterAggregateLoad.clear();
    this.aggregate.onAggregateLoadError.clear();
    this.aggregate.beforeAggregateSnapshot.clear();
    this.aggregate.afterAggregateSnapshot.clear();
    this.aggregate.onAggregateSnapshotError.clear();

    // Application hooks
    this.application.onApplicationStart.clear();
    this.application.onApplicationStop.clear();
    this.application.onApplicationError.clear();
    this.application.onHealthCheck.clear();
  }
}

// Built-in hook implementations

// Logging hook for commands
export class CommandLoggingHook<TCommand extends Command, TEvent extends Event> implements Hook<[TCommand, TEvent[]]> {
  readonly name = 'command-logging';
  readonly priority = HookPriority.NORMAL;

  constructor(
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  execute(command: TCommand, events: TEvent[]): void {
    this.logger.info('Command executed', {
      commandType: command.type,
      aggregateId: command.aggregateId,
      eventCount: events.length,
      eventTypes: events.map(e => e.type),
    });
  }
}

// Metrics collection hook
export class MetricsCollectionHook<TCommand extends Command> implements Hook<[TCommand]> {
  readonly name = 'metrics-collection';
  readonly priority = HookPriority.LOW;

  private readonly metrics = new Map<string, number>();

  execute(command: TCommand): void {
    const count = this.metrics.get(command.type) ?? 0;
    this.metrics.set(command.type, count + 1);
  }

  getMetrics(): ReadonlyMap<string, number> {
    return this.metrics;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Health check hook
export class HealthCheckHook implements Hook<[]> {
  readonly name = 'health-check';
  readonly priority = HookPriority.NORMAL;

  constructor(
    private readonly healthChecks: Array<() => Promise<boolean> | boolean>
  ) {}

  async execute(): Promise<void> {
    for (const healthCheck of this.healthChecks) {
      const isHealthy = await healthCheck();
      if (!isHealthy) {
        throw new HookExecutionError(
          'Health check failed',
          'HEALTH_CHECK_FAILED',
          this.name
        );
      }
    }
  }

  addHealthCheck(healthCheck: () => Promise<boolean> | boolean): this {
    this.healthChecks.push(healthCheck);
    return this;
  }
}

// Type definitions

export interface HookExecutionResult {
  readonly hookName: string;
  readonly success: boolean;
  readonly error?: Error;
  readonly duration: number;
}

export interface HookRegistryStatistics {
  readonly command: {
    readonly beforeCommandExecution: number;
    readonly afterCommandExecution: number;
    readonly onCommandExecutionError: number;
  };
  readonly event: {
    readonly beforeEventPersistence: number;
    readonly afterEventPersistence: number;
    readonly onEventPersistenceError: number;
    readonly beforeEventProcessing: number;
    readonly afterEventProcessing: number;
    readonly onEventProcessingError: number;
  };
  readonly aggregate: {
    readonly beforeAggregateLoad: number;
    readonly afterAggregateLoad: number;
    readonly onAggregateLoadError: number;
    readonly beforeAggregateSnapshot: number;
    readonly afterAggregateSnapshot: number;
    readonly onAggregateSnapshotError: number;
  };
  readonly application: {
    readonly onApplicationStart: number;
    readonly onApplicationStop: number;
    readonly onApplicationError: number;
    readonly onHealthCheck: number;
  };
}

// Hook execution error class
export class HookExecutionError extends Error implements BaseError {
  public readonly type = 'INFRASTRUCTURE' as const;
  public readonly category = 'HOOK_EXECUTION' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: HookExecutionErrorCode,
    public readonly hookName?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HookExecutionError';
    this.code = code as ErrorCode;
  }
}

export type HookExecutionErrorCode =
  | 'HOOK_EXECUTION_FAILED'
  | 'HEALTH_CHECK_FAILED'
  | 'HOOK_REGISTRATION_FAILED';

// Global lifecycle hook registry instance
export const globalLifecycleHooks = new LifecycleHookRegistry();