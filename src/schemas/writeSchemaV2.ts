import { makeExecutableSchema } from '@graphql-tools/schema';
import { gql } from 'graphql-tag';
import { mutationResolvers } from '../resolvers/mutations';
import type { ErrorResolvers } from '../types/generated/resolvers';

export const writeTypeDefs = gql`
  type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload!
    updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
    deleteUser(id: ID!): DeleteUserPayload!
  }

  input CreateUserInput {
    name: String!
    email: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  type CreateUserPayload {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type UpdateUserPayload {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type DeleteUserPayload {
    success: Boolean!
    errors: [Error!]
  }

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: String!
    updatedAt: String!
  }

  type Error {
    field: String
    message: String!
  }

  # Dummy query to satisfy GraphQL requirement
  type Query {
    _empty: String
  }
`;

// Empty query resolver to satisfy GraphQL requirement
const queryResolvers = {
  _empty: () => null,
};

// Error resolver to handle the mapping
const errorResolvers: ErrorResolvers = {
  field: (parent) => parent.field ?? null,
  message: (parent) => parent.message,
};

// Create executable schema with type safety
export const writeSchemaV2 = makeExecutableSchema({
  typeDefs: writeTypeDefs,
  resolvers: {
    Query: queryResolvers,
    Mutation: mutationResolvers,
    Error: errorResolvers,
  },
});

// Export for use in server
export { mutationResolvers as writeResolvers };