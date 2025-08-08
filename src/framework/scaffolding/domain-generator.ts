/**
 * Framework Scaffolding: Domain Generator
 * 
 * Utilities to quickly scaffold new CQRS domains with best practices
 * following the simplified framework patterns.
 */

import { NamingConventions } from '../core/naming-conventions';

/**
 * Domain scaffolding configuration
 */
export interface IDomainScaffoldConfig {
  /** Domain name (e.g., 'User', 'Order', 'Product') */
  name: string;
  /** Entity fields */
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'Date' | 'array' | 'object';
    optional?: boolean;
    validation?: Array<'required' | 'email' | 'min' | 'max' | 'length'>;
  }>;
  /** Operations to generate */
  operations: {
    create?: boolean;
    update?: boolean;
    delete?: boolean;
    get?: boolean;
    list?: boolean;
    search?: boolean;
  };
  /** Additional options */
  options?: {
    addTimestamps?: boolean;
    addSoftDelete?: boolean;
    addAudit?: boolean;
  };
}

/**
 * Domain code templates
 */
export class DomainGenerator {
  /**
   * Generate complete domain structure
   */
  static generate(config: IDomainScaffoldConfig): Record<string, string> {
    const files: Record<string, string> = {};
    
    // Generate types
    files[`${config.name.toLowerCase()}/types.ts`] = this.generateTypes(config);
    
    // Generate events
    files[`${config.name.toLowerCase()}/events/types.ts`] = this.generateEventTypes(config);
    files[`${config.name.toLowerCase()}/events/factories.ts`] = this.generateEventFactories(config);
    
    // Generate commands
    files[`${config.name.toLowerCase()}/commands/types.ts`] = this.generateCommandTypes(config);
    files[`${config.name.toLowerCase()}/commands/handlers.ts`] = this.generateCommandHandlers(config);
    
    // Generate queries  
    files[`${config.name.toLowerCase()}/queries/types.ts`] = this.generateQueryTypes(config);
    files[`${config.name.toLowerCase()}/queries/handlers.ts`] = this.generateQueryHandlers(config);
    
    // Generate aggregate
    files[`${config.name.toLowerCase()}/aggregates/${config.name.toLowerCase()}.ts`] = this.generateAggregate(config);
    files[`${config.name.toLowerCase()}/aggregates/repository.ts`] = this.generateRepository(config);
    
    // Generate validators
    files[`${config.name.toLowerCase()}/validators/command.validators.ts`] = this.generateValidators(config);
    
    // Generate domain module
    files[`${config.name.toLowerCase()}/index.ts`] = this.generateDomainIndex(config);
    files[`${config.name.toLowerCase()}/domain-setup.ts`] = this.generateDomainSetup(config);
    
    return files;
  }

  /**
   * Generate TypeScript types
   */
  private static generateTypes(config: IDomainScaffoldConfig): string {
    const fieldsInterface = config.fields
      .map(field => {
        const optional = field.optional ? '?' : '';
        const type = this.mapFieldType(field.type);
        return `  ${field.name}${optional}: ${type};`;
      })
      .join('\n');

    const timestampFields = config.options?.addTimestamps ? `
  createdAt: Date;
  updatedAt: Date;` : '';

    const softDeleteFields = config.options?.addSoftDelete ? `
  deletedAt?: Date;
  isDeleted: boolean;` : '';

    const auditFields = config.options?.addAudit ? `
  createdBy: string;
  updatedBy: string;` : '';

    return `/**
 * ${config.name} Domain: Types
 */

import type { AggregateId } from '../../../framework/core/branded';

export interface ${config.name}State {
  id: AggregateId;
${fieldsInterface}${timestampFields}${softDeleteFields}${auditFields}
}

export interface ${config.name}Data {
${fieldsInterface}
}

export interface Create${config.name}Data {
${config.fields.filter(f => !f.optional).map(field => `  ${field.name}: ${this.mapFieldType(field.type)};`).join('\n')}
}

export interface Update${config.name}Data {
${config.fields.map(field => `  ${field.name}?: ${this.mapFieldType(field.type)};`).join('\n')}
}
`;
  }

  /**
   * Generate event types
   */
  private static generateEventTypes(config: IDomainScaffoldConfig): string {
    const name = config.name;
    const constantName = NamingConventions.toConstantCase(name);

    return `/**
 * ${name} Domain: Event Types
 */

import type { IEvent } from '../../../../framework/core/event';
import type { AggregateId } from '../../../../framework/core/branded';
import type { ${name}Data, Create${name}Data, Update${name}Data } from '../types';

export enum ${name}EventTypes {
  ${name}Created = '${constantName}_CREATED',
  ${name}Updated = '${constantName}_UPDATED',
  ${name}Deleted = '${constantName}_DELETED',
}

export interface ${name}CreatedEvent extends IEvent<${name}EventTypes.${name}Created> {
  aggregateId: AggregateId;
  data: Create${name}Data;
}

export interface ${name}UpdatedEvent extends IEvent<${name}EventTypes.${name}Updated> {
  aggregateId: AggregateId;
  data: Update${name}Data;
}

export interface ${name}DeletedEvent extends IEvent<${name}EventTypes.${name}Deleted> {
  aggregateId: AggregateId;
  data: { reason?: string };
}

export type ${name}Event = 
  | ${name}CreatedEvent
  | ${name}UpdatedEvent
  | ${name}DeletedEvent;
`;
  }

  /**
   * Generate event factories
   */
  private static generateEventFactories(config: IDomainScaffoldConfig): string {
    const name = config.name;

    return `/**
 * ${name} Domain: Event Factories
 */

import { createEvent, createEventMetadata } from '../../../../framework/core/helpers';
import { BrandedTypes } from '../../../../framework/core/branded';
import type {
  ${name}CreatedEvent,
  ${name}UpdatedEvent,
  ${name}DeletedEvent,
  ${name}EventTypes
} from './types';
import type { AggregateId } from '../../../../framework/core/branded';
import type { Create${name}Data, Update${name}Data } from '../types';

export const ${name}EventFactories = {
  create${name}Created: (
    aggregateId: AggregateId,
    data: Create${name}Data
  ): ${name}CreatedEvent =>
    createEvent({
      id: BrandedTypes.EventId(),
      type: '${NamingConventions.toConstantCase(name)}_CREATED' as ${name}EventTypes.${name}Created,
      aggregateId,
      data,
      metadata: createEventMetadata()
    }),

  create${name}Updated: (
    aggregateId: AggregateId,
    data: Update${name}Data
  ): ${name}UpdatedEvent =>
    createEvent({
      id: BrandedTypes.EventId(),
      type: '${NamingConventions.toConstantCase(name)}_UPDATED' as ${name}EventTypes.${name}Updated,
      aggregateId,
      data,
      metadata: createEventMetadata()
    }),

  create${name}Deleted: (
    aggregateId: AggregateId,
    reason?: string
  ): ${name}DeletedEvent =>
    createEvent({
      id: BrandedTypes.EventId(),
      type: '${NamingConventions.toConstantCase(name)}_DELETED' as ${name}EventTypes.${name}Deleted,
      aggregateId,
      data: { reason },
      metadata: createEventMetadata()
    }),
};
`;
  }

  /**
   * Generate command types
   */
  private static generateCommandTypes(config: IDomainScaffoldConfig): string {
    const name = config.name;
    const constantName = NamingConventions.toConstantCase(name);

    const operations = [];
    if (config.operations.create) operations.push('Create');
    if (config.operations.update) operations.push('Update');
    if (config.operations.delete) operations.push('Delete');

    const commandEnums = operations.map(op => 
      `  ${op}${name} = '${op.toUpperCase()}_${constantName}'`
    ).join(',\n');

    const commandInterfaces = operations.map(op => {
      const dataType = op === 'Create' ? `Create${name}Data` :
                      op === 'Update' ? `Update${name}Data` :
                      `{ reason?: string }`;

      return `
export interface ${op}${name}Command extends IAggregateCommand<${name}CommandTypes.${op}${name}, ${dataType}, AggregateId> {
  aggregateId: AggregateId;
  payload: ${dataType};
}`;
    }).join('\n');

    return `/**
 * ${name} Domain: Command Types
 */

import type { IAggregateCommand } from '../../../../framework/core/command';
import type { AggregateId } from '../../../../framework/core/branded';
import type { Create${name}Data, Update${name}Data } from '../types';

export enum ${name}CommandTypes {
${commandEnums}
}
${commandInterfaces}

export type ${name}Command = ${operations.map(op => `${op}${name}Command`).join(' | ')};
`;
  }

  /**
   * Generate command handlers
   */
  private static generateCommandHandlers(config: IDomainScaffoldConfig): string {
    const name = config.name;
    
    const handlers = [];
    if (config.operations.create) handlers.push(`Create${name}CommandHandler`);
    if (config.operations.update) handlers.push(`Update${name}CommandHandler`);
    if (config.operations.delete) handlers.push(`Delete${name}CommandHandler`);

    const handlerImplementations = handlers.map(handlerName => {
      const operation = handlerName.replace(`${name}CommandHandler`, '').toLowerCase();
      const commandType = handlerName.replace('Handler', '');
      
      return `
export class ${handlerName} implements ICommandHandler<${commandType}Command> {
  constructor(private repository: ${name}Repository) {}

  canHandle(command: ICommand): boolean {
    return command.type === ${name}CommandTypes.${commandType.replace('Command', '')};
  }

  async handle(command: ${commandType}Command): Promise<ICommandResult> {
    try {
      ${this.generateHandlerLogic(operation, name)}
      
      await this.repository.save(aggregate);
      
      return success({
        aggregateId: command.aggregateId,
        version: aggregate.version
      });
    } catch (error) {
      return failure(\`Failed to ${operation} ${name.toLowerCase()}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }
}`;
    }).join('\n');

    return `/**
 * ${name} Domain: Command Handlers
 */

import type { ICommand, ICommandHandler, ICommandResult } from '../../../../framework/core/command';
import { success, failure } from '../../../../framework/core/helpers';
import type { ${name}Repository } from '../aggregates/repository';
import type { ${handlers.map(h => h.replace('Handler', 'Command')).join(', ')} } from './types';
import { ${name}CommandTypes } from './types';
${handlerImplementations}
`;
  }

  /**
   * Generate handler logic based on operation
   */
  private static generateHandlerLogic(operation: string, name: string): string {
    switch (operation) {
      case 'create':
        return `const aggregate = this.repository.createAggregate(command.aggregateId);
      aggregate.create(command.payload);`;
      
      case 'update':
        return `const aggregate = await this.repository.findById(command.aggregateId);
      if (!aggregate) {
        throw new Error('${name} not found');
      }
      aggregate.update(command.payload);`;
      
      case 'delete':
        return `const aggregate = await this.repository.findById(command.aggregateId);
      if (!aggregate) {
        throw new Error('${name} not found');
      }
      aggregate.delete(command.payload.reason);`;
      
      default:
        return `// Implement ${operation} logic here`;
    }
  }

  /**
   * Map field types to TypeScript types
   */
  private static mapFieldType(type: string): string {
    switch (type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'Date': return 'Date';
      case 'array': return 'unknown[]';
      case 'object': return 'Record<string, unknown>';
      default: return 'unknown';
    }
  }

  /**
   * Generate additional methods (abbreviated for brevity)
   */
  private static generateQueryTypes(config: IDomainScaffoldConfig): string {
    // Implementation similar to command types...
    return `// Query types for ${config.name} domain`;
  }

  private static generateQueryHandlers(config: IDomainScaffoldConfig): string {
    // Implementation similar to command handlers...
    return `// Query handlers for ${config.name} domain`;
  }

  private static generateAggregate(config: IDomainScaffoldConfig): string {
    // Implementation for aggregate...
    return `// Aggregate implementation for ${config.name}`;
  }

  private static generateRepository(config: IDomainScaffoldConfig): string {
    // Implementation for repository...
    return `// Repository implementation for ${config.name}`;
  }

  private static generateValidators(config: IDomainScaffoldConfig): string {
    // Implementation for validators...
    return `// Validators for ${config.name} commands`;
  }

  private static generateDomainIndex(config: IDomainScaffoldConfig): string {
    // Implementation for domain index...
    return `// Domain module exports for ${config.name}`;
  }

  private static generateDomainSetup(config: IDomainScaffoldConfig): string {
    return `/**
 * ${config.name} Domain: Setup using Simple Framework
 */

import { DomainBuilder } from '../../../framework';
import type { ${config.name}Event, ${config.name}Command, ${config.name}Query } from './types';
// Import handlers here...

export function setup${config.name}Domain(context: any) {
  return DomainBuilder
    .forDomain<${config.name}Event, ${config.name}Command, ${config.name}Query>('${config.name}')
    .withCommandHandlers({
      // Add command handlers here
    })
    .withQueryHandlers({
      // Add query handlers here
    })
    .withEventHandlers(
      // Add event handlers here
    )
    .build(context);
}
`;
  }
}

/**
 * CLI-style domain generator
 */
export function generateDomain(config: IDomainScaffoldConfig): void {
  console.log(`🏗️  Generating ${config.name} domain...`);
  
  const files = DomainGenerator.generate(config);
  
  console.log(`✅ Generated ${Object.keys(files).length} files for ${config.name} domain:`);
  
  Object.keys(files).forEach(filePath => {
    console.log(`   📄 ${filePath}`);
  });
  
  console.log(`\n🚀 Next steps:`);
  console.log(`   1. Review generated files`);
  console.log(`   2. Implement aggregate business logic`);
  console.log(`   3. Add validation rules`);
  console.log(`   4. Write tests`);
  console.log(`   5. Register domain with framework`);
}

/**
 * Quick scaffold presets
 */
export const DomainPresets = {
  /**
   * Simple CRUD entity
   */
  simpleCrud: (name: string, fields: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'Date' | 'array' | 'object' }>): IDomainScaffoldConfig => ({
    name,
    fields,
    operations: {
      create: true,
      update: true,
      delete: true,
      get: true,
      list: true
    },
    options: {
      addTimestamps: true,
      addSoftDelete: true
    }
  }),

  /**
   * Read-only view model
   */
  readOnly: (name: string, fields: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'Date' | 'array' | 'object' }>): IDomainScaffoldConfig => ({
    name,
    fields,
    operations: {
      get: true,
      list: true,
      search: true
    }
  }),

  /**
   * Event-sourced aggregate
   */
  eventSourced: (name: string, fields: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'Date' | 'array' | 'object' }>): IDomainScaffoldConfig => ({
    name,
    fields,
    operations: {
      create: true,
      update: true,
      delete: true,
      get: true,
      list: true
    },
    options: {
      addTimestamps: true,
      addAudit: true
    }
  })
};