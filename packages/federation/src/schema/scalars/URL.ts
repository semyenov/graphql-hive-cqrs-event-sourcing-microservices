/**
 * URL Scalar - RFC 3986 compliant URL
 * 
 * Effect Schema-based GraphQL scalar for URL validation
 */

import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { GraphQLScalarType, GraphQLError, Kind } from "graphql"

// ============================================================================
// Schema Definition
// ============================================================================

export const URLSchema = Schema.String.pipe(
  Schema.filter((s) => {
    try {
      new URL(s)
      return true
    } catch {
      return false
    }
  }, {
    message: () => "Invalid URL format"
  }),
  Schema.annotations({
    title: "URL",
    description: "RFC 3986 compliant URL",
    examples: ["https://example.com", "https://api.example.com/v1/resource"]
  })
)

export type URL = Schema.Schema.Type<typeof URLSchema>

// ============================================================================
// GraphQL Scalar
// ============================================================================

export const GraphQLURL = new GraphQLScalarType({
  name: "URL",
  description: "RFC 3986 compliant URL",
  
  serialize(value: unknown): string {
    const result = Schema.encodeEither(URLSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `URL cannot serialize value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseValue(value: unknown): string {
    const result = Schema.decodeEither(URLSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `URL cannot parse value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseLiteral(ast: any): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `URL cannot parse non-string AST: ${ast.kind}`,
        { nodes: [ast] }
      )
    }
    
    const result = Schema.decodeEither(URLSchema)(ast.value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `URL cannot parse literal: ${ast.value}`,
        { nodes: [ast] }
      )
    }
    
    return result.right
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

export const parseURL = (value: string) =>
  Schema.decodeEither(URLSchema)(value)

export const validateURL = (value: string) =>
  Effect.gen(function* () {
    const parsed = yield* Schema.decode(URLSchema)(value)
    return parsed
  })

export const normalizeURL = (url: string): string => {
  try {
    const parsed = new URL(url)
    // Normalize by reconstructing
    return parsed.toString()
  } catch {
    return url
  }
}

export const isValidURL = (value: string): boolean => {
  const result = Schema.decodeEither(URLSchema)(value)
  return Either.isRight(result)
}

export const getURLDomain = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}