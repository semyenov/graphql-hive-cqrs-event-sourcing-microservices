/**
 * GraphQL Federation Integration
 * 
 * Native GraphQL Federation support with Effect-TS
 * Automatic schema generation from Effect Schemas
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as AST from "@effect/schema/AST"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import * as Match from "effect/Match"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  Kind,
  GraphQLInputObjectType,
  GraphQLInputFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  buildSchema,
  printSchema
} from "graphql"
import { addResolversToSchema } from "@graphql-tools/schema"

// ============================================================================
// Types and Errors
// ============================================================================

/**
 * Federation entity configuration
 */
export interface FederationEntity<
  SourceType = unknown,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType = SourceType,
  ResolveReferenceType = <T extends Record<string, unknown>>(reference: T) => Effect.Effect<ResultType, EntityResolverError>,
  FieldsType = {
    [K in keyof ResultType]?: FieldResolver<SourceType, ArgsType, ContextType, ResultType[K]>
  }
> {
  readonly typename: string
  readonly key: string
  readonly schema: Schema.Schema.Any
  readonly fields: FieldsType
  readonly resolveReference: ResolveReferenceType
}

/**
 * Field resolver function type
 */
export type FieldResolver<
  SourceType = unknown,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType = unknown
> = (
  source: SourceType,
  args?: ArgsType,
  context?: ContextType,
  info?: GraphQLResolveInfo
) => Effect.Effect<
  ResultType,
  EntityResolverError
>

/**
 * Entity resolver error
 */
export class EntityResolverError extends Data.Error {
  readonly _tag = "EntityResolverError"
  constructor(
    readonly reason: "NotFound" | "InvalidReference" | "ResolutionFailed",
    readonly message: string,
    readonly details?: unknown
  ) {
    super()
  }
}

/**
 * Schema conversion error
 */
export class SchemaConversionError extends Data.Error {
  readonly _tag = "SchemaConversionError"
  constructor(
    readonly message: string,
    readonly ast?: AST.AST
  ) {
    super()
  }
}

/**
 * Domain schema configuration
 */
export interface DomainSchemaConfig<
  SourceType = unknown,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType extends SourceType = SourceType,
> {
  readonly commands: Record<string, Schema.Schema.Any>
  readonly queries: Record<string, Schema.Schema.Any>
  readonly events: Record<string, Schema.Schema.Any>
  readonly entities: ReadonlyArray<FederationEntity<SourceType, ArgsType, ContextType, ResultType>>,
  readonly context?: Schema.Schema.Any
  readonly scalars?: Record<string, GraphQLScalarType>
}

// ============================================================================
// Schema to GraphQL Type Conversion
// ============================================================================

/**
 * Convert Effect Schema to GraphQL Type with better error handling
 */
export const schemaToGraphQLType = (
  schema: Schema.Schema.Any,
  isInput: boolean = false,
  typeCache = new Map<string, any>()
): Effect.Effect<any, SchemaConversionError> => {
  const ast = schema.ast
  const cacheKey = `${ast._tag}-${isInput}`

  if (typeCache.has(cacheKey)) {
    return Effect.succeed(typeCache.get(cacheKey))
  }

  return pipe(
    Match.type<AST.AST>(),
    Match.when({ _tag: "StringKeyword" }, () => Effect.succeed(GraphQLString)),
    Match.when({ _tag: "NumberKeyword" }, () => Effect.succeed(GraphQLFloat)),
    Match.when({ _tag: "BooleanKeyword" }, () => Effect.succeed(GraphQLBoolean)),
    Match.when({ _tag: "Refinement" }, (refinement) => {
      const annotations = AST.getAnnotation<{ title?: string }>(
        AST.TitleAnnotationId
      )(refinement)

      return pipe(
        annotations,
        Option.match({
          onSome: (ann) => {
            switch (ann.title) {
              case "AggregateId":
              case "EventId":
              case "CommandId":
                return Effect.succeed(GraphQLID)
              case "Email":
              case "Username":
                return Effect.succeed(GraphQLString)
              case "Timestamp":
                return Effect.succeed(GraphQLFloat)
              case "Version":
                return Effect.succeed(GraphQLInt)
              default:
                return schemaToGraphQLType(Schema.make(refinement.from), isInput, typeCache)
            }
          },
          onNone: () => schemaToGraphQLType(Schema.make(refinement.from), isInput, typeCache)
        })
      )
    }),
    Match.when({ _tag: "TypeLiteral" }, (literal) => {
      const title = pipe(
        AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(literal),
        Option.getOrElse(() => ({ title: isInput ? "InputObject" : "Object" }))
      ).title || (isInput ? "InputObject" : "Object")

      if (isInput) {
        return pipe(
          Effect.forEach(literal.propertySignatures, (prop) =>
            pipe(
              schemaToGraphQLType(Schema.make(prop.type), isInput, typeCache),
              Effect.map(fieldType => ({
                name: String(prop.name),
                type: prop.isOptional ? fieldType : new GraphQLNonNull(fieldType)
              }))
            )
          ),
          Effect.map(fields => {
            const fieldMap: GraphQLInputFieldConfigMap = {}
            fields.forEach(field => {
              fieldMap[field.name] = field.type
            })

            const type = new GraphQLInputObjectType({
              name: title,
              fields: () => fieldMap
            })

            typeCache.set(cacheKey, type)
            return type
          })
        )
      } else {
        return pipe(
          Effect.forEach(literal.propertySignatures, (prop) =>
            pipe(
              schemaToGraphQLType(Schema.make(prop.type), isInput, typeCache),
              Effect.map(fieldType => ({
                name: String(prop.name),
                config: {
                  type: prop.isOptional ? fieldType : new GraphQLNonNull(fieldType),
                  resolve: (source: any) => source[String(prop.name)]
                }
              }))
            )
          ),
          Effect.map(fields => {
            const fieldMap: GraphQLFieldConfigMap<any, any> = {}
            fields.forEach(field => {
              fieldMap[field.name] = field.config
            })

            const type = new GraphQLObjectType({
              name: title,
              fields: () => fieldMap
            })

            typeCache.set(cacheKey, type)
            return type
          })
        )
      }
    }),
    Match.when({ _tag: "TupleType" }, (tuple) => {
      if (tuple.elements.length === 0) {
        return Effect.succeed(new GraphQLList(GraphQLString))
      }

      return pipe(
        schemaToGraphQLType(
          Schema.make(tuple.elements[0]?.type || Schema.String.ast),
          isInput,
          typeCache
        ),
        Effect.map(elementType => new GraphQLList(elementType))
      )
    }),
    Match.when({ _tag: "Union" }, (union) => {
      return pipe(
        Effect.forEach(union.types, t =>
          schemaToGraphQLType(Schema.make(t), isInput, typeCache)
        ),
        Effect.map(types => {
          const title = pipe(
            AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(union),
            Option.getOrElse(() => ({ title: "Union" }))
          ).title || "Union"

          const type = new GraphQLUnionType({
            name: title,
            types,
            resolveType: (value) => value.__typename || types[0]?.name
          })

          typeCache.set(cacheKey, type)
          return type
        })
      )
    }),
    Match.when({ _tag: "Literal" }, (literal) => {
      const type = (() => {
        if (typeof literal.literal === "string") return GraphQLString
        if (typeof literal.literal === "number") return GraphQLFloat
        if (typeof literal.literal === "boolean") return GraphQLBoolean
        return GraphQLString
      })()

      return Effect.succeed(type)
    }),
    Match.when({ _tag: "Enums" }, (enums) => {
      const values: Record<string, { value: any }> = {}
      enums.enums.forEach(([enumName, enumValue]) => {
        values[enumName] = { value: enumValue }
      })

      const title = pipe(
        AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(enums),
        Option.getOrElse(() => ({ title: "Enum" }))
      ).title || "Enum"

      const type = new GraphQLEnumType({
        name: title,
        values
      })

      typeCache.set(cacheKey, type)
      return Effect.succeed(type)
    }),
    Match.orElse((ast) =>
      Effect.fail(new SchemaConversionError(
        `Unsupported AST type: ${ast._tag}`,
        ast
      ))
    )
  )(ast)
}

// ============================================================================
// Federation Directives
// ============================================================================

/**
 * Federation directive definitions
 */
export const FEDERATION_DIRECTIVES = `
  directive @key(fields: String!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE
  directive @extends on OBJECT | INTERFACE
  directive @external on OBJECT | FIELD_DEFINITION
  directive @requires(fields: String!) on FIELD_DEFINITION
  directive @provides(fields: String!) on FIELD_DEFINITION
  directive @shareable on OBJECT | FIELD_DEFINITION
  directive @tag(name: String!) repeatable on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
  directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
  directive @override(from: String!) on FIELD_DEFINITION
`

/**
 * Federation scalar types
 */
export const FEDERATION_SCALARS = `
  scalar _Any
  scalar _FieldSet
  
  type _Service {
    sdl: String
  }
  
  extend type Query {
    _entities(representations: [_Any!]!): [_Entity]!
    _service: _Service!
  }
  
  union _Entity
`

// ============================================================================
// Entity Resolver Builder
// ============================================================================

/**
 * Create federation entity resolver with improved error handling
 */
export const createEntityResolver = <
  SourceType extends Record<string, unknown> = Record<string, unknown>,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType extends SourceType = SourceType,
>(
  entity: FederationEntity<
    SourceType,
    ArgsType,
    ContextType,
    ResultType
  >
): GraphQLFieldConfig<
  ResultType,
  ContextType,
  ArgsType
> => {
  const fieldResolvers = pipe(
    ReadonlyArray.fromRecord(entity.fields),
    ReadonlyArray.map(([field, resolverFn]) => [
      field,
      (
        source: ResultType,
        args: ArgsType,
        context: ContextType,
        info: GraphQLResolveInfo
      ) => {
        const resolver = resolverFn
        if (!resolver) {
          return Effect.fail(new EntityResolverError(
            "NotFound",
            `Field ${field} not found`
          ))
        }

        return pipe(
          resolver(source, args, context, info),
          Effect.catchAll((error: unknown) => Effect.fail(error))
        )
      }
    ])
  )

  const resolveReference = (reference: SourceType) => {
    return pipe(
      entity.resolveReference(reference),
      Effect.map(result => ({
        ...result,
        __typename: entity.typename
      }))
    )
  }

  return {
    __typename: entity.typename,
    __resolveReference: resolveReference,
    ...Object.fromEntries(fieldResolvers)
  }
}

// ============================================================================
// Schema Generation
// ============================================================================

/**
 * Generate federated GraphQL schema with improved structure
 */
export const generateFederatedSchema = (
  config: DomainSchemaConfig
): Effect.Effect<string, SchemaConversionError> => {
  return Effect.succeed(() => {
    const parts: string[] = [
      FEDERATION_DIRECTIVES,
      FEDERATION_SCALARS
    ]

    // Add context type if provided
    if (config.context) {
      parts.push(generateContextType(config.context))
    }

    // Add command input types
    parts.push("# Commands")
    Object.entries(config.commands).forEach(([name, schema]) => {
      parts.push(generateInputType(name, schema))
    })

    // Add query input types
    parts.push("\n# Queries")
    Object.entries(config.queries).forEach(([name, schema]) => {
      parts.push(generateInputType(name, schema))
    })

    // Add event types
    parts.push("\n# Events")
    parts.push("interface DomainEvent {")
    parts.push("  type: String!")
    parts.push("  metadata: EventMetadata!")
    parts.push("}")

    Object.entries(config.events).forEach(([name, schema]) => {
      parts.push(generateEventType(name, schema))
    })

    // Add entities
    parts.push("\n# Entities")
    config.entities.forEach(entity => {
      parts.push(generateEntityType(entity))
    })

    // Update _Entity union
    if (config.entities.length > 0) {
      const entityNames = config.entities.map(e => e.typename).join(" | ")
      parts.push(`\nextend union _Entity = ${entityNames}`)
    }

    // Add root types
    parts.push("\n# Root Types")
    parts.push(generateRootTypes(config))

    return parts.join("\n")
  }).pipe(Effect.map(fn => fn()))
}

/**
 * Generate context type from schema
 */
const generateContextType = (schema: Schema.Schema.Any): string => {
  const ast = schema.ast

  if (ast._tag !== "TypeLiteral") {
    return `type Context { value: String! }`
  }

  const fields = ast.propertySignatures.map(prop => {
    const fieldName = String(prop.name)
    const fieldType = getGraphQLTypeString(prop.type)
    const isOptional = prop.isOptional

    return `  ${fieldName}: ${fieldType}${isOptional ? "" : "!"}`
  })

  return `type Context {\n${fields.join("\n")}\n}`
}

/**
 * Generate input type from schema
 */
const generateInputType = (name: string, schema: Schema.Schema.Any): string => {
  const ast = schema.ast

  if (ast._tag !== "TypeLiteral") {
    return `input ${name}Input { value: String! }`
  }

  const fields = ast.propertySignatures.map(prop => {
    const fieldName = String(prop.name)
    const fieldType = getGraphQLTypeString(prop.type, true)
    const isOptional = prop.isOptional

    return `  ${fieldName}: ${fieldType}${isOptional ? "" : "!"}`
  })

  return `input ${name}Input {\n${fields.join("\n")}\n}`
}

/**
 * Generate event type from schema
 */
const generateEventType = (name: string, schema: Schema.Schema.Any): string => {
  const ast = schema.ast

  if (ast._tag !== "TypeLiteral") {
    return `type ${name}Event implements DomainEvent {
  type: String!
  metadata: EventMetadata!
  data: String!
}`
  }

  const fields = ast.propertySignatures.map(prop => {
    const fieldName = String(prop.name)
    const fieldType = getGraphQLTypeString(prop.type)
    const isOptional = prop.isOptional

    return `  ${fieldName}: ${fieldType}${isOptional ? "" : "!"}`
  })

  return `type ${name}Event implements DomainEvent {
  type: String!
  metadata: EventMetadata!
${fields.join("\n")}
}`
}

/**
 * Generate entity type
 */
const generateEntityType = (entity: FederationEntity): string => {
  const ast = entity.schema.ast

  if (ast._tag !== "TypeLiteral") {
    return `type ${entity.typename} @key(fields: "${entity.key}") {
  ${entity.key}: ID!
}`
  }

  const fields = ast.propertySignatures.map(prop => {
    const fieldName = String(prop.name)
    const fieldType = getGraphQLTypeString(prop.type)
    const isOptional = prop.isOptional

    return `  ${fieldName}: ${fieldType}${isOptional ? "" : "!"}`
  })

  return `type ${entity.typename} @key(fields: "${entity.key}") {
${fields.join("\n")}
}`
}

/**
 * Get GraphQL type string from AST with improved error handling
 */
const getGraphQLTypeString = (ast: AST.AST, isInput: boolean = false): string => {
  return pipe(
    Match.type<AST.AST>(),
    Match.when({ _tag: "StringKeyword" }, () => "String"),
    Match.when({ _tag: "NumberKeyword" }, () => "Float"),
    Match.when({ _tag: "BooleanKeyword" }, () => "Boolean"),
    Match.when({ _tag: "Refinement" }, (refinement) => {
      const annotations = AST.getAnnotation<{ title?: string }>(
        AST.TitleAnnotationId
      )(refinement)

      return pipe(
        annotations,
        Option.match({
          onSome: (ann) => {
            switch (ann.title) {
              case "AggregateId":
              case "EventId":
              case "CommandId":
                return "ID"
              case "Email":
              case "Username":
                return "String"
              case "Timestamp":
                return "Float"
              case "Version":
                return "Int"
              default:
                return getGraphQLTypeString(refinement.from, isInput)
            }
          },
          onNone: () => getGraphQLTypeString(refinement.from, isInput)
        })
      )
    }),
    Match.when({ _tag: "TypeLiteral" }, (literal) => {
      const title = pipe(
        AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(literal),
        Option.getOrElse(() => ({ title: isInput ? "InputObject" : "Object" }))
      ).title || (isInput ? "InputObject" : "Object")

      return title
    }),
    Match.when({ _tag: "TupleType" }, (tuple) => {
      if (tuple.elements.length === 0) return "[String]"
      return `[${getGraphQLTypeString(tuple.elements[0]?.type || Schema.String.ast, isInput)}]`
    }),
    Match.when({ _tag: "Union" }, () => "String"), // Simplified for SDL generation
    Match.orElse(() => "String")
  )(ast)
}

/**
 * Generate root types
 */
const generateRootTypes = (config: DomainSchemaConfig): string => {
  const mutations = Object.keys(config.commands).map(
    name => `  ${name}(input: ${name}Input!): CommandResult!`
  )

  const queries = Object.keys(config.queries).map(
    name => `  ${name}(input: ${name}Input!): QueryResult!`
  )

  return `
type Query {
${queries.join("\n")}
}

type Mutation {
${mutations.join("\n")}
}

type CommandResult {
  success: Boolean!
  aggregateId: ID
  version: Int
  error: String
}

type QueryResult {
  data: String!
  metadata: QueryMetadata!
}

type EventMetadata {
  eventId: ID!
  aggregateId: ID!
  version: Int!
  timestamp: Float!
  correlationId: String!
  causationId: String!
  actor: String!
}

type QueryMetadata {
  timestamp: Float!
  executionTime: Float!
  cached: Boolean!
}
`
}

// ============================================================================
// Federation Resolver Builder
// ============================================================================

/**
 * Create federation resolvers for _entities and _service
 */
export const createFederationResolvers = <
  SourceType extends Record<string, unknown> = Record<string, unknown>,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType extends SourceType = SourceType,
>(
  entities: ReadonlyArray<FederationEntity<SourceType, ArgsType, ContextType, ResultType>>,
  schema: GraphQLSchema
) => {
  const entityResolvers = Object.fromEntries(
    entities.map(entity => [entity.typename, createEntityResolver(entity)])
  ) as Record<string, GraphQLFieldConfig<ResultType, ContextType, ArgsType>>

  return {
    _Entity: {
      __resolveType: (obj: unknown) => (obj as Record<string, unknown>).__typename as string
    },
    _Service: {
      sdl: () => printSchema(schema)
    },
    Query: {
      _entities: async (_: unknown, { representations }: { representations: unknown[] }) => {
        return representations.map(rep => {
          const resolver = entityResolvers[(rep as Record<string, unknown>).__typename as string]
          if (!resolver) return null

          return {
            ...(rep as Record<string, unknown>),
            __resolveReference: resolver.resolve
          }
        })
      },
      _service: () => ({})
    }
  }
}

/**
 * Build complete GraphQL schema with federation support
 */
export const buildFederatedSchema = <
  SourceType extends Record<string, unknown> = Record<string, unknown>,
  ArgsType = unknown,
  ContextType = unknown,
  ResultType extends SourceType = SourceType,
>(
  config: DomainSchemaConfig
): Effect.Effect<GraphQLSchema, SchemaConversionError> => {
  return pipe(
    generateFederatedSchema(config),
    Effect.map(schema => buildSchema(schema)),
    Effect.map(schema => addResolversToSchema({
      schema,
      resolvers: createFederationResolvers(config.entities as ReadonlyArray<FederationEntity<SourceType, ArgsType, ContextType, ResultType>>, schema)
    }))
  )
}