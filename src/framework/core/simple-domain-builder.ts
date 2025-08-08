/**
 * Framework Core: Simple Domain Builder
 * 
 * KISS-compliant domain builder that merges enhanced-domain-builder and domain-registry
 * with a focus on simplicity and explicit configuration.
 */

import type { IEvent, IEventBus } from './event';
import type { ICommand, ICommandBus, ICommandHandler } from './command';
import type { IQuery, IQueryBus, IQueryHandler } from './query';
import type { IEventStore } from './event';
import type { IValidator } from './validation';
import { SimpleDiscovery, DiscoveryHelpers, type ISimpleRegistry } from './simple-discovery';

/**
 * Simplified domain context
 */
export interface IDomainContext<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  eventStore: IEventStore<TEvent>;
  commandBus: ICommandBus;
  queryBus: IQueryBus;
  eventBus: IEventBus<TEvent>;
}

/**
 * Simple domain builder options
 */
export interface ISimpleDomainOptions {
  /** Domain name for logging */
  name?: string;
  /** Auto-register components with buses */
  autoRegister?: boolean;
}

/**
 * Simple domain builder with KISS principles
 */
export class SimpleDomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private discovery: SimpleDiscovery<TEvent, TCommand, TQuery>;
  private options: ISimpleDomainOptions;

  constructor(options: ISimpleDomainOptions = {}) {
    this.options = {
      name: 'Domain',
      autoRegister: true,
      ...options
    };
    this.discovery = new SimpleDiscovery<TEvent, TCommand, TQuery>();
  }

  /**
   * Register command handlers
   */
  withCommandHandlers(handlers: Record<string, ICommandHandler<TCommand>>): this {
    this.discovery.registerCommandHandlers(handlers);
    return this;
  }

  /**
   * Register query handlers
   */
  withQueryHandlers(handlers: Record<string, IQueryHandler<TQuery, unknown>>): this {
    this.discovery.registerQueryHandlers(handlers);
    return this;
  }

  /**
   * Register projections
   */
  withProjections(projections: Record<string, unknown>): this {
    this.discovery.registerProjections(projections);
    return this;
  }

  /**
   * Register validators
   */
  withValidators(validators: Record<string, IValidator<unknown>>): this {
    this.discovery.registerValidators(validators);
    return this;
  }

  /**
   * Register event handlers
   */
  withEventHandlers(...handlers: Array<(event: TEvent) => Promise<void>>): this {
    this.discovery.registerEventHandlers(...handlers);
    return this;
  }

  /**
   * Register all components from a domain module
   */
  fromDomain(domainModule: {
    commandHandlers?: Record<string, ICommandHandler<TCommand>>;
    queryHandlers?: Record<string, IQueryHandler<TQuery, unknown>>;
    projections?: Record<string, unknown>;
    validators?: Record<string, IValidator<unknown>>;
    eventHandlers?: Array<(event: TEvent) => Promise<void>>;
  }): this {
    const discovery = DiscoveryHelpers.fromDomain<TEvent, TCommand, TQuery>(domainModule);
    const registry = discovery.getRegistry();
    
    // Merge into our registry
    for (const [type, handler] of registry.commandHandlers) {
      this.discovery.getRegistry().commandHandlers.set(type, handler);
    }
    for (const [type, handler] of registry.queryHandlers) {
      this.discovery.getRegistry().queryHandlers.set(type, handler);
    }
    for (const [name, projection] of registry.projections) {
      this.discovery.getRegistry().projections.set(name, projection);
    }
    for (const [name, validator] of registry.validators) {
      this.discovery.getRegistry().validators.set(name, validator);
    }
    this.discovery.getRegistry().eventHandlers.push(...registry.eventHandlers);
    
    return this;
  }

  /**
   * Register all exports from a module using naming conventions
   */
  fromModule(moduleExports: Record<string, unknown>): this {
    const discovery = DiscoveryHelpers.fromModule<TEvent, TCommand, TQuery>(moduleExports);
    const registry = discovery.getRegistry();
    
    // Merge into our registry
    for (const [type, handler] of registry.commandHandlers) {
      this.discovery.getRegistry().commandHandlers.set(type, handler);
    }
    for (const [type, handler] of registry.queryHandlers) {
      this.discovery.getRegistry().queryHandlers.set(type, handler);
    }
    for (const [name, projection] of registry.projections) {
      this.discovery.getRegistry().projections.set(name, projection);
    }
    for (const [name, validator] of registry.validators) {
      this.discovery.getRegistry().validators.set(name, validator);
    }
    this.discovery.getRegistry().eventHandlers.push(...registry.eventHandlers);
    
    return this;
  }

  /**
   * Build and optionally auto-register with buses
   */
  build(context: IDomainContext<TEvent, TCommand, TQuery>): ISimpleRegistry<TEvent, TCommand, TQuery> {
    const registry = this.discovery.getRegistry();
    
    console.log(`\n🏗️  Building ${this.options.name} domain...`);
    
    if (this.options.autoRegister) {
      this.autoRegister(registry, context);
    }
    
    this.logBuildSummary(registry);
    
    return registry;
  }

  /**
   * Auto-register components with buses
   */
  private autoRegister(
    registry: ISimpleRegistry<TEvent, TCommand, TQuery>,
    context: IDomainContext<TEvent, TCommand, TQuery>
  ): void {
    // Register command handlers
    for (const [commandType, handler] of registry.commandHandlers) {
      (context.commandBus as any).registerWithType(commandType, handler);
    }
    console.log(`  ✅ Registered ${registry.commandHandlers.size} command handlers`);

    // Register query handlers
    for (const [queryType, handler] of registry.queryHandlers) {
      (context.queryBus as any).registerWithType(queryType, handler);
    }
    console.log(`  ✅ Registered ${registry.queryHandlers.size} query handlers`);

    // Register event handlers
    for (const handler of registry.eventHandlers) {
      (context.eventBus as any).subscribeAll(handler);
    }
    console.log(`  ✅ Registered ${registry.eventHandlers.length} event handlers`);
  }

  /**
   * Log build summary
   */
  private logBuildSummary(registry: ISimpleRegistry<TEvent, TCommand, TQuery>): void {
    const totalComponents = 
      registry.commandHandlers.size + 
      registry.queryHandlers.size + 
      registry.projections.size + 
      registry.validators.size + 
      registry.eventHandlers.length;
      
    console.log(`✅ ${this.options.name} domain built with ${totalComponents} components`);
    console.log(`   Commands: ${registry.commandHandlers.size}`);
    console.log(`   Queries: ${registry.queryHandlers.size}`);
    console.log(`   Projections: ${registry.projections.size}`);
    console.log(`   Validators: ${registry.validators.size}`);
    console.log(`   Event Handlers: ${registry.eventHandlers.length}`);
  }

  /**
   * Get current registry for inspection
   */
  getRegistry(): ISimpleRegistry<TEvent, TCommand, TQuery> {
    return this.discovery.getRegistry();
  }
}

/**
 * Create simple domain builder
 */
export function createSimpleDomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
  options?: ISimpleDomainOptions
): SimpleDomainBuilder<TEvent, TCommand, TQuery> {
  return new SimpleDomainBuilder<TEvent, TCommand, TQuery>(options);
}

/**
 * Convenience factory functions
 */
export const DomainBuilder = {
  /**
   * Create builder for a specific domain
   */
  forDomain<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    name: string
  ): SimpleDomainBuilder<TEvent, TCommand, TQuery> {
    return createSimpleDomainBuilder<TEvent, TCommand, TQuery>({ name });
  },

  /**
   * Create builder with auto-registration disabled
   */
  manual<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    name?: string
  ): SimpleDomainBuilder<TEvent, TCommand, TQuery> {
    return createSimpleDomainBuilder<TEvent, TCommand, TQuery>({ 
      name: name || 'Manual Domain',
      autoRegister: false 
    });
  }
};