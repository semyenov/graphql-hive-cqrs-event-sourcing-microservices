/**
 * Custom GraphQL Scalars
 * 
 * Collection of Effect Schema-based custom scalars for GraphQL
 */

export * from "./DateTime"
export * from "./JSON"
export * from "./Email"
export * from "./URL"
export * from "./UUID"

import { GraphQLDateTime } from "./DateTime"
import { GraphQLJSON } from "./JSON"
import { GraphQLEmail } from "./Email"
import { GraphQLURL } from "./URL"
import { GraphQLUUID } from "./UUID"

// ============================================================================
// Scalar Map for Schema Building
// ============================================================================

export const CustomScalars = {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
  Email: GraphQLEmail,
  URL: GraphQLURL,
  UUID: GraphQLUUID,
} as const

// ============================================================================
// Type Definitions for SDL
// ============================================================================

export const ScalarTypeDefinitions = `
  """ISO 8601 date-time string"""
  scalar DateTime
  
  """Arbitrary JSON value"""
  scalar JSON
  
  """RFC 5322 compliant email address"""
  scalar Email
  
  """RFC 3986 compliant URL"""
  scalar URL
  
  """RFC 4122 UUID"""
  scalar UUID
`