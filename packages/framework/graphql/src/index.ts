// Universal GraphQL Integration for CQRS/Event Sourcing Framework
// Main exports for @cqrs-framework/graphql package

// CQRS Plugin exports
export * from './plugins/cqrsPlugin';

// Error handling and adaptation
export * from './adapters/error-adapter';
export type { GraphQLError } from './adapters/error-adapter';

// Schema building utilities
export * from './schema/builders';

// Version information
export const GRAPHQL_FRAMEWORK_VERSION = '1.0.0';
export const GRAPHQL_FRAMEWORK_NAME = '@cqrs-framework/graphql';