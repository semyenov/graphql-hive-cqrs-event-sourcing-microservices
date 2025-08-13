/**
 * @cqrs/federation - GraphQL Federation support for CQRS/Event Sourcing
 * 
 * This package provides GraphQL Federation integration with Effect-TS,
 * enabling automatic schema generation from Effect Schemas and proper
 * entity resolution across microservices.
 */

// ============================================================================
// Service-based Architecture (Primary API)
// ============================================================================

// Services
export * from "./services"

// Schema components
export * from "./schema/scalars"
export * from "./schema/type-converter"

// Resolver middleware
export {
  type ResolverMiddleware,
  type ResolverContext,
  ResolverContextTag,
  ResolverMiddlewareError,
  timingMiddleware,
  errorHandlingMiddleware,
  authorizationMiddleware,
  rateLimitMiddleware,
  composeMiddleware,
  applyMiddleware,
  developmentMiddleware,
  productionMiddleware,
  authenticatedMiddleware
} from "./resolver/middleware"

// NOT exporting loggingMiddleware and cachingMiddleware to avoid conflicts with services
export * from "./resolver/batching/DataLoaderService"

// Federation entity resolution
export { 
  EntityResolutionService,
  EntityResolutionServiceLive,
  EntityResolutionError,
  type EntityReference,
  type EntityResolver,
  type ResolutionResult,
  registerEntityResolver,
  resolveEntity
} from "./federation/entity/EntityResolutionServiceSimple"

// ============================================================================
// Core Functionality
// ============================================================================

// Builder exports for convenience
export { EntityBuilder, createEntity, createEntities } from "./core/builders/entity-builder"
export { SchemaBuilder, createSchemaBuilder, buildFederatedSchema, generateFederatedSchema } from "./core/builders/schema-builder"

// Type exports
export type {
  FederationEntity,
  EntityReferenceResolver,
  FieldResolver,
  FieldResolverMap,
  DomainSchemaConfig,
  SchemaMap,
  GraphQLScalarMap,
  FederationExtensions,
  TypeConversionContext,
} from "./core/types"

// Error exports
export {
  EntityResolverError,
  FieldResolverError,
  SchemaConversionError,
  FederationConfigError,
  isEntityResolverError,
  isFieldResolverError,
  isSchemaConversionError,
  isFederationConfigError,
  type FederationError,
} from "./core/errors"

// Constant exports
export {
  FEDERATION_DIRECTIVES,
  FEDERATION_BASE_SCHEMA,
  COMMON_SCALARS,
  DOMAIN_EVENT_SCHEMA,
  COMMAND_RESULT_SCHEMA,
  QUERY_RESULT_SCHEMA,
  ERROR_CODES,
  DEFAULT_FEDERATION_VERSION,
  DEFAULT_CACHE_TTL,
  DEFAULT_TIMEOUT,
  MAX_BATCH_SIZE,
} from "./core/constants"

// Converter exports
export { schemaToGraphQLType, createConversionContext } from "./core/converters/schema-to-graphql"

// Resolver exports
export {
  type FederationContext,
  FederationService,
  createFederationService,
  createFederationResolvers,
  createEntityResolver,
  createEntityResolvers,
} from "./core/resolvers/federation-resolvers"

