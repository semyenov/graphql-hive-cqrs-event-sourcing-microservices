/**
 * Email Scalar - RFC 5322 compliant email address
 * 
 * Effect Schema-based GraphQL scalar for email validation
 */

import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import { GraphQLScalarType, GraphQLError, Kind } from "graphql"
import { pipe } from "effect/Function"

// ============================================================================
// Schema Definition
// ============================================================================

const EmailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export const EmailSchema = pipe(
  Schema.String,
  Schema.pattern(EmailRegex),
  Schema.annotations({
    title: "Email",
    description: "RFC 5322 compliant email address",
    examples: ["user@example.com", "admin@domain.org"]
  })
)

export type Email = Schema.Schema.Type<typeof EmailSchema>

// ============================================================================
// GraphQL Scalar
// ============================================================================

export const GraphQLEmail = new GraphQLScalarType({
  name: "Email",
  description: "RFC 5322 compliant email address",
  
  serialize(value: unknown): string {
    const result = Schema.encodeEither(EmailSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `Email cannot serialize value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseValue(value: unknown): string {
    const result = Schema.decodeEither(EmailSchema)(value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `Email cannot parse value: ${JSON.stringify(value)}`
      )
    }
    
    return result.right
  },
  
  parseLiteral(ast): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `Email cannot parse non-string AST: ${ast.kind}`,
        { nodes: [ast] }
      )
    }
    
    const result = Schema.decodeEither(EmailSchema)(ast.value as string)
    
    if (Either.isLeft(result)) {
      throw new GraphQLError(
        `Email cannot parse literal: ${ast.value}`,
        { nodes: [ast] }
      )
    }
    
    return result.right
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

export const parseEmail = (value: string) =>
  Schema.decodeEither(EmailSchema)(value)

export const validateEmail = (value: string) =>
  Effect.gen(function* () {
    const parsed = yield* Schema.decode(EmailSchema)(value as string)
    return parsed
  })

export const normalizeEmail = (email: string): string => {
  // Basic normalization: lowercase and trim
  return email.toLowerCase().trim()
}

export const isValidEmail = (value: string): boolean => {
  const result = Schema.decodeEither(EmailSchema)(value)
  return Either.isRight(result)
}