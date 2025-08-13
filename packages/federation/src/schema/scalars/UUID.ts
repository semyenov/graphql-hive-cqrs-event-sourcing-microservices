/**
 * UUID Scalar - RFC 4122 UUID
 * 
 * Effect Schema-based GraphQL scalar for UUID validation
 */

import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { GraphQLScalarType, GraphQLError, Kind } from "graphql"
import { pipe } from "effect/Function"

// ============================================================================
// Schema Definition
// ============================================================================

export const UUIDSchema = pipe(
  Schema.UUID,
  Schema.annotations({
    title: "UUID",
    description: "RFC 4122 UUID",
    examples: [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    ]
  })
)

export type UUID = Schema.Schema.Type<typeof UUIDSchema>

// ============================================================================
// GraphQL Scalar
// ============================================================================

export const GraphQLUUID = new GraphQLScalarType({
  name: "UUID",
  description: "RFC 4122 UUID",
  
  serialize(value: unknown): string {
    const result = Schema.encodeEither(UUIDSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `UUID cannot serialize value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseValue(value: unknown): string {
    const result = Schema.decodeEither(UUIDSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `UUID cannot parse value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseLiteral(ast: any): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `UUID cannot parse non-string AST: ${ast.kind}`,
        { nodes: [ast] }
      )
    }
    
    const result = Schema.decodeEither(UUIDSchema)(ast.value)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `UUID cannot parse literal: ${ast.value}`,
        { nodes: [ast] }
      )
    }
    
    return result.right
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

export const parseUUID = (value: string) =>
  Schema.decodeEither(UUIDSchema)(value)

export const validateUUID = (value: string) =>
  Effect.gen(function* () {
    const parsed = yield* Schema.decode(UUIDSchema)(value)
    return parsed
  })

export const isValidUUID = (value: string): boolean => {
  const result = Schema.decodeEither(UUIDSchema)(value)
  return Either.isRight(result)
}

// Generate a new UUID v4 (requires crypto API)
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback for environments without crypto.randomUUID
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
  return `${s4()}${s4()}-${s4()}-4${s4().substring(1)}-${((parseInt(s4(), 16) & 0x3) | 0x8).toString(16)}${s4().substring(1)}-${s4()}${s4()}${s4()}`
}