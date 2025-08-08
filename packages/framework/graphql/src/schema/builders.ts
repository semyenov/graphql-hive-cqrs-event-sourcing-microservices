// Universal GraphQL Schema Builders for CQRS framework
// Provides utilities for building read and write schemas

import { 
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLString, 
  GraphQLNonNull,
  GraphQLList,
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInputFieldConfigMap,
  GraphQLFieldConfigMap,
  type GraphQLResolveInfo,
  type GraphQLFieldResolver,
  type ThunkObjMap,
} from 'graphql';
import type { GraphQLError } from '../adapters/error-adapter';

// Generic resolver context type
export interface ResolverContext {
  requestId?: string;
  userId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

// Base resolver type
export type BaseResolver<TArgs = any, TContext = ResolverContext> = GraphQLFieldResolver<
  unknown,
  TContext,
  TArgs,
  unknown
>;

// Command/Query result wrapper types
export interface CommandResult<TData = unknown> {
  success: boolean;
  data?: TData;
  errors?: GraphQLError[];
}

export interface QueryResult<TData = unknown> {
  data: TData;
  errors?: GraphQLError[];
}

// Schema builder options
export interface SchemaBuilderOptions {
  enableIntrospection?: boolean;
  enablePlayground?: boolean;
  dateScalarType?: 'DateTime' | 'Date' | 'Timestamp';
}

/**
 * Build a standardized GraphQL error type
 */
export function buildErrorType(name = 'Error'): GraphQLObjectType {
  return new GraphQLObjectType({
    name,
    fields: {
      field: {
        type: GraphQLString,
        description: 'The field that caused the error, if applicable',
      },
      message: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Human-readable error message',
      },
      code: {
        type: GraphQLString,
        description: 'Machine-readable error code',
      },
    },
  });
}

/**
 * Build a standardized mutation result type
 */
export function buildMutationResultType(
  name: string,
  dataType: GraphQLObjectType,
  errorType?: GraphQLObjectType
): GraphQLObjectType {
  const ErrorType = errorType || buildErrorType();

  return new GraphQLObjectType({
    name: `${name}Payload`,
    fields: {
      success: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: 'Whether the operation was successful',
      },
      data: {
        type: dataType,
        description: 'The result data if successful',
      },
      errors: {
        type: new GraphQLList(new GraphQLNonNull(ErrorType)),
        description: 'Any errors that occurred during the operation',
      },
    },
  });
}

/**
 * Build a standardized list result type for queries
 */
export function buildListResultType(
  name: string,
  itemType: GraphQLObjectType
): GraphQLObjectType {
  return new GraphQLObjectType({
    name: `${name}List`,
    fields: {
      items: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(itemType))),
        description: 'The list items',
      },
      total: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Total number of items available',
      },
      hasMore: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: 'Whether there are more items available',
      },
    },
  });
}

/**
 * Build standardized pagination input type
 */
export function buildPaginationInputType(name = 'PaginationInput'): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name,
    fields: {
      limit: {
        type: GraphQLString,
        description: 'Maximum number of items to return',
        defaultValue: '20',
      },
      offset: {
        type: GraphQLString,
        description: 'Number of items to skip',
        defaultValue: '0',
      },
      cursor: {
        type: GraphQLString,
        description: 'Cursor for cursor-based pagination',
      },
    },
  });
}

/**
 * Schema builder base class
 */
export abstract class SchemaBuilder {
  protected options: SchemaBuilderOptions;
  protected types = new Map<string, GraphQLObjectType>();
  protected inputTypes = new Map<string, GraphQLInputObjectType>();

  constructor(options: SchemaBuilderOptions = {}) {
    this.options = {
      enableIntrospection: true,
      enablePlayground: true,
      dateScalarType: 'DateTime',
      ...options,
    };
  }

  /**
   * Register a GraphQL type
   */
  protected registerType(name: string, type: GraphQLObjectType): void {
    this.types.set(name, type);
  }

  /**
   * Register a GraphQL input type
   */
  protected registerInputType(name: string, type: GraphQLInputObjectType): void {
    this.inputTypes.set(name, type);
  }

  /**
   * Get a registered type
   */
  protected getType(name: string): GraphQLObjectType | undefined {
    return this.types.get(name);
  }

  /**
   * Get a registered input type
   */
  protected getInputType(name: string): GraphQLInputObjectType | undefined {
    return this.inputTypes.get(name);
  }

  /**
   * Build the GraphQL schema
   */
  abstract build(): GraphQLSchema;

  /**
   * Get all registered types
   */
  getRegisteredTypes(): Map<string, GraphQLObjectType> {
    return new Map(this.types);
  }

  /**
   * Get all registered input types
   */
  getRegisteredInputTypes(): Map<string, GraphQLInputObjectType> {
    return new Map(this.inputTypes);
  }
}

/**
 * Read schema builder for queries and subscriptions
 */
export class ReadSchemaBuilder extends SchemaBuilder {
  private queryFields: GraphQLFieldConfigMap<unknown, ResolverContext> = {};
  private subscriptionFields: GraphQLFieldConfigMap<unknown, ResolverContext> = {};

  /**
   * Add a query field
   */
  addQuery(name: string, config: GraphQLFieldConfig<unknown, ResolverContext>): this {
    this.queryFields[name] = config;
    return this;
  }

  /**
   * Add multiple query fields
   */
  addQueries(fields: GraphQLFieldConfigMap<unknown, ResolverContext>): this {
    Object.assign(this.queryFields, fields);
    return this;
  }

  /**
   * Add a subscription field
   */
  addSubscription(name: string, config: GraphQLFieldConfig<unknown, ResolverContext>): this {
    this.subscriptionFields[name] = config;
    return this;
  }

  /**
   * Add multiple subscription fields
   */
  addSubscriptions(fields: GraphQLFieldConfigMap<unknown, ResolverContext>): this {
    Object.assign(this.subscriptionFields, fields);
    return this;
  }

  /**
   * Build the read schema
   */
  build(): GraphQLSchema {
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: this.queryFields,
    });

    const schemaConfig: { query: GraphQLObjectType; subscription?: GraphQLObjectType } = {
      query: queryType,
    };

    if (Object.keys(this.subscriptionFields).length > 0) {
      schemaConfig.subscription = new GraphQLObjectType({
        name: 'Subscription',
        fields: this.subscriptionFields,
      });
    }

    return new GraphQLSchema(schemaConfig);
  }
}

/**
 * Write schema builder for mutations
 */
export class WriteSchemaBuilder extends SchemaBuilder {
  private mutationFields: GraphQLFieldConfigMap<unknown, ResolverContext> = {};

  /**
   * Add a mutation field
   */
  addMutation(name: string, config: GraphQLFieldConfig<unknown, ResolverContext>): this {
    this.mutationFields[name] = config;
    return this;
  }

  /**
   * Add multiple mutation fields
   */
  addMutations(fields: GraphQLFieldConfigMap<unknown, ResolverContext>): this {
    Object.assign(this.mutationFields, fields);
    return this;
  }

  /**
   * Build the write schema with a dummy query (required by GraphQL spec)
   */
  build(): GraphQLSchema {
    // GraphQL requires a Query type even in mutation-only schemas
    const dummyQuery = new GraphQLObjectType({
      name: 'Query',
      fields: {
        _dummy: {
          type: GraphQLString,
          resolve: () => 'This is a write-only schema. Use mutations.',
        },
      },
    });

    const mutationType = new GraphQLObjectType({
      name: 'Mutation',
      fields: this.mutationFields,
    });

    return new GraphQLSchema({
      query: dummyQuery,
      mutation: mutationType,
    });
  }
}

/**
 * Factory functions for creating schema builders
 */
export const createReadSchemaBuilder = (options?: SchemaBuilderOptions): ReadSchemaBuilder => {
  return new ReadSchemaBuilder(options);
};

export const createWriteSchemaBuilder = (options?: SchemaBuilderOptions): WriteSchemaBuilder => {
  return new WriteSchemaBuilder(options);
};

/**
 * Helper to merge multiple schemas (useful for modular schema building)
 */
export function mergeSchemaBuilders(builders: SchemaBuilder[]): {
  types: Map<string, GraphQLObjectType>;
  inputTypes: Map<string, GraphQLInputObjectType>;
} {
  const mergedTypes = new Map<string, GraphQLObjectType>();
  const mergedInputTypes = new Map<string, GraphQLInputObjectType>();

  for (const builder of builders) {
    // Merge types
    for (const [name, type] of builder.getRegisteredTypes()) {
      if (mergedTypes.has(name)) {
        console.warn(`Type ${name} is being overridden during schema merge`);
      }
      mergedTypes.set(name, type);
    }

    // Merge input types
    for (const [name, inputType] of builder.getRegisteredInputTypes()) {
      if (mergedInputTypes.has(name)) {
        console.warn(`Input type ${name} is being overridden during schema merge`);
      }
      mergedInputTypes.set(name, inputType);
    }
  }

  return {
    types: mergedTypes,
    inputTypes: mergedInputTypes,
  };
}