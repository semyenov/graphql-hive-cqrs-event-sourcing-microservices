/**
 * Framework GraphQL: Main Exports
 * 
 * GraphQL-to-CQRS bridge for seamless integration.
 */

// Type exports
export type {
  IGraphQLContext,
  IGraphQLError,
  IGraphQLMutationResponse,
  IMutationResolverConfig,
  IQueryResolverConfig,
  ISubscriptionResolverConfig,
  ResolverFunction,
  CommandInputMapper,
  QueryParamsMapper,
  ResultMapper,
  IResolverBuilderOptions,
  ISchemaBuilderConfig,
  ExtractResolverArgs,
  ExtractResolverResult,
} from './types';

export {
  isGraphQLMutationResponse,
  isGraphQLError,
} from './types';

// Error handling exports
export {
  GraphQLErrorCode,
  validationErrorsToGraphQL,
  commandResultToGraphQLResponse,
  errorToGraphQL,
  createGraphQLError,
  withErrorHandling,
  aggregateErrors,
} from './errors';

// Context exports
export type {
  IContextBuilderConfig,
  IEnhancedContextBuilderConfig,
} from './context';

export {
  createContextBuilder,
  createEnhancedContextBuilder,
  authenticationMiddleware,
  loggingMiddleware,
  rateLimitingMiddleware,
  getContextValue,
  setContextValue,
} from './context';

// Resolver exports
export {
  createMutationResolver,
  createQueryResolver,
  createSubscriptionResolver,
  createBatchResolver,
  createResolverMap,
} from './resolvers';

// Schema exports
export {
  baseTypeDefs,
  scalarTypeDefs,
  buildSchema,
  mergeResolvers,
  createDomainConfig,
  combineDomains,
  standardScalars,
  generateTypeScriptTypes,
} from './schema';

/**
 * Quick setup function for GraphQL with CQRS
 */
export { setupGraphQLBridge } from './setup';

// Re-export commonly used types from core
export type { 
  ICommand, 
  IAggregateCommand,
  ICommandResult,
  ICommandBus,
  ValidationError,
  ValidationResult,
} from '../core/command';

export type {
  IQuery,
  IQueryBus,
  IPaginationParams,
  IPaginatedResult,
} from '../core/query';

export type {
  IEvent,
  IEventBus,
  IEventMetadata,
} from '../core/event';

export type {
  AggregateId,
  Email,
  UserId,
} from '../core/branded/types';