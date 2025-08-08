/**
 * Framework GraphQL: Schema Builder
 * 
 * Utilities for building GraphQL schemas with CQRS domains.
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import type { ISchemaBuilderConfig } from './types';

/**
 * Base GraphQL type definitions
 */
export const baseTypeDefs = `
  # Base Query type
  type Query {
    _empty: String
  }
  
  # Base Mutation type
  type Mutation {
    _empty: String
  }
  
  # Base Subscription type
  type Subscription {
    _empty: String
  }
  
  # Common error type
  type Error {
    message: String!
    code: String
    field: String
  }
  
  # Common pagination input
  input PaginationInput {
    offset: Int!
    limit: Int!
    sortBy: String
    sortOrder: SortOrder
  }
  
  # Sort order enum
  enum SortOrder {
    ASC
    DESC
  }
  
  # Common interfaces
  interface Node {
    id: ID!
  }
  
  interface Timestamped {
    createdAt: String!
    updatedAt: String!
  }
  
  interface MutationResponse {
    success: Boolean!
    errors: [Error!]
  }
`;

/**
 * Common scalar definitions
 */
export const scalarTypeDefs = `
  # ISO 8601 DateTime
  scalar DateTime
  
  # JSON object
  scalar JSON
  
  # Email address
  scalar Email
  
  # URL
  scalar URL
  
  # UUID
  scalar UUID
  
  # Positive integer
  scalar PositiveInt
  
  # Non-negative integer
  scalar NonNegativeInt
  
  # Positive float
  scalar PositiveFloat
  
  # Non-negative float
  scalar NonNegativeFloat
`;

/**
 * Build GraphQL schema from domains
 */
export function buildSchema(config: ISchemaBuilderConfig): GraphQLSchema {
  // Combine type definitions
  const typeDefs = [
    config.baseTypeDefs || baseTypeDefs,
    scalarTypeDefs,
    ...config.domains.map(d => d.typeDefs),
  ].join('\n\n');
  
  // Merge resolvers
  const resolvers = mergeResolvers(
    ...config.domains.map(d => d.resolvers),
    config.scalars || {},
    config.directives || {}
  );
  
  // Create executable schema
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}

/**
 * Merge multiple resolver maps
 */
export function mergeResolvers(
  ...resolverMaps: Array<Record<string, unknown>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  
  for (const resolverMap of resolverMaps) {
    for (const [typeName, typeResolvers] of Object.entries(resolverMap)) {
      if (!merged[typeName]) {
        merged[typeName] = {};
      }
      
      if (typeof typeResolvers === 'object' && typeResolvers !== null) {
        merged[typeName] = {
          ...(merged[typeName] as Record<string, unknown>),
          ...typeResolvers,
        };
      } else {
        merged[typeName] = typeResolvers;
      }
    }
  }
  
  return merged;
}

/**
 * Create domain configuration
 */
export function createDomainConfig(
  name: string,
  typeDefs: string,
  resolvers: Record<string, unknown>
): ISchemaBuilderConfig['domains'][0] {
  return {
    name,
    typeDefs,
    resolvers,
  };
}

/**
 * Combine multiple domain configurations
 */
export function combineDomains(
  ...domains: ISchemaBuilderConfig['domains']
): ISchemaBuilderConfig['domains'] {
  return domains;
}

/**
 * Standard scalar resolvers
 */
export const standardScalars = {
  DateTime: {
    serialize: (value: unknown) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
    parseValue: (value: unknown) => {
      if (typeof value === 'string') {
        return new Date(value);
      }
      return value;
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },
  
  JSON: {
    serialize: (value: unknown) => value,
    parseValue: (value: unknown) => value,
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        try {
          return JSON.parse(ast.value);
        } catch {
          return null;
        }
      }
      return null;
    },
  },
  
  Email: {
    serialize: (value: unknown) => String(value),
    parseValue: (value: unknown) => {
      if (typeof value === 'string' && isValidEmail(value)) {
        return value;
      }
      throw new Error('Invalid email address');
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue' && isValidEmail(ast.value)) {
        return ast.value;
      }
      throw new Error('Invalid email address');
    },
  },
  
  URL: {
    serialize: (value: unknown) => String(value),
    parseValue: (value: unknown) => {
      if (typeof value === 'string') {
        try {
          new URL(value);
          return value;
        } catch {
          throw new Error('Invalid URL');
        }
      }
      throw new Error('Invalid URL');
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        try {
          new URL(ast.value);
          return ast.value;
        } catch {
          throw new Error('Invalid URL');
        }
      }
      throw new Error('Invalid URL');
    },
  },
  
  UUID: {
    serialize: (value: unknown) => String(value),
    parseValue: (value: unknown) => {
      if (typeof value === 'string' && isValidUUID(value)) {
        return value;
      }
      throw new Error('Invalid UUID');
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue' && isValidUUID(ast.value)) {
        return ast.value;
      }
      throw new Error('Invalid UUID');
    },
  },
  
  PositiveInt: {
    serialize: (value: unknown) => Number(value),
    parseValue: (value: unknown) => {
      const num = Number(value);
      if (Number.isInteger(num) && num > 0) {
        return num;
      }
      throw new Error('Value must be a positive integer');
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'IntValue') {
        const num = parseInt(ast.value, 10);
        if (num > 0) {
          return num;
        }
      }
      throw new Error('Value must be a positive integer');
    },
  },
  
  NonNegativeInt: {
    serialize: (value: unknown) => Number(value),
    parseValue: (value: unknown) => {
      const num = Number(value);
      if (Number.isInteger(num) && num >= 0) {
        return num;
      }
      throw new Error('Value must be a non-negative integer');
    },
    parseLiteral: (ast: any) => {
      if (ast.kind === 'IntValue') {
        const num = parseInt(ast.value, 10);
        if (num >= 0) {
          return num;
        }
      }
      throw new Error('Value must be a non-negative integer');
    },
  },
};

/**
 * Helper validators
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate TypeScript types from schema
 */
export function generateTypeScriptTypes(schema: GraphQLSchema): string {
  // This would integrate with graphql-code-generator
  // For now, return a placeholder
  return `// Generated TypeScript types from GraphQL schema\n// Use graphql-code-generator for actual generation`;
}