/**
 * Services Module
 * 
 * Export all Effect-based services for GraphQL federation
 */

export {
  SchemaService,
  SchemaServiceLive,
  SchemaBuilderError,
  SchemaValidationError,
  type SchemaConfig,
  type EntityDefinition,
  type SchemaDefinition,
  buildSchema_,
  generateSDL_,
  mergeSchemas_,
} from "./SchemaService"

export {
  ValidationService,
  ValidationServiceLive,
  ValidationError,
  ComplexityError,
  FederationComplianceError,
  type ValidationConfig,
  type ComplexityConfig,
  type ValidationResult,
  validateDocument_,
  validateSchema_ as validateSchemaWithService,
  checkComplexity_,
  checkFederationCompliance_,
  strictValidation,
  developmentValidation,
  productionValidation,
} from "./ValidationService"

export {
  ResolverService,
  ResolverServiceLive,
  ResolverError,
  BatchingError,
  MiddlewareError,
  type ResolverFn,
  type MiddlewareFn,
  type ResolverConfig,
  type CacheConfig,
  type BatchConfig,
  type ResolverMap,
  loggingMiddleware,
  authMiddleware,
  cachingMiddleware,
  resolver,
  resolverPure,
  withAuth,
  withCache,
  withLogging,
} from "./ResolverService"

export {
  FederationService,
  FederationServiceLive,
  FederationError,
  type EntityConfig,
  type SubgraphConfig,
  type FederationDirectives,
  buildSubgraphSchema_,
  generateSubgraphSDL_,
  createEntityUnion_,
} from "./FederationService"

// Re-export service layers for convenience
import { SchemaServiceLive } from "./SchemaService"
import { ValidationServiceLive } from "./ValidationService"
import { ResolverServiceLive } from "./ResolverService"
import { FederationServiceLive } from "./FederationService"
import * as Layer from "effect/Layer"

/**
 * Complete service layer with all federation services
 */
export const FederationServicesLive = Layer.mergeAll(
  SchemaServiceLive,
  ValidationServiceLive,
  ResolverServiceLive,
  FederationServiceLive
)