/**
 * GraphQL Error Adapter
 * 
 * Adapts domain errors to GraphQL errors
 */

import { GraphQLError } from 'graphql';

export class GraphQLErrorAdapter extends GraphQLError {
  constructor(message: string, code?: string, extensions?: Record<string, any>) {
    super(message, {
      extensions: {
        code: code || 'INTERNAL_SERVER_ERROR',
        ...extensions
      }
    });
  }
}

export function adaptDomainError(error: Error): GraphQLError {
  if (error instanceof GraphQLError) {
    return error;
  }
  
  return new GraphQLErrorAdapter(
    error.message,
    error.constructor.name,
    { originalError: error.name }
  );
}