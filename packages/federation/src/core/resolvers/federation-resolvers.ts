import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"
import { GraphQLSchema, printSchema } from "graphql"
import type { FederationEntity, FieldResolver } from "../types"
import { EntityResolverError } from "../errors"

export interface FederationContext {
  readonly userId: string
  readonly traceId: string
  readonly timestamp: number
}

export class FederationService extends Context.Tag("FederationService")<
  FederationService,
  {
    readonly resolveEntity: <T>(
      typename: string,
      reference: Record<string, unknown>
    ) => Effect.Effect<T | null, EntityResolverError>
    readonly getServiceSDL: () => Effect.Effect<string, never>
  }
>() {}

export const createFederationService = (
  entities: ReadonlyArray<FederationEntity>,
  schema: GraphQLSchema
): Layer.Layer<FederationService> => {
  const entityMap = new Map(
    entities.map(entity => [entity.typename, entity])
  )

  return Layer.succeed(FederationService, {
    resolveEntity: <T>(typename: string, reference: Record<string, unknown>) => {
      const entity = entityMap.get(typename)
      
      if (!entity) {
        return Effect.succeed(null)
      }

      return pipe(
        entity.resolveReference(reference),
        Effect.map(result => ({
          ...(result as Record<string, unknown>),
          __typename: typename,
        }) as T),
        Effect.catchTag("EntityResolverError", () => Effect.succeed(null))
      )
    },
    
    getServiceSDL: () => Effect.succeed(printSchema(schema)),
  })
}

export const createFederationResolvers = (
  entities: ReadonlyArray<FederationEntity>,
  schema: GraphQLSchema
) => {
  const service = createFederationService(entities, schema)
  
  return {
    _Entity: {
      __resolveType: (obj: any) => obj.__typename,
    },
    
    Query: {
      _entities: async (
        _parent: unknown,
        { representations }: { representations: Array<Record<string, unknown>> },
        _context: FederationContext
      ) => {
        const program = Effect.gen(function* () {
          const federationService = yield* FederationService
          
          const results = yield* Effect.all(
            representations.map(rep =>
              federationService.resolveEntity(
                rep.__typename as string,
                rep
              )
            ),
            { concurrency: "unbounded" }
          )
          
          return results
        })
        
        return Effect.runPromise(
          Effect.provide(program, service)
        )
      },
      
      _service: async () => {
        const program = Effect.gen(function* () {
          const federationService = yield* FederationService
          const sdl = yield* federationService.getServiceSDL()
          return { sdl }
        })
        
        return Effect.runPromise(
          Effect.provide(program, service)
        )
      },
    },
  }
}

export const createEntityResolver = (
  entity: FederationEntity
) => {
  return entity.resolveReference
}

export const createEntityResolvers = (
  entity: FederationEntity
) => {
  const resolvers: Record<string, any> = {
    __resolveReference: async (reference: Record<string, unknown>) => {
      return Effect.runPromise(
        pipe(
          entity.resolveReference(reference),
          Effect.map(result => ({
            ...(result as Record<string, unknown>),
            __typename: entity.typename,
          })),
          Effect.catchTag("EntityResolverError" as const, () =>
            Effect.fail(new Error("Entity resolution failed"))
          )
        )
      )
    },
  }
  
  Object.entries(entity.fields).forEach(([fieldName, fieldResolver]) => {
    resolvers[fieldName] = async (source: any, args: any, context: any, info: any) => {
      const resolver = fieldResolver as FieldResolver<unknown, unknown, unknown, unknown>
      return Effect.runPromise(pipe(resolver(source, args, context, info), Effect.catchAll(() => Effect.fail(new Error("Field resolution failed")))))
    }
  })
  
  return resolvers
}