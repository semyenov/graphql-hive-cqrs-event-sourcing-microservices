/**
 * FederationService - Apollo Federation support
 * 
 * Provides federation-specific functionality including
 * entity resolution, reference handling, and subgraph SDL generation
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Data from "effect/Data"
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLUnionType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  printSchema,
} from "graphql"
import { addResolversToSchema } from "@graphql-tools/schema"
import * as Schema from "@effect/schema/Schema"

// ============================================================================
// Error Types
// ============================================================================

export class FederationError extends Data.TaggedError("FederationError")<{
  readonly reason: "InvalidEntity" | "ResolverNotFound" | "ReferenceResolutionFailed" | "SubgraphBuildFailed"
  readonly message: string
  readonly entity?: string
  readonly details?: unknown
}> {}

// ============================================================================
// Types
// ============================================================================

export interface EntityConfig<T = any> {
  readonly typename: string
  readonly keyFields: ReadonlyArray<string>
  readonly schema: Schema.Schema.Any
  readonly resolveReference: (reference: any) => Effect.Effect<T, FederationError>
  readonly fields?: GraphQLFieldConfigMap<T, any>
  readonly extends?: boolean
  readonly shareable?: boolean
}

export interface SubgraphConfig {
  readonly name: string
  readonly url?: string
  readonly entities: ReadonlyArray<EntityConfig>
  readonly additionalTypes?: ReadonlyArray<GraphQLObjectType>
  readonly federationVersion?: 1 | 2
}

export interface FederationDirectives {
  readonly key?: string
  readonly extends?: boolean
  readonly shareable?: boolean
  readonly inaccessible?: boolean
  readonly override?: string
  readonly provides?: string
  readonly requires?: string
  readonly tag?: string
  readonly composeDirective?: string
  readonly interfaceObject?: boolean
}

// ============================================================================
// Service Interface
// ============================================================================

export interface FederationService {
  readonly buildSubgraphSchema: (
    config: SubgraphConfig
  ) => Effect.Effect<GraphQLSchema, FederationError>
  
  readonly createEntityResolver: <T>(
    entity: EntityConfig<T>
  ) => GraphQLFieldConfig<any, any>
  
  readonly createEntityUnion: (
    entities: ReadonlyArray<EntityConfig>
  ) => Effect.Effect<GraphQLUnionType, FederationError>
  
  readonly generateSubgraphSDL: (
    schema: GraphQLSchema,
    config?: SubgraphConfig
  ) => Effect.Effect<string, FederationError>
  
  readonly addFederationDirectives: (
    type: GraphQLObjectType,
    directives: FederationDirectives
  ) => GraphQLObjectType
  
  readonly validateEntityKey: (
    entity: EntityConfig,
    key: string
  ) => Effect.Effect<void, FederationError>
}

export const FederationService = Context.GenericTag<FederationService>("@federation/FederationService")

// ============================================================================
// Service Implementation
// ============================================================================

const makeFederationService = Effect.gen(function* () {
  // Build a federated subgraph schema
  const buildSubgraphSchema = (config: SubgraphConfig) =>
    Effect.gen(function* () {
      try {
        // Create entity types
        const entityTypes: GraphQLObjectType[] = []
        const entityResolvers: Record<string, any> = {}
        
        for (const entity of config.entities) {
          // Create GraphQL type from schema
          const fields: GraphQLFieldConfigMap<any, any> = {
            __typename: {
              type: new GraphQLNonNull(GraphQLString),
              resolve: () => entity.typename,
            },
            ...entity.fields,
          }
          
          // Add key fields as non-nullable
          entity.keyFields.forEach(field => {
            if (!fields[field]) {
              fields[field] = {
                type: new GraphQLNonNull(GraphQLString),
              }
            }
          })
          
          const entityType = new GraphQLObjectType({
            name: entity.typename,
            fields,
            extensions: {
              apollo: {
                federation: {
                  keys: [entity.keyFields.join(" ")],
                  extends: entity.extends,
                  shareable: entity.shareable,
                },
              },
            },
          })
          
          entityTypes.push(entityType)
          
          // Add reference resolver
          entityResolvers[entity.typename] = {
            __resolveReference: async (reference: any) => {
              const result = await Effect.runPromise(
                entity.resolveReference(reference).pipe(
                  Effect.catchAll(error =>
                    Effect.fail(
                      new Error(`Failed to resolve ${entity.typename}: ${error.message}`)
                    )
                  )
                )
              )
              return result
            },
          }
        }
        
        // Create _Entity union
        const entityUnion = entityTypes.length > 0
          ? new GraphQLUnionType({
              name: "_Entity",
              types: entityTypes,
              resolveType: (value: any) => value.__typename,
            })
          : undefined
        
        // Create Query type with federation fields
        const queryFields: GraphQLFieldConfigMap<any, any> = {
          _service: {
            type: new GraphQLNonNull(
              new GraphQLObjectType({
                name: "_Service",
                fields: {
                  sdl: {
                    type: new GraphQLNonNull(GraphQLString),
                  },
                },
              })
            ),
            resolve: () => ({
              sdl: printSchema(
                new GraphQLSchema({
                  query: new GraphQLObjectType({
                    name: "Query",
                    fields: {},
                  }),
                  types: [...entityTypes, ...(config.additionalTypes || [])],
                })
              ),
            }),
          },
        }
        
        if (entityUnion) {
          queryFields._entities = {
            type: new GraphQLList(entityUnion),
            args: {
              representations: {
                type: new GraphQLNonNull(
                  new GraphQLList(new GraphQLNonNull(GraphQLString))
                ),
              },
            },
            resolve: async (_source, { representations }) => {
              const results = []
              for (const rep of representations) {
                const parsed = JSON.parse(rep)
                const typename = parsed.__typename
                const resolver = entityResolvers[typename]
                if (resolver?.__resolveReference) {
                  const resolved = await resolver.__resolveReference(parsed)
                  results.push(resolved)
                }
              }
              return results
            },
          }
        }
        
        const queryType = new GraphQLObjectType({
          name: "Query",
          fields: queryFields,
        })
        
        // Build the schema
        const schema = new GraphQLSchema({
          query: queryType,
          types: [...entityTypes, ...(config.additionalTypes || [])],
        })
        
        // Add resolvers
        const schemaWithResolvers = addResolversToSchema({
          schema,
          resolvers: entityResolvers,
        })
        
        return schemaWithResolvers
      } catch (error) {
        return yield* Effect.fail(
          new FederationError({
            reason: "SubgraphBuildFailed",
            message: "Failed to build subgraph schema",
            details: error,
          })
        )
      }
    })

  // Create entity resolver field
  const createEntityResolver = <T>(entity: EntityConfig<T>): GraphQLFieldConfig<any, any> => ({
    type: new GraphQLObjectType({
      name: entity.typename,
      fields: entity.fields || {},
    }),
    resolve: async (reference: any) => {
      const result = await Effect.runPromise(
        entity.resolveReference(reference).pipe(
          Effect.catchAll(error =>
            Effect.fail(
              new Error(`Failed to resolve ${entity.typename}: ${error.message}`)
            )
          )
        )
      )
      return result
    },
  })

  // Create entity union type
  const createEntityUnion = (entities: ReadonlyArray<EntityConfig>) =>
    Effect.gen(function* () {
      if (entities.length === 0) {
        return yield* Effect.fail(
          new FederationError({
            reason: "InvalidEntity",
            message: "No entities provided for union",
          })
        )
      }
      
      const types = entities.map(entity =>
        new GraphQLObjectType({
          name: entity.typename,
          fields: entity.fields || {
            __typename: {
              type: new GraphQLNonNull(GraphQLString),
              resolve: () => entity.typename,
            },
          },
        })
      )
      
      return new GraphQLUnionType({
        name: "_Entity",
        types,
        resolveType: (value: any) => value.__typename,
      })
    })

  // Generate subgraph SDL with federation directives
  const generateSubgraphSDL = (schema: GraphQLSchema, config?: SubgraphConfig) =>
    Effect.try({
      try: () => {
        let sdl = printSchema(schema)
        
        // Add federation directives
        if (config?.federationVersion === 2) {
          sdl = `extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable", "@inaccessible", "@override", "@provides", "@requires", "@tag", "@extends", "@external"])\n\n${sdl}`
        }
        
        // Add entity directives
        if (config?.entities) {
          config.entities.forEach(entity => {
            const keyDirective = `@key(fields: "${entity.keyFields.join(" ")}")`
            const extendsDirective = entity.extends ? " @extends" : ""
            const shareableDirective = entity.shareable ? " @shareable" : ""
            
            sdl = sdl.replace(
              `type ${entity.typename} {`,
              `type ${entity.typename} ${keyDirective}${extendsDirective}${shareableDirective} {`
            )
          })
        }
        
        return sdl
      },
      catch: (error) =>
        new FederationError({
          reason: "SubgraphBuildFailed",
          message: "Failed to generate subgraph SDL",
          details: error,
        }),
    })

  // Add federation directives to a type
  const addFederationDirectives = (
    type: GraphQLObjectType,
    directives: FederationDirectives
  ): GraphQLObjectType => {
    const extensions = {
      ...type.extensions,
      apollo: {
        ...(type.extensions as any)?.apollo,
        federation: {
          ...(type.extensions as any)?.apollo?.federation,
          ...directives,
        },
      },
    }
    
    return new GraphQLObjectType({
      ...type.toConfig(),
      extensions,
    })
  }

  // Validate entity key fields
  const validateEntityKey = (entity: EntityConfig, key: string) =>
    Effect.gen(function* () {
      const keyFields = key.split(" ")
      const schemaFields = Object.keys(entity.fields || {})
      
      for (const field of keyFields) {
        if (!schemaFields.includes(field)) {
          return yield* Effect.fail(
            new FederationError({
              reason: "InvalidEntity",
              message: `Key field "${field}" not found in entity "${entity.typename}"`,
              entity: entity.typename,
            })
          )
        }
      }
    })

  return {
    buildSubgraphSchema,
    createEntityResolver,
    createEntityUnion,
    generateSubgraphSDL,
    addFederationDirectives,
    validateEntityKey,
  } satisfies FederationService
})

// ============================================================================
// Service Layer
// ============================================================================

export const FederationServiceLive = Layer.effect(
  FederationService,
  makeFederationService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const buildSubgraphSchema_ = (config: SubgraphConfig) =>
  Effect.gen(function* () {
    const service = yield* FederationService
    return yield* service.buildSubgraphSchema(config)
  })

export const generateSubgraphSDL_ = (schema: GraphQLSchema, config?: SubgraphConfig) =>
  Effect.gen(function* () {
    const service = yield* FederationService
    return yield* service.generateSubgraphSDL(schema, config)
  })

export const createEntityUnion_ = (entities: ReadonlyArray<EntityConfig>) =>
  Effect.gen(function* () {
    const service = yield* FederationService
    return yield* service.createEntityUnion(entities)
  })