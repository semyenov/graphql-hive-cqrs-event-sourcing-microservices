/**
 * Entity Resolution Service - Simplified Version
 * 
 * Optimized entity resolution for GraphQL Federation with caching
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Cache from "effect/Cache"
import * as Duration from "effect/Duration"
import * as Data from "effect/Data"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"

// ============================================================================
// Error Types
// ============================================================================

export class EntityResolutionError extends Data.TaggedError("EntityResolutionError")<{
  readonly entity: string
  readonly id: string
  readonly reason: "NotFound" | "InvalidReference" | "ResolutionFailed" | "Timeout"
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Types
// ============================================================================

export interface EntityReference {
  readonly __typename: string
  readonly id: string
  readonly [key: string]: any
}

export interface EntityResolver<T> {
  readonly typename: string
  readonly resolve: (reference: EntityReference) => Effect.Effect<T, EntityResolutionError>
}

export interface ResolutionResult<T> {
  readonly entity: T
  readonly cached: boolean
  readonly executionTime: number
}

// ============================================================================
// Service Interface
// ============================================================================

export interface EntityResolutionService {
  readonly registerResolver: <T>(
    resolver: EntityResolver<T>
  ) => Effect.Effect<void>
  
  readonly resolveEntity: <T>(
    reference: EntityReference
  ) => Effect.Effect<ResolutionResult<T>, EntityResolutionError>
  
  readonly clearCache: () => Effect.Effect<void>
}

export const EntityResolutionService = Context.GenericTag<EntityResolutionService>("@federation/EntityResolutionService")

// ============================================================================
// Implementation
// ============================================================================

const makeEntityResolutionService = Effect.gen(function* () {
  // Use refs to store mutable state
  const resolversRef = yield* Ref.make(HashMap.empty<string, EntityResolver<any>>())
  const cacheRef = yield* Cache.make({
    capacity: 1000,
    timeToLive: Duration.minutes(5),
    lookup: (_key: string) => Effect.fail("Not found" as never)
  })
  
  const registerResolver = <T>(resolver: EntityResolver<T>) =>
    Ref.update(resolversRef, (resolvers: HashMap.HashMap<string, EntityResolver<any>>) =>
      HashMap.set(resolvers, resolver.typename, resolver)
    )
  
  const resolveEntity = <T>(reference: EntityReference): Effect.Effect<ResolutionResult<T>, EntityResolutionError, never> =>
    Effect.gen(function* () {
      const startTime = Date.now()
      const typename = reference.__typename
      const cacheKey = `${typename}:${reference.id}`
      
      // Check cache
      const cached = yield* Effect.option(cacheRef.get(cacheKey))
      
      if (Option.isSome(cached)) {
        return {
          entity: cached.value as T,
          cached: true,
          executionTime: Date.now() - startTime
        }
      }
      
      // Get resolver
      const resolvers = yield* Ref.get(resolversRef)
      const resolver = HashMap.get(resolvers, typename)
      
      if (Option.isNone(resolver)) {
        return yield* Effect.fail(
          new EntityResolutionError({
            entity: typename,
            id: reference.id,
            reason: "InvalidReference",
            message: `No resolver registered for entity type: ${typename}`
          })
        )
      }
      
      // Resolve entity
      const entity = yield* resolver.value.resolve(reference)
      
      // Cache result
      yield* cacheRef.set(cacheKey, entity as any)
      
      return {
        entity,
        cached: false,
        executionTime: Date.now() - startTime
      }
    })
  
  const clearCache = () => cacheRef.invalidateAll
  
  return {
    registerResolver,
    resolveEntity,
    clearCache
  } satisfies EntityResolutionService
})

// ============================================================================
// Service Layer
// ============================================================================

export const EntityResolutionServiceLive = Layer.effect(
  EntityResolutionService,
  makeEntityResolutionService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const registerEntityResolver = <T>(
  resolver: EntityResolver<T>
) =>
  Effect.gen(function* () {
    const service = yield* EntityResolutionService
    return yield* service.registerResolver(resolver)
  })

export const resolveEntity = <T>(
  reference: EntityReference
) =>
  Effect.gen(function* () {
    const service = yield* EntityResolutionService
    return yield* service.resolveEntity<T>(reference)
  })