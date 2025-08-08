// Universal CQRS Plugin for GraphQL Yoga with Envelop
// Provides automatic schema routing based on operation type

import type { Plugin } from '@envelop/core';
import { 
  type GraphQLSchema, 
  type OperationDefinitionNode, 
  Kind, 
  execute, 
  subscribe,
  type DocumentNode,
  type ExecutionArgs
} from 'graphql';

// CQRS Plugin configuration options
export interface CQRSPluginOptions {
  /** Schema for handling queries and subscriptions (read operations) */
  readSchema: GraphQLSchema;
  /** Schema for handling mutations (write operations) */
  writeSchema: GraphQLSchema;
  /** Optional custom operation type detection */
  operationTypeDetector?: (document: DocumentNode) => 'query' | 'mutation' | 'subscription' | null;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom schema selector based on operation */
  schemaSelector?: (operationType: string, operation: OperationDefinitionNode) => GraphQLSchema;
}

// Default operation type detector
const defaultOperationTypeDetector = (document: DocumentNode): 'query' | 'mutation' | 'subscription' | null => {
  const operation = document.definitions.find(
    (def): def is OperationDefinitionNode => 
      'kind' in def && def.kind === Kind.OPERATION_DEFINITION
  );
  
  return operation?.operation || null;
};

/**
 * CQRS Plugin for GraphQL Yoga
 * 
 * Automatically routes operations to appropriate schemas:
 * - Queries and Subscriptions → Read Schema
 * - Mutations → Write Schema
 * 
 * This enables clean separation between read and write operations
 * following CQRS (Command Query Responsibility Segregation) principles.
 */
export const useCQRS = (options: CQRSPluginOptions): Plugin => {
  const {
    readSchema,
    writeSchema,
    operationTypeDetector = defaultOperationTypeDetector,
    debug = false,
    schemaSelector,
  } = options;

  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[CQRS Plugin] ${message}`, ...args);
    }
  };

  // Schema selector with fallback logic
  const selectSchema = (operationType: string, operation?: OperationDefinitionNode): GraphQLSchema => {
    if (schemaSelector && operation) {
      return schemaSelector(operationType, operation);
    }

    switch (operationType) {
      case 'mutation':
        log(`Routing ${operationType} to write schema`);
        return writeSchema;
      case 'query':
      case 'subscription':
        log(`Routing ${operationType} to read schema`);
        return readSchema;
      default:
        log(`Unknown operation type: ${operationType}, defaulting to read schema`);
        return readSchema;
    }
  };

  return {
    onExecute({ args, setExecuteFn }) {
      const operationType = operationTypeDetector(args.document);
      
      if (!operationType) {
        throw new Error('Unable to determine operation type from document');
      }

      const operation = args.document.definitions.find(
        (def: OperationDefinitionNode): def is OperationDefinitionNode => 
          'kind' in def && def.kind === Kind.OPERATION_DEFINITION
      );

      const schema = selectSchema(operationType, operation);

      setExecuteFn((executeArgs: ExecutionArgs) =>
        execute({
          ...executeArgs,
          schema,
        })
      );
    },

    onSubscribe({ args, setSubscribeFn }) {
      const operationType = operationTypeDetector(args.document);
      
      if (!operationType) {
        throw new Error('Unable to determine operation type from document');
      }

      const operation = args.document.definitions.find(
        (def: OperationDefinitionNode): def is OperationDefinitionNode => 
          'kind' in def && def.kind === Kind.OPERATION_DEFINITION
      );

      // Subscriptions always use read schema (they're reading from event streams)
      const schema = operationType === 'subscription' ? readSchema : selectSchema(operationType, operation);

      setSubscribeFn((subscribeArgs) =>
        subscribe({
          ...subscribeArgs,
          schema,
        })
      );
    },

    onSchemaChange({ schema, replaceSchema }) {
      // This allows GraphQL tooling to see a unified schema for introspection
      // while execution uses separate schemas based on operation type
      log('Schema change detected, CQRS plugin handling routing');
      
      // We don't replace the schema here as we want to maintain separate schemas
      // The provided schema is typically a merged version for tooling purposes
    },

    onParse({ params, setParsedDocument }) {
      // We can add custom parsing logic here if needed
      log('Parsing GraphQL document for CQRS routing');
    },

    onValidate({ params, setResult }) {
      // We can add custom validation logic here if needed
      // For example, validating that mutations only use write schema types
      log('Validating GraphQL document for CQRS compliance');
    },
  };
};

// Helper function to create a CQRS plugin with minimal configuration
export const createCQRSPlugin = (
  readSchema: GraphQLSchema,
  writeSchema: GraphQLSchema,
  options?: Partial<Omit<CQRSPluginOptions, 'readSchema' | 'writeSchema'>>
): Plugin => {
  return useCQRS({
    readSchema,
    writeSchema,
    ...options,
  });
};

// Type guard for CQRS operations
export const isMutationOperation = (operationType: string): operationType is 'mutation' => {
  return operationType === 'mutation';
};

export const isQueryOperation = (operationType: string): operationType is 'query' => {
  return operationType === 'query';
};

export const isSubscriptionOperation = (operationType: string): operationType is 'subscription' => {
  return operationType === 'subscription';
};

// Schema validation helper
export const validateCQRSSchemas = (readSchema: GraphQLSchema, writeSchema: GraphQLSchema): void => {
  if (!readSchema) {
    throw new Error('Read schema is required for CQRS plugin');
  }
  
  if (!writeSchema) {
    throw new Error('Write schema is required for CQRS plugin');
  }

  // Additional validation can be added here
  // e.g., checking that read schema has no mutations, write schema has no subscriptions, etc.
};

// Plugin factory with validation
export const createValidatedCQRSPlugin = (
  readSchema: GraphQLSchema,
  writeSchema: GraphQLSchema,
  options?: Partial<Omit<CQRSPluginOptions, 'readSchema' | 'writeSchema'>>
): Plugin => {
  validateCQRSSchemas(readSchema, writeSchema);
  return createCQRSPlugin(readSchema, writeSchema, options);
};