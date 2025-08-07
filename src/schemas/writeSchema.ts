import { makeExecutableSchema } from '@graphql-tools/schema';
import { gql } from 'graphql-tag';
import { InMemoryEventStore } from '../events/InMemoryEventStore';
import { UserAggregate, UserRepository } from '../events/UserAggregate';
import type { UserEvent } from '../events/generic-types';
import type { 
  MutationResolvers,
  CreateUserPayload,
  UpdateUserPayload,
  DeleteUserPayload,
  CreateUserInput,
  UpdateUserInput,
  GraphQLError,
  RequiredBy,
  isPayloadSuccess,
  InferMutationInput,
  InferMutationPayload,
  Mutation,
  ResolverFn,
  ValidationError as DomainValidationError,
} from '../types';
import type { GraphQLResolveInfo } from 'graphql';
import type { 
  IErrorResponseBuilder,
  ISuccessResponseBuilder,
  IMutationResolverFactory,
} from './interfaces';
import { BrandedTypes, type AggregateId } from '../types';

// Create a shared event store instance with proper typing
export const eventStore = new InMemoryEventStore<UserEvent>();

// User repository instance
const userRepository = new UserRepository(eventStore);

// Error response builder implementation
class ErrorResponseBuilder implements IErrorResponseBuilder {
  build<T extends { success: boolean; errors?: Array<Pick<DomainValidationError, 'field' | 'message'>> | null }>(
    error: unknown
  ): T {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    // Map to GraphQLError which has field and message
    const graphQLError: GraphQLError = {
      field: null,
      message,
    };
    return {
      success: false,
      errors: [graphQLError],
    } as T;
  }
}

const errorResponseBuilder = new ErrorResponseBuilder();

// Success response builder implementation
class SuccessResponseBuilder implements ISuccessResponseBuilder {
  build<TPayload extends { success: boolean }>(
    data: Omit<TPayload, 'success'>
  ): TPayload {
    return {
      success: true,
      ...data,
    } as TPayload;
  }
}

const successResponseBuilder = new SuccessResponseBuilder();

// Mutation resolver factory implementation
class MutationResolverFactory implements IMutationResolverFactory {
  constructor(
    private readonly errorResponseBuilder: IErrorResponseBuilder
  ) {}

  create<TArgs, TResult>(
    handler: (args: TArgs) => Promise<TResult>
  ) {
    return async <TParent = {}, TContext = {}>(
    _parent: TParent, 
    args: TArgs, 
    _context: TContext, 
    _info: GraphQLResolveInfo
  ): Promise<TResult> => {
    try {
      return await handler(args);
    } catch (error) {
      return this.errorResponseBuilder.build(error) as TResult;
    }
    };
  }
}

const mutationResolverFactory = new MutationResolverFactory(errorResponseBuilder);

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

// Type-safe resolvers with generics
export const writeResolvers: RequiredBy<MutationResolvers, 'createUser' | 'updateUser' | 'deleteUser'> = {
  createUser: mutationResolverFactory.create<{ input: CreateUserInput }, CreateUserPayload>(
    async ({ input }) => {
      const id = crypto.randomUUID();
      const aggregateId = BrandedTypes.aggregateId(id);
      let aggregate = await userRepository.get(aggregateId);
      
      if (!aggregate) {
        aggregate = new UserAggregate(id);
      }

      aggregate.create(input);
      await userRepository.save(aggregate);

      const user = aggregate.getUser();
      return successResponseBuilder.build({
        user,
        errors: null,
      });
    }
  ),

  updateUser: mutationResolverFactory.create<{ id: string; input: UpdateUserInput }, UpdateUserPayload>(
    async ({ id, input }) => {
      const aggregateId = BrandedTypes.aggregateId(id);
      const aggregate = await userRepository.get(aggregateId);
      
      if (!aggregate) {
        throw new Error(`User with id ${id} not found`);
      }

      aggregate.update(input);
      await userRepository.save(aggregate);

      const user = aggregate.getUser();
      return successResponseBuilder.build({
        user,
        errors: null,
      });
    }
  ),

  deleteUser: mutationResolverFactory.create<{ id: string }, DeleteUserPayload>(
    async ({ id }) => {
      const aggregateId = BrandedTypes.aggregateId(id);
      const aggregate = await userRepository.get(aggregateId);
      
      if (!aggregate) {
        throw new Error(`User with id ${id} not found`);
      }

      aggregate.delete();
      await userRepository.save(aggregate);

      return successResponseBuilder.build({
        errors: null,
      });
    }
  ),
};

// Empty query resolver to satisfy GraphQL requirement
const queryResolvers = {
  _empty: () => null,
};

// Create executable schema with type safety
export const writeSchema = makeExecutableSchema({
  typeDefs: writeTypeDefs,
  resolvers: {
    Query: queryResolvers,
    Mutation: writeResolvers,
  },
});

// Export types for external use
export type WriteSchemaResolvers = typeof writeResolvers;
export type WriteSchemaContext = MutationResolvers extends { createUser?: infer R } 
  ? R extends ResolverFn<unknown, unknown, infer C, unknown> 
    ? C 
    : never 
  : never;

// Type-safe command handler
export class CommandHandler {
  constructor(private repository: UserRepository) {}

  async handle<TMutation extends keyof MutationResolvers & keyof Mutation>(
    mutation: TMutation,
    args: Parameters<NonNullable<MutationResolvers[TMutation]>>[1]
  ): Promise<InferMutationPayload<TMutation>> {
    const resolver = writeResolvers[mutation];
    if (!resolver) {
      throw new Error(`Unknown mutation: ${mutation}`);
    }
    
    return resolver({}, args, {}, {} as GraphQLResolveInfo) as Promise<InferMutationPayload<TMutation>>;
  }
}