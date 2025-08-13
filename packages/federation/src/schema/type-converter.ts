/**
 * Type Converter - Effect Schema to GraphQL Type conversion
 * 
 * Utilities for converting Effect Schemas to GraphQL types
 */

import * as Schema from "@effect/schema/Schema"
import * as AST from "@effect/schema/AST"
import {
  GraphQLType,
  GraphQLOutputType,
  GraphQLObjectType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLEnumType,
} from "graphql"
import { CustomScalars } from "./scalars"

// ============================================================================
// Type Conversion Cache
// ============================================================================

const typeCache = new Map<AST.AST, GraphQLType>()

// ============================================================================
// Main Converter
// ============================================================================

export function schemaToGraphQLType(schema: Schema.Schema.Any): GraphQLType {
  const ast = schema.ast
  
  // Check cache
  if (typeCache.has(ast)) {
    return typeCache.get(ast)!
  }
  
  const type = convertAST(ast)
  typeCache.set(ast, type)
  return type
}

// ============================================================================
// AST Conversion
// ============================================================================

function convertAST(ast: AST.AST): GraphQLType {
  switch (ast._tag) {
    case "StringKeyword":
      return GraphQLString
      
    case "NumberKeyword":
      return GraphQLFloat
      
    case "BooleanKeyword":
      return GraphQLBoolean
      
    case "Literal":
      return convertLiteral(ast)
      
    case "Union":
      return convertUnion(ast)
      
    case "Refinement":
      return handleRefinement(ast)
      
    case "Transformation":
      return convertAST(ast.from)
      
    case "Declaration":
      return handleDeclaration(ast)
      
    case "TupleType":
      return convertTuple(ast)
      
    case "TypeLiteral":
      return convertTypeLiteral(ast)
      
    case "Suspend":
      return convertAST(ast.f())
      
    default:
      // Fallback to string for unknown types
      return GraphQLString
  }
}

// ============================================================================
// Specific Converters
// ============================================================================

function convertLiteral(ast: AST.Literal): GraphQLType {
  const value = ast.literal
  
  if (typeof value === "string") {
    return GraphQLString
  } else if (typeof value === "number") {
    return Number.isInteger(value) ? GraphQLInt : GraphQLFloat
  } else if (typeof value === "boolean") {
    return GraphQLBoolean
  }
  
  return GraphQLString
}

function convertUnion(ast: AST.Union): GraphQLType {
  const types = ast.types.map(convertAST)
  
  // If all types are the same, return that type
  if (types.every(t => t === types[0])) {
    return types[0]
  }
  
  // Check if it's an enum (all literals)
  const isEnum = ast.types.every(t => t._tag === "Literal")
  if (isEnum) {
    const values: Record<string, any> = {}
    ast.types.forEach((t) => {
      if (t._tag === "Literal") {
        const literal = t as AST.Literal
        const key = String(literal.literal).toUpperCase().replace(/[^A-Z0-9_]/g, "_")
        values[key] = { value: literal.literal }
      }
    })
    
    return new GraphQLEnumType({
      name: `GeneratedEnum_${Date.now()}`,
      values
    })
  }
  
  // For other unions, we'll need to create a GraphQL union type
  // This requires object types, so fallback to string for now
  return GraphQLString
}

function convertTuple(ast: AST.TupleType): GraphQLType {
  // Tuples become lists of the first element type
  if (ast.elements.length > 0 && ast.elements[0]) {
    const firstElement = ast.elements[0] as any
    const elementType = firstElement.type 
      ? convertAST(firstElement.type)
      : GraphQLString
    return new GraphQLList(elementType)
  }
  return new GraphQLList(GraphQLString)
}

function convertTypeLiteral(ast: AST.TypeLiteral): GraphQLType {
  const fields: GraphQLFieldConfigMap<any, any> = {}
  
  ast.propertySignatures.forEach(prop => {
    const fieldName = typeof prop.name === "string" ? prop.name : String(prop.name)
    const fieldType = convertAST(prop.type) as GraphQLOutputType
    
    fields[fieldName] = {
      type: prop.isOptional ? fieldType : new GraphQLNonNull(fieldType),
      description: prop.annotations ? getAnnotation(prop as any, "description") : undefined
    }
  })
  
  // Generate unique name for the object type
  const typeName = getAnnotation(ast, "title") || `GeneratedType_${Date.now()}`
  
  return new GraphQLObjectType({
    name: typeName,
    description: getAnnotation(ast, "description"),
    fields
  })
}

function handleRefinement(ast: AST.Refinement): GraphQLType {
  // Check for common refinements that map to GraphQL scalars
  const annotations = ast.annotations
  
  // Check for custom scalar annotations
  if (annotations) {
    const title = getAnnotation(ast, "title")
    if (title && title in CustomScalars) {
      return CustomScalars[title as keyof typeof CustomScalars]
    }
  }
  
  // Check for ID refinement
  if (getAnnotation(ast, "identifier") === "ID") {
    return GraphQLID
  }
  
  // Default to the underlying type
  return convertAST(ast.from)
}

function handleDeclaration(ast: AST.Declaration): GraphQLType {
  const title = getAnnotation(ast, "title")
  
  // Check for DateTime
  if (title === "DateTime") {
    return CustomScalars.DateTime
  }
  
  // Check for UUID
  if (title === "UUID") {
    return CustomScalars.UUID
  }
  
  // Check for other custom scalars
  if (title && title in CustomScalars) {
    return CustomScalars[title as keyof typeof CustomScalars]
  }
  
  // Fallback to string
  return GraphQLString
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAnnotation(ast: AST.AST, key: string): string | undefined {
  const annotations = ast.annotations
  if (!annotations) return undefined
  
  const value = annotations[Symbol.for(`@effect/schema/annotation/${key}`)]
  return value ? String(value) : undefined
}

export function isNullable(ast: AST.AST): boolean {
  if (ast._tag === "Union") {
    return ast.types.some(t => 
      t._tag === "UndefinedKeyword"
    )
  }
  return false
}

export function makeNullable(type: GraphQLType): GraphQLType {
  if (type instanceof GraphQLNonNull) {
    return type.ofType
  }
  return type
}

export function makeNonNull(type: GraphQLType): GraphQLType {
  if (type instanceof GraphQLNonNull) {
    return type
  }
  return new GraphQLNonNull(type)
}

// ============================================================================
// Schema to Field Config
// ============================================================================

export function schemaToFieldConfig(
  schema: Schema.Schema.Any,
  options?: {
    description?: string
    deprecationReason?: string
    resolve?: any
  }
): GraphQLFieldConfig<any, any> {
  const type = schemaToGraphQLType(schema) as GraphQLOutputType
  
  return {
    type,
    description: options?.description || getAnnotation(schema.ast, "description"),
    deprecationReason: options?.deprecationReason,
    resolve: options?.resolve
  }
}

// ============================================================================
// Clear Cache
// ============================================================================

export function clearTypeCache(): void {
  typeCache.clear()
}