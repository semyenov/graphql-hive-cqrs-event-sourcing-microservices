import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as AST from "@effect/schema/AST"
import * as Option from "effect/Option"
import { pipe } from "effect/Function"
import {
  GraphQLString,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLFieldConfig,
} from "graphql"
import { SchemaConversionError } from "../errors"
import type { TypeConversionContext } from "../types"

const MAX_RECURSION_DEPTH = 10

export const createConversionContext = (
  isInput: boolean = false,
  scalars?: Record<string, any>
): TypeConversionContext => ({
  cache: new Map(),
  isInput,
  scalars,
  depth: 0,
  maxDepth: MAX_RECURSION_DEPTH,
})

export const schemaToGraphQLType = (
  schema: Schema.Schema.Any,
  context: TypeConversionContext = createConversionContext()
): Effect.Effect<GraphQLOutputType | GraphQLInputType, SchemaConversionError> => {
  if (context.depth > context.maxDepth) {
    return Effect.fail(
      new SchemaConversionError({
        schemaType: "Unknown",
        astType: schema.ast._tag,
        reason: `Maximum recursion depth (${context.maxDepth}) exceeded`,
      })
    )
  }

  const ast = schema.ast
  const cacheKey = generateCacheKey(ast, context.isInput)

  if (context.cache.has(cacheKey)) {
    return Effect.succeed(context.cache.get(cacheKey))
  }

  const nextContext: TypeConversionContext = {
    ...context,
    depth: context.depth + 1,
  }

  return pipe(
    convertAST(ast, nextContext),
    Effect.tap((type) => Effect.sync(() => context.cache.set(cacheKey, type)))
  )
}

const generateCacheKey = (ast: AST.AST, isInput: boolean): string => {
  const baseKey = ast._tag
  const suffix = isInput ? "-input" : "-output"
  
  if ("annotations" in ast) {
    const title = AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(ast)
    if (Option.isSome(title)) {
      return `${title.value.title}${suffix}`
    }
  }
  
  return `${baseKey}${suffix}`
}

const convertAST = (
  ast: AST.AST,
  context: TypeConversionContext
): Effect.Effect<GraphQLOutputType | GraphQLInputType, SchemaConversionError> => {
  switch (ast._tag) {
    case "StringKeyword":
      return Effect.succeed(GraphQLString)
    
    case "NumberKeyword":
      return Effect.succeed(GraphQLFloat)
    
    case "BooleanKeyword":
      return Effect.succeed(GraphQLBoolean)
    
    case "Literal":
      return convertLiteral(ast, context)
    
    case "Refinement":
      return convertRefinement(ast, context)
    
    case "TypeLiteral":
      return convertTypeLiteral(ast, context)
    
    case "Union":
      return convertUnion(ast, context)
    
    case "Enums":
      return convertEnums(ast, context)
    
    case "TupleType":
      return convertTuple(ast, context)
    
    case "Declaration":
      return convertDeclaration(ast, context)
    
    case "Transformation":
      return schemaToGraphQLType(Schema.make(ast.from), context)
    
    default:
      return Effect.fail(
        new SchemaConversionError({
          schemaType: "Unknown",
          astType: ast._tag,
          reason: `Unsupported AST type: ${ast._tag}`,
        })
      )
  }
}

const convertLiteral = (
  ast: AST.Literal,
  _context: TypeConversionContext
): Effect.Effect<GraphQLOutputType | GraphQLInputType, SchemaConversionError> => {
  const literal = ast.literal
  
  if (typeof literal === "string") return Effect.succeed(GraphQLString)
  if (typeof literal === "number") return Effect.succeed(GraphQLFloat)
  if (typeof literal === "boolean") return Effect.succeed(GraphQLBoolean)
  
  return Effect.succeed(GraphQLString)
}

const convertRefinement = (
  ast: AST.Refinement,
  context: TypeConversionContext
): Effect.Effect<GraphQLOutputType | GraphQLInputType, SchemaConversionError> => {
  const annotations = AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(ast)
  
  if (Option.isSome(annotations)) {
    const title = annotations.value.title
    
    const brandedTypeMap: Record<string, GraphQLOutputType | GraphQLInputType> = {
      AggregateId: GraphQLID,
      EventId: GraphQLID,
      CommandId: GraphQLID,
      QueryId: GraphQLID,
      UserId: GraphQLID,
      ProductId: GraphQLID,
      OrderId: GraphQLID,
      Email: GraphQLString,
      Username: GraphQLString,
      Timestamp: GraphQLFloat,
      Version: GraphQLInt,
      Money: GraphQLFloat,
    }
    
    if (title && title in brandedTypeMap) {
      return Effect.succeed(brandedTypeMap[title])
    }
  }
  
  return schemaToGraphQLType(Schema.make(ast.from), context)
}

const convertTypeLiteral = (
  ast: AST.TypeLiteral,
  context: TypeConversionContext
): Effect.Effect<GraphQLObjectType | GraphQLInputObjectType, SchemaConversionError> => {
  const title = getTypeTitle(ast, context.isInput)
  
  if (context.isInput) {
    return createInputObjectType(ast, title, context)
  } else {
    return createObjectType(ast, title, context)
  }
}

const getTypeTitle = (ast: AST.AST, isInput: boolean): string => {
  const annotations = AST.getAnnotation<{ title?: string }>(AST.TitleAnnotationId)(ast)
  
  if (Option.isSome(annotations) && annotations.value.title) {
    return annotations.value.title
  }
  
  return isInput ? "InputObject" : "Object"
}

const createInputObjectType = (
  ast: AST.TypeLiteral,
  name: string,
  context: TypeConversionContext
): Effect.Effect<GraphQLInputObjectType, SchemaConversionError> => {
  return pipe(
    Effect.forEach(ast.propertySignatures, (prop) =>
      pipe(
        schemaToGraphQLType(Schema.make(prop.type), context),
        Effect.map((fieldType) => ({
          name: String(prop.name),
          type: prop.isOptional ? fieldType : new GraphQLNonNull(fieldType),
        }))
      )
    ),
    Effect.map((fields) => {
      const fieldMap: GraphQLInputFieldConfigMap = {}
      fields.forEach((field) => {
        fieldMap[field.name] = { type: field.type as GraphQLInputType }
      })
      
      return new GraphQLInputObjectType({
        name,
        fields: () => fieldMap,
      })
    })
  )
}

const createObjectType = (
  ast: AST.TypeLiteral,
  name: string,
  context: TypeConversionContext
): Effect.Effect<GraphQLObjectType, SchemaConversionError> => {
  return pipe(
    Effect.forEach(ast.propertySignatures, (prop) =>
      pipe(
        schemaToGraphQLType(Schema.make(prop.type), context),
        Effect.map((fieldType) => ({
          name: String(prop.name),
          config: {
            type: prop.isOptional ? fieldType : new GraphQLNonNull(fieldType),
            resolve: (source: unknown) => (source as Record<string, unknown>)[String(prop.name)],
          },
        }))
      )
    ),
    Effect.map((fields) => {
      const fieldMap: GraphQLFieldConfigMap<unknown, unknown> = {}
      fields.forEach((field) => {
        fieldMap[field.name] = field.config as GraphQLFieldConfig<unknown, unknown, unknown>
      })
      
      return new GraphQLObjectType({
        name,
        fields: () => fieldMap,
      })
    })
  )
}

const convertUnion = (
  ast: AST.Union,
  context: TypeConversionContext
): Effect.Effect<GraphQLUnionType, SchemaConversionError> => {
  if (context.isInput) {
    return Effect.fail(
      new SchemaConversionError({
        schemaType: "Union",
        astType: ast._tag,
        reason: "Unions cannot be used as input types in GraphQL",
      })
    )
  }
  
  const title = getTypeTitle(ast, false)
  
  return pipe(
    Effect.forEach(ast.types, (t) => schemaToGraphQLType(Schema.make(t), context)),
    Effect.map((types) => {
      const objectTypes = types.filter(
        (t): t is GraphQLObjectType => t instanceof GraphQLObjectType
      )
      
      if (objectTypes.length === 0) {
        throw new Error("Union must contain at least one object type")
      }
      
      return new GraphQLUnionType({
        name: title,
        types: objectTypes,
        resolveType: (value: unknown) => (value as { __typename?: string }).__typename || objectTypes[0]?.name,
      })
    })
  )
}

const convertEnums = (
  ast: AST.Enums,
  _context: TypeConversionContext
): Effect.Effect<GraphQLEnumType, SchemaConversionError> => {
  const title = getTypeTitle(ast, false)
  const values: Record<string, { value: unknown }> = {}
  
  ast.enums.forEach(([enumName, enumValue]) => {
    values[String(enumName)] = { value: enumValue }
  })
  
  return Effect.succeed(
    new GraphQLEnumType({
      name: title,
      values,
    })
  )
}

const convertTuple = (
  ast: AST.TupleType,
  context: TypeConversionContext
): Effect.Effect<GraphQLList<any>, SchemaConversionError> => {
  if (ast.elements.length === 0) {
    return Effect.succeed(new GraphQLList(GraphQLString))
  }
  
  return pipe(
    schemaToGraphQLType(
      Schema.make(ast.elements[0]?.type || AST.stringKeyword),
      context
    ),
    Effect.map((elementType) => new GraphQLList(elementType))
  )
}

const convertDeclaration = (
  _ast: AST.Declaration,
  _context: TypeConversionContext
): Effect.Effect<GraphQLOutputType | GraphQLInputType, SchemaConversionError> => {
  return Effect.succeed(GraphQLString)
}