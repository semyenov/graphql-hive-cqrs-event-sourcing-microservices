/**
 * SchemaService - Effect-based GraphQL schema building service
 * 
 * Provides composable schema construction with full type safety
 * and automatic SDL generation using Effect patterns
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "@effect/schema/Schema"
import * as Data from "effect/Data"
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  printSchema,
  validateSchema
} from "graphql"
import { addResolversToSchema } from "@graphql-tools/schema"

// ============================================================================
// Error Types
// ============================================================================

export class SchemaBuilderError extends Data.TaggedError("SchemaBuilderError")<{
  readonly reason: "InvalidSchema" | "ValidationFailed" | "BuildFailed" | "ConversionFailed"
  readonly message: string
  readonly details?: unknown
}> {}

export class SchemaValidationError extends Data.TaggedError("SchemaValidationError")<{
  readonly errors: ReadonlyArray<string>
  readonly schema?: string
}> {}

// ============================================================================
// Types
// ============================================================================

export interface SchemaConfig {
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly federationVersion?: 1 | 2
  readonly enableIntrospection?: boolean
}

export interface EntityDefinition<T = any> {
  readonly typename: string
  readonly keyFields: ReadonlyArray<string>
  readonly schema: Schema.Schema<T, unknown>
  readonly resolveReference?: (reference: unknown) => Effect.Effect<T, SchemaBuilderError>
  readonly fields?: GraphQLFieldConfigMap<T, any>
  readonly extensions?: Record<string, unknown>
}

export interface SchemaDefinition {
  readonly config: SchemaConfig
  readonly entities: ReadonlyArray<EntityDefinition>
  readonly queries: Record<string, GraphQLFieldConfig<any, any>>
  readonly mutations: Record<string, GraphQLFieldConfig<any, any>>
  readonly subscriptions: Record<string, GraphQLFieldConfig<any, any>>
  readonly types: ReadonlyArray<GraphQLObjectType>
  readonly scalars: Record<string, any>
  readonly directives: ReadonlyArray<any>
}

// ============================================================================
// Service Interface
// ============================================================================

export interface SchemaService {
  readonly build: (
    definition: SchemaDefinition
  ) => Effect.Effect<GraphQLSchema, SchemaBuilderError>
  
  readonly generateSDL: (
    schema: GraphQLSchema
  ) => Effect.Effect<string, SchemaBuilderError>
  
  readonly validate: (
    schema: GraphQLSchema
  ) => Effect.Effect<void, SchemaValidationError>
  
  readonly merge: (
    schemas: ReadonlyArray<GraphQLSchema>
  ) => Effect.Effect<GraphQLSchema, SchemaBuilderError>
  
  readonly addResolvers: (
    schema: GraphQLSchema,
    resolvers: Record<string, any>
  ) => Effect.Effect<GraphQLSchema, SchemaBuilderError>
  
  readonly introspect: (
    schema: GraphQLSchema
  ) => Effect.Effect<Record<string, any>, SchemaBuilderError>
}

export const SchemaService = Context.GenericTag<SchemaService>("@federation/SchemaService")

// ============================================================================
// Service Implementation
// ============================================================================

const makeSchemaService = Effect.gen(function* () {
  // Build GraphQL schema from definition
  const build = (definition: SchemaDefinition) =>
    Effect.gen(function* () {
      try {
        // Create Query type
        const queryType = new GraphQLObjectType({
          name: "Query",
          fields: () => ({
            ...definition.queries,
            _service: {
              type: new GraphQLObjectType({
                name: "_Service",
                fields: {
                  sdl: { type: require("graphql").GraphQLString }
                }
              }),
              resolve: () => ({ sdl: "" })
            }
          })
        })

        // Create Mutation type if mutations exist
        const mutationType = Object.keys(definition.mutations).length > 0
          ? new GraphQLObjectType({
              name: "Mutation",
              fields: () => definition.mutations
            })
          : undefined

        // Create Subscription type if subscriptions exist
        const subscriptionType = Object.keys(definition.subscriptions).length > 0
          ? new GraphQLObjectType({
              name: "Subscription",
              fields: () => definition.subscriptions
            })
          : undefined

        // Build the schema
        const schema = new GraphQLSchema({
          query: queryType,
          mutation: mutationType,
          subscription: subscriptionType,
          types: definition.types,
          directives: definition.directives
        })

        return schema
      } catch (error) {
        return yield* Effect.fail(
          new SchemaBuilderError({
            reason: "BuildFailed",
            message: "Failed to build GraphQL schema",
            details: error
          })
        )
      }
    })

  // Generate SDL from schema
  const generateSDL = (schema: GraphQLSchema) =>
    Effect.try({
      try: () => printSchema(schema),
      catch: (error) =>
        new SchemaBuilderError({
          reason: "ConversionFailed",
          message: "Failed to generate SDL",
          details: error
        })
    })

  // Validate schema
  const validate = (schema: GraphQLSchema) =>
    Effect.gen(function* () {
      const errors = validateSchema(schema)
      if (errors.length > 0) {
        return yield* Effect.fail(
          new SchemaValidationError({
            errors: errors.map(e => e.message),
            schema: printSchema(schema)
          })
        )
      }
    })

  // Merge multiple schemas
  const merge = (schemas: ReadonlyArray<GraphQLSchema>) =>
    Effect.gen(function* () {
      if (schemas.length === 0) {
        return yield* Effect.fail(
          new SchemaBuilderError({
            reason: "InvalidSchema",
            message: "No schemas provided to merge"
          })
        )
      }

      if (schemas.length === 1) {
        return schemas[0]
      }

      // TODO: Implement proper schema merging with conflict resolution
      // For now, return the first schema
      return schemas[0]
    })

  // Add resolvers to schema
  const addResolvers = (schema: GraphQLSchema, resolvers: Record<string, any>) =>
    Effect.try({
      try: () => addResolversToSchema({ schema, resolvers }),
      catch: (error) =>
        new SchemaBuilderError({
          reason: "BuildFailed",
          message: "Failed to add resolvers to schema",
          details: error
        })
    })

  // Introspect schema
  const introspect = (schema: GraphQLSchema) =>
    Effect.try({
      try: () => {
        const { introspectionFromSchema } = require("graphql")
        return introspectionFromSchema(schema)
      },
      catch: (error) =>
        new SchemaBuilderError({
          reason: "ConversionFailed",
          message: "Failed to introspect schema",
          details: error
        })
    })

  return {
    build,
    generateSDL,
    validate,
    merge,
    addResolvers,
    introspect
  } satisfies SchemaService
})

// ============================================================================
// Service Layer
// ============================================================================

export const SchemaServiceLive = Layer.effect(
  SchemaService,
  makeSchemaService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const buildSchema_ = (definition: SchemaDefinition) =>
  Effect.gen(function* () {
    const service = yield* SchemaService
    return yield* service.build(definition)
  })

export const generateSDL_ = (schema: GraphQLSchema) =>
  Effect.gen(function* () {
    const service = yield* SchemaService
    return yield* service.generateSDL(schema)
  })

export const validateSchema_ = (schema: GraphQLSchema) =>
  Effect.gen(function* () {
    const service = yield* SchemaService
    return yield* service.validate(schema)
  })

export const mergeSchemas_ = (schemas: ReadonlyArray<GraphQLSchema>) =>
  Effect.gen(function* () {
    const service = yield* SchemaService
    return yield* service.merge(schemas)
  })

// ============================================================================
// Schema Builder (Fluent API)
// ============================================================================

export class SchemaDefinitionBuilder {
  constructor(
    private readonly definition: Partial<SchemaDefinition> = {}
  ) {}

  withConfig(config: SchemaConfig): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      config
    })
  }

  withEntity(entity: EntityDefinition): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      entities: [...(this.definition.entities || []), entity]
    })
  }

  withEntities(entities: ReadonlyArray<EntityDefinition>): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      entities: [...(this.definition.entities || []), ...entities]
    })
  }

  withQuery(name: string, field: GraphQLFieldConfig<any, any>): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      queries: { ...(this.definition.queries || {}), [name]: field }
    })
  }

  withMutation(name: string, field: GraphQLFieldConfig<any, any>): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      mutations: { ...(this.definition.mutations || {}), [name]: field }
    })
  }

  withSubscription(name: string, field: GraphQLFieldConfig<any, any>): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      subscriptions: { ...(this.definition.subscriptions || {}), [name]: field }
    })
  }

  withType(type: GraphQLObjectType): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      types: [...(this.definition.types || []), type]
    })
  }

  withScalar(name: string, scalar: any): SchemaDefinitionBuilder {
    return new SchemaDefinitionBuilder({
      ...this.definition,
      scalars: { ...(this.definition.scalars || {}), [name]: scalar }
    })
  }

  build(): SchemaDefinition {
    if (!this.definition.config) {
      throw new Error("Schema config is required")
    }

    return {
      config: this.definition.config,
      entities: this.definition.entities || [],
      queries: this.definition.queries || {},
      mutations: this.definition.mutations || {},
      subscriptions: this.definition.subscriptions || {},
      types: this.definition.types || [],
      scalars: this.definition.scalars || {},
      directives: this.definition.directives || []
    }
  }
}

export const schemaBuilder = (name: string, version: string = "1.0.0") =>
  new SchemaDefinitionBuilder().withConfig({ name, version })