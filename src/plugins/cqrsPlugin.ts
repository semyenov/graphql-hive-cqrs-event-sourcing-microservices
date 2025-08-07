import type { Plugin } from '@envelop/core';
import { type GraphQLSchema, type OperationDefinitionNode, Kind, execute, subscribe } from 'graphql';
import { readSchema } from '../schemas/readSchema';
import { writeSchema } from '../schemas/writeSchema';

export interface CQRSPluginOptions {
  readSchema: GraphQLSchema;
  writeSchema: GraphQLSchema;
}

export const useCQRS = (options?: CQRSPluginOptions): Plugin => {
  const schemas = {
    read: options?.readSchema || readSchema,
    write: options?.writeSchema || writeSchema,
  };

  return {
    onExecute({ args, setExecuteFn }) {
      const document = args.document;
      const operation = document.definitions.find(
        (def: object): def is OperationDefinitionNode => 'kind' in def && def.kind === Kind.OPERATION_DEFINITION
      );

      if (!operation) {
        throw new Error('No operation found in document');
      }

      const operationType = operation.operation;
      const schema = operationType === 'mutation' ? schemas.write : schemas.read;

      setExecuteFn((executeArgs) =>
        execute({
          ...executeArgs,
          schema,
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

      // Subscriptions typically read from event streams
      const schema = schemas.read;

      setSubscribeFn((subscribeArgs) =>
        subscribe({
          ...subscribeArgs,
          schema,
        })
      );
    },

    onSchemaChange({ schema, replaceSchema }) {
      // This allows Hive to see the merged schema for reporting
      // while execution uses separate schemas
      console.log('Schema registered with CQRS plugin');
    },
  };
};