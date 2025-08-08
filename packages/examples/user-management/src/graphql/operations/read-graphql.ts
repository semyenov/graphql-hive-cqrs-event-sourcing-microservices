import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './read-env.d.ts';

// Initialize gql.tada for read schema (queries only)
export const readGraphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    // Add custom scalars if needed
    // DateTime could be added here if we change createdAt/updatedAt to DateTime
  };
}>();

// Re-export utilities scoped to read schema
export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';