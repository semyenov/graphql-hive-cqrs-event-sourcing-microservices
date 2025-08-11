/**
 * Event Versioning and Migration System
 * 
 * Handles event schema evolution with:
 * - Version tracking
 * - Forward/backward compatibility
 * - Automatic migrations
 * - Schema validation
 */

import * as Effect from 'effect/Effect';
import * as Schema from '@effect/schema/Schema';
import * as Option from 'effect/Option';
import * as ReadonlyArray from 'effect/ReadonlyArray';
import { pipe } from 'effect/Function';
import type { IEvent } from '../../core/types';

/**
 * Event version metadata
 */
export interface EventVersion {
  readonly version: number;
  readonly schema: Schema.Schema<any, any>;
  readonly deprecated?: boolean;
  readonly deprecatedAt?: Date;
  readonly removedAt?: Date;
}

/**
 * Event migration
 */
export interface EventMigration<From = any, To = any> {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly up: (event: From) => Effect.Effect<To, never, never>;
  readonly down?: (event: To) => Effect.Effect<From, never, never>;
  readonly description?: string;
}

/**
 * Versioned event
 */
export interface VersionedEvent<T = unknown> extends IEvent {
  readonly version: number;
  readonly data: T;
}

/**
 * Event versioning registry
 */
export class EventVersionRegistry {
  private versions = new Map<string, Map<number, EventVersion>>();
  private migrations = new Map<string, EventMigration[]>();
  private currentVersions = new Map<string, number>();

  /**
   * Register event version
   */
  registerVersion<T>(
    eventType: string,
    version: number,
    schema: Schema.Schema<T, any>,
    options?: {
      deprecated?: boolean;
      deprecatedAt?: Date;
      removedAt?: Date;
    }
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      if (!this.versions.has(eventType)) {
        this.versions.set(eventType, new Map());
      }
      
      const typeVersions = this.versions.get(eventType)!;
      typeVersions.set(version, {
        version,
        schema,
        ...options,
      });
      
      // Update current version if this is newer
      const currentVersion = this.currentVersions.get(eventType) ?? 0;
      if (version > currentVersion) {
        this.currentVersions.set(eventType, version);
      }
    });
  }

  /**
   * Register migration between versions
   */
  registerMigration<From, To>(
    eventType: string,
    migration: EventMigration<From, To>
  ): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      if (!this.migrations.has(eventType)) {
        this.migrations.set(eventType, []);
      }
      
      const typeMigrations = this.migrations.get(eventType)!;
      typeMigrations.push(migration as EventMigration);
      
      // Sort migrations by version
      typeMigrations.sort((a, b) => a.fromVersion - b.fromVersion);
    });
  }

  /**
   * Get current version for event type
   */
  getCurrentVersion(eventType: string): Option.Option<number> {
    const version = this.currentVersions.get(eventType);
    return version !== undefined ? Option.some(version) : Option.none();
  }

  /**
   * Get schema for event version
   */
  getSchema(
    eventType: string,
    version: number
  ): Option.Option<Schema.Schema<any, any>> {
    const typeVersions = this.versions.get(eventType);
    if (!typeVersions) return Option.none();
    
    const eventVersion = typeVersions.get(version);
    return eventVersion ? Option.some(eventVersion.schema) : Option.none();
  }

  /**
   * Migrate event to target version
   */
  migrateEvent<T>(
    event: VersionedEvent,
    targetVersion?: number
  ): Effect.Effect<VersionedEvent<T>, MigrationError, never> {
    return Effect.gen(function* (_) {
      const target = targetVersion ?? 
        Option.getOrElse(
          () => event.version
        )(getCurrentVersion(event.type));
      
      if (event.version === target) {
        return event as VersionedEvent<T>;
      }
      
      const migrationPath = yield* _(
        findMigrationPath(
          event.type,
          event.version,
          target,
          migrations.get(event.type) ?? []
        )
      );
      
      let current = event;
      for (const migration of migrationPath) {
        const migrated = yield* _(migration.up(current.data));
        current = {
          ...current,
          version: migration.toVersion,
          data: migrated,
        };
      }
      
      return current as VersionedEvent<T>;
    });
  }

  /**
   * Validate event against schema
   */
  validateEvent(
    event: VersionedEvent
  ): Effect.Effect<void, ValidationError, never> {
    return Effect.gen(function* (_) {
      const schema = getSchema(event.type, event.version);
      
      if (Option.isNone(schema)) {
        return yield* _(Effect.fail(
          new ValidationError(`No schema found for ${event.type} v${event.version}`)
        ));
      }
      
      const parseResult = yield* _(
        Schema.decodeUnknown(schema.value)(event.data)
      );
      
      return undefined;
    });
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(eventType: string, version: number): boolean {
    const typeVersions = this.versions.get(eventType);
    if (!typeVersions) return false;
    
    const eventVersion = typeVersions.get(version);
    return eventVersion?.deprecated ?? false;
  }

  /**
   * Get migration path between versions
   */
  private findMigrationPath(
    eventType: string,
    fromVersion: number,
    toVersion: number,
    migrations: EventMigration[]
  ): Effect.Effect<EventMigration[], MigrationError, never> {
    return Effect.gen(function* (_) {
      const path: EventMigration[] = [];
      
      if (fromVersion < toVersion) {
        // Forward migration
        let current = fromVersion;
        while (current < toVersion) {
          const migration = migrations.find(
            m => m.fromVersion === current
          );
          
          if (!migration) {
            return yield* _(Effect.fail(
              new MigrationError(
                `No migration found from v${current} for ${eventType}`
              )
            ));
          }
          
          path.push(migration);
          current = migration.toVersion;
        }
      } else {
        // Backward migration
        let current = fromVersion;
        while (current > toVersion) {
          const migration = migrations.find(
            m => m.toVersion === current && m.down
          );
          
          if (!migration) {
            return yield* _(Effect.fail(
              new MigrationError(
                `No backward migration found from v${current} for ${eventType}`
              )
            ));
          }
          
          // Create reverse migration
          path.push({
            fromVersion: migration.toVersion,
            toVersion: migration.fromVersion,
            up: migration.down!,
          });
          current = migration.fromVersion;
        }
      }
      
      return path;
    });
  }
}

/**
 * Migration error
 */
export class MigrationError extends Error {
  readonly _tag = 'MigrationError';
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  readonly _tag = 'ValidationError';
}

/**
 * Event schema builder
 */
export class EventSchemaBuilder<T> {
  private fields: Map<string, Schema.Schema<any, any>> = new Map();
  private required: Set<string> = new Set();
  
  addField<K extends string, V>(
    name: K,
    schema: Schema.Schema<V, any>,
    required: boolean = true
  ): EventSchemaBuilder<T & Record<K, V>> {
    this.fields.set(name, schema);
    if (required) {
      this.required.add(name);
    }
    return this as any;
  }
  
  removeField<K extends keyof T>(
    name: K
  ): EventSchemaBuilder<Omit<T, K>> {
    this.fields.delete(name as string);
    this.required.delete(name as string);
    return this as any;
  }
  
  renameField<K extends keyof T, N extends string>(
    oldName: K,
    newName: N
  ): EventSchemaBuilder<Omit<T, K> & Record<N, T[K]>> {
    const schema = this.fields.get(oldName as string);
    if (schema) {
      this.fields.delete(oldName as string);
      this.fields.set(newName, schema);
      
      if (this.required.has(oldName as string)) {
        this.required.delete(oldName as string);
        this.required.add(newName);
      }
    }
    return this as any;
  }
  
  build(): Schema.Schema<T, any> {
    const schemaObj: any = {};
    
    for (const [name, schema] of this.fields) {
      if (this.required.has(name)) {
        schemaObj[name] = schema;
      } else {
        schemaObj[name] = Schema.optional(schema);
      }
    }
    
    return Schema.struct(schemaObj);
  }
}

/**
 * Common event migrations
 */
export const CommonMigrations = {
  /**
   * Add field with default value
   */
  addField: <T, K extends string, V>(
    fieldName: K,
    defaultValue: V
  ) => (event: T): Effect.Effect<T & Record<K, V>, never, never> =>
    Effect.succeed({
      ...event,
      [fieldName]: defaultValue,
    } as T & Record<K, V>),
  
  /**
   * Remove field
   */
  removeField: <T, K extends keyof T>(
    fieldName: K
  ) => (event: T): Effect.Effect<Omit<T, K>, never, never> => {
    const { [fieldName]: _, ...rest } = event;
    return Effect.succeed(rest as Omit<T, K>);
  },
  
  /**
   * Rename field
   */
  renameField: <T, K extends keyof T, N extends string>(
    oldName: K,
    newName: N
  ) => (event: T): Effect.Effect<Omit<T, K> & Record<N, T[K]>, never, never> => {
    const { [oldName]: value, ...rest } = event;
    return Effect.succeed({
      ...rest,
      [newName]: value,
    } as Omit<T, K> & Record<N, T[K]>);
  },
  
  /**
   * Transform field value
   */
  transformField: <T, K extends keyof T, V>(
    fieldName: K,
    transform: (value: T[K]) => V
  ) => (event: T): Effect.Effect<Omit<T, K> & Record<K, V>, never, never> =>
    Effect.succeed({
      ...event,
      [fieldName]: transform(event[fieldName]),
    } as any),
  
  /**
   * Split field into multiple fields
   */
  splitField: <T, K extends keyof T, Fields extends Record<string, any>>(
    fieldName: K,
    split: (value: T[K]) => Fields
  ) => (event: T): Effect.Effect<Omit<T, K> & Fields, never, never> => {
    const { [fieldName]: value, ...rest } = event;
    return Effect.succeed({
      ...rest,
      ...split(value),
    } as Omit<T, K> & Fields);
  },
  
  /**
   * Merge fields into one
   */
  mergeFields: <T, K extends keyof T, V>(
    fieldNames: K[],
    merge: (...values: T[K][]) => V,
    newFieldName: string
  ) => (event: T): Effect.Effect<Omit<T, K> & Record<string, V>, never, never> => {
    const values = fieldNames.map(name => event[name]);
    const result = { ...event };
    
    for (const name of fieldNames) {
      delete result[name];
    }
    
    return Effect.succeed({
      ...result,
      [newFieldName]: merge(...values),
    } as any);
  },
};

/**
 * Create event versioning registry
 */
export const createEventVersionRegistry = (): EventVersionRegistry =>
  new EventVersionRegistry();

/**
 * Example usage
 */
export const EventVersioningExample = {
  // Define schemas for different versions
  UserCreatedV1: Schema.struct({
    userId: Schema.string,
    email: Schema.string,
    createdAt: Schema.Date,
  }),
  
  UserCreatedV2: Schema.struct({
    userId: Schema.string,
    email: Schema.string,
    username: Schema.string,
    createdAt: Schema.Date,
    metadata: Schema.optional(Schema.record(Schema.string, Schema.unknown)),
  }),
  
  // Define migration from V1 to V2
  UserCreatedV1toV2: {
    fromVersion: 1,
    toVersion: 2,
    up: CommonMigrations.addField('username', 'user'),
    down: CommonMigrations.removeField('username'),
    description: 'Added username field',
  },
};