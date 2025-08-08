import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eventStore } from '../repositories';
import { UserAggregate } from '../events/UserAggregate';
import { mutationResolvers } from '../resolvers/mutations';
import type { UserEvent, AllEvents } from '../events/generic-types';
import type { 
  QueryResolvers,
  RequiredBy,
  ResolverFn,
  AggregateId,
} from '../types';
import type { User, UserList } from '../types/generated/schema';
import type { GraphQLResolveInfo } from 'graphql';
import type { IProjectionBuilder } from '../events/interfaces';

// Load schema definition
const typeDefs = readFileSync(join(__dirname, '../../src/schema.graphql'), 'utf-8');

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
    private readonly eventStore: { getAllEvents(): Promise<AllEvents[]> },
    private readonly projectionBuilder: IProjectionBuilder<UserEvent, User>
  ) {}

  async rebuild(): Promise<void> {
    const allEvents = await this.eventStore.getAllEvents();
    // Filter to only user events
    const userEvents = allEvents.filter(event => 
      event.type === 'UserCreated' || 
      event.type === 'UserUpdated' || 
      event.type === 'UserDeleted'
    ) as UserEvent[];
    await this.projectionBuilder.rebuild(userEvents);
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

// Query resolvers
export const queryResolvers: RequiredBy<QueryResolvers, 'getUser' | 'listUsers' | 'searchUsers'> = {
  getUser: resolverFactory.create<{ id: string }, User | null>(
    async ({ id }) => userProjectionBuilder.get(id)
  ),

  listUsers: resolverFactory.create<{ limit?: number; offset?: number }, UserList>(
    async ({ limit = 10, offset = 0 }) => {
      const allUsers = userProjectionBuilder.getAll();
      const paginatedUsers = allUsers.slice(offset, offset + limit);
      
      return {
        __typename: 'UserList',
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

// Error resolver to handle the mapping
interface ErrorParent {
  field?: string | null;
  message: string;
}

const errorResolvers = {
  field: (parent: ErrorParent) => parent.field ?? null,
  message: (parent: ErrorParent) => parent.message,
};

// Create unified executable schema
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: queryResolvers,
    Mutation: mutationResolvers,
    Error: errorResolvers,
  },
});

// Export resolver types for external use
export type SchemaResolvers = {
  Query: typeof queryResolvers;
  Mutation: typeof mutationResolvers;
  Error: typeof errorResolvers;
};

// Re-export for backward compatibility
export const readSchema = schema;
export const writeSchemaV2 = schema;
export const readResolvers = queryResolvers;
export const writeResolvers = mutationResolvers;