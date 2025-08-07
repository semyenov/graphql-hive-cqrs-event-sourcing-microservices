import { makeExecutableSchema } from '@graphql-tools/schema';
import { gql } from 'graphql-tag';
import { eventStore } from './writeSchema';
import { UserAggregate, UserRepository } from '../events/UserAggregate';
import type { UserEvent } from '../events/generic-types';
import type { 
  User, 
  UserList, 
  QueryResolvers,
  RequiredBy,
  FieldSelector,
  ResolverFn,
  AggregateId,
} from '../types';
import type { GraphQLResolveInfo } from 'graphql';
import type { IProjectionBuilder, IAggregateInternal } from '../events/interfaces';
import { BrandedTypes } from '../types';

// Generic projection builder
class ProjectionBuilder<TEvent extends { aggregateId: AggregateId }, TProjection> implements IProjectionBuilder<TEvent, TProjection> {
  private projections = new Map<string, TProjection>();

  constructor(
    private readonly buildProjection: (aggregateId: string, events: TEvent[]) => TProjection | null
  ) {}

  async rebuild(events: TEvent[]): Promise<void> {
    const aggregateEvents = new Map<string, TEvent[]>();

    // Group events by aggregate
    for (const event of events) {
      if (!aggregateEvents.has(event.aggregateId)) {
        aggregateEvents.set(event.aggregateId, []);
      }
      aggregateEvents.get(event.aggregateId)!.push(event);
    }

    // Rebuild projections
    this.projections.clear();
    for (const [aggregateId, aggEvents] of aggregateEvents) {
      const projection = this.buildProjection(aggregateId, aggEvents);
      if (projection) {
        this.projections.set(aggregateId, projection);
      }
    }
  }

  get(id: string): TProjection | null {
    return this.projections.get(id) || null;
  }

  getAll(): TProjection[] {
    return Array.from(this.projections.values());
  }

  search(predicate: (projection: TProjection) => boolean): TProjection[] {
    return this.getAll().filter(predicate);
  }
}

// User projection with type safety
const userProjectionBuilder = new ProjectionBuilder<UserEvent, User>(
  (aggregateId, events) => {
    if (events.length === 0) return null;
    
    const aggregate = new UserAggregate(aggregateId);
    // Use direct method access
    for (const event of events) {
      aggregate.applyEvent(event, false);
    }
    return aggregate.toProjection();
  }
);

// Projection rebuilder interface
interface IProjectionRebuilder {
  rebuild(): Promise<void>;
}

// Implementation of projection rebuilder
class UserProjectionRebuilder implements IProjectionRebuilder {
  constructor(
    private readonly eventStore: { getAllEvents(): Promise<UserEvent[]> },
    private readonly projectionBuilder: IProjectionBuilder<UserEvent, User>
  ) {}

  async rebuild(): Promise<void> {
    const allEvents = await this.eventStore.getAllEvents() as UserEvent[];
    await this.projectionBuilder.rebuild(allEvents);
  }
}

const projectionRebuilder = new UserProjectionRebuilder(eventStore, userProjectionBuilder);

// Resolver factory interface
interface IResolverFactory {
  create<TArgs, TResult>(
    resolver: (args: TArgs) => Promise<TResult> | TResult
  ): ResolverFn<TResult, {}, unknown, TArgs>;
}

// Implementation of resolver factory
class ResolverFactory implements IResolverFactory {
  constructor(private readonly projectionRebuilder: IProjectionRebuilder) {}

  create<TArgs, TResult>(
    resolver: (args: TArgs) => Promise<TResult> | TResult
  ): ResolverFn<TResult, {}, unknown, TArgs> {
    return async <TParent = {}, TContext = {}>(
    _parent: TParent, 
    args: TArgs, 
    _context: TContext, 
    _info: GraphQLResolveInfo
  ): Promise<TResult> => {
      await this.projectionRebuilder.rebuild(); // In production, use event handlers instead
      return resolver(args);
    };
  }
}

const resolverFactory = new ResolverFactory(projectionRebuilder);

export const readTypeDefs = gql`
  type Query {
    getUser(id: ID!): User
    listUsers(limit: Int = 10, offset: Int = 0): UserList!
    searchUsers(query: String!): [User!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: String!
    updatedAt: String!
  }

  type UserList {
    users: [User!]!
    total: Int!
    hasMore: Boolean!
  }
`;

// Type-safe resolvers with generics
export const readResolvers: RequiredBy<QueryResolvers, 'getUser' | 'listUsers' | 'searchUsers'> = {
  getUser: resolverFactory.create<{ id: string }, User | null>(
    async ({ id }) => userProjectionBuilder.get(id)
  ),

  listUsers: resolverFactory.create<{ limit?: number; offset?: number }, UserList>(
    async ({ limit = 10, offset = 0 }) => {
      const allUsers = userProjectionBuilder.getAll();
      const paginatedUsers = allUsers.slice(offset, offset + limit);
      
      return {
        users: paginatedUsers,
        total: allUsers.length,
        hasMore: offset + limit < allUsers.length,
      };
    }
  ),

  searchUsers: resolverFactory.create<{ query: string }, User[]>(
    async ({ query }) => {
      const searchLower = query.toLowerCase();
      return userProjectionBuilder.search(
        user => 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
      );
    }
  ),
};

// Create executable schema with type safety
export const readSchema = makeExecutableSchema({
  typeDefs: readTypeDefs,
  resolvers: {
    Query: readResolvers,
  },
});

// Export types for external use
export type ReadSchemaResolvers = typeof readResolvers;
export type ReadSchemaContext = QueryResolvers extends { getUser?: infer R } 
  ? R extends ResolverFn<unknown, unknown, infer C, unknown> 
    ? C 
    : never 
  : never;