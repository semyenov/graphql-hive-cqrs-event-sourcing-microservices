/**
 * Framework Core: Enhanced Domain Registry
 * 
 * Convention-based domain registration with auto-discovery.
 */

import type { IEvent, IEventBus } from './event';
import type { ICommand, ICommandBus, ICommandHandler } from './command';
import type { IQuery, IQueryBus, IQueryHandler } from './query';
import type { IEventStore } from './event';
import type { IDomainModule } from './types';

/**
 * Domain component discovery result
 */
export interface IDomainComponents<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  handlers: {
    commands: Map<string, ICommandHandler<TCommand>>;
    queries: Map<string, IQueryHandler<TQuery, unknown>>;
  };
  projections: Map<string, unknown>;
  validators: Map<string, unknown>;
  eventHandlers: Array<(event: TEvent) => Promise<void>>;
}

/**
 * Domain context with all infrastructure
 */
export interface IDomainContext<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  eventStore: IEventStore<TEvent>;
  commandBus: ICommandBus;
  queryBus: IQueryBus;
  eventBus: IEventBus<TEvent>;
  repository: unknown; // Will be typed by specific domain
}

/**
 * Convention-based domain builder
 */
export class DomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private components: Partial<IDomainComponents<TEvent, TCommand, TQuery>> = {};
  private config: any = {};

  /**
   * Set domain configuration
   */
  configure(config: any): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Auto-register command handlers from object
   */
  withCommandHandlers(handlers: Record<string, ICommandHandler<TCommand>>): this {
    this.components.handlers = this.components.handlers || { commands: new Map(), queries: new Map() };
    for (const [key, handler] of Object.entries(handlers)) {
      // Extract command type from key (e.g., 'createUserHandler' -> 'CREATE_USER')
      const commandType = this.extractCommandType(key);
      this.components.handlers.commands.set(commandType, handler);
    }
    return this;
  }

  /**
   * Auto-register query handlers from object
   */
  withQueryHandlers(handlers: Record<string, IQueryHandler<TQuery, unknown>>): this {
    this.components.handlers = this.components.handlers || { commands: new Map(), queries: new Map() };
    for (const [key, handler] of Object.entries(handlers)) {
      // Extract query type from key (e.g., 'getUserByIdHandler' -> 'GET_USER_BY_ID')
      const queryType = this.extractQueryType(key);
      this.components.handlers.queries.set(queryType, handler);
    }
    return this;
  }

  /**
   * Auto-register projections from object
   */
  withProjections(projections: Record<string, unknown>): this {
    this.components.projections = this.components.projections || new Map();
    for (const [key, projection] of Object.entries(projections)) {
      this.components.projections.set(key, projection);
    }
    return this;
  }

  /**
   * Auto-register event handlers
   */
  withEventHandlers(handlers: Array<(event: TEvent) => Promise<void>>): this {
    this.components.eventHandlers = handlers;
    return this;
  }

  /**
   * Build domain context with auto-wiring
   */
  build(context: IDomainContext<TEvent, TCommand, TQuery>): IDomainComponents<TEvent, TCommand, TQuery> {
    // Auto-register command handlers
    if (this.components.handlers?.commands) {
      for (const [commandType, handler] of this.components.handlers.commands) {
        (context.commandBus).registerWithType(commandType, handler);
      }
    }

    // Auto-register query handlers  
    if (this.components.handlers?.queries) {
      for (const [queryType, handler] of this.components.handlers.queries) {
        (context.queryBus as any).register(handler); // IQueryBus doesn't have registerWithType
      }
    }

    // Auto-register event handlers
    if (this.components.eventHandlers) {
      for (const handler of this.components.eventHandlers) {
        (context.eventBus).subscribeAll(handler);
      }
    }

    return this.components as IDomainComponents<TEvent, TCommand, TQuery>;
  }

  /**
   * Extract command type from handler name using convention
   * e.g., 'createUserHandler' -> 'CREATE_USER'
   */
  private extractCommandType(handlerName: string): string {
    // Remove 'Handler' suffix and convert camelCase to SNAKE_CASE
    const name = handlerName.replace(/Handler$/, '');
    return name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }

  /**
   * Extract query type from handler name using convention
   * e.g., 'getUserByIdHandler' -> 'GET_USER_BY_ID'  
   */
  private extractQueryType(handlerName: string): string {
    // Remove 'Handler' suffix and convert camelCase to SNAKE_CASE
    const name = handlerName.replace(/Handler$/, '');
    return name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}

/**
 * Create domain builder
 */
export function createDomainBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(): DomainBuilder<TEvent, TCommand, TQuery> {
  return new DomainBuilder<TEvent, TCommand, TQuery>();
}

/**
 * Simplified domain initialization function
 */
export function initializeDomain<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
  builder: DomainBuilder<TEvent, TCommand, TQuery>,
  context: IDomainContext<TEvent, TCommand, TQuery>
): IDomainComponents<TEvent, TCommand, TQuery> {
  return builder.build(context);
}