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
import { pipe } from "effect/Function"
import { match, P } from "ts-pattern"
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
  Kind
} from "graphql"

// ============================================================================
// Schema to GraphQL Type Conversion
// ============================================================================

/**
 * Convert Effect Schema to GraphQL Type
 */
export const schemaToGraphQLType = (schema: Schema.Schema.Any): any => {
  const ast = schema.ast
  
  return match(ast)
    // Literals
    .with({ _tag: "StringKeyword" }, () => GraphQLString)
    .with({ _tag: "NumberKeyword" }, () => GraphQLFloat)
    .with({ _tag: "BooleanKeyword" }, () => GraphQLBoolean)
    
    // Branded types
    .with(
      { _tag: "Refinement" },
      (refinement) => {
        const annotations = AST.getAnnotation<{ title?: string }>(
          AST.TitleAnnotationId
        )(refinement)
        
        return match(annotations)
          .with(Option.some({ title: "AggregateId" }), () => GraphQLID)
          .with(Option.some({ title: "EventId" }), () => GraphQLID)
          .with(Option.some({ title: "CommandId" }), () => GraphQLID)
          .with(Option.some({ title: "Email" }), () => GraphQLString)
          .with(Option.some({ title: "Username" }), () => GraphQLString)
          .with(Option.some({ title: "Timestamp" }), () => GraphQLFloat)
          .with(Option.some({ title: "Version" }), () => GraphQLInt)
          .otherwise(() => schemaToGraphQLType(Schema.make(refinement.from)))
      }
    )
    
    // Structs (Objects)
    .with({ _tag: "TypeLiteral" }, (literal) => {
      const fields: any = {}
      
      literal.propertySignatures.forEach((prop) => {
        const name = String(prop.name)
        const isOptional = prop.isOptional
        const fieldType = schemaToGraphQLType(Schema.make(prop.type))
        
        fields[name] = {
          type: isOptional ? fieldType : new GraphQLNonNull(fieldType)
        }
      })
      
      const title = pipe(
        AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(literal),
        Option.getOrElse(() => ({ title: "Object" }))
      ).title
      
      return new GraphQLObjectType({
        name: title,
        fields
      })
    })
    
    // Arrays
    .with({ _tag: "TupleType" }, (tuple) => {
      if (tuple.elements.length === 0) {
        return new GraphQLList(GraphQLString)
      }
      const elementType = schemaToGraphQLType(Schema.make(tuple.elements[0].type))
      return new GraphQLList(elementType)
    })
    
    // Unions
    .with({ _tag: "Union" }, (union) => {
      const types = union.types.map(t => schemaToGraphQLType(Schema.make(t)))
      
      const title = pipe(
        AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(union),
        Option.getOrElse(() => ({ title: "Union" }))
      ).title
      
      return new GraphQLUnionType({
        name: title,
        types,
        resolveType: (value) => {
          // Would need runtime type resolution
          return types[0]
        }
      })
    })
    
    // Enums (Literals)
    .with({ _tag: "Literal" }, (literal) => {
      if (typeof literal.literal === "string") {
        return GraphQLString
      } else if (typeof literal.literal === "number") {
        return GraphQLFloat
      } else if (typeof literal.literal === "boolean") {
        return GraphQLBoolean
      }
      return GraphQLString
    })
    
    .otherwise(() => GraphQLString)
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
 * Federation entity configuration
 */
export interface FederationEntity<T> {
  readonly typename: string
  readonly key: string
  readonly schema: Schema.Schema<T, unknown>
  readonly resolveReference: (
    reference: any
  ) => Effect.Effect<T, EntityResolverError>
  readonly fields?: Record<string, FieldResolver<T, any>>
}

export class EntityResolverError {
  readonly _tag = "EntityResolverError"
  constructor(
    readonly reason: "NotFound" | "InvalidReference" | "ResolutionFailed",
    readonly message: string,
    readonly details?: unknown
  ) {}
}

export type FieldResolver<Source, Result> = (
  source: Source,
  args: any,
  context: any,
  info: GraphQLResolveInfo
) => Effect.Effect<Result, any> | Result

/**
 * Create federation entity resolver
 */
export const createEntityResolver = <T>(
  entity: FederationEntity<T>
) => ({
  __typename: entity.typename,
  __resolveReference: (reference: any, context: any) =>
    pipe(
      entity.resolveReference(reference),
      Effect.map(result => ({
        ...result,
        __typename: entity.typename
      })),
      Effect.runPromise
    ),
  ...Object.fromEntries(
    Object.entries(entity.fields || {}).map(([field, resolver]) => [
      field,
      (source: T, args: any, context: any, info: GraphQLResolveInfo) => {
        const result = resolver(source, args, context, info)
        return Effect.isEffect(result)
          ? Effect.runPromise(result)
          : result
      }
    ])
  )
})

// ============================================================================
// Schema Generation
// ============================================================================

/**
 * Generate GraphQL schema from domain schemas
 */
export interface DomainSchemaConfig {
  readonly commands: Record<string, Schema.Schema.Any>
  readonly queries: Record<string, Schema.Schema.Any>
  readonly events: Record<string, Schema.Schema.Any>
  readonly entities: ReadonlyArray<FederationEntity<any>>
}

/**
 * Generate federated GraphQL schema
 */
export const generateFederatedSchema = (
  config: DomainSchemaConfig
): string => {
  const parts: string[] = [
    FEDERATION_DIRECTIVES,
    FEDERATION_SCALARS
  ]
  
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
    const fieldType = getGraphQLTypeString(prop.type)
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
const generateEntityType = <T>(entity: FederationEntity<T>): string => {
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
 * Get GraphQL type string from AST
 */
const getGraphQLTypeString = (ast: AST.AST): string => {
  return match(ast)
    .with({ _tag: "StringKeyword" }, () => "String")
    .with({ _tag: "NumberKeyword" }, () => "Float")
    .with({ _tag: "BooleanKeyword" }, () => "Boolean")
    .with({ _tag: "Refinement" }, (refinement) => {
      const annotations = AST.getAnnotation<{ title?: string }>(
        AST.TitleAnnotationId
      )(refinement)
      
      return match(annotations)
        .with(Option.some({ title: P.string }), ({ title }) => {
          if (title.includes("Id")) return "ID"
          if (title === "Timestamp") return "Float"
          if (title === "Version") return "Int"
          return "String"
        })
        .otherwise(() => getGraphQLTypeString(refinement.from))
    })
    .with({ _tag: "TypeLiteral" }, () => "Object")
    .with({ _tag: "TupleType" }, (tuple) => {
      if (tuple.elements.length === 0) return "[String]"
      return `[${getGraphQLTypeString(tuple.elements[0].type)}]`
    })
    .with({ _tag: "Union" }, () => "String")
    .otherwise(() => "String")
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