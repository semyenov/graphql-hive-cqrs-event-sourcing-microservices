/**
 * Framework Core: Framework Builder
 * 
 * Fluent API for setting up complete CQRS/Event Sourcing applications
 * with sensible defaults and simplified configuration.
 */

import {
  createEventStore,
  createCommandBus,
  createEventBus,
  createQueryBus,
  type IEvent,
  type ICommand,
  type IQuery
} from '../index';
import { SimpleDomainBuilder, type IDomainContext } from './simple-domain-builder';

/**
 * Framework configuration options
 */
export interface IFrameworkConfig {
  /** Application name */
  name: string;
  /** Enable development mode (more logging, debugging) */
  development?: boolean;
  /** Event store configuration */
  eventStore?: {
    type: 'memory' | 'file' | 'database';
    config?: Record<string, unknown>;
  };
  /** Enable metrics collection */
  metrics?: boolean;
  /** Enable request tracing */
  tracing?: boolean;
}

/**
 * Complete framework setup
 */
export class FrameworkBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  private config: IFrameworkConfig;
  private domains: Array<(context: IDomainContext<TEvent, TCommand, TQuery>) => void> = [];

  constructor(config: IFrameworkConfig) {
    this.config = {
      development: process.env.NODE_ENV !== 'production',
      eventStore: { type: 'memory' },
      metrics: false,
      tracing: false,
      ...config
    };
  }

  /**
   * Add a domain to the application
   */
  withDomain(
    setup: (builder: SimpleDomainBuilder<TEvent, TCommand, TQuery>) => SimpleDomainBuilder<TEvent, TCommand, TQuery>
  ): this {
    this.domains.push((context) => {
      const domainBuilder = new SimpleDomainBuilder<TEvent, TCommand, TQuery>({
        name: `Domain${this.domains.length + 1}`,
        autoRegister: true
      });
      
      const configuredBuilder = setup(domainBuilder);
      configuredBuilder.build(context);
    });
    
    return this;
  }

  /**
   * Build complete framework
   */
  build(): IFrameworkApp<TEvent, TCommand, TQuery> {
    if (this.config.development) {
      console.log(`🚀 Building ${this.config.name} framework...`);
    }

    // Create infrastructure
    const eventStore = createEventStore<TEvent>();
    const commandBus = createCommandBus();
    const queryBus = createQueryBus();
    const eventBus = createEventBus<TEvent>();

    const context: IDomainContext<TEvent, TCommand, TQuery> = {
      eventStore,
      commandBus,
      queryBus,
      eventBus
    };

    // Initialize all domains
    this.domains.forEach((domainSetup, index) => {
      if (this.config.development) {
        console.log(`  📦 Initializing domain ${index + 1}...`);
      }
      domainSetup(context);
    });

    if (this.config.development) {
      console.log(`✅ ${this.config.name} framework built successfully!`);
      console.log(`   📦 Domains: ${this.domains.length}`);
      console.log(`   🏗️  Infrastructure ready`);
    }

    return new FrameworkApp(this.config, context);
  }
}

/**
 * Framework application instance
 */
export class FrameworkApp<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  constructor(
    private config: IFrameworkConfig,
    private context: IDomainContext<TEvent, TCommand, TQuery>
  ) {}

  /**
   * Get command bus
   */
  get commands() {
    return this.context.commandBus;
  }

  /**
   * Get query bus
   */
  get queries() {
    return this.context.queryBus;
  }

  /**
   * Get event bus
   */
  get events() {
    return this.context.eventBus;
  }

  /**
   * Get event store
   */
  get eventStore() {
    return this.context.eventStore;
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.config.development) {
      console.log(`🟢 Starting ${this.config.name}...`);
    }

    // Perform any startup tasks here
    // e.g., database connections, cache warming, etc.

    if (this.config.development) {
      console.log(`✅ ${this.config.name} started successfully!`);
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (this.config.development) {
      console.log(`🔴 Stopping ${this.config.name}...`);
    }

    // Perform cleanup tasks here

    if (this.config.development) {
      console.log(`✅ ${this.config.name} stopped successfully!`);
    }
  }

  /**
   * Get application health
   */
  getHealth(): { status: 'healthy' | 'unhealthy'; details: Record<string, unknown> } {
    return {
      status: 'healthy',
      details: {
        name: this.config.name,
        uptime: process.uptime(),
        environment: this.config.development ? 'development' : 'production',
        // Add more health checks here
      }
    };
  }
}

/**
 * Framework application interface
 */
export interface IFrameworkApp<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery> {
  commands: IDomainContext<TEvent, TCommand, TQuery>['commandBus'];
  queries: IDomainContext<TEvent, TCommand, TQuery>['queryBus'];
  events: IDomainContext<TEvent, TCommand, TQuery>['eventBus'];
  eventStore: IDomainContext<TEvent, TCommand, TQuery>['eventStore'];
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealth(): { status: 'healthy' | 'unhealthy'; details: Record<string, unknown> };
}

/**
 * Create framework builder
 */
export function createFrameworkBuilder<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
  config: IFrameworkConfig
): FrameworkBuilder<TEvent, TCommand, TQuery> {
  return new FrameworkBuilder<TEvent, TCommand, TQuery>(config);
}

/**
 * Quick setup functions for common patterns
 */
export const Framework = {
  /**
   * Create a simple CQRS application
   */
  simple<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    name: string
  ): FrameworkBuilder<TEvent, TCommand, TQuery> {
    return createFrameworkBuilder<TEvent, TCommand, TQuery>({
      name,
      development: true,
      eventStore: { type: 'memory' },
      metrics: false
    });
  },

  /**
   * Create a production-ready application
   */
  production<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    name: string,
    eventStoreConfig?: { type: 'database'; config: Record<string, unknown> }
  ): FrameworkBuilder<TEvent, TCommand, TQuery> {
    return createFrameworkBuilder<TEvent, TCommand, TQuery>({
      name,
      development: false,
      eventStore: eventStoreConfig || { type: 'memory' },
      metrics: true,
      tracing: true
    });
  },

  /**
   * Create a development application with debugging
   */
  development<TEvent extends IEvent, TCommand extends ICommand, TQuery extends IQuery>(
    name: string
  ): FrameworkBuilder<TEvent, TCommand, TQuery> {
    return createFrameworkBuilder<TEvent, TCommand, TQuery>({
      name,
      development: true,
      eventStore: { type: 'memory' },
      metrics: true,
      tracing: true
    });
  }
};