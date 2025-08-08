/**
 * Framework Core: Enhanced Domain Builder with Auto-Discovery
 * 
 * Combines convention-based registration with automatic discovery
 * for zero-configuration domain setup.
 */

import type { IEvent, IEventBus } from './event';
import type { ICommand, ICommandBus, ICommandHandler } from './command';
import type { IQuery, IQueryBus, IQueryHandler } from './query';
import type { IEventStore } from './event';
import type { IDomainComponents, IDomainContext } from './domain-registry';
import { 
  AutoDiscovery, 
  createAutoDiscovery,
  type IDiscoveryConfig,
  type IDiscoveryResult,
  DiscoveryPresets
} from './auto-discovery';

/**
 * Enhanced domain builder options
 */
export interface IEnhancedDomainOptions {
  /** Enable auto-discovery */
  autoDiscovery?: boolean;
  /** Discovery configuration */
  discoveryConfig?: Partial<IDiscoveryConfig>;
  /** Use preset discovery configuration */
  discoveryPreset?: keyof typeof DiscoveryPresets;
  /** Manual component registrations (merged with discovered) */
  manualComponents?: {
    commandHandlers?: Record<string, ICommandHandler<any>>;
    queryHandlers?: Record<string, IQueryHandler<any, unknown>>;
    projections?: Record<string, unknown>;
    validators?: Record<string, unknown>;
    eventHandlers?: Array<(event: any) => Promise<void>>;
  };
  /** Override auto-registration */
  autoRegister?: {
    handlers?: boolean;
    projections?: boolean;
    validators?: boolean;
    eventHandlers?: boolean;
  };
}

/**
 * Enhanced domain builder with auto-discovery
 */
export class EnhancedDomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private options: IEnhancedDomainOptions;
  private discovery?: AutoDiscovery<TEvent, TCommand, TQuery>;
  private discoveryResult?: IDiscoveryResult<TEvent, TCommand, TQuery>;

  constructor(options: IEnhancedDomainOptions = {}) {
    this.options = {
      autoDiscovery: true,
      autoRegister: {
        handlers: true,
        projections: true,
        validators: true,
        eventHandlers: true,
      },
      ...options,
    };

    // Initialize auto-discovery if enabled
    if (this.options.autoDiscovery) {
      this.initializeDiscovery();
    }
  }

  /**
   * Initialize auto-discovery system
   */
  private initializeDiscovery(): void {
    let discoveryConfig = this.options.discoveryConfig || {};

    // Apply preset if specified
    if (this.options.discoveryPreset) {
      const preset = DiscoveryPresets[this.options.discoveryPreset];
      discoveryConfig = { ...preset, ...discoveryConfig };
    }

    // Merge auto-register options
    if (this.options.autoRegister) {
      discoveryConfig.autoRegister = { ...discoveryConfig.autoRegister, ...this.options.autoRegister };
    }

    this.discovery = createAutoDiscovery<TEvent, TCommand, TQuery>(discoveryConfig);
  }

  /**
   * Perform discovery (if enabled)
   */
  async discover(): Promise<this> {
    if (this.discovery) {
      console.log('🔍 Enhanced Domain Builder: Starting auto-discovery...');
      this.discoveryResult = await this.discovery.discover();
    }
    return this;
  }

  /**
   * Build domain with auto-discovery + manual components
   */
  async build(context: IDomainContext<TEvent, TCommand, TQuery>): Promise<IDomainComponents<TEvent, TCommand, TQuery>> {
    // Perform discovery if not already done
    if (this.options.autoDiscovery && !this.discoveryResult) {
      await this.discover();
    }

    // Initialize result components
    const components: IDomainComponents<TEvent, TCommand, TQuery> = {
      handlers: {
        commands: new Map(),
        queries: new Map(),
      },
      projections: new Map(),
      validators: new Map(),
      eventHandlers: [],
    };

    // Add discovered components
    if (this.discoveryResult) {
      this.mergeDiscoveredComponents(components, this.discoveryResult);
    }

    // Add manual components
    if (this.options.manualComponents) {
      this.mergeManualComponents(components, this.options.manualComponents);
    }

    // Auto-register components
    await this.autoRegisterComponents(components, context);

    console.log(`✅ Enhanced Domain Builder: Built domain with ${this.getTotalComponentCount(components)} components`);
    this.logBuildSummary(components);

    return components;
  }

  /**
   * Merge discovered components
   */
  private mergeDiscoveredComponents(
    components: IDomainComponents<TEvent, TCommand, TQuery>,
    discoveryResult: IDiscoveryResult<TEvent, TCommand, TQuery>
  ): void {
    // Merge command handlers
    for (const [commandType, handler] of discoveryResult.commandHandlers) {
      components.handlers.commands.set(commandType, handler);
    }

    // Merge query handlers
    for (const [queryType, handler] of discoveryResult.queryHandlers) {
      components.handlers.queries.set(queryType, handler);
    }

    // Merge projections
    for (const [name, projection] of discoveryResult.projections) {
      components.projections.set(name, projection);
    }

    // Merge validators
    for (const [name, validator] of discoveryResult.validators) {
      components.validators.set(name, validator);
    }

    // Merge event handlers
    components.eventHandlers.push(...discoveryResult.eventHandlers);
  }

  /**
   * Merge manual components
   */
  private mergeManualComponents(
    components: IDomainComponents<TEvent, TCommand, TQuery>,
    manualComponents: NonNullable<IEnhancedDomainOptions['manualComponents']>
  ): void {
    // Merge manual command handlers
    if (manualComponents.commandHandlers) {
      for (const [key, handler] of Object.entries(manualComponents.commandHandlers)) {
        const commandType = this.extractCommandType(key);
        components.handlers.commands.set(commandType, handler);
        console.log(`  📝 Manual Command: ${key} -> ${commandType}`);
      }
    }

    // Merge manual query handlers  
    if (manualComponents.queryHandlers) {
      for (const [key, handler] of Object.entries(manualComponents.queryHandlers)) {
        const queryType = this.extractQueryType(key);
        components.handlers.queries.set(queryType, handler);
        console.log(`  🔍 Manual Query: ${key} -> ${queryType}`);
      }
    }

    // Merge manual projections
    if (manualComponents.projections) {
      for (const [key, projection] of Object.entries(manualComponents.projections)) {
        components.projections.set(key, projection);
        console.log(`  📊 Manual Projection: ${key}`);
      }
    }

    // Merge manual validators
    if (manualComponents.validators) {
      for (const [key, validator] of Object.entries(manualComponents.validators)) {
        components.validators.set(key, validator);
        console.log(`  ✅ Manual Validator: ${key}`);
      }
    }

    // Merge manual event handlers
    if (manualComponents.eventHandlers) {
      components.eventHandlers.push(...manualComponents.eventHandlers);
      console.log(`  🔔 Manual Event Handlers: ${manualComponents.eventHandlers.length}`);
    }
  }

  /**
   * Auto-register components with buses
   */
  private async autoRegisterComponents(
    components: IDomainComponents<TEvent, TCommand, TQuery>,
    context: IDomainContext<TEvent, TCommand, TQuery>
  ): Promise<void> {
    // Auto-register command handlers
    if (this.options.autoRegister?.handlers && context.commandBus) {
      for (const [commandType, handler] of components.handlers.commands) {
        (context.commandBus as any).registerWithType(commandType, handler);
      }
      console.log(`  ✅ Auto-registered ${components.handlers.commands.size} command handlers`);
    }

    // Auto-register query handlers
    if (this.options.autoRegister?.handlers && context.queryBus) {
      for (const [queryType, handler] of components.handlers.queries) {
        (context.queryBus as any).registerWithType(queryType, handler);
      }
      console.log(`  ✅ Auto-registered ${components.handlers.queries.size} query handlers`);
    }

    // Auto-register event handlers
    if (this.options.autoRegister?.eventHandlers && context.eventBus) {
      for (const handler of components.eventHandlers) {
        (context.eventBus as any).subscribeAll(handler);
      }
      console.log(`  ✅ Auto-registered ${components.eventHandlers.length} event handlers`);
    }
  }

  /**
   * Extract command type from handler name
   */
  private extractCommandType(handlerName: string): string {
    const name = handlerName.replace(/Handler$/, '');
    return name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }

  /**
   * Extract query type from handler name
   */
  private extractQueryType(handlerName: string): string {
    const name = handlerName.replace(/Handler$/, '');
    return name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }

  /**
   * Get total component count
   */
  private getTotalComponentCount(components: IDomainComponents<TEvent, TCommand, TQuery>): number {
    return components.handlers.commands.size +
           components.handlers.queries.size +
           components.projections.size +
           components.validators.size +
           components.eventHandlers.length;
  }

  /**
   * Log build summary
   */
  private logBuildSummary(components: IDomainComponents<TEvent, TCommand, TQuery>): void {
    console.log('\n📈 Enhanced Domain Build Summary:');
    console.log(`  Command Handlers: ${components.handlers.commands.size}`);
    console.log(`  Query Handlers: ${components.handlers.queries.size}`);
    console.log(`  Projections: ${components.projections.size}`);
    console.log(`  Validators: ${components.validators.size}`);
    console.log(`  Event Handlers: ${components.eventHandlers.length}`);
    
    if (this.discoveryResult) {
      const discoveredCount = this.discoveryResult.components.length;
      const manualCount = this.getTotalComponentCount(components) - discoveredCount;
      console.log(`  📊 Discovery: ${discoveredCount} auto-discovered, ${manualCount} manual`);
    }
  }

  /**
   * Get discovery result
   */
  getDiscoveryResult(): IDiscoveryResult<TEvent, TCommand, TQuery> | undefined {
    return this.discoveryResult;
  }

  /**
   * Get discovery configuration  
   */
  getDiscoveryConfig(): IDiscoveryConfig | undefined {
    return this.discovery?.getConfig();
  }

  /**
   * Update discovery configuration
   */
  updateDiscoveryConfig(updates: Partial<IDiscoveryConfig>): this {
    this.discovery?.updateConfig(updates);
    return this;
  }
}

/**
 * Create enhanced domain builder
 */
export function createEnhancedDomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
  options?: IEnhancedDomainOptions
): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
  return new EnhancedDomainBuilder<TEvent, TCommand, TQuery>(options);
}

/**
 * Simplified factory functions for common patterns
 */
export const DomainBuilderFactory = {
  /**
   * Standard CQRS domain with auto-discovery
   */
  standard<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    baseDir?: string
  ): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
    return createEnhancedDomainBuilder<TEvent, TCommand, TQuery>({
      autoDiscovery: true,
      discoveryPreset: 'standardCQRS',
      discoveryConfig: baseDir ? { baseDir } : undefined,
    });
  },

  /**
   * Feature-based domain structure
   */
  featureBased<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    baseDir?: string
  ): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
    return createEnhancedDomainBuilder<TEvent, TCommand, TQuery>({
      autoDiscovery: true,
      discoveryPreset: 'featureBased',
      discoveryConfig: baseDir ? { baseDir } : undefined,
    });
  },

  /**
   * Modular monolith structure
   */
  modularMonolith<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    baseDir?: string
  ): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
    return createEnhancedDomainBuilder<TEvent, TCommand, TQuery>({
      autoDiscovery: true,
      discoveryPreset: 'modularMonolith',
      discoveryConfig: baseDir ? { baseDir } : undefined,
    });
  },

  /**
   * Manual-only domain (no auto-discovery)
   */
  manual<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    components?: IEnhancedDomainOptions['manualComponents']
  ): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
    return createEnhancedDomainBuilder<TEvent, TCommand, TQuery>({
      autoDiscovery: false,
      manualComponents: components,
    });
  },

  /**
   * Hybrid approach (auto-discovery + manual overrides)
   */
  hybrid<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    preset: keyof typeof DiscoveryPresets,
    manualComponents?: IEnhancedDomainOptions['manualComponents']
  ): EnhancedDomainBuilder<TEvent, TCommand, TQuery> {
    return createEnhancedDomainBuilder<TEvent, TCommand, TQuery>({
      autoDiscovery: true,
      discoveryPreset: preset,
      manualComponents,
    });
  },
};