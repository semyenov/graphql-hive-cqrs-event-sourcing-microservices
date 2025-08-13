/**
 * JSON Scalar - Arbitrary JSON value
 * 
 * Effect Schema-based GraphQL scalar for JSON values
 */

import * as Schema from "@effect/schema/Schema"
import * as Either from "effect/Either"
import { GraphQLScalarType, GraphQLError, Kind } from "graphql"

// ============================================================================
// Schema Definition
// ============================================================================

export const JSONSchema = Schema.parseJson(Schema.Unknown).pipe(
  Schema.annotations({
    title: "JSON",
    description: "Arbitrary JSON value",
  })
)

export type JSON = Schema.Schema.Type<typeof JSONSchema>

// ============================================================================
// GraphQL Scalar
// ============================================================================

export const GraphQLJSON = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  
  serialize(value: unknown): any {
    // For output, just return the value as-is
    // GraphQL will handle JSON serialization
    return value
  },
  
  parseValue(value: unknown): any {
    // For input variables, validate it's valid JSON
    if (typeof value === 'string') {
      const result = Schema.decodeEither(JSONSchema)(value)
      if (Either.isLeft(result)) {
        throw new GraphQLError(
          `JSON cannot parse value: ${value}`
        )
      }
      return result.right
    }
    // If it's already an object/array, return as-is
    return value
  },
  
  parseLiteral(ast): any {
    switch (ast.kind) {
      case Kind.STRING:
        const result = Schema.decodeEither(JSONSchema)(ast.value)
        if (Either.isLeft(result)) {
          throw new GraphQLError(
            `JSON cannot parse literal: ${ast.value}`,
            { nodes: [ast] }
          )
        }
        return result.right
        
      case Kind.OBJECT:
        // Parse object literal
        const obj: Record<string, any> = {}
        ast.fields.forEach(field => {
          obj[field.name.value] = parseLiteralValue(field.value)
        })
        return obj
        
      case Kind.LIST:
        // Parse array literal
        return ast.values.map(parseLiteralValue)
        
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(ast.value)
        
      case Kind.BOOLEAN:
        return ast.value
        
      case Kind.NULL:
        return null
        
      default:
        throw new GraphQLError(
          `JSON cannot parse AST kind: ${ast.kind}`,
          { nodes: [ast] }
        )
    }
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

function parseLiteralValue(ast: any): any {
  switch (ast.kind) {
    case Kind.STRING:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value)
    case Kind.BOOLEAN:
      return ast.value
    case Kind.NULL:
      return null
    case Kind.OBJECT:
      const obj: Record<string, any> = {}
      ast.fields.forEach((field: any) => {
        obj[field.name.value] = parseLiteralValue(field.value)
      })
      return obj
    case Kind.LIST:
      return ast.values.map(parseLiteralValue)
    default:
      throw new GraphQLError(
        `Cannot parse value of kind: ${ast.kind}`,
        { nodes: [ast] }
      )
  }
}

export const parseJSON = (value: string) =>
  Schema.decodeEither(JSONSchema)(value)

export const validateJSON = (value: string) =>
  Schema.decode(JSONSchema)(value)