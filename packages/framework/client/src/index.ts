// Main exports for the CQRS Framework Client package

// Error handling
export {
  GraphQLError,
  ClientError,
  isGraphQLError,
  isClientError,
  createGraphQLError,
  responseToResult,
  type GraphQLErrorInfo,
  type OperationResult,
} from './errors/GraphQLError';

// Base client classes
export {
  BaseGraphQLClient,
  DEFAULT_CLIENT_CONFIG,
  type GraphQLRequest,
  type GraphQLResponse,
  type GraphQLClientConfig,
} from './clients/BaseGraphQLClient';

export {
  BaseCQRSClient,
  type CQRSOperationResult,
  type BaseCreateInput,
  type BaseUpdateInput,
  type BaseEntity,
} from './clients/BaseCQRSClient';

export {
  CQRSClientBase,
  type IReadClient,
  type IWriteClient,
  type CQRSClientOptions,
  type CommandResult,
  type QueryResult,
} from './clients/CQRSClientBase';

// Patterns
export {
  EventualConsistencyHandler,
  eventualConsistency,
  DEFAULT_EVENTUAL_CONSISTENCY_CONFIG,
  type EventualConsistencyConfig,
} from './patterns/EventualConsistency';

export {
  BulkOperationHandler,
  DEFAULT_BULK_CONFIG,
  type BulkOperationProgress,
  type BulkOperationConfig,
} from './patterns/BulkOperations';

export {
  CacheWarmingHandler,
  DEFAULT_CACHE_CONFIG,
  type CacheWarmingConfig,
} from './patterns/CacheWarming';

export {
  PersistedDocumentRegistry,
  InMemoryPersistedDocumentStore,
  persistedDocuments,
  createPersistedDocument,
  extractOperationName,
  validatePersistedDocument,
  type PersistedDocument,
  type PersistedDocumentStore,
} from './patterns/PersistedDocuments';

// Re-export commonly used types from dependencies
export type { Result } from '@cqrs-framework/types';

// Package metadata
export const CLIENT_PACKAGE_VERSION = '1.0.0';
export const CLIENT_PACKAGE_NAME = '@cqrs-framework/client';