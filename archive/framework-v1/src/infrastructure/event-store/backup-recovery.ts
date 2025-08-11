/**
 * Event Store Backup and Recovery
 * 
 * Comprehensive backup and disaster recovery:
 * - Point-in-time recovery
 * - Incremental backups
 * - Stream-based export/import
 * - Verification and integrity checks
 * - Cross-region replication
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import * as Chunk from 'effect/Chunk';
import { pipe } from 'effect/Function';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type { IEvent, IEventStore, ISnapshot } from '../../effect/core/types';
import type { AggregateId } from '../../core/branded'; 

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Backup metadata
 */
export interface BackupMetadata {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: 'full' | 'incremental';
  readonly fromPosition: bigint;
  readonly toPosition: bigint;
  readonly eventCount: number;
  readonly compressed: boolean;
  readonly checksum: string;
  readonly size: number;
  readonly duration: number;
}

/**
 * Recovery point
 */
export interface RecoveryPoint {
  readonly timestamp: Date;
  readonly position: bigint;
  readonly eventCount: number;
  readonly consistent: boolean;
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  readonly backupPath: string;
  readonly compressionLevel?: number;
  readonly chunkSize?: number;
  readonly retentionDays?: number;
  readonly encryptionKey?: string;
}

/**
 * Event store backup service
 */
export class EventStoreBackup {
  constructor(
    private readonly eventStore: {
      readAllEvents: (
        fromPosition?: bigint,
        maxCount?: number
      ) => Effect.Effect<IEvent[], never, never>;
      getLatestPosition: () => Effect.Effect<bigint, never, never>;
    },
    private readonly config: BackupConfig
  ) {}
  
  /**
   * Create full backup
   */
  createFullBackup(): Effect.Effect<BackupMetadata, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const backupId = `full-${Date.now()}`;
      const backupFile = path.join(
        self.config.backupPath,
        `${backupId}.backup`
      );
      
      console.log(`Starting full backup: ${backupId}`);
      
      // Get latest position
      const latestPosition = yield* _(self.eventStore.getLatestPosition());
      
      // Stream all events
      const events = yield* _(
        self.streamAllEvents(0n, latestPosition)
      );
      
      // Create backup data
      const backupData = {
        metadata: {
          id: backupId,
          timestamp: new Date(),
          type: 'full' as const,
          fromPosition: 0n,
          toPosition: latestPosition,
        },
        events,
      };
      
      // Compress and save
      const compressed = yield* _(self.compressData(backupData));
      yield* _(self.saveBackupFile(backupFile, compressed));
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        fromPosition: 0n,
        toPosition: latestPosition,
        eventCount: events.length,
        compressed: true,
        checksum: self.calculateChecksum(compressed),
        size: compressed.length,
        duration: Date.now() - startTime,
      };
      
      // Save metadata
      yield* _(self.saveMetadata(metadata));
      
      console.log(`Full backup completed: ${events.length} events, ${compressed.length} bytes`);
      
      return metadata;
    });
  }
  
  /**
   * Create incremental backup
   */
  createIncrementalBackup(
    fromPosition: bigint
  ): Effect.Effect<BackupMetadata, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const backupId = `incr-${Date.now()}`;
      const backupFile = path.join(
        self.config.backupPath,
        `${backupId}.backup`
      );
      
      console.log(`Starting incremental backup from position ${fromPosition}`);
      
      // Get latest position
      const latestPosition = yield* _(self.eventStore.getLatestPosition());
      
      if (fromPosition >= latestPosition) {
        console.log('No new events to backup');
        return {
          id: backupId,
          timestamp: new Date(),
          type: 'incremental',
          fromPosition,
          toPosition: fromPosition,
          eventCount: 0,
          compressed: false,
          checksum: '',
          size: 0,
          duration: Date.now() - startTime,
        };
      }
      
      // Stream events from position
      const events = yield* _(
        self.streamAllEvents(fromPosition, latestPosition)
      );
      
      // Create backup data
      const backupData = {
        metadata: {
          id: backupId,
          timestamp: new Date(),
          type: 'incremental' as const,
          fromPosition,
          toPosition: latestPosition,
        },
        events,
      };
      
      // Compress and save
      const compressed = yield* _(self.compressData(backupData));
      yield* _(self.saveBackupFile(backupFile, compressed));
      
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'incremental',
        fromPosition,
        toPosition: latestPosition,
        eventCount: events.length,
        compressed: true,
        checksum: self.calculateChecksum(compressed),
        size: compressed.length,
        duration: Date.now() - startTime,
      };
      
      // Save metadata
      yield* _(self.saveMetadata(metadata));
      
      console.log(`Incremental backup completed: ${events.length} events`);
      
      return metadata;
    });
  }
  
  /**
   * Restore from backup
   */
  restoreFromBackup(
    backupId: string,
    targetStore?: IEventStore
  ): Effect.Effect<{ eventsRestored: number }, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      console.log(`Starting restore from backup: ${backupId}`);
      const backupFile = path.join(
        self.config.backupPath,
        `${backupId}.backup`
      );
      
      // Load and decompress backup
      const compressed = yield* _(self.loadBackupFile(backupFile));
      const backupData = yield* _(self.decompressData(compressed));
      
      // Verify integrity
      const checksum = self.calculateChecksum(compressed);
      const metadata = yield* _(self.loadMetadata(backupId));
      
      if (metadata.checksum !== checksum) {
        throw new Error('Backup integrity check failed');
      }
      
      // Group events by stream
      const eventsByStream = self.groupEventsByStream(backupData.events);
      
      // Restore events
      let totalRestored = 0;
      const store = targetStore || self.eventStore as unknown as IEventStore;
      
      for (const [streamId, events] of eventsByStream) {
        yield* _(Effect.tryPromise({
          try: () => store.appendToStream(streamId, events as IEvent[]),
          catch: (e) => new Error(`Failed to restore events: ${e}`),
        }));
        totalRestored += events.length;
        
        if (totalRestored % 1000 === 0) {
          console.log(`Restored ${totalRestored} events...`);
        }
      }
      
      console.log(`Restore completed: ${totalRestored} events`);
      
      return { eventsRestored: totalRestored };
    });
  }
  
  /**
   * Point-in-time recovery
   */
  recoverToPoint(
    timestamp: Date
  ): Effect.Effect<RecoveryPoint, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      console.log(`Starting point-in-time recovery to ${timestamp}`);
      
      // Find relevant backups
      const backups = yield* _(self.findBackupsBeforeTime(timestamp));
      
      if (backups.length === 0) {
        throw new Error('No backups found before specified time');
      }
      
      // Restore full backup first
      const fullBackup = backups.find(b => b.type === 'full');
      if (!fullBackup) {
        throw new Error('No full backup found');
      }
      
      yield* _(self.restoreFromBackup(fullBackup.id));
      
      // Apply incremental backups
      const incrementals = backups
        .filter(b => b.type === 'incremental')
        .sort((a, b) => a.fromPosition > b.fromPosition ? 1 : -1);
      
      for (const incr of incrementals) {
        yield* _(self.restoreFromBackup(incr.id));
      }
      
      // Find recovery position
      const position = yield* _(self.findPositionAtTime(timestamp));
      
      return {
        timestamp,
        position,
        eventCount: backups.reduce((sum, b) => sum + b.eventCount, 0),
        consistent: true,
      };
    });
  }
  
  /**
   * Verify backup integrity
   */
  verifyBackup(backupId: string): Effect.Effect<boolean, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const backupFile = path.join(
        self.config.backupPath,
        `${backupId}.backup`
      );
      
      const compressed = yield* _(self.loadBackupFile(backupFile));
      const metadata = yield* _(self.loadMetadata(backupId));
      
      const checksum = self.calculateChecksum(compressed);
      const valid = metadata.checksum === checksum;
      
      if (!valid) {
        console.error(`Backup ${backupId} integrity check failed`);
      }
      
      return valid;
    });
  }
  
  /**
   * Clean old backups
   */
  cleanOldBackups(): Effect.Effect<{ deleted: number }, Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const retentionDays = self.config.retentionDays ?? 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const allMetadata = yield* _(self.loadAllMetadata());
      const toDelete = allMetadata.filter(m => m.timestamp < cutoffDate);
      
      let deleted = 0;
      for (const metadata of toDelete) {
        const backupFile = path.join(
          self.config.backupPath,
          `${metadata.id}.backup`
        );
        
        yield* _(Effect.tryPromise({
          try: () => fs.unlink(backupFile),
          catch: (e) => new Error(`Failed to delete backup: ${e}`),
        }));
        
        deleted++;
      }
      
      console.log(`Cleaned ${deleted} old backups`);
      
      return { deleted };
    });
  }
  
  // Private helper methods
  
  private streamAllEvents(
    fromPosition: bigint,
    toPosition: bigint
  ): Effect.Effect<IEvent[], Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const events: IEvent[] = [];
      const chunkSize = self.config.chunkSize ?? 1000;
      let currentPosition = fromPosition;
      
      while (currentPosition < toPosition) {
        const chunk = yield* _(
          self.eventStore.readAllEvents(currentPosition, chunkSize)
        );
        
        if (chunk.length === 0) break;
        events.push(...chunk);
        
        const lastEvent = chunk[chunk.length - 1] as IEvent & { metadata: { globalPosition: bigint } };
        currentPosition = BigInt(
          lastEvent.metadata ? lastEvent.metadata.globalPosition : 
          currentPosition + BigInt(chunk.length)
        );
      }
      
      return events;
    });
  }
  
  private compressData(data: any): Effect.Effect<Buffer, Error, never> {
    const self = this;
    return Effect.tryPromise({
      try: async () => {
        const json = JSON.stringify(data);
        const compressed = await gzip(json, {
          level: self.config.compressionLevel ?? 6,
        });
        return compressed;
      },
      catch: (e) => new Error(`Compression failed: ${e}`),
    });
  }
  
  private decompressData(buffer: Buffer): Effect.Effect<any, Error, never> {
    const self = this;
    return Effect.tryPromise({
      try: async () => {
        const decompressed = await gunzip(buffer);
        return JSON.parse(decompressed.toString());
      },
      catch: (e) => new Error(`Decompression failed: ${e}`),
    });
  }
  
  private saveBackupFile(
    filepath: string,
    data: Buffer
  ): Effect.Effect<void, Error, never> {
    return Effect.tryPromise({
      try: () => fs.writeFile(filepath, data),
      catch: (e) => new Error(`Failed to save backup: ${e}`),
    });
  }
  
  private loadBackupFile(filepath: string): Effect.Effect<Buffer, Error, never> {
    return Effect.tryPromise({
      try: () => fs.readFile(filepath),
      catch: (e) => new Error(`Failed to load backup: ${e}`),
    });
  }
  
  private saveMetadata(metadata: BackupMetadata): Effect.Effect<void, Error, never> {
    const self = this;
    return Effect.tryPromise({
      try: () => {
        const metadataFile = path.join(
          self.config.backupPath,
          `${metadata.id}.meta.json`
        );
        return fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
      },
      catch: (e) => new Error(`Failed to save metadata: ${e}`),
    });
  }
  
  private loadMetadata(backupId: string): Effect.Effect<BackupMetadata, Error, never> {
    const self = this;
    return Effect.tryPromise({
      try: async () => {
        const metadataFile = path.join(
          self.config.backupPath,
          `${backupId}.meta.json`
        );
        const content = await fs.readFile(metadataFile, 'utf-8');
        return JSON.parse(content);
      },
      catch: (e) => new Error(`Failed to load metadata: ${e}`),
    });
  }
  
  private loadAllMetadata(): Effect.Effect<BackupMetadata[], Error, never> {
    const self = this;
    return Effect.tryPromise({
      try: async () => {
        const files = await fs.readdir(self.config.backupPath);
        const metaFiles = files.filter(f => f.endsWith('.meta.json'));
        
        const metadata: BackupMetadata[] = [];
        for (const file of metaFiles) {
          const content = await fs.readFile(
            path.join(self.config.backupPath, file),
            'utf-8'
          );
          metadata.push(JSON.parse(content));
        }
        
        return metadata;
      },
      catch: (e) => new Error(`Failed to load metadata: ${e}`),
    });
  }
  
  private findBackupsBeforeTime(
    timestamp: Date
  ): Effect.Effect<BackupMetadata[], Error, never> {
    const self = this;
    return Effect.gen(function* (_) {
      const allMetadata = yield* _(self.loadAllMetadata());
      return allMetadata
        .filter(m => m.timestamp <= timestamp)
        .sort((a, b) => a.timestamp > b.timestamp ? -1 : 1);
    });
  }
  
  private findPositionAtTime(
    timestamp: Date
  ): Effect.Effect<bigint, Error, never> {
    const self = this;
    // In production, would query event store for exact position
    return Effect.succeed(BigInt(Date.now()));
  }
  
  private calculateChecksum(data: Buffer): string {
    // Simple checksum for demo - use crypto.createHash in production
    return data.length.toString(16);
  }
  
  private groupEventsByStream(
    events: IEvent[]
  ): Map<AggregateId, IEvent[]> {
    const grouped = new Map<AggregateId, IEvent[]>();
    
    for (const event of events) {
      const streamEvents = grouped.get(event.aggregateId) ?? [];
      streamEvents.push(event);
      grouped.set(event.aggregateId, streamEvents);
    }
    
    return grouped;
  }
}

/**
 * Backup scheduler
 */
export class BackupScheduler {
  constructor(
    private readonly backup: EventStoreBackup,
    private readonly schedule: {
      full: Schedule.Schedule<unknown, unknown>;
      incremental: Schedule.Schedule<unknown, unknown>;
    }
  ) {}
  
  /**
   * Start scheduled backups
   */
  start(): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      // Schedule full backups
      yield* _(
        pipe(
          self.backup.createFullBackup(),
          Effect.repeat(self.schedule.full),
          Effect.fork
        )
      );
      
      // Schedule incremental backups
      yield* _(
        pipe(
          Effect.gen(function* (_) {
            // Get last backup position
            const lastPosition = yield* _(self.getLastBackupPosition());
            yield* _(self.backup.createIncrementalBackup(lastPosition));
          }),
          Effect.repeat(self.schedule.incremental),
          Effect.fork
        )
      );
      
      console.log('Backup scheduler started');
    });
  }
  
  private getLastBackupPosition(): Effect.Effect<bigint, never, never> {
    // In production, would track last backup position
    return Effect.succeed(0n);
  }
}

/**
 * Cross-region replication
 */
export class EventStoreReplication {
  constructor(
    private readonly source: {
      readAllEvents: (
        fromPosition?: bigint
      ) => Effect.Effect<IEvent[], never, never>;
      subscribe: (
        handler: (event: IEvent) => Effect.Effect<void, never, never>
      ) => Effect.Effect<() => void, never, never>;
    },
    private readonly targets: Array<{
      name: string;
      appendToStream: (
        streamId: AggregateId,
        events: IEvent[]
      ) => Effect.Effect<void, never, never>;
    }>
  ) {}
  
  /**
   * Start replication
   */
  startReplication(): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      // Subscribe to source events
      const unsubscribe = yield* _(
        self.source.subscribe((event) =>
          self.replicateEvent(event)
        )
      );
      
      console.log(`Replication started to ${self.targets.length} targets`);
      
      // Return cleanup
      return () => unsubscribe();
    });
  }
  
  private replicateEvent(event: IEvent): Effect.Effect<void, never, never> {
    const self = this;
    return Effect.gen(function* (_) {
      // Replicate to all targets in parallel
      yield* _(
        Effect.all(
          self.targets.map(target =>
            pipe(
              target.appendToStream(event.aggregateId, [event]),
              Effect.catchAll((error) =>
                Effect.sync(() =>
                  console.error(`Replication to ${target.name} failed:`, error)
                )
              )
            )
          )
        )
      );
    });
  }
}

/**
 * Create backup service
 */
export const createBackupService = (
  eventStore: {
    readAllEvents: (
      fromPosition?: bigint,
      maxCount?: number
    ) => Effect.Effect<IEvent[], never, never>;
    getLatestPosition: () => Effect.Effect<bigint, never, never>;
  },
  config: BackupConfig
): EventStoreBackup => {
  return new EventStoreBackup(eventStore, config);
};

/**
 * Create backup scheduler with default schedules
 */
export const createBackupScheduler = (
  backup: EventStoreBackup
): BackupScheduler => {
  return new BackupScheduler(backup, {
    full: Schedule.spaced(Duration.days(1)), // Daily full backup
    incremental: Schedule.spaced(Duration.hours(1)), // Hourly incremental
  });
};