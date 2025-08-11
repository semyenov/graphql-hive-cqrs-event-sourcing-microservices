/**
 * GraphQL Context Types
 * 
 * Context types for GraphQL resolvers
 */

import type { CommandBus, QueryBus, EventBus } from '@cqrs/framework/infrastructure/bus';

export interface GraphQLContext {
  commandBus: CommandBus;
  queryBus: QueryBus;
  eventBus: EventBus<any>;
}

export type GraphQLRootValue = Record<string, never>;