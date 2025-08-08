/**
 * Framework Core: Simple Discovery System
 * 
 * KISS-compliant discovery system that favors explicit registration
 * over complex file system scanning and magic.
 */

import type { IEvent } from './event';
import type { ICommand, ICommandHandler } from './command';
import type { IQuery, IQueryHandler } from './query';
import type { IValidator } from './validation';
import { NamingConventions, defaultNamingExtractor } from './naming-conventions';

/**
 * Simple component registry for manual registration
 */
export interface ISimpleRegistry<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  commandHandlers: Map<string, ICommandHandler<TCommand>>;
  queryHandlers: Map<string, IQueryHandler<TQuery, unknown>>;
  projections: Map<string, unknown>;
  validators: Map<string, IValidator<unknown>>;
  eventHandlers: Array<(event: TEvent) => Promise<void>>;
}

/**
 * Simple discovery builder - explicit and predictable
 */
export class SimpleDiscovery<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private registry: ISimpleRegistry<TEvent, TCommand, TQuery> = {
    commandHandlers: new Map(),
    queryHandlers: new Map(),
    projections: new Map(),
    validators: new Map(),
    eventHandlers: [],
  };

  /**
   * Register command handlers with type inference
   */
  registerCommandHandlers(handlers: Record<string, ICommandHandler<TCommand>>): this {
    for (const [name, handler] of Object.entries(handlers)) {
      const commandType = this.extractCommandType(name);
      this.registry.commandHandlers.set(commandType, handler);
      console.log(`  ✅ Command: ${name} -> ${commandType}`);
    }
    return this;
  }

  /**
   * Register query handlers with type inference
   */
  registerQueryHandlers(handlers: Record<string, IQueryHandler<TQuery, unknown>>): this {
    for (const [name, handler] of Object.entries(handlers)) {
      const queryType = this.extractQueryType(name);
      this.registry.queryHandlers.set(queryType, handler);
      console.log(`  ✅ Query: ${name} -> ${queryType}`);
    }
    return this;
  }

  /**
   * Register projections
   */
  registerProjections(projections: Record<string, unknown>): this {
    for (const [name, projection] of Object.entries(projections)) {
      this.registry.projections.set(name, projection);
      console.log(`  ✅ Projection: ${name}`);
    }
    return this;
  }

  /**
   * Register validators
   */
  registerValidators(validators: Record<string, IValidator<unknown>>): this {
    for (const [name, validator] of Object.entries(validators)) {
      this.registry.validators.set(name, validator);
      console.log(`  ✅ Validator: ${name}`);
    }
    return this;
  }

  /**
   * Register event handlers
   */
  registerEventHandlers(...handlers: Array<(event: TEvent) => Promise<void>>): this {
    this.registry.eventHandlers.push(...handlers);
    console.log(`  ✅ Event Handlers: ${handlers.length} registered`);
    return this;
  }

  /**
   * Get the registry
   */
  getRegistry(): ISimpleRegistry<TEvent, TCommand, TQuery> {
    return this.registry;
  }

  /**
   * Extract command type from handler name using naming conventions
   */
  private extractCommandType(handlerName: string): string {
    return NamingConventions.extractCommandType(handlerName);
  }

  /**
   * Extract query type from handler name using naming conventions
   */
  private extractQueryType(handlerName: string): string {
    return NamingConventions.extractQueryType(handlerName);
  }
}

/**
 * Create simple discovery instance
 */
export function createSimpleDiscovery<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(): SimpleDiscovery<TEvent, TCommand, TQuery> {
  return new SimpleDiscovery<TEvent, TCommand, TQuery>();
}

/**
 * Simple discovery helper for common patterns
 */
export const DiscoveryHelpers = {
  /**
   * Register all exports from a handlers module
   */
  fromModule<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    moduleExports: Record<string, unknown>
  ): SimpleDiscovery<TEvent, TCommand, TQuery> {
    const discovery = createSimpleDiscovery<TEvent, TCommand, TQuery>();
    
    const commandHandlers: Record<string, ICommandHandler<TCommand>> = {};
    const queryHandlers: Record<string, IQueryHandler<TQuery, unknown>> = {};
    const projections: Record<string, unknown> = {};
    const validators: Record<string, IValidator<unknown>> = {};
    const eventHandlers: Array<(event: TEvent) => Promise<void>> = [];

    for (const [name, exported] of Object.entries(moduleExports)) {
      const componentType = defaultNamingExtractor.determineComponentType(name);
      
      switch (componentType) {
        case 'command':
          commandHandlers[name] = exported as ICommandHandler<TCommand>;
          break;
        case 'query':
          queryHandlers[name] = exported as IQueryHandler<TQuery, unknown>;
          break;
        case 'projection':
          projections[name] = exported;
          break;
        case 'validator':
          validators[name] = exported as IValidator<unknown>;
          break;
        case 'event':
          if (typeof exported === 'function') {
            eventHandlers.push(exported as (event: TEvent) => Promise<void>);
          }
          break;
      }
    }

    return discovery
      .registerCommandHandlers(commandHandlers)
      .registerQueryHandlers(queryHandlers)
      .registerProjections(projections)
      .registerValidators(validators)
      .registerEventHandlers(...eventHandlers);
  },

  /**
   * Register domain components using simple naming conventions
   */
  fromDomain<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    domainModule: {
      commandHandlers?: Record<string, ICommandHandler<TCommand>>;
      queryHandlers?: Record<string, IQueryHandler<TQuery, unknown>>;
      projections?: Record<string, unknown>;
      validators?: Record<string, IValidator<unknown>>;
      eventHandlers?: Array<(event: TEvent) => Promise<void>>;
    }
  ): SimpleDiscovery<TEvent, TCommand, TQuery> {
    const discovery = createSimpleDiscovery<TEvent, TCommand, TQuery>();
    
    if (domainModule.commandHandlers) {
      discovery.registerCommandHandlers(domainModule.commandHandlers);
    }
    if (domainModule.queryHandlers) {
      discovery.registerQueryHandlers(domainModule.queryHandlers);
    }
    if (domainModule.projections) {
      discovery.registerProjections(domainModule.projections);
    }
    if (domainModule.validators) {
      discovery.registerValidators(domainModule.validators);
    }
    if (domainModule.eventHandlers) {
      discovery.registerEventHandlers(...domainModule.eventHandlers);
    }
    
    return discovery;
  }
};