import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './write-env.d.ts';

// Initialize gql.tada for write schema (mutations only)
export const writeGraphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    // Add custom scalars if needed
  };
}>();

// Re-export utilities scoped to write schema
export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';