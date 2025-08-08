/**
 * Framework Generator: Domain Template
 * 
 * Generates boilerplate code for new domains following best practices
 * established in the user domain implementation.
 */

export interface DomainConfig {
  name: string;
  aggregateName: string;
  events: string[];
  commands: string[];
  queries?: string[];
}

/**
 * Generate domain directory structure
 */
export function generateDomainStructure(config: DomainConfig): Map<string, string> {
  const files = new Map<string, string>();
  const { name, aggregateName } = config;
  const domainPath = `src/domains/${name}`;
  
  // Generate event types
  files.set(`${domainPath}/events/types.ts`, generateEventTypes(config));
  files.set(`${domainPath}/events/factories.ts`, generateEventFactories(config));
  files.set(`${domainPath}/events/handlers.ts`, generateEventHandlers(config));
  
  // Generate command types and handlers
  files.set(`${domainPath}/commands/types.ts`, generateCommandTypes(config));
  files.set(`${domainPath}/commands/handlers.ts`, generateCommandHandlers(config));
  
  // Generate aggregate
  files.set(`${domainPath}/aggregates/${aggregateName.toLowerCase()}.ts`, generateAggregate(config));
  files.set(`${domainPath}/aggregates/repository.ts`, generateRepository(config));
  
  // Generate queries
  files.set(`${domainPath}/queries/types.ts`, generateQueryTypes(config));
  files.set(`${domainPath}/queries/handlers.ts`, generateQueryHandlers(config));
  files.set(`${domainPath}/queries/specifications.ts`, generateSpecifications(config));
  
  // Generate projections
  files.set(`${domainPath}/projections/${aggregateName.toLowerCase()}.projection.ts`, generateProjection(config));
  
  // Generate validators
  files.set(`${domainPath}/validators/command.validators.ts`, generateValidators(config));
  
  // Generate helpers
  files.set(`${domainPath}/helpers/type-guards.ts`, generateTypeGuards(config));
  
  // Generate index file
  files.set(`${domainPath}/index.ts`, generateIndexFile(config));
  
  return files;
}

function generateEventTypes(config: DomainConfig): string {
  const { aggregateName, events } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Event Types
 */

import type { IEvent } from '../../../framework/core/event';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * Event type constants
 */
export const ${capitalizedName}EventTypes = {
${events.map(e => `  ${e}: '${capitalizedName}${e}' as const,`).join('\n')}
} as const;

export type ${capitalizedName}EventType = typeof ${capitalizedName}EventTypes[keyof typeof ${capitalizedName}EventTypes];

${events.map(event => `
/**
 * ${event} event data
 */
export interface ${event}Data {
  // TODO: Define event data structure
}

/**
 * ${event} event
 */
export interface ${event}Event extends IEvent<
  typeof ${capitalizedName}EventTypes.${event},
  ${event}Data,
  AggregateId
> {
  type: typeof ${capitalizedName}EventTypes.${event};
}`).join('\n')}

/**
 * Union of all ${aggregateName} events
 */
export type ${capitalizedName}Event = ${events.map(e => `${e}Event`).join(' | ')};
`;
}

function generateEventFactories(config: DomainConfig): string {
  const { aggregateName, events } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Event Factories
 */

import { BrandedTypes } from '../../../framework/core/branded/factories';
import { ${capitalizedName}EventTypes } from './types';
import type { ${events.map(e => `${e}Event, ${e}Data`).join(', ')} } from './types';
import type { AggregateId, EventVersion } from '../../../framework/core/branded/types';

export const ${capitalizedName}EventFactories = {
${events.map(event => `  
  create${event}(
    aggregateId: AggregateId,
    data: ${event}Data,
    version: number
  ): ${event}Event {
    return {
      id: BrandedTypes.eventId(crypto.randomUUID()),
      aggregateId,
      type: ${capitalizedName}EventTypes.${event},
      data,
      version: BrandedTypes.eventVersion(version),
      timestamp: BrandedTypes.timestamp(new Date()),
      metadata: {
        correlationId: BrandedTypes.correlationId(crypto.randomUUID()),
        causationId: BrandedTypes.causationId(crypto.randomUUID()),
        timestamp: BrandedTypes.timestamp(new Date()),
      },
    };
  },`).join('\n')}
};
`;
}

function generateCommandTypes(config: DomainConfig): string {
  const { aggregateName, commands } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Command Types
 */

import type { ICommand } from '../../../framework/core/command';

/**
 * Command type constants
 */
export const ${capitalizedName}CommandTypes = {
${commands.map(c => `  ${c}: '${capitalizedName}.${c}' as const,`).join('\n')}
} as const;

export type ${capitalizedName}CommandType = typeof ${capitalizedName}CommandTypes[keyof typeof ${capitalizedName}CommandTypes];

${commands.map(command => `
/**
 * ${command} command
 */
export interface ${command}Command extends ICommand<
  typeof ${capitalizedName}CommandTypes.${command},
  {
    // TODO: Define command payload
  }
> {
  type: typeof ${capitalizedName}CommandTypes.${command};
}`).join('\n')}

/**
 * Union of all ${aggregateName} commands
 */
export type ${capitalizedName}Command = ${commands.map(c => `${c}Command`).join(' | ')};
`;
}

function generateAggregate(config: DomainConfig): string {
  const { aggregateName, events } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Aggregate
 */

import { Aggregate } from '../../../framework/core/aggregate';
import { BrandedTypes } from '../../../framework/core/branded/factories';
import { ${capitalizedName}EventFactories } from '../events/factories';
import { match${capitalizedName}Event } from '../helpers/type-guards';
import type { ${capitalizedName}Event } from '../events/types';
import type { ${capitalizedName}Command } from '../commands/types';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * ${capitalizedName} state
 */
export interface ${capitalizedName}State {
  id: AggregateId;
  // TODO: Define aggregate state
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ${capitalizedName} aggregate implementation
 */
export class ${capitalizedName}Aggregate extends Aggregate<
  ${capitalizedName}State,
  ${capitalizedName}Event,
  AggregateId
> {
  constructor(id: AggregateId) {
    super(
      id,
      (state, event) => {
        return match${capitalizedName}Event<${capitalizedName}State>(event, {
          // TODO: Implement event reducers
${events.map(e => `          ${capitalizedName}${e}: (e) => state,`).join('\n')}
        });
      },
      {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Handle commands
   */
  handle(command: ${capitalizedName}Command): void {
    // TODO: Implement command handling
  }
}
`;
}

function generateRepository(config: DomainConfig): string {
  const { aggregateName } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Repository
 */

import { AggregateRepository } from '../../../framework/infrastructure/repository/aggregate';
import { ${capitalizedName}Aggregate } from './${aggregateName.toLowerCase()}';
import type { IEventStore } from '../../../framework/core/event';
import type { ${capitalizedName}Event } from '../events/types';
import type { AggregateId } from '../../../framework/core/branded/types';

/**
 * ${capitalizedName} repository implementation
 */
export class ${capitalizedName}Repository extends AggregateRepository<
  ${capitalizedName}Aggregate,
  ${capitalizedName}Event,
  AggregateId
> {
  constructor(eventStore: IEventStore<${capitalizedName}Event>) {
    super(
      eventStore,
      (id) => new ${capitalizedName}Aggregate(id),
      '${capitalizedName}'
    );
  }
}

/**
 * Factory for creating ${aggregateName} repository
 */
export function create${capitalizedName}Repository(
  eventStore: IEventStore<${capitalizedName}Event>
): ${capitalizedName}Repository {
  return new ${capitalizedName}Repository(eventStore);
}
`;
}

function generateCommandHandlers(config: DomainConfig): string {
  const { aggregateName, commands } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Command Handlers
 */

import type { ICommandHandler, ICommandResult } from '../../../framework/core/command';
import type { CommandBus } from '../../../framework/infrastructure/bus';
import { ${capitalizedName}Repository } from '../aggregates/repository';
import { ${capitalizedName}CommandTypes } from './types';
import type { ${commands.map(c => `${c}Command`).join(', ')} } from './types';

${commands.map(command => `
/**
 * ${command} command handler
 */
export class ${command}Handler implements ICommandHandler<${command}Command> {
  constructor(private readonly repository: ${capitalizedName}Repository) {}

  async handle(command: ${command}Command): Promise<ICommandResult> {
    // TODO: Implement command handling logic
    return {
      success: true,
      data: undefined,
    };
  }

  canHandle(command: ${command}Command): boolean {
    return command.type === ${capitalizedName}CommandTypes.${command};
  }
}`).join('\n')}

/**
 * Register all ${aggregateName} command handlers
 */
export function register${capitalizedName}CommandHandlers(
  commandBus: CommandBus,
  repository: ${capitalizedName}Repository
): void {
${commands.map(c => `  commandBus.registerWithType(
    ${capitalizedName}CommandTypes.${c},
    new ${c}Handler(repository)
  );`).join('\n')}
}
`;
}

function generateQueryTypes(config: DomainConfig): string {
  const { aggregateName, queries = ['GetById', 'GetAll'] } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Query Types
 */

import type { IQuery } from '../../../framework/core/query';

/**
 * Query type constants
 */
export const ${capitalizedName}QueryTypes = {
${queries.map(q => `  ${q}: '${capitalizedName}.${q}' as const,`).join('\n')}
} as const;

export type ${capitalizedName}QueryType = typeof ${capitalizedName}QueryTypes[keyof typeof ${capitalizedName}QueryTypes];

${queries.map(query => `
/**
 * ${query} query
 */
export interface ${query}Query extends IQuery<
  typeof ${capitalizedName}QueryTypes.${query},
  any // TODO: Define query parameters
> {
  type: typeof ${capitalizedName}QueryTypes.${query};
}`).join('\n')}

/**
 * Union of all ${aggregateName} queries
 */
export type ${capitalizedName}Query = ${queries.map(q => `${q}Query`).join(' | ')};
`;
}

function generateQueryHandlers(config: DomainConfig): string {
  const { aggregateName, queries = ['GetById', 'GetAll'] } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Query Handlers
 */

import type { IQueryHandler } from '../../../framework/core/query';
import type { QueryBus } from '../../../framework/infrastructure/bus';
import { ${capitalizedName}QueryTypes } from './types';
import type { ${queries.map(q => `${q}Query`).join(', ')} } from './types';

${queries.map(query => `
/**
 * ${query} query handler
 */
export class ${query}Handler implements IQueryHandler<${query}Query, any> {
  async handle(query: ${query}Query): Promise<any> {
    // TODO: Implement query handling logic
    return null;
  }

  canHandle(query: ${query}Query): boolean {
    return query.type === ${capitalizedName}QueryTypes.${query};
  }
}`).join('\n')}

/**
 * Register all ${aggregateName} query handlers
 */
export function register${capitalizedName}QueryHandlers(
  queryBus: QueryBus,
  projection: any // TODO: Add proper projection type
): void {
${queries.map(q => `  queryBus.registerWithType(
    ${capitalizedName}QueryTypes.${q},
    new ${q}Handler()
  );`).join('\n')}
}
`;
}

function generateProjection(config: DomainConfig): string {
  const { aggregateName } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Projection
 */

import { createProjectionBuilder } from '../../../framework/infrastructure/projections/builder';
import { match${capitalizedName}Event } from '../helpers/type-guards';
import type { ${capitalizedName}Event } from '../events/types';
import type { ${capitalizedName}State } from '../aggregates/${aggregateName.toLowerCase()}';

/**
 * ${capitalizedName} read model
 */
export interface ${capitalizedName}ReadModel extends ${capitalizedName}State {
  // Additional read model fields
}

/**
 * Create ${aggregateName} projection
 */
export function create${capitalizedName}Projection() {
  return createProjectionBuilder<${capitalizedName}Event, ${capitalizedName}ReadModel>(
    (aggregateId, events) => {
      if (events.length === 0) return null;

      // TODO: Build projection from events
      let model: ${capitalizedName}ReadModel | null = null;

      for (const event of events) {
        // Process event
      }

      return model;
    },
    '${capitalizedName}Projection'
  );
}
`;
}

function generateSpecifications(config: DomainConfig): string {
  const { aggregateName } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Query Specifications
 */

import type { ${capitalizedName}ReadModel } from '../projections/${aggregateName.toLowerCase()}.projection';

/**
 * Specification interface
 */
export interface ISpecification<T> {
  isSatisfiedBy(item: T): boolean;
}

/**
 * ${capitalizedName} specifications
 */
export const ${capitalizedName}Specifications = {
  // TODO: Add specifications
  
  /**
   * Example: Active items specification
   */
  active(): ISpecification<${capitalizedName}ReadModel> {
    return {
      isSatisfiedBy: (item) => true, // TODO: Implement
    };
  },
};
`;
}

function generateValidators(config: DomainConfig): string {
  const { aggregateName, commands } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Command Validators
 */

import { createCommandValidator, ValidationRules } from '../../../framework/core/validation';
import type { ICommandValidator } from '../../../framework/core/validation';
import type { ${commands.map(c => `${c}Command`).join(', ')} } from '../commands/types';

/**
 * Create ${aggregateName} command validators
 */
export function create${capitalizedName}CommandValidators() {
  return {
${commands.map(command => `    
    ${command.charAt(0).toLowerCase() + command.slice(1)}: createCommandValidator<${command}Command>({
      // TODO: Define validation rules
    }),`).join('\n')}
  };
}
`;
}

function generateEventHandlers(config: DomainConfig): string {
  const { aggregateName } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Event Handlers
 */

import type { EventBus } from '../../../framework/infrastructure/bus';
import type { ${capitalizedName}Event } from './types';

/**
 * Register ${aggregateName} event handlers
 */
export function register${capitalizedName}EventHandlers(
  eventBus: EventBus<${capitalizedName}Event>,
  projections: any // TODO: Add projection types
): void {
  // TODO: Register event handlers
}
`;
}

function generateTypeGuards(config: DomainConfig): string {
  const { aggregateName, events } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Type Guards and Helpers
 */

import { ${capitalizedName}EventTypes } from '../events/types';
import type { ${capitalizedName}Event } from '../events/types';

/**
 * Type-safe event pattern matching
 */
export function match${capitalizedName}Event<TResult>(
  event: ${capitalizedName}Event,
  patterns: {
${events.map(e => `    [${capitalizedName}EventTypes.${e}]: (e: Extract<${capitalizedName}Event, { type: typeof ${capitalizedName}EventTypes.${e} }>) => TResult;`).join('\n')}
  }
): TResult {
  const handler = patterns[event.type as keyof typeof patterns];
  if (!handler) {
    throw new Error(\`No handler for event type: \${event.type}\`);
  }
  return handler(event as any);
}
`;
}

function generateIndexFile(config: DomainConfig): string {
  const { name, aggregateName } = config;
  const capitalizedName = capitalize(aggregateName);
  
  return `/**
 * ${capitalizedName} Domain Module
 */

import type { IDomainModule } from '../../framework/core/types';
import { createCommandBus, createEventBus, createQueryBus } from '../../framework/infrastructure/bus';
import { createEventStore } from '../../framework/infrastructure/event-store/memory';
import { create${capitalizedName}Repository } from './aggregates/repository';
import { register${capitalizedName}CommandHandlers } from './commands/handlers';
import { register${capitalizedName}QueryHandlers } from './queries/handlers';
import { register${capitalizedName}EventHandlers } from './events/handlers';
import { create${capitalizedName}Projection } from './projections/${aggregateName.toLowerCase()}.projection';
import { create${capitalizedName}CommandValidators } from './validators/command.validators';
import type { ${capitalizedName}Event } from './events/types';

// Public API exports
export * from './events/types';
export * from './events/factories';
export * from './commands/types';
export * from './queries/types';
export * from './aggregates/${aggregateName.toLowerCase()}';
export * from './aggregates/repository';

/**
 * ${capitalizedName} domain module
 */
export const ${capitalizedName}DomainModule: IDomainModule = {
  name: '${name}',
  version: '1.0.0',
  
  async initialize() {
    console.log('[${capitalizedName}Domain] Module initialized');
  },
  
  async shutdown() {
    console.log('[${capitalizedName}Domain] Module shut down');
  },
};

/**
 * Initialize ${aggregateName} domain
 */
export function initialize${capitalizedName}Domain() {
  const eventStore = createEventStore<${capitalizedName}Event>();
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();
  const eventBus = createEventBus<${capitalizedName}Event>();
  
  const repository = create${capitalizedName}Repository(eventStore);
  const projection = create${capitalizedName}Projection();
  const validators = create${capitalizedName}CommandValidators();
  
  register${capitalizedName}CommandHandlers(commandBus, repository);
  register${capitalizedName}QueryHandlers(queryBus, projection);
  register${capitalizedName}EventHandlers(eventBus, { projection });
  
  return {
    repository,
    commandBus,
    queryBus,
    eventBus,
    projection,
    validators,
  };
}
`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * CLI tool to generate domain
 */
export function generateDomain(config: DomainConfig): void {
  const files = generateDomainStructure(config);
  
  console.log(`Generated domain structure for ${config.name}:`);
  for (const [path, content] of files) {
    console.log(`  - ${path}`);
    // In a real implementation, write files to disk
  }
}