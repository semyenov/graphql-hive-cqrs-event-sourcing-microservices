/**
 * Type-only exports for better tree-shaking
 * 
 * Import types from here when you only need type definitions
 * without importing the runtime code.
 */

// Core types
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

// Error types
export type {
  EntityResolverError,
  FieldResolverError,
  SchemaConversionError,
  FederationConfigError,
  FederationError,
} from "./core/errors"

// Service types
export type {
  SchemaConfig,
  EntityDefinition,
  SchemaDefinition,
} from "./services/SchemaService"

export type {
  ValidationConfig,
  ComplexityConfig,
  ValidationResult,
} from "./services/ValidationService"

export type {
  ResolverFn,
  MiddlewareFn,
  ResolverConfig,
  CacheConfig,
  BatchConfig,
  ResolverMap,
} from "./services/ResolverService"

export type {
  EntityConfig,
  SubgraphConfig,
  FederationDirectives,
} from "./services/FederationService"

// Entity Resolution types
export type {
  EntityReference,
  EntityResolver,
  ResolutionResult,
} from "./federation/entity/EntityResolutionServiceSimple"

// DataLoader types
export type {
  BatchFunction,
  DataLoaderOptions,
  DataLoader,
} from "./resolver/batching/DataLoaderService"

// Middleware types
export type {
  ResolverContext,
  ResolverMiddleware,
} from "./resolver/middleware"