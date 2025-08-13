export const FEDERATION_DIRECTIVES = `
  scalar _Any
  scalar _FieldSet
  scalar link__Import
  scalar federation__Scope

  directive @key(fields: _FieldSet!, resolvable: Boolean = true) repeatable on OBJECT | INTERFACE
  directive @extends on OBJECT | INTERFACE
  directive @external(reason: String) on OBJECT | FIELD_DEFINITION
  directive @requires(fields: _FieldSet!) on FIELD_DEFINITION
  directive @provides(fields: _FieldSet!) on FIELD_DEFINITION
  directive @shareable repeatable on OBJECT | FIELD_DEFINITION
  directive @tag(name: String!) repeatable on FIELD_DEFINITION | INTERFACE | OBJECT | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION | SCHEMA
  directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION
  directive @override(from: String!) on FIELD_DEFINITION
  directive @composeDirective(name: String) repeatable on SCHEMA
  directive @interfaceObject on OBJECT
  directive @authenticated on FIELD_DEFINITION | OBJECT | INTERFACE | SCALAR | ENUM
  directive @requiresScopes(scopes: [[federation__Scope!]!]!) on FIELD_DEFINITION | OBJECT | INTERFACE | SCALAR | ENUM
  directive @policy(policies: [[String!]!]!) on FIELD_DEFINITION | OBJECT | INTERFACE | SCALAR | ENUM
  directive @link(url: String, as: String, for: link__Purpose, import: [link__Import]) repeatable on SCHEMA

  enum link__Purpose {
    SECURITY
    EXECUTION
  }
` as const

export const FEDERATION_BASE_SCHEMA = `
  type _Service {
    sdl: String
  }

  union _Entity

  type Query {
    _entities(representations: [_Any!]!): [_Entity]!
    _service: _Service!
  }
` as const

export const COMMON_SCALARS = `
  scalar DateTime
  scalar JSON
  scalar JSONObject
  scalar UUID
  scalar EmailAddress
  scalar URL
  scalar PhoneNumber
  scalar PostalCode
  scalar CountryCode
  scalar Currency
  scalar BigInt
  scalar Byte
  scalar Duration
  scalar IPv4
  scalar IPv6
  scalar MAC
  scalar ISBN
  scalar Port
  scalar RGB
  scalar RGBA
  scalar HSL
  scalar HSLA
  scalar HexColorCode
  scalar Latitude
  scalar Longitude
  
  # Common Input Types
  input OrderItemInput {
    productId: String!
    quantity: Int!
    price: Float!
  }
` as const

export const DOMAIN_EVENT_SCHEMA = `
  interface DomainEvent {
    type: String!
    metadata: EventMetadata!
  }

  type EventMetadata {
    eventId: ID!
    aggregateId: ID!
    version: Int!
    timestamp: Float!
    correlationId: String
    causationId: String
    actor: String
  }
` as const

export const COMMAND_RESULT_SCHEMA = `
  type CommandResult {
    success: Boolean!
    aggregateId: ID
    version: Int
    events: [DomainEvent!]
    error: CommandError
  }

  type CommandError {
    code: String!
    message: String!
    details: JSON
  }
` as const

export const QUERY_RESULT_SCHEMA = `
  type QueryResult {
    data: JSON!
    metadata: QueryMetadata!
  }

  type QueryMetadata {
    timestamp: Float!
    executionTime: Float!
    cached: Boolean!
    source: String
  }
` as const

export const ERROR_CODES = {
  ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  RESOLUTION_FAILED: "RESOLUTION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TIMEOUT: "TIMEOUT",
  RATE_LIMITED: "RATE_LIMITED",
} as const

export const DEFAULT_FEDERATION_VERSION = 2

export const DEFAULT_CACHE_TTL = 60 * 1000

export const DEFAULT_TIMEOUT = 30 * 1000

export const MAX_BATCH_SIZE = 100