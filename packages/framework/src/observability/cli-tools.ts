/**
 * Observability CLI Tools
 * 
 * Command-line tools for observability and monitoring:
 * - Health check CLI commands
 * - Metrics visualization and querying
 * - Log analysis and search
 * - SLO monitoring and alerting
 * - Dashboard management
 * - Debugging and troubleshooting utilities
 */

import * as Effect from 'effect/Effect';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import type { HealthReport, HealthStatus } from './health-checks';
import type { SLOReport, SLOStatus } from './slo-monitoring';
import type { LogQuery, LogEntry } from './log-aggregation';
import type { AnomalyResult } from './anomaly-detection';

/**
 * CLI command interface
 */
export interface CLICommand {
  readonly name: string;
  readonly description: string;
  readonly aliases?: string[];
  readonly args: CLIArgument[];
  readonly execute: (args: Record<string, any>) => Effect.Effect<void, Error, never>;
}

/**
 * CLI argument
 */
export interface CLIArgument {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly required: boolean;
  readonly defaultValue?: any;
  readonly choices?: string[];
}

/**
 * CLI output formatter
 */
export class CLIFormatter {
  /**
   * Format table output
   */
  static table(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((header, i) => {
      const maxWidth = Math.max(
        header.length,
        ...rows.map(row => (row[i] || '').toString().length)
      );
      return Math.min(maxWidth, 50); // Cap column width
    });

    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    
    const formatRow = (cells: string[]) => {
      return '|' + cells.map((cell, i) => {
        const truncated = cell.length > colWidths[i] 
          ? cell.slice(0, colWidths[i] - 3) + '...'
          : cell;
        return ` ${truncated.padEnd(colWidths[i])} `;
      }).join('|') + '|';
    };

    const lines = [
      separator,
      formatRow(headers),
      separator,
      ...rows.map(formatRow),
      separator,
    ];

    return lines.join('\n');
  }

  /**
   * Format key-value pairs
   */
  static keyValue(data: Record<string, any>, indent: number = 0): string {
    const prefix = ' '.repeat(indent);
    return Object.entries(data)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${prefix}${key}:\n${this.keyValue(value, indent + 2)}`;
        } else {
          return `${prefix}${key}: ${value}`;
        }
      })
      .join('\n');
  }

  /**
   * Format JSON with colors
   */
  static json(data: any, indent: number = 2): string {
    return JSON.stringify(data, null, indent);
  }

  /**
   * Format status with color
   */
  static status(status: string): string {
    const colors = {
      UP: '\x1b[32m', // Green
      DOWN: '\x1b[31m', // Red
      OUT_OF_SERVICE: '\x1b[33m', // Yellow
      UNKNOWN: '\x1b[90m', // Gray
      compliant: '\x1b[32m',
      at_risk: '\x1b[33m',
      exhausted: '\x1b[31m',
      CRITICAL: '\x1b[91m',
      HIGH: '\x1b[31m',
      MEDIUM: '\x1b[33m',
      LOW: '\x1b[32m',
    };

    const reset = '\x1b[0m';
    const color = colors[status as keyof typeof colors] || '';
    
    return `${color}${status}${reset}`;
  }

  /**
   * Format duration
   */
  static duration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Format bytes
   */
  static bytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format percentage
   */
  static percentage(value: number, total: number): string {
    const percent = total > 0 ? (value / total) * 100 : 0;
    return `${percent.toFixed(1)}%`;
  }

  /**
   * Create progress bar
   */
  static progressBar(value: number, max: number, width: number = 20): string {
    const percent = max > 0 ? Math.min(value / max, 1) : 0;
    const filled = Math.floor(percent * width);
    const empty = width - filled;
    
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${this.percentage(value, max)}`;
  }
}

/**
 * Health check CLI commands
 */
export class HealthCheckCLI {
  constructor(
    private readonly healthService: {
      checkHealth: () => Effect.Effect<HealthReport, Error, never>;
      checkIndicator: (name: string) => Effect.Effect<Option.Option<any>, Error, never>;
    }
  ) {}

  /**
   * Health check command
   */
  createHealthCommand(): CLICommand {
    return {
      name: 'health',
      description: 'Check application health status',
      aliases: ['status'],
      args: [
        {
          name: 'indicator',
          description: 'Specific health indicator to check',
          type: 'string',
          required: false,
        },
        {
          name: 'format',
          description: 'Output format',
          type: 'string',
          required: false,
          defaultValue: 'table',
          choices: ['table', 'json', 'summary'],
        },
      ],
      execute: (args) => Effect.gen(function* (_) {
        if (args.indicator) {
          yield* _(this.checkSpecificIndicator(args.indicator, args.format));
        } else {
          yield* _(this.checkOverallHealth(args.format));
        }
      }),
    };
  }

  private checkOverallHealth(format: string): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log('Checking application health...\n');
      
      const report = yield* _(this.healthService.checkHealth());
      
      switch (format) {
        case 'json':
          console.log(CLIFormatter.json(report));
          break;
        
        case 'summary':
          this.displayHealthSummary(report);
          break;
        
        default:
          this.displayHealthTable(report);
      }
    });
  }

  private checkSpecificIndicator(name: string, format: string): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log(`Checking health indicator: ${name}\n`);
      
      const result = yield* _(this.healthService.checkIndicator(name));
      
      if (Option.isNone(result)) {
        console.log(`❌ Health indicator '${name}' not found`);
        return;
      }

      const indicator = result.value;
      
      if (format === 'json') {
        console.log(CLIFormatter.json(indicator));
      } else {
        console.log(`Status: ${CLIFormatter.status(indicator.status)}`);
        console.log(`Duration: ${CLIFormatter.duration(indicator.duration)}`);
        console.log(`Timestamp: ${indicator.timestamp.toISOString()}`);
        
        if (indicator.error) {
          console.log(`Error: ${indicator.error}`);
        }
        
        if (indicator.details) {
          console.log('\nDetails:');
          console.log(CLIFormatter.keyValue(indicator.details, 2));
        }
      }
    });
  }

  private displayHealthSummary(report: HealthReport): void {
    console.log(`Overall Status: ${CLIFormatter.status(report.status)}`);
    console.log(`Check Duration: ${CLIFormatter.duration(report.duration)}`);
    console.log(`Timestamp: ${report.timestamp.toISOString()}\n`);
    
    console.log('Summary:');
    console.log(`  Total Indicators: ${report.summary.total}`);
    console.log(`  🟢 UP: ${report.summary.up}`);
    console.log(`  🔴 DOWN: ${report.summary.down}`);
    console.log(`  🟡 OUT_OF_SERVICE: ${report.summary.outOfService}`);
    console.log(`  ⚪ UNKNOWN: ${report.summary.unknown}`);
    
    // Show failed indicators
    const failedIndicators = Object.entries(report.indicators)
      .filter(([, result]) => result.status !== 'UP')
      .map(([name, result]) => ({ name, ...result }));
    
    if (failedIndicators.length > 0) {
      console.log('\nFailed Indicators:');
      for (const indicator of failedIndicators) {
        console.log(`  ❌ ${indicator.name}: ${CLIFormatter.status(indicator.status)}`);
        if (indicator.error) {
          console.log(`     Error: ${indicator.error}`);
        }
      }
    }
  }

  private displayHealthTable(report: HealthReport): void {
    console.log(`Overall Status: ${CLIFormatter.status(report.status)}\n`);
    
    const headers = ['Indicator', 'Status', 'Duration', 'Error'];
    const rows = Object.entries(report.indicators).map(([name, result]) => [
      name,
      CLIFormatter.status(result.status),
      CLIFormatter.duration(result.duration),
      result.error || '-',
    ]);
    
    console.log(CLIFormatter.table(headers, rows));
  }
}

/**
 * SLO monitoring CLI commands
 */
export class SLOMonitoringCLI {
  constructor(
    private readonly sloService: {
      generateReport: (slos: any[], period: Duration.Duration) => Effect.Effect<SLOReport, Error, never>;
    }
  ) {}

  /**
   * SLO status command
   */
  createSLOCommand(): CLICommand {
    return {
      name: 'slo',
      description: 'Check SLO compliance and error budget status',
      args: [
        {
          name: 'period',
          description: 'Time period for SLO evaluation',
          type: 'string',
          required: false,
          defaultValue: '24h',
          choices: ['1h', '24h', '7d', '30d'],
        },
        {
          name: 'format',
          description: 'Output format',
          type: 'string',
          required: false,
          defaultValue: 'table',
          choices: ['table', 'json', 'summary'],
        },
      ],
      execute: (args) => this.checkSLOStatus(args.period, args.format),
    };
  }

  private checkSLOStatus(periodStr: string, format: string): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      console.log(`Checking SLO status for period: ${periodStr}\n`);
      
      const period = this.parsePeriod(periodStr);
      // In production, would load actual SLO definitions
      const slos: any[] = [];
      const report = yield* _(this.sloService.generateReport(slos, period));
      
      switch (format) {
        case 'json':
          console.log(CLIFormatter.json(report));
          break;
        
        case 'summary':
          this.displaySLOSummary(report);
          break;
        
        default:
          this.displaySLOTable(report);
      }
    });
  }

  private parsePeriod(periodStr: string): Duration.Duration {
    const match = periodStr.match(/^(\d+)([hdwM])$/);
    if (!match) {
      return Duration.hours(24);
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h': return Duration.hours(num);
      case 'd': return Duration.days(num);
      case 'w': return Duration.days(num * 7);
      case 'M': return Duration.days(num * 30);
      default: return Duration.hours(24);
    }
  }

  private displaySLOSummary(report: SLOReport): void {
    console.log(`Overall Compliance: ${report.overallCompliance.toFixed(2)}%\n`);
    
    console.log('Summary:');
    console.log(`  Total SLOs: ${report.totalSLOs}`);
    console.log(`  🟢 Compliant: ${report.compliantSLOs}`);
    console.log(`  🟡 At Risk: ${report.atRiskSLOs}`);
    console.log(`  🔴 Exhausted: ${report.exhaustedSLOs}`);
    
    if (report.exhaustedSLOs > 0) {
      console.log('\nSLOs with Exhausted Error Budget:');
      const exhausted = report.statuses.filter(s => s.compliance === 'exhausted');
      for (const slo of exhausted) {
        console.log(`  ❌ ${slo.slo.name}: ${slo.currentValue.toFixed(2)}% (target: ${slo.target}%)`);
        console.log(`     Error Budget: ${slo.errorBudget.remaining.toFixed(2)}%`);
      }
    }
  }

  private displaySLOTable(report: SLOReport): void {
    const headers = ['SLO', 'Current', 'Target', 'Compliance', 'Error Budget', 'Trend'];
    const rows = report.statuses.map(status => [
      status.slo.name,
      `${status.currentValue.toFixed(2)}%`,
      `${status.target.toFixed(2)}%`,
      CLIFormatter.status(status.compliance),
      `${status.errorBudget.remaining.toFixed(2)}%`,
      status.trend,
    ]);
    
    console.log(CLIFormatter.table(headers, rows));
  }
}

/**
 * Log analysis CLI commands
 */
export class LogAnalysisCLI {
  constructor(
    private readonly logService: {
      search: (query: LogQuery) => LogEntry[];
      getStatistics: (query?: LogQuery) => any;
    }
  ) {}

  /**
   * Log search command
   */
  createLogCommand(): CLICommand {
    return {
      name: 'logs',
      description: 'Search and analyze logs',
      args: [
        {
          name: 'query',
          description: 'Search term or filter',
          type: 'string',
          required: false,
        },
        {
          name: 'level',
          description: 'Log level filter',
          type: 'string',
          required: false,
          choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
        },
        {
          name: 'service',
          description: 'Service name filter',
          type: 'string',
          required: false,
        },
        {
          name: 'since',
          description: 'Time range (e.g., 1h, 30m)',
          type: 'string',
          required: false,
          defaultValue: '1h',
        },
        {
          name: 'limit',
          description: 'Maximum number of results',
          type: 'number',
          required: false,
          defaultValue: 100,
        },
        {
          name: 'format',
          description: 'Output format',
          type: 'string',
          required: false,
          defaultValue: 'table',
          choices: ['table', 'json', 'raw'],
        },
      ],
      execute: (args) => this.searchLogs(args),
    };
  }

  /**
   * Log stats command
   */
  createLogStatsCommand(): CLICommand {
    return {
      name: 'log-stats',
      description: 'Show log statistics and analysis',
      args: [
        {
          name: 'since',
          description: 'Time range for statistics',
          type: 'string',
          required: false,
          defaultValue: '1h',
        },
      ],
      execute: (args) => this.showLogStats(args.since),
    };
  }

  private searchLogs(args: Record<string, any>): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const query: LogQuery = {
        searchTerm: args.query,
        levels: args.level ? [args.level] : undefined,
        services: args.service ? [args.service] : undefined,
        timeRange: {
          from: new Date(Date.now() - this.parseDuration(args.since)),
          to: new Date(),
        },
        limit: args.limit,
      };

      const logs = this.logService.search(query);

      switch (args.format) {
        case 'json':
          console.log(CLIFormatter.json(logs));
          break;
        
        case 'raw':
          for (const log of logs) {
            console.log(`${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.message}`);
          }
          break;
        
        default:
          this.displayLogTable(logs);
      }
    });
  }

  private showLogStats(since: string): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const query: LogQuery = {
        timeRange: {
          from: new Date(Date.now() - this.parseDuration(since)),
          to: new Date(),
        },
      };

      const stats = this.logService.getStatistics(query);
      
      console.log(`Log Statistics (${since})\n`);
      
      console.log(`Total Logs: ${stats.totalLogs}`);
      
      console.log('\nBy Level:');
      for (const [level, count] of Object.entries(stats.logsByLevel)) {
        if (count > 0) {
          console.log(`  ${level.toUpperCase()}: ${count}`);
        }
      }
      
      console.log('\nBy Service:');
      const sortedServices = Object.entries(stats.logsByService)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10);
      
      for (const [service, count] of sortedServices) {
        console.log(`  ${service}: ${count}`);
      }
      
      if (stats.topErrorTypes.length > 0) {
        console.log('\nTop Errors:');
        for (const error of stats.topErrorTypes.slice(0, 5)) {
          console.log(`  ${error.error} (${error.count}x)`);
        }
      }
    });
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/^(\d+)([hms])$/);
    if (!match) {
      return 3600000; // 1 hour default
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h': return num * 3600000;
      case 'm': return num * 60000;
      case 's': return num * 1000;
      default: return 3600000;
    }
  }

  private displayLogTable(logs: LogEntry[]): void {
    const headers = ['Timestamp', 'Level', 'Service', 'Message'];
    const rows = logs.map(log => [
      log.timestamp.toISOString().replace('T', ' ').replace('Z', ''),
      CLIFormatter.status(log.level.toUpperCase()),
      log.service,
      log.message.length > 80 ? log.message.slice(0, 77) + '...' : log.message,
    ]);
    
    console.log(CLIFormatter.table(headers, rows));
  }
}

/**
 * Anomaly detection CLI commands
 */
export class AnomalyDetectionCLI {
  constructor(
    private readonly anomalyService: {
      getAnomalyHistory: (metricName: string, since?: Date, limit?: number) => AnomalyResult[];
      getStatistics: (metricName: string) => any;
    }
  ) {}

  /**
   * Anomaly list command
   */
  createAnomalyCommand(): CLICommand {
    return {
      name: 'anomalies',
      description: 'View detected anomalies',
      args: [
        {
          name: 'metric',
          description: 'Specific metric to analyze',
          type: 'string',
          required: false,
        },
        {
          name: 'since',
          description: 'Time range (e.g., 1h, 30m)',
          type: 'string',
          required: false,
          defaultValue: '24h',
        },
        {
          name: 'severity',
          description: 'Minimum severity level',
          type: 'string',
          required: false,
          choices: ['low', 'medium', 'high', 'critical'],
        },
        {
          name: 'limit',
          description: 'Maximum number of results',
          type: 'number',
          required: false,
          defaultValue: 50,
        },
      ],
      execute: (args) => this.listAnomalies(args),
    };
  }

  private listAnomalies(args: Record<string, any>): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const metricName = args.metric || 'commands_per_second';
      const since = new Date(Date.now() - this.parseDuration(args.since));
      
      let anomalies = this.anomalyService.getAnomalyHistory(metricName, since, args.limit);
      
      // Filter by severity if specified
      if (args.severity) {
        const severityOrder = ['low', 'medium', 'high', 'critical'];
        const minIndex = severityOrder.indexOf(args.severity);
        anomalies = anomalies.filter(a => 
          severityOrder.indexOf(a.severity) >= minIndex
        );
      }

      console.log(`Anomalies for ${metricName} (${args.since})\n`);
      
      if (anomalies.length === 0) {
        console.log('No anomalies found.');
        return;
      }

      const headers = ['Timestamp', 'Type', 'Severity', 'Value', 'Expected', 'Confidence', 'Description'];
      const rows = anomalies.map(anomaly => [
        anomaly.timestamp.toISOString().replace('T', ' ').replace('Z', ''),
        anomaly.type,
        CLIFormatter.status(anomaly.severity.toUpperCase()),
        anomaly.value.toFixed(2),
        anomaly.expectedValue.toFixed(2),
        `${(anomaly.confidence * 100).toFixed(1)}%`,
        anomaly.description.length > 50 ? anomaly.description.slice(0, 47) + '...' : anomaly.description,
      ]);
      
      console.log(CLIFormatter.table(headers, rows));
      
      // Show summary statistics
      const stats = this.anomalyService.getStatistics(metricName);
      console.log('\nAnomaly Statistics:');
      console.log(`  Total: ${stats.totalAnomalies}`);
      console.log(`  By Severity:`);
      for (const [severity, count] of Object.entries(stats.anomaliesBySeverity)) {
        if (count > 0) {
          console.log(`    ${severity}: ${count}`);
        }
      }
    });
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/^(\d+)([hdwM])$/);
    if (!match) {
      return 86400000; // 24 hours default
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h': return num * 3600000;
      case 'd': return num * 86400000;
      case 'w': return num * 604800000;
      case 'M': return num * 2592000000;
      default: return 86400000;
    }
  }
}

/**
 * Main CLI application
 */
export class ObservabilityCLI {
  private commands = new Map<string, CLICommand>();

  constructor(
    private readonly services: {
      health?: any;
      slo?: any;
      logs?: any;
      anomaly?: any;
    }
  ) {
    this.registerCommands();
  }

  /**
   * Register all CLI commands
   */
  private registerCommands(): void {
    if (this.services.health) {
      const healthCLI = new HealthCheckCLI(this.services.health);
      this.addCommand(healthCLI.createHealthCommand());
    }

    if (this.services.slo) {
      const sloCLI = new SLOMonitoringCLI(this.services.slo);
      this.addCommand(sloCLI.createSLOCommand());
    }

    if (this.services.logs) {
      const logCLI = new LogAnalysisCLI(this.services.logs);
      this.addCommand(logCLI.createLogCommand());
      this.addCommand(logCLI.createLogStatsCommand());
    }

    if (this.services.anomaly) {
      const anomalyCLI = new AnomalyDetectionCLI(this.services.anomaly);
      this.addCommand(anomalyCLI.createAnomalyCommand());
    }

    // Add help command
    this.addCommand({
      name: 'help',
      description: 'Show available commands',
      args: [],
      execute: () => this.showHelp(),
    });
  }

  /**
   * Add command to CLI
   */
  addCommand(command: CLICommand): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * Execute CLI command
   */
  execute(args: string[]): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      if (args.length === 0) {
        yield* _(this.showHelp());
        return;
      }

      const commandName = args[0];
      const command = this.commands.get(commandName);

      if (!command) {
        console.error(`Unknown command: ${commandName}`);
        yield* _(this.showHelp());
        return yield* _(Effect.fail(new Error(`Unknown command: ${commandName}`)));
      }

      const parsedArgs = this.parseArgs(command.args, args.slice(1));
      yield* _(command.execute(parsedArgs));
    });
  }

  /**
   * Parse command arguments
   */
  private parseArgs(argDefs: CLIArgument[], args: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    // Set defaults
    for (const argDef of argDefs) {
      if (argDef.defaultValue !== undefined) {
        result[argDef.name] = argDef.defaultValue;
      }
    }

    // Parse provided arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const argDef = argDefs.find(def => def.name === key);
        
        if (!argDef) {
          console.warn(`Unknown argument: ${arg}`);
          continue;
        }

        if (argDef.type === 'boolean') {
          result[key] = true;
        } else if (i + 1 < args.length) {
          const value = args[++i];
          result[key] = this.convertValue(value, argDef.type);
        }
      } else {
        // Positional argument
        const argDef = argDefs.find(def => result[def.name] === undefined);
        if (argDef) {
          result[argDef.name] = this.convertValue(arg, argDef.type);
        }
      }
    }

    return result;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'array':
        return value.split(',');
      default:
        return value;
    }
  }

  /**
   * Show help information
   */
  private showHelp(): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      console.log('CQRS Observability CLI\n');
      
      console.log('Available Commands:\n');
      
      const uniqueCommands = Array.from(new Set(this.commands.values()));
      
      for (const command of uniqueCommands) {
        console.log(`  ${command.name.padEnd(15)} ${command.description}`);
        
        if (command.aliases && command.aliases.length > 0) {
          console.log(`${''.padEnd(17)}Aliases: ${command.aliases.join(', ')}`);
        }
      }

      console.log('\nUse --help with any command for detailed usage information.\n');
      
      console.log('Examples:');
      console.log('  cqrs-cli health                    # Check overall health');
      console.log('  cqrs-cli health --indicator=database  # Check specific indicator');
      console.log('  cqrs-cli logs --level=error --since=1h  # Show recent errors');
      console.log('  cqrs-cli slo --period=24h          # Check SLO compliance');
      console.log('  cqrs-cli anomalies --severity=high # Show high-severity anomalies');
    });
  }
}

/**
 * Create observability CLI
 */
export const createObservabilityCLI = (services: {
  health?: any;
  slo?: any;
  logs?: any;
  anomaly?: any;
}): ObservabilityCLI => {
  return new ObservabilityCLI(services);
};