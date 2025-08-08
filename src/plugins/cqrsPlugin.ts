import type { Plugin } from '@envelop/core';
import { type GraphQLSchema, type OperationDefinitionNode, Kind, execute, subscribe } from 'graphql';
import { schema } from '../schemas/schema';

export interface CQRSPluginOptions {
  schema?: GraphQLSchema;
}

export const useCQRS = (options?: CQRSPluginOptions): Plugin => {
  const unifiedSchema = options?.schema || schema;

  return {
    onExecute({ args, setExecuteFn }) {
      const document = args.document;
      const operation = document.definitions.find(
        (def: object): def is OperationDefinitionNode => 'kind' in def && def.kind === Kind.OPERATION_DEFINITION
      );

      if (!operation) {
        throw new Error('No operation found in document');
      }

      // Use unified schema for all operations
      // CQRS separation is handled at the resolver level
      setExecuteFn((executeArgs) =>
        execute({
          ...executeArgs,
          schema: unifiedSchema,
        })
      );
    },

    onSubscribe({ args, setSubscribeFn }) {
      const document = args.document;
      const operation = document.definitions.find(
        (def: object): def is OperationDefinitionNode => 'kind' in def && def.kind === Kind.OPERATION_DEFINITION
      );

      if (!operation) {
        throw new Error('No operation found in document');
      }

      // Subscriptions use the unified schema
      setSubscribeFn((subscribeArgs) =>
        subscribe({
          ...subscribeArgs,
          schema: unifiedSchema,
        })
      );
    },

    onSchemaChange({ schema, replaceSchema }) {
      // Schema is now unified for both reporting and execution
      console.log('Unified schema registered with CQRS plugin');
    },
  };
};