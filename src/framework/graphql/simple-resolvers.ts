/**
 * Framework GraphQL: Simple CQRS Resolvers
 * 
 * KISS-compliant resolvers that focus on CQRS integration only.
 * Additional concerns are handled by separate middleware.
 */

import type { ICommand, ICommandBus } from '../core/command';
import type { IQuery, IQueryBus } from '../core/query';
import type { GraphQLFieldConfig } from 'graphql';
import { GraphQLString, type GraphQLResolveInfo } from 'graphql';

/**
 * Simple resolver context with minimal CQRS integration
 */
export interface ISimpleResolverContext {
  commandBus: ICommandBus;
  queryBus: IQueryBus;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Command resolver factory - converts GraphQL mutations to commands
 */
export function createCommandResolver<TCommand extends ICommand>(
  commandType: TCommand['type']
): GraphQLFieldConfig<unknown, ISimpleResolverContext> {
  return {
    type: GraphQLString,
    async resolve(parent: unknown, args: unknown, context: ISimpleResolverContext, info: GraphQLResolveInfo) {
      const command: TCommand = {
        type: commandType,
        payload: args,
      } as TCommand;

      try {
        const result = await context.commandBus.send(command);
        return result;
      } catch (error) {
        console.error(`Command ${commandType} failed:`, error);
        throw new Error(`Failed to execute command: ${commandType}`);
      }
    }
  };
}

/**
 * Query resolver factory - converts GraphQL queries to query objects
 */
export function createQueryResolver<TQuery extends IQuery<string, unknown, unknown>>(
  queryType: TQuery['type']
): GraphQLFieldConfig<unknown, ISimpleResolverContext> {
  return {
    type: GraphQLString,
    async resolve(parent: unknown, args: unknown, context: ISimpleResolverContext, info: GraphQLResolveInfo) {
      const query: TQuery = {
        type: queryType,
        parameters: args,
      } as TQuery;

      try {
        const result = await context.queryBus.ask(query);
        return result;
      } catch (error) {
        console.error(`Query ${queryType} failed:`, error);
        throw new Error(`Failed to execute query: ${queryType}`);
      }
    }
  };
}

/**
 * Batch resolver factory for efficient data fetching
 */
export function createBatchResolver<TQuery extends IQuery<string, unknown, unknown>>(
  queryType: TQuery['type'],
  keyField: string = 'id'
): GraphQLFieldConfig<unknown, ISimpleResolverContext> {
  const dataLoader = new Map(); // Simple in-memory batching

  return {
    type: GraphQLString,
    async resolve(parent: unknown, args: unknown, context: ISimpleResolverContext, info: GraphQLResolveInfo) {
      const key = (parent as Record<string, unknown>)[keyField];
      
      if (!dataLoader.has(key)) {
        const query: TQuery = {
          type: queryType,
          parameters: { ...(args as object), [keyField]: key },
        } as TQuery;

        const promise = context.queryBus.ask(query);
        dataLoader.set(key, promise);
        
        // Clear cache after request
        setTimeout(() => dataLoader.delete(key), 0);
      }

      return dataLoader.get(key);
    }
  };
}

/**
 * Simple resolver builder for common patterns
 */
export class SimpleResolverBuilder {
  private resolvers: Record<string, GraphQLFieldConfig<unknown, ISimpleResolverContext>> = {};

  /**
   * Add command resolver
   */
  command<TCommand extends ICommand>(
    fieldName: string, 
    commandType: TCommand['type']
  ): this {
    this.resolvers[fieldName] = createCommandResolver<TCommand>(commandType);
    return this;
  }

  /**
   * Add query resolver
   */
  query<TQuery extends IQuery<string, unknown, unknown>>(
    fieldName: string, 
    queryType: TQuery['type']
  ): this {
    this.resolvers[fieldName] = createQueryResolver<TQuery>(queryType);
    return this;
  }

  /**
   * Add batch resolver
   */
  batch<TQuery extends IQuery<string, unknown, unknown>>(
    fieldName: string, 
    queryType: TQuery['type'],
    keyField?: string
  ): this {
    this.resolvers[fieldName] = createBatchResolver<TQuery>(queryType, keyField);
    return this;
  }

  /**
   * Add custom resolver
   */
  custom(
    fieldName: string, 
    resolver: GraphQLFieldConfig<unknown, ISimpleResolverContext>
  ): this {
    this.resolvers[fieldName] = resolver;
    return this;
  }

  /**
   * Build resolver map
   */
  build(): Record<string, GraphQLFieldConfig<unknown, ISimpleResolverContext>> {
    return { ...this.resolvers };
  }
}

/**
 * Create simple resolver builder
 */
export function createResolverBuilder(): SimpleResolverBuilder {
  return new SimpleResolverBuilder();
}

/**
 * Convenience functions for common resolver patterns
 */
export const ResolverHelpers = {
  /**
   * Create standard CRUD resolvers for an entity
   */
  crud<TEntity>(entityName: string) {
    const builder = createResolverBuilder();
    const name = entityName.toLowerCase();
    const Name = entityName.charAt(0).toUpperCase() + entityName.slice(1);

    return builder
      .command(`create${Name}`, `CREATE_${entityName.toUpperCase()}` as const)
      .command(`update${Name}`, `UPDATE_${entityName.toUpperCase()}` as const)
      .command(`delete${Name}`, `DELETE_${entityName.toUpperCase()}` as const)
      .query(`get${Name}`, `GET_${entityName.toUpperCase()}` as const)
      .query(`list${Name}s`, `LIST_${entityName.toUpperCase()}S` as const)
      .build();
  },

  /**
   * Create read-only resolvers for a view model
   */
  readonly<TEntity>(entityName: string) {
    const builder = createResolverBuilder();
    const name = entityName.toLowerCase();
    const Name = entityName.charAt(0).toUpperCase() + entityName.slice(1);

    return builder
      .query(`get${Name}`, `GET_${entityName.toUpperCase()}` as const)
      .query(`list${Name}s`, `LIST_${entityName.toUpperCase()}S` as const)
      .query(`search${Name}s`, `SEARCH_${entityName.toUpperCase()}S` as const)
      .build();
  }
};