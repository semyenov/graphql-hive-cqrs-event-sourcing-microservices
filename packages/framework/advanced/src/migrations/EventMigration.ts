import type { Event } from '@cqrs-framework/core';
import type { Result, BaseError, ErrorCode } from '@cqrs-framework/types';

// Event migration interface
export interface EventMigration<TFrom extends Event = Event, TTo extends Event = Event> {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly eventType: string;
  readonly description: string;
  
  // Test if event can be migrated
  canMigrate(event: Event): event is TFrom;
  
  // Perform the migration
  migrate(event: TFrom): Promise<Result<TTo, MigrationError>>;
  
  // Rollback migration (optional)
  rollback?(event: TTo): Promise<Result<TFrom, MigrationError>>;
}

// Migration registry
export class EventMigrationRegistry {
  private readonly migrations = new Map<string, EventMigration[]>();
  private readonly migrationHistory = new Map<string, MigrationExecution[]>();

  // Register migration
  register(migration: EventMigration): void {
    const eventType = migration.eventType;
    const existing = this.migrations.get(eventType) ?? [];
    
    // Sort by version
    const sorted = [...existing, migration].sort((a, b) => a.fromVersion - b.fromVersion);
    
    // Validate migration chain
    this.validateMigrationChain(sorted);
    
    this.migrations.set(eventType, sorted);
  }

  // Migrate event to latest version
  async migrateToLatest<TEvent extends Event>(
    event: TEvent
  ): Promise<Result<Event, MigrationError>> {
    const migrations = this.getMigrationsForEvent(event);
    
    if (migrations.length === 0) {
      return {
        success: true,
        value: event,
      };
    }

    return await this.applyMigrationChain(event, migrations);
  }

  // Migrate event to specific version
  async migrateToVersion<TEvent extends Event>(
    event: TEvent,
    targetVersion: number
  ): Promise<Result<Event, MigrationError>> {
    const migrations = this.getMigrationsForEvent(event);
    const applicableMigrations = migrations.filter(
      m => m.fromVersion >= this.getEventVersion(event) && m.toVersion <= targetVersion
    );

    if (applicableMigrations.length === 0) {
      return {
        success: true,
        value: event,
      };
    }

    return await this.applyMigrationChain(event, applicableMigrations);
  }

  // Batch migrate events
  async migrateBatch<TEvent extends Event>(
    events: TEvent[]
  ): Promise<Result<Event[], BatchMigrationError>> {
    const results: Event[] = [];
    const errors: MigrationError[] = [];

    for (const [index, event] of events.entries()) {
      const result = await this.migrateToLatest(event);
      
      if (result.success) {
        results.push(result.value);
      } else {
        errors.push(
          new MigrationError(
            `Event at index ${index}: ${result.error.message}`,
            'BATCH_MIGRATION_FAILED',
            event.type,
            { originalError: result.error }
          )
        );
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: new BatchMigrationError(
          `${errors.length} events failed to migrate`,
          errors
        ),
      };
    }

    return {
      success: true,
      value: results,
    };
  }

  // Get migration path between versions
  getMigrationPath(
    eventType: string,
    fromVersion: number,
    toVersion: number
  ): EventMigration[] {
    const migrations = this.migrations.get(eventType) ?? [];
    
    return migrations.filter(
      m => m.fromVersion >= fromVersion && m.toVersion <= toVersion
    );
  }

  // Check if migration is available
  canMigrate(eventType: string, fromVersion: number, toVersion: number): boolean {
    const path = this.getMigrationPath(eventType, fromVersion, toVersion);
    
    // Check for complete path
    let currentVersion = fromVersion;
    for (const migration of path) {
      if (migration.fromVersion !== currentVersion) {
        return false;
      }
      currentVersion = migration.toVersion;
    }
    
    return currentVersion === toVersion;
  }

  // Get migration statistics
  getStatistics(): MigrationStatistics {
    const totalMigrations = Array.from(this.migrations.values())
      .reduce((sum, migrations) => sum + migrations.length, 0);
    
    const totalExecutions = Array.from(this.migrationHistory.values())
      .reduce((sum, executions) => sum + executions.length, 0);

    const eventTypesWithMigrations = this.migrations.size;
    
    const recentExecutions = Array.from(this.migrationHistory.values())
      .flat()
      .filter(execution => 
        Date.now() - execution.timestamp.getTime() < 24 * 60 * 60 * 1000
      ).length;

    return {
      totalMigrations,
      totalExecutions,
      eventTypesWithMigrations,
      recentExecutions,
    };
  }

  // Private helper methods
  private getMigrationsForEvent(event: Event): EventMigration[] {
    const migrations = this.migrations.get(event.type) ?? [];
    const eventVersion = this.getEventVersion(event);
    
    return migrations.filter(migration => migration.fromVersion >= eventVersion);
  }

  private async applyMigrationChain(
    event: Event,
    migrations: EventMigration[]
  ): Promise<Result<Event, MigrationError>> {
    let currentEvent = event;
    const executionId = this.generateExecutionId();
    
    try {
      for (const migration of migrations) {
        if (!migration.canMigrate(currentEvent)) {
          continue;
        }

        const startTime = Date.now();
        const result = await migration.migrate(currentEvent);
        const duration = Date.now() - startTime;

        if (!result.success) {
          this.recordExecution(executionId, migration, false, duration, result.error);
          return result;
        }

        this.recordExecution(executionId, migration, true, duration);
        currentEvent = result.value;
      }

      return {
        success: true,
        value: currentEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: new MigrationError(
          `Migration chain failed: ${error}`,
          'MIGRATION_CHAIN_FAILED',
          event.type
        ),
      };
    }
  }

  private validateMigrationChain(migrations: EventMigration[]): void {
    if (migrations.length <= 1) return;

    for (let i = 1; i < migrations.length; i++) {
      const prev = migrations[i - 1];
      const curr = migrations[i];

      if (prev && curr && curr.fromVersion !== prev.toVersion) {
        throw new Error(
          `Migration chain break: ${prev.toVersion} -> ${curr.fromVersion} for ${curr.eventType}`
        );
      }
    }
  }

  private getEventVersion(event: Event): number {
    // Use the event's version property
    return typeof event.version === 'number' ? event.version : (event.version as unknown as number);
  }

  private recordExecution(
    executionId: string,
    migration: EventMigration,
    success: boolean,
    duration: number,
    error?: MigrationError
  ): void {
    const execution: MigrationExecution = {
      executionId,
      migration: {
        eventType: migration.eventType,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        description: migration.description,
      },
      success,
      duration,
      timestamp: new Date(),
      ...(error?.message !== undefined ? { error: error.message } : {}),
    };

    const eventType = migration.eventType;
    const existing = this.migrationHistory.get(eventType) ?? [];
    existing.push(execution);
    
    // Keep only recent executions to avoid memory leaks
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000);
    }
    
    this.migrationHistory.set(eventType, existing);
  }

  private generateExecutionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Built-in migration types

// Field rename migration
export class FieldRenameMigration<TEvent extends Event> implements EventMigration<TEvent, TEvent> {
  constructor(
    public readonly eventType: string,
    public readonly fromVersion: number,
    public readonly toVersion: number,
    private readonly fieldMap: Record<string, string>,
    public readonly description: string = `Rename fields: ${Object.entries(fieldMap).map(([from, to]) => `${from}->${to}`).join(', ')}`
  ) {}

  canMigrate(event: Event): event is TEvent {
    return event.type === this.eventType;
  }

  async migrate(event: TEvent): Promise<Result<TEvent, MigrationError>> {
    try {
      const newData = (typeof event.data === 'object' && event.data !== null) 
        ? { ...(event.data as Record<string, unknown>) } 
        : {} as Record<string, unknown>;
      
      for (const [oldField, newField] of Object.entries(this.fieldMap)) {
        if (oldField in newData) {
          newData[newField] = newData[oldField];
          delete newData[oldField];
        }
      }

      const migratedEvent = {
        ...event,
        data: newData,
      } as TEvent;

      return {
        success: true,
        value: migratedEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: new MigrationError(
          `Field rename migration failed: ${error}`,
          'FIELD_RENAME_FAILED',
          this.eventType
        ),
      };
    }
  }
}

// Field transform migration
export class FieldTransformMigration<TEvent extends Event> implements EventMigration<TEvent, TEvent> {
  constructor(
    public readonly eventType: string,
    public readonly fromVersion: number,
    public readonly toVersion: number,
    private readonly transforms: Record<string, (value: unknown) => unknown>,
    public readonly description: string = `Transform fields: ${Object.keys(transforms).join(', ')}`
  ) {}

  canMigrate(event: Event): event is TEvent {
    return event.type === this.eventType;
  }

  async migrate(event: TEvent): Promise<Result<TEvent, MigrationError>> {
    try {
      const newData = (typeof event.data === 'object' && event.data !== null) 
        ? { ...(event.data as Record<string, unknown>) } 
        : {} as Record<string, unknown>;
      
      for (const [field, transform] of Object.entries(this.transforms)) {
        if (field in newData) {
          newData[field] = transform(newData[field]);
        }
      }

      const migratedEvent = {
        ...event,
        data: newData,
      } as TEvent;

      return {
        success: true,
        value: migratedEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: new MigrationError(
          `Field transform migration failed: ${error}`,
          'FIELD_TRANSFORM_FAILED',
          this.eventType
        ),
      };
    }
  }
}

// Types and interfaces
export interface MigrationExecution {
  readonly executionId: string;
  readonly migration: {
    readonly eventType: string;
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly description: string;
  };
  readonly success: boolean;
  readonly duration: number;
  readonly timestamp: Date;
  readonly error?: string;
}

export interface MigrationStatistics {
  readonly totalMigrations: number;
  readonly totalExecutions: number;
  readonly eventTypesWithMigrations: number;
  readonly recentExecutions: number;
}

// Error classes
export class MigrationError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'MIGRATION' as const;
  public readonly timestamp = new Date();
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: MigrationErrorCode,
    public readonly eventType?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MigrationError';
    this.code = code as ErrorCode;
  }
}

export class BatchMigrationError extends Error implements BaseError {
  public readonly type = 'DOMAIN' as const;
  public readonly category = 'MIGRATION' as const;
  public readonly code: ErrorCode = 'BATCH_MIGRATION_FAILED' as ErrorCode;
  public readonly timestamp = new Date();

  constructor(
    message: string,
    public readonly individualErrors: MigrationError[]
  ) {
    super(message);
    this.name = 'BatchMigrationError';
  }
}

export type MigrationErrorCode =
  | 'MIGRATION_CHAIN_FAILED'
  | 'FIELD_RENAME_FAILED'
  | 'FIELD_TRANSFORM_FAILED'
  | 'VERSION_MISMATCH'
  | 'INVALID_EVENT'
  | 'BATCH_MIGRATION_FAILED';

// Global registry instance
export const eventMigrationRegistry = new EventMigrationRegistry();