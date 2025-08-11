#!/usr/bin/env bun
/**
 * Event Store Management CLI
 * 
 * Command-line interface for event store operations:
 * - Stream management
 * - Event inspection
 * - Backup operations
 * - Performance testing
 * - Maintenance tasks
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import * as Console from 'effect/Console';
import { pipe } from 'effect/Function';
import { Command } from 'commander';
import * as Table from 'cli-table3';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import { PostgresEventStore } from './postgres';
import { EventStoreBackup, createBackupService } from './backup-recovery';
import { runBenchmarks, runStressTest } from './benchmarks';
import { createProjectionProcessor, CommonProjections } from './postgres-projections';
import { createSnapshotManager, createAdaptiveSnapshotManager } from './snapshot-strategies';
import { EventVersionRegistry, createEventVersionRegistry } from './versioning';
import type { PostgresConfig } from './postgres';

// CLI Configuration
const program = new Command();

program
  .name('event-store')
  .description('Event Store Management CLI')
  .version('1.0.0');

// Database configuration from environment or flags
const getDbConfig = (options: any): PostgresConfig => ({
  host: options.host || process.env.DB_HOST || 'localhost',
  port: parseInt(options.port || process.env.DB_PORT || '5432'),
  database: options.database || process.env.DB_NAME || 'eventstore',
  user: options.user || process.env.DB_USER || 'postgres',
  password: options.password || process.env.DB_PASSWORD || 'postgres',
  poolSize: parseInt(options.poolSize || '10'),
});

// ============================================================================
// Stream Commands
// ============================================================================

const streamCmd = program
  .command('stream')
  .description('Stream management operations');

streamCmd
  .command('list')
  .description('List all streams')
  .option('-l, --limit <number>', 'Limit number of results', '100')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = yield* _(createEventStore(config));
        
        const query = `
          SELECT stream_id, version, created_at, updated_at, is_deleted
          FROM streams
          ORDER BY updated_at DESC
          LIMIT $1
        `;
        
        const result = yield* _(executeQuery(config, query, [options.limit]));
        
        const table = new Table.default({
          head: ['Stream ID', 'Version', 'Created', 'Updated', 'Status'],
          style: { head: ['cyan'] },
        });
        
        for (const row of result.rows) {
          table.push([
            chalk.yellow(row.stream_id.substring(0, 8) + '...'),
            row.version,
            new Date(row.created_at).toLocaleDateString(),
            new Date(row.updated_at).toLocaleDateString(),
            row.is_deleted ? chalk.red('Deleted') : chalk.green('Active'),
          ]);
        }
        
        console.log(table.toString());
        console.log(`\nTotal: ${result.rows.length} streams`);
      })
    );
  });

streamCmd
  .command('inspect <streamId>')
  .description('Inspect a specific stream')
  .option('-e, --events', 'Show events in stream')
  .option('-s, --snapshots', 'Show snapshots')
  .action(async (streamId, options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        // Get stream info
        const streamQuery = `
          SELECT * FROM streams WHERE stream_id = $1
        `;
        const streamResult = yield* _(executeQuery(config, streamQuery, [streamId]));
        
        if (streamResult.rows.length === 0) {
          console.log(chalk.red(`Stream ${streamId} not found`));
          return;
        }
        
        const stream = streamResult.rows[0];
        
        console.log(chalk.cyan('\n📊 Stream Information'));
        console.log('=' .repeat(50));
        console.log(`Stream ID: ${chalk.yellow(stream.stream_id)}`);
        console.log(`Version: ${stream.version}`);
        console.log(`Created: ${new Date(stream.created_at).toLocaleString()}`);
        console.log(`Updated: ${new Date(stream.updated_at).toLocaleString()}`);
        
        if (options.events) {
          const events = yield* _(store.readFromStream(streamId));
          
          console.log(chalk.cyan('\n📝 Events'));
          console.log('-' .repeat(50));
          
          const eventTable = new Table.default({
            head: ['Version', 'Type', 'Timestamp', 'Data Size'],
            style: { head: ['cyan'] },
          });
          
          for (const event of events.slice(0, 10)) {
            eventTable.push([
              event.aggregateVersion,
              chalk.blue(event.type),
              new Date(event.timestamp).toLocaleString(),
              `${JSON.stringify(event.data).length} bytes`,
            ]);
          }
          
          console.log(eventTable.toString());
          
          if (events.length > 10) {
            console.log(`... and ${events.length - 10} more events`);
          }
        }
        
        if (options.snapshots) {
          const snapshot = yield* _(store.loadSnapshot(streamId));
          
          if (Option.isSome(snapshot)) {
            console.log(chalk.cyan('\n📸 Latest Snapshot'));
            console.log('-' .repeat(50));
            console.log(`Version: ${snapshot.value.version}`);
            console.log(`Created: ${snapshot.value.timestamp}`);
            console.log(`Size: ${JSON.stringify(snapshot.value.data).length} bytes`);
          } else {
            console.log(chalk.yellow('\nNo snapshots found'));
          }
        }
      })
    );
  });

// ============================================================================
// Event Commands
// ============================================================================

const eventCmd = program
  .command('event')
  .description('Event operations');

eventCmd
  .command('replay <streamId>')
  .description('Replay events for a stream')
  .option('-f, --from <version>', 'Start from version', '0')
  .option('-t, --to <version>', 'End at version')
  .action(async (streamId, options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        const fromVersion = parseInt(options.from);
        const toVersion = options.to ? parseInt(options.to) : undefined;
        
        console.log(chalk.cyan(`\n🔄 Replaying events for stream ${streamId}`));
        
        const events = yield* _(
          store.readFromStream(streamId, fromVersion, toVersion)
        );
        
        for (const event of events) {
          console.log(`\n[${event.aggregateVersion}] ${chalk.blue(event.type)}`);
          console.log(`  Timestamp: ${new Date(event.timestamp).toLocaleString()}`);
          console.log(`  Data: ${JSON.stringify(event.data, null, 2)}`);
        }
        
        console.log(chalk.green(`\n✅ Replayed ${events.length} events`));
      })
    );
  });

// ============================================================================
// Backup Commands
// ============================================================================

const backupCmd = program
  .command('backup')
  .description('Backup and recovery operations');

backupCmd
  .command('create')
  .description('Create a backup')
  .option('-t, --type <type>', 'Backup type (full/incremental)', 'full')
  .option('-p, --path <path>', 'Backup path', './backups')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        const backupService = createBackupService(store, {
          backupPath: options.path,
          compressionLevel: 6,
        });
        
        console.log(chalk.cyan(`\n💾 Creating ${options.type} backup...`));
        
        const metadata = options.type === 'full'
          ? yield* _(backupService.createFullBackup())
          : yield* _(backupService.createIncrementalBackup(0n));
        
        console.log(chalk.green('\n✅ Backup completed'));
        console.log(`  ID: ${metadata.id}`);
        console.log(`  Events: ${metadata.eventCount}`);
        console.log(`  Size: ${(metadata.size / 1024).toFixed(2)} KB`);
        console.log(`  Duration: ${metadata.duration}ms`);
      })
    );
  });

backupCmd
  .command('restore <backupId>')
  .description('Restore from backup')
  .action(async (backupId, options) => {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('⚠️  This will overwrite existing data. Continue?'),
        default: false,
      },
    ]);
    
    if (!confirm) {
      console.log('Restore cancelled');
      return;
    }
    
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        const backupService = createBackupService(store, {
          backupPath: './backups',
        });
        
        console.log(chalk.cyan(`\n📥 Restoring from backup ${backupId}...`));
        
        const result = yield* _(backupService.restoreFromBackup(backupId));
        
        console.log(chalk.green('\n✅ Restore completed'));
        console.log(`  Events restored: ${result.eventsRestored}`);
      })
    );
  });

// ============================================================================
// Projection Commands
// ============================================================================

const projectionCmd = program
  .command('projection')
  .description('Projection management');

projectionCmd
  .command('list')
  .description('List all projections')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        
        const query = `
          SELECT projection_name, last_position, last_updated, is_running, error_count
          FROM projections
          ORDER BY projection_name
        `;
        
        const result = yield* _(executeQuery(config, query, []));
        
        const table = new Table.default({
          head: ['Name', 'Position', 'Updated', 'Status', 'Errors'],
          style: { head: ['cyan'] },
        });
        
        for (const row of result.rows) {
          table.push([
            chalk.yellow(row.projection_name),
            row.last_position,
            new Date(row.last_updated).toLocaleString(),
            row.is_running ? chalk.green('Running') : chalk.gray('Stopped'),
            row.error_count > 0 ? chalk.red(row.error_count) : '0',
          ]);
        }
        
        console.log(table.toString());
      })
    );
  });

projectionCmd
  .command('reset <name>')
  .description('Reset a projection')
  .action(async (name, options) => {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`Reset projection ${name}?`),
        default: false,
      },
    ]);
    
    if (!confirm) return;
    
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        const processor = createProjectionProcessor(
          CommonProjections.eventTypeCount(),
          store,
          null
        );
        
        yield* _(processor.reset());
        
        console.log(chalk.green(`✅ Projection ${name} reset`));
      })
    );
  });

// ============================================================================
// Benchmark Commands
// ============================================================================

const benchCmd = program
  .command('bench')
  .description('Performance benchmarking');

benchCmd
  .command('run')
  .description('Run performance benchmarks')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        const results = yield* _(runBenchmarks(store));
        
        // Results are printed by the benchmark itself
      })
    );
  });

benchCmd
  .command('stress')
  .description('Run stress test')
  .option('-d, --duration <seconds>', 'Test duration', '60')
  .option('-c, --concurrency <number>', 'Concurrent workers', '10')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        const store = new PostgresEventStore(null, config);
        
        yield* _(runStressTest(store, {
          duration: Duration.seconds(parseInt(options.duration)),
          concurrency: parseInt(options.concurrency),
        }));
      })
    );
  });

// ============================================================================
// Maintenance Commands
// ============================================================================

const maintCmd = program
  .command('maint')
  .description('Maintenance operations');

maintCmd
  .command('vacuum')
  .description('Run vacuum on event store tables')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        
        console.log(chalk.cyan('\n🧹 Running vacuum...'));
        
        yield* _(executeQuery(config, 'VACUUM ANALYZE events', []));
        yield* _(executeQuery(config, 'VACUUM ANALYZE streams', []));
        yield* _(executeQuery(config, 'VACUUM ANALYZE snapshots', []));
        yield* _(executeQuery(config, 'VACUUM ANALYZE projections', []));
        
        console.log(chalk.green('✅ Vacuum completed'));
      })
    );
  });

maintCmd
  .command('partition')
  .description('Create future partitions')
  .option('-m, --months <number>', 'Months ahead', '3')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        
        console.log(chalk.cyan('\n📅 Creating partitions...'));
        
        const query = `SELECT create_monthly_partitions($1)`;
        yield* _(executeQuery(config, query, [parseInt(options.months)]));
        
        console.log(chalk.green(`✅ Created partitions for next ${options.months} months`));
      })
    );
  });

maintCmd
  .command('stats')
  .description('Show event store statistics')
  .action(async (options) => {
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const config = getDbConfig(options);
        
        // Get statistics
        const stats = yield* _(Effect.all({
          events: executeQuery(config, 'SELECT COUNT(*) as count FROM events', []),
          streams: executeQuery(config, 'SELECT COUNT(*) as count FROM streams', []),
          snapshots: executeQuery(config, 'SELECT COUNT(*) as count FROM snapshots', []),
          projections: executeQuery(config, 'SELECT COUNT(*) as count FROM projections', []),
          size: executeQuery(config, `
            SELECT 
              pg_size_pretty(pg_database_size(current_database())) as db_size,
              pg_size_pretty(pg_total_relation_size('events')) as events_size,
              pg_size_pretty(pg_total_relation_size('snapshots')) as snapshots_size
          `, []),
        }));
        
        console.log(chalk.cyan('\n📊 Event Store Statistics'));
        console.log('=' .repeat(50));
        console.log(`Events: ${chalk.yellow(stats.events.rows[0].count)}`);
        console.log(`Streams: ${chalk.yellow(stats.streams.rows[0].count)}`);
        console.log(`Snapshots: ${chalk.yellow(stats.snapshots.rows[0].count)}`);
        console.log(`Projections: ${chalk.yellow(stats.projections.rows[0].count)}`);
        console.log('\nStorage:');
        console.log(`  Database: ${stats.size.rows[0].db_size}`);
        console.log(`  Events: ${stats.size.rows[0].events_size}`);
        console.log(`  Snapshots: ${stats.size.rows[0].snapshots_size}`);
      })
    );
  });

// ============================================================================
// Helper Functions
// ============================================================================

const createEventStore = (config: PostgresConfig) =>
  Effect.gen(function* (_) {
    // In real implementation, would create actual connection pool
    const pool = null;
    return new PostgresEventStore(pool, config);
  });

const executeQuery = (
  config: PostgresConfig,
  query: string,
  params: any[]
): Effect.Effect<{ rows: any[] }, Error, never> =>
  Effect.tryPromise({
    try: async () => {
      // In real implementation, would use pg library
      console.log('Executing query:', query.substring(0, 50) + '...');
      return { rows: [] };
    },
    catch: (e) => new Error(`Query failed: ${e}`),
  });

// ============================================================================
// Interactive Mode
// ============================================================================

program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.cyan('\n🎮 Event Store Interactive Mode'));
    console.log('Type "help" for available commands or "exit" to quit\n');
    
    while (true) {
      const { command } = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: '>',
        },
      ]);
      
      if (command === 'exit') break;
      if (command === 'help') {
        console.log('\nAvailable commands:');
        console.log('  stream list    - List all streams');
        console.log('  event replay   - Replay events');
        console.log('  backup create  - Create backup');
        console.log('  bench run      - Run benchmarks');
        console.log('  maint stats    - Show statistics');
        console.log('  exit           - Exit interactive mode\n');
        continue;
      }
      
      // Parse and execute command
      const args = command.split(' ');
      const cmd = program.commands.find(c => c.name() === args[0]);
      if (cmd) {
        await cmd.parseAsync(args, { from: 'user' });
      } else {
        console.log(chalk.red('Unknown command. Type "help" for available commands.'));
      }
    }
    
    console.log(chalk.green('\n👋 Goodbye!'));
  });

// ============================================================================
// Main
// ============================================================================

// Add global options
program
  .option('-h, --host <host>', 'Database host')
  .option('-p, --port <port>', 'Database port')
  .option('-d, --database <database>', 'Database name')
  .option('-u, --user <user>', 'Database user')
  .option('-P, --password <password>', 'Database password');

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}