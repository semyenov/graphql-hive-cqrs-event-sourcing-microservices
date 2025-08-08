// Projections Framework
// Generic patterns for building read models from event streams

// Core projection building
export {
  ProjectionBuilder,
  type Projection,
  type ProjectionHandler,
  type ProjectionStore,
  type ProjectionFilter,
  type QueryOptions,
  type ProjectionMiddleware,
  type ProjectionProcessingResult,
  type ProjectionStatistics,
  ProjectionError,
  type ProjectionErrorCode
} from './builders/ProjectionBuilder';

// In-memory store implementation
export {
  InMemoryProjectionStore,
  type ProjectionStoreStatistics
} from './stores/InMemoryProjectionStore';

// Real-time subscriptions
export {
  ProjectionSubscription,
  ProjectionManager,
  projectionManager,
  type ProjectionSubscriber,
  type ProjectionUpdate,
  type ProjectionSubscriptionOptions,
  type ProjectionSubscriptionStatus,
  SubscriptionError,
  type SubscriptionErrorCode
} from './subscriptions/ProjectionSubscription';

// Query handling system
export {
  QueryRegistry,
  ProjectionQueryHandler,
  SingleProjectionQueryHandler,
  ProjectionCountQueryHandler,
  QueryLoggingMiddleware,
  type Query,
  type QueryHandler,
  type QueryMiddleware,
  type ProjectionQueryParams,
  type QueryRegistryOptions,
  type QueryRegistryStatistics,
  QueryError,
  type QueryErrorCode,
  DEFAULT_QUERY_OPTIONS
} from './queries/QueryHandler';