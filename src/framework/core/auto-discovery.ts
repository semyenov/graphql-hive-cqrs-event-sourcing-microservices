/**
 * Framework Core: Auto-Discovery System
 * 
 * Automatic discovery and registration of handlers, projections, and validators
 * based on file system conventions and naming patterns.
 */

import type { IEvent, IEventBus } from './event';
import type { ICommand, ICommandBus, ICommandHandler } from './command';
import type { IQuery, IQueryBus, IQueryHandler } from './query';
import type { IEventStore } from './event';
import type { IValidator, ICommandValidator, IQueryValidator } from './validation';

/**
 * Discovery configuration options
 */
export interface IDiscoveryConfig {
  /** Base directory for discovery (relative to domain root) */
  baseDir: string;
  /** Patterns for different component types */
  patterns: {
    commandHandlers?: string[];
    queryHandlers?: string[];
    projections?: string[];
    validators?: string[];
    eventHandlers?: string[];
  };
  /** Naming conventions */
  conventions: {
    commandHandlerSuffix?: string;
    queryHandlerSuffix?: string;
    projectionSuffix?: string;
    validatorSuffix?: string;
    eventHandlerSuffix?: string;
  };
  /** Auto-registration options */
  autoRegister: {
    handlers?: boolean;
    projections?: boolean;
    validators?: boolean;
    eventHandlers?: boolean;
  };
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG: IDiscoveryConfig = {
  baseDir: './src/domains',
  patterns: {
    commandHandlers: ['**/commands/handlers.ts', '**/commands/handlers/*.ts'],
    queryHandlers: ['**/queries/handlers.ts', '**/queries/handlers/*.ts'],
    projections: ['**/projections/*.ts', '**/projections/index.ts'],
    validators: ['**/validators/*.ts', '**/validators/index.ts'],
    eventHandlers: ['**/events/handlers.ts', '**/events/handlers/*.ts'],
  },
  conventions: {
    commandHandlerSuffix: 'CommandHandler',
    queryHandlerSuffix: 'QueryHandler', 
    projectionSuffix: 'Projection',
    validatorSuffix: 'Validator',
    eventHandlerSuffix: 'EventHandler',
  },
  autoRegister: {
    handlers: true,
    projections: true,
    validators: true,
    eventHandlers: true,
  },
};

/**
 * Discovered component metadata
 */
export interface IDiscoveredComponent {
  name: string;
  type: 'commandHandler' | 'queryHandler' | 'projection' | 'validator' | 'eventHandler';
  filePath: string;
  exportName: string;
  instance?: unknown;
  commandType?: string;
  queryType?: string;
  eventType?: string;
}

/**
 * Discovery result
 */
export interface IDiscoveryResult<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  commandHandlers: Map<string, ICommandHandler<TCommand>>;
  queryHandlers: Map<string, IQueryHandler<TQuery, unknown>>;
  projections: Map<string, unknown>;
  validators: Map<string, IValidator<unknown> | ICommandValidator<TCommand> | IQueryValidator<TQuery>>;
  eventHandlers: Array<(event: TEvent) => Promise<void>>;
  components: IDiscoveredComponent[];
}

/**
 * File system discovery utilities (simulated for this example)
 */
export class FileSystemDiscovery {
  /**
   * Discover files matching patterns
   */
  static async discoverFiles(patterns: string[], baseDir: string): Promise<string[]> {
    // In a real implementation, this would use fs.readdir and glob patterns
    // For demonstration purposes, we'll simulate discovered files
    
    const simulatedFiles: Record<string, string[]> = {
      '**/commands/handlers.ts': [
        'src/domains/users/commands/handlers.ts',
        'src/domains/orders/commands/handlers.ts',
        'src/domains/products/commands/handlers.ts',
      ],
      '**/queries/handlers.ts': [
        'src/domains/users/queries/handlers.ts',
        'src/domains/orders/queries/handlers.ts',
        'src/domains/products/queries/handlers.ts',
      ],
      '**/projections/*.ts': [
        'src/domains/users/projections/user.projection.ts',
        'src/domains/users/projections/user-list.projection.ts',
        'src/domains/orders/projections/order.projection.ts',
        'src/domains/products/projections/product.projection.ts',
      ],
      '**/validators/*.ts': [
        'src/domains/users/validators/command.validators.ts',
        'src/domains/orders/validators/command.validators.ts',
      ],
      '**/events/handlers.ts': [
        'src/domains/users/events/handlers.ts',
        'src/domains/orders/events/handlers.ts',
      ],
    };

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = simulatedFiles[pattern] || [];
      allFiles.push(...files);
    }

    return Array.from(new Set(allFiles)); // Remove duplicates
  }

  /**
   * Extract exports from a file (simulated)
   */
  static async extractExports(filePath: string): Promise<Record<string, unknown>> {
    // In a real implementation, this would dynamically import the file
    // For demonstration, we'll return simulated exports based on file path
    
    if (filePath.includes('commands/handlers.ts')) {
      return {
        CreateUserCommandHandler: { canHandle: () => true, handle: () => Promise.resolve() },
        UpdateUserCommandHandler: { canHandle: () => true, handle: () => Promise.resolve() },
        DeleteUserCommandHandler: { canHandle: () => true, handle: () => Promise.resolve() },
      };
    }
    
    if (filePath.includes('queries/handlers.ts')) {
      return {
        GetUserByIdQueryHandler: { canHandle: () => true, handle: () => Promise.resolve() },
        ListUsersQueryHandler: { canHandle: () => true, handle: () => Promise.resolve() },
        SearchUsersQueryHandler: { canHandle: () => true, handle: () => Promise.resolve() },
      };
    }

    if (filePath.includes('projections')) {
      return {
        createUserProjection: { project: () => {}, getState: () => ({}) },
        createUserListProjection: { project: () => {}, getState: () => ({}) },
      };
    }

    if (filePath.includes('validators')) {
      return {
        createUserCommandValidator: { validate: () => Promise.resolve({ isValid: true, errors: [] }) },
        updateUserCommandValidator: { validate: () => Promise.resolve({ isValid: true, errors: [] }) },
      };
    }

    return {};
  }
}

/**
 * Component name analyzer
 */
export class ComponentNameAnalyzer {
  /**
   * Extract component type and command/query type from name
   */
  static analyzeComponent(name: string, conventions: IDiscoveryConfig['conventions']): {
    type: IDiscoveredComponent['type'] | null;
    commandType?: string;
    queryType?: string;
    eventType?: string;
  } {
    if (name.endsWith(conventions.commandHandlerSuffix || 'CommandHandler')) {
      return {
        type: 'commandHandler',
        commandType: this.extractCommandType(name, conventions.commandHandlerSuffix || 'CommandHandler'),
      };
    }

    if (name.endsWith(conventions.queryHandlerSuffix || 'QueryHandler')) {
      return {
        type: 'queryHandler',
        queryType: this.extractQueryType(name, conventions.queryHandlerSuffix || 'QueryHandler'),
      };
    }

    if (name.includes(conventions.projectionSuffix || 'Projection')) {
      return { type: 'projection' };
    }

    if (name.includes(conventions.validatorSuffix || 'Validator')) {
      return { type: 'validator' };
    }

    if (name.endsWith(conventions.eventHandlerSuffix || 'EventHandler')) {
      return { type: 'eventHandler' };
    }

    return { type: null };
  }

  /**
   * Extract command type from handler name
   * e.g., 'CreateUserCommandHandler' -> 'CREATE_USER'
   */
  private static extractCommandType(handlerName: string, suffix: string): string {
    const baseName = handlerName.replace(new RegExp(suffix + '$'), '');
    return baseName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }

  /**
   * Extract query type from handler name
   * e.g., 'GetUserByIdQueryHandler' -> 'GET_USER_BY_ID'
   */
  private static extractQueryType(handlerName: string, suffix: string): string {
    const baseName = handlerName.replace(new RegExp(suffix + '$'), '');
    return baseName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}

/**
 * Auto-discovery engine
 */
export class AutoDiscovery<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private config: IDiscoveryConfig;
  private components: IDiscoveredComponent[] = [];

  constructor(config: Partial<IDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  }

  /**
   * Discover all components
   */
  async discover(): Promise<IDiscoveryResult<TEvent, TCommand, TQuery>> {
    console.log('🔍 Starting auto-discovery of domain components...');

    const result: IDiscoveryResult<TEvent, TCommand, TQuery> = {
      commandHandlers: new Map(),
      queryHandlers: new Map(),
      projections: new Map(),
      validators: new Map(),
      eventHandlers: [],
      components: [],
    };

    // Discover command handlers
    if (this.config.patterns.commandHandlers) {
      await this.discoverCommandHandlers(result);
    }

    // Discover query handlers
    if (this.config.patterns.queryHandlers) {
      await this.discoverQueryHandlers(result);
    }

    // Discover projections
    if (this.config.patterns.projections) {
      await this.discoverProjections(result);
    }

    // Discover validators
    if (this.config.patterns.validators) {
      await this.discoverValidators(result);
    }

    // Discover event handlers
    if (this.config.patterns.eventHandlers) {
      await this.discoverEventHandlers(result);
    }

    result.components = this.components;
    
    console.log(`✅ Auto-discovery completed: ${this.components.length} components found`);
    this.logDiscoveryResults(result);

    return result;
  }

  /**
   * Discover command handlers
   */
  private async discoverCommandHandlers(result: IDiscoveryResult<TEvent, TCommand, TQuery>): Promise<void> {
    const files = await FileSystemDiscovery.discoverFiles(
      this.config.patterns.commandHandlers!,
      this.config.baseDir
    );

    for (const filePath of files) {
      const exports = await FileSystemDiscovery.extractExports(filePath);
      
      for (const [exportName, instance] of Object.entries(exports)) {
        const analysis = ComponentNameAnalyzer.analyzeComponent(exportName, this.config.conventions);
        
        if (analysis.type === 'commandHandler' && analysis.commandType) {
          const component: IDiscoveredComponent = {
            name: exportName,
            type: 'commandHandler',
            filePath,
            exportName,
            instance,
            commandType: analysis.commandType,
          };

          this.components.push(component);
          result.commandHandlers.set(analysis.commandType, instance as ICommandHandler<TCommand>);
          
          console.log(`  📝 Command: ${exportName} -> ${analysis.commandType}`);
        }
      }
    }
  }

  /**
   * Discover query handlers
   */
  private async discoverQueryHandlers(result: IDiscoveryResult<TEvent, TCommand, TQuery>): Promise<void> {
    const files = await FileSystemDiscovery.discoverFiles(
      this.config.patterns.queryHandlers!,
      this.config.baseDir
    );

    for (const filePath of files) {
      const exports = await FileSystemDiscovery.extractExports(filePath);
      
      for (const [exportName, instance] of Object.entries(exports)) {
        const analysis = ComponentNameAnalyzer.analyzeComponent(exportName, this.config.conventions);
        
        if (analysis.type === 'queryHandler' && analysis.queryType) {
          const component: IDiscoveredComponent = {
            name: exportName,
            type: 'queryHandler',
            filePath,
            exportName,
            instance,
            queryType: analysis.queryType,
          };

          this.components.push(component);
          result.queryHandlers.set(analysis.queryType, instance as IQueryHandler<TQuery, unknown>);
          
          console.log(`  🔍 Query: ${exportName} -> ${analysis.queryType}`);
        }
      }
    }
  }

  /**
   * Discover projections
   */
  private async discoverProjections(result: IDiscoveryResult<TEvent, TCommand, TQuery>): Promise<void> {
    const files = await FileSystemDiscovery.discoverFiles(
      this.config.patterns.projections!,
      this.config.baseDir
    );

    for (const filePath of files) {
      const exports = await FileSystemDiscovery.extractExports(filePath);
      
      for (const [exportName, instance] of Object.entries(exports)) {
        const analysis = ComponentNameAnalyzer.analyzeComponent(exportName, this.config.conventions);
        
        if (analysis.type === 'projection') {
          const component: IDiscoveredComponent = {
            name: exportName,
            type: 'projection',
            filePath,
            exportName,
            instance,
          };

          this.components.push(component);
          result.projections.set(exportName, instance);
          
          console.log(`  📊 Projection: ${exportName}`);
        }
      }
    }
  }

  /**
   * Discover validators
   */
  private async discoverValidators(result: IDiscoveryResult<TEvent, TCommand, TQuery>): Promise<void> {
    const files = await FileSystemDiscovery.discoverFiles(
      this.config.patterns.validators!,
      this.config.baseDir
    );

    for (const filePath of files) {
      const exports = await FileSystemDiscovery.extractExports(filePath);
      
      for (const [exportName, instance] of Object.entries(exports)) {
        const analysis = ComponentNameAnalyzer.analyzeComponent(exportName, this.config.conventions);
        
        if (analysis.type === 'validator') {
          const component: IDiscoveredComponent = {
            name: exportName,
            type: 'validator',
            filePath,
            exportName,
            instance,
          };

          this.components.push(component);
          result.validators.set(exportName, instance as IValidator<unknown>);
          
          console.log(`  ✅ Validator: ${exportName}`);
        }
      }
    }
  }

  /**
   * Discover event handlers
   */
  private async discoverEventHandlers(result: IDiscoveryResult<TEvent, TCommand, TQuery>): Promise<void> {
    const files = await FileSystemDiscovery.discoverFiles(
      this.config.patterns.eventHandlers!,
      this.config.baseDir
    );

    for (const filePath of files) {
      const exports = await FileSystemDiscovery.extractExports(filePath);
      
      for (const [exportName, instance] of Object.entries(exports)) {
        if (typeof instance === 'function') {
          const component: IDiscoveredComponent = {
            name: exportName,
            type: 'eventHandler',
            filePath,
            exportName,
            instance,
          };

          this.components.push(component);
          result.eventHandlers.push(instance as (event: TEvent) => Promise<void>);
          
          console.log(`  🔔 Event Handler: ${exportName}`);
        }
      }
    }
  }

  /**
   * Auto-register discovered components
   */
  async autoRegister(
    result: IDiscoveryResult<TEvent, TCommand, TQuery>,
    context: {
      commandBus?: ICommandBus;
      queryBus?: IQueryBus;
      eventBus?: IEventBus<TEvent>;
      eventStore?: IEventStore<TEvent>;
    }
  ): Promise<void> {
    console.log('🔧 Auto-registering discovered components...');

    // Auto-register command handlers
    if (this.config.autoRegister.handlers && context.commandBus) {
      for (const [commandType, handler] of result.commandHandlers) {
        (context.commandBus as any).registerWithType(commandType, handler);
        console.log(`  ✅ Registered command handler: ${commandType}`);
      }
    }

    // Auto-register query handlers
    if (this.config.autoRegister.handlers && context.queryBus) {
      for (const [queryType, handler] of result.queryHandlers) {
        (context.queryBus as any).registerWithType(queryType, handler);
        console.log(`  ✅ Registered query handler: ${queryType}`);
      }
    }

    // Auto-register event handlers
    if (this.config.autoRegister.eventHandlers && context.eventBus) {
      for (const handler of result.eventHandlers) {
        (context.eventBus as any).subscribeAll(handler);
        console.log(`  ✅ Registered event handler`);
      }
    }

    console.log('✅ Auto-registration completed');
  }

  /**
   * Log discovery results
   */
  private logDiscoveryResults(result: IDiscoveryResult<TEvent, TCommand, TQuery>): void {
    console.log('\n📈 Discovery Summary:');
    console.log(`  Command Handlers: ${result.commandHandlers.size}`);
    console.log(`  Query Handlers: ${result.queryHandlers.size}`);
    console.log(`  Projections: ${result.projections.size}`);
    console.log(`  Validators: ${result.validators.size}`);
    console.log(`  Event Handlers: ${result.eventHandlers.length}`);
  }

  /**
   * Get discovery configuration
   */
  getConfig(): IDiscoveryConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<IDiscoveryConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create auto-discovery instance
 */
export function createAutoDiscovery<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
  config?: Partial<IDiscoveryConfig>
): AutoDiscovery<TEvent, TCommand, TQuery> {
  return new AutoDiscovery<TEvent, TCommand, TQuery>(config);
}

/**
 * Convention-based discovery presets
 */
export const DiscoveryPresets = {
  /**
   * Standard CQRS domain structure
   */
  standardCQRS: {
    patterns: {
      commandHandlers: ['**/commands/handlers.ts', '**/commands/*.handler.ts'],
      queryHandlers: ['**/queries/handlers.ts', '**/queries/*.handler.ts'],
      projections: ['**/projections/*.ts', '**/projections/index.ts'],
      validators: ['**/validators/*.ts'],
      eventHandlers: ['**/events/handlers.ts', '**/events/*.handler.ts'],
    },
    conventions: {
      commandHandlerSuffix: 'CommandHandler',
      queryHandlerSuffix: 'QueryHandler',
      projectionSuffix: 'Projection',
      validatorSuffix: 'Validator',
      eventHandlerSuffix: 'Handler',
    },
  },

  /**
   * Feature-based structure  
   */
  featureBased: {
    patterns: {
      commandHandlers: ['**/features/*/commands/*.ts'],
      queryHandlers: ['**/features/*/queries/*.ts'],
      projections: ['**/features/*/projections/*.ts'],
      validators: ['**/features/*/validators/*.ts'],
      eventHandlers: ['**/features/*/events/*.ts'],
    },
    conventions: {
      commandHandlerSuffix: 'Handler',
      queryHandlerSuffix: 'Handler', 
      projectionSuffix: 'Projection',
      validatorSuffix: 'Validator',
      eventHandlerSuffix: 'EventHandler',
    },
  },

  /**
   * Modular monolith structure
   */
  modularMonolith: {
    patterns: {
      commandHandlers: ['**/modules/*/application/commands/*.ts'],
      queryHandlers: ['**/modules/*/application/queries/*.ts'],
      projections: ['**/modules/*/infrastructure/projections/*.ts'],
      validators: ['**/modules/*/application/validators/*.ts'],
      eventHandlers: ['**/modules/*/infrastructure/events/*.ts'],
    },
    conventions: {
      commandHandlerSuffix: 'CommandHandler',
      queryHandlerSuffix: 'QueryHandler',
      projectionSuffix: 'Projection', 
      validatorSuffix: 'Validator',
      eventHandlerSuffix: 'EventHandler',
    },
  },
};