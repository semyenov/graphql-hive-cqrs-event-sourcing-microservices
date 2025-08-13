/**
 * DateTime Scalar - ISO 8601 date-time string
 * 
 * Effect Schema-based GraphQL scalar for date-time values
 */

import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { GraphQLScalarType, GraphQLError, Kind } from "graphql"

// ============================================================================
// Schema Definition
// ============================================================================

// Simple string schema with ISO 8601 validation
export const DateTimeSchema = Schema.String.pipe(
  Schema.filter((s) => {
    const date = new Date(s)
    return !isNaN(date.getTime())
  }, {
    message: () => "Invalid ISO 8601 date-time string"
  }),
  Schema.annotations({
    title: "DateTime",
    description: "ISO 8601 date-time string",
  })
)

export type DateTime = Schema.Schema.Type<typeof DateTimeSchema>

// ============================================================================
// GraphQL Scalar
// ============================================================================

export const GraphQLDateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO 8601 date-time string",
  
  serialize(value: unknown): string {
    // Handle Date objects and strings
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (typeof value === 'string') {
      // Validate it's a valid date string
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        throw new GraphQLError(
          `DateTime cannot serialize value: ${JSON.stringify(value)}`
        )
      }
      return date.toISOString()
    }
    throw new GraphQLError(
      `DateTime cannot serialize value: ${JSON.stringify(value)}`
    )
  },
  
  parseValue(value: unknown): Date {
    if (typeof value !== 'string') {
      throw new GraphQLError(
        `DateTime cannot parse non-string value: ${JSON.stringify(value)}`
      )
    }
    
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      throw new GraphQLError(
        `DateTime cannot parse value: ${JSON.stringify(value)}`
      )
    }
    
    return date
  },
  
  parseLiteral(ast: any): Date {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `DateTime cannot parse non-string AST: ${ast.kind}`,
        { nodes: [ast] }
      )
    }
    
    const date = new Date(ast.value)
    if (isNaN(date.getTime())) {
      throw new GraphQLError(
        `DateTime cannot parse literal: ${ast.value}`,
        { nodes: [ast] }
      )
    }
    
    return date
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

export const parseDateTime = (value: string) => {
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return Either.left(new Error(`Invalid date: ${value}`))
  }
  return Either.right(date)
}

export const serializeDateTime = (date: Date) =>
  Either.right(date.toISOString())

export const validateDateTime = (value: string) =>
  Effect.gen(function* () {
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      return yield* Effect.fail(new Error(`Invalid date: ${value}`))
    }
    return date
  })