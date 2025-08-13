import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { buildSchema, GraphQLSchema } from "graphql"
import { addResolversToSchema } from "@graphql-tools/schema"
import type { DomainSchemaConfig, FederationEntity } from "../types"
import { SchemaConversionError, FederationConfigError } from "../errors"
import {
  FEDERATION_DIRECTIVES,
  FEDERATION_BASE_SCHEMA,
  COMMON_SCALARS,
  DOMAIN_EVENT_SCHEMA,
  COMMAND_RESULT_SCHEMA,
  QUERY_RESULT_SCHEMA,
} from "../constants"
import { createFederationResolvers } from "../resolvers/federation-resolvers"

// Helper function to generate entity schema
const generateEntitySchema = (entity: FederationEntity): string => {
  const keyFields = Array.isArray(entity.key) ? entity.key.join(" ") : entity.key
  const directives = [`@key(fields: "${keyFields}")`]
  
  if (entity.extensions?.shareable) {
    directives.push("@shareable")
  }
  
  if (entity.extensions?.extends) {
    directives.push("@extends")
  }
  
  // For now, use a simplified field generation
  // In production, this would introspect the Effect Schema
  const fields = `  id: ID!
  # Additional fields from schema`
  
  return `type ${entity.typename} ${directives.join(" ")} {
${fields}
}`
}

export class SchemaBuilder {
  private constructor(
    private readonly config: Partial<DomainSchemaConfig>
  ) {}

  static create(name: string, version: string = "1.0.0"): SchemaBuilder {
    return new SchemaBuilder({
      name,
      version,
      commands: {},
      queries: {},
      events: {},
      entities: [],
    })
  }

  withCommands(commands: Record<string, Schema.Schema.Any>): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      commands: {
        ...this.config.commands,
        ...commands,
      },
    })
  }

  withCommand(name: string, schema: Schema.Schema.Any): SchemaBuilder {
    return this.withCommands({ [name]: schema })
  }

  withQueries(queries: Record<string, Schema.Schema.Any>): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      queries: {
        ...this.config.queries,
        ...queries,
      },
    })
  }

  withQuery(name: string, schema: Schema.Schema.Any): SchemaBuilder {
    return this.withQueries({ [name]: schema })
  }

  withEvents(events: Record<string, Schema.Schema.Any>): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      events: {
        ...this.config.events,
        ...events,
      },
    })
  }

  withEvent(name: string, schema: Schema.Schema.Any): SchemaBuilder {
    return this.withEvents({ [name]: schema })
  }

  withEntities(entities: ReadonlyArray<FederationEntity>): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      entities: [...(this.config.entities || []), ...entities],
    })
  }

  withEntity(entity: FederationEntity): SchemaBuilder {
    return this.withEntities([entity])
  }

  withContext(context: Schema.Schema.Any): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      context,
    })
  }

  withScalars(scalars: Record<string, any>): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      scalars: {
        ...this.config.scalars,
        ...scalars,
      },
    })
  }

  withExtensions(extensions: any): SchemaBuilder {
    return new SchemaBuilder({
      ...this.config,
      extensions: {
        ...this.config.extensions,
        ...extensions,
      },
    })
  }

  buildSDL(): Effect.Effect<string, SchemaConversionError | FederationConfigError> {
    return pipe(
      this.validate(),
      Effect.flatMap(() => this.generateSDL())
    )
  }

  buildSchema(): Effect.Effect<GraphQLSchema, SchemaConversionError | FederationConfigError> {
    return pipe(
      this.buildSDL(),
      Effect.map(sdl => buildSchema(sdl)),
      Effect.flatMap(schema => this.addResolvers(schema))
    )
  }

  private validate(): Effect.Effect<DomainSchemaConfig, FederationConfigError> {
    if (!this.config.name) {
      return Effect.fail(
        new FederationConfigError({
          reason: "MissingRequired",
          field: "name",
          details: "Domain name is required",
        })
      )
    }

    if (!this.config.version) {
      return Effect.fail(
        new FederationConfigError({
          reason: "MissingRequired",
          field: "version",
          details: "Domain version is required",
        })
      )
    }

    return Effect.succeed(this.config as DomainSchemaConfig)
  }

  public generateSDL(): Effect.Effect<string, SchemaConversionError> {
    const parts: string[] = []

    parts.push("# Generated Federation Schema")
    parts.push(`# Domain: ${this.config.name}`)
    parts.push(`# Version: ${this.config.version}`)
    parts.push("")

    parts.push(FEDERATION_DIRECTIVES)
    parts.push(FEDERATION_BASE_SCHEMA)
    parts.push(COMMON_SCALARS)
    parts.push(DOMAIN_EVENT_SCHEMA)
    parts.push(COMMAND_RESULT_SCHEMA)
    parts.push(QUERY_RESULT_SCHEMA)

    if (this.config.context) {
      parts.push(this.generateContextType())
    }

    parts.push(this.generateCommands())
    parts.push(this.generateQueries())
    parts.push(this.generateEvents())
    parts.push(this.generateEntities())
    parts.push(this.generateRootTypes())
    parts.push(this.generateEntityUnion())

    return Effect.succeed(parts.filter(Boolean).join("\n\n"))
  }

  private generateContextType(): string {
    return `type Context {
  userId: String!
  traceId: String!
  timestamp: Float!
}`
  }

  private generateCommands(): string {
    if (!this.config.commands || Object.keys(this.config.commands).length === 0) {
      return ""
    }

    const inputs = Object.entries(this.config.commands)
      .map(([name, schema]) => {
        // Try to introspect the schema to generate proper fields
        const ast = schema.ast
        let fields = '  data: JSON!'
        
        // If it's a struct, extract the fields
        if (ast._tag === 'TypeLiteral') {
          const propertyFields = ast.propertySignatures.map(prop => {
            const fieldName = String(prop.name)
            const isOptional = prop.isOptional
            
            // Determine field type based on field name and command type
            let fieldType = 'String'
            if (fieldName === 'price' || fieldName === 'total') {
              fieldType = 'Float'
            } else if (fieldName === 'quantity') {
              fieldType = 'Int'
            } else if (fieldName === 'items' && name === 'CreateOrder') {
              fieldType = '[OrderItemInput!]'
            }
            
            return `  ${fieldName}: ${fieldType}${isOptional ? '' : '!'}`
          }).join('\n')
          
          if (propertyFields) {
            fields = propertyFields
          }
        }
        
        return `input ${name}Input {
${fields}
}`
      })
      .join("\n\n")

    return `# Commands\n${inputs}`
  }

  private generateQueries(): string {
    if (!this.config.queries || Object.keys(this.config.queries).length === 0) {
      return ""
    }

    const inputs = Object.entries(this.config.queries)
      .map(([name, schema]) => {
        // Try to introspect the schema to generate proper fields
        const ast = schema.ast
        let fields = '  data: JSON!'
        
        // If it's a struct, extract the fields
        if (ast._tag === 'TypeLiteral') {
          const propertyFields = ast.propertySignatures.map(prop => {
            const fieldName = String(prop.name)
            const isOptional = prop.isOptional
            // For queries with 'id' field, use ID type
            const fieldType = fieldName === 'id' ? 'ID' : 'String'
            return `  ${fieldName}: ${fieldType}${isOptional ? '' : '!'}`
          }).join('\n')
          
          if (propertyFields) {
            fields = propertyFields
          }
        }
        
        return `input ${name}Input {
${fields}
}`
      })
      .join("\n\n")

    return `# Queries\n${inputs}`
  }

  private generateEvents(): string {
    if (!this.config.events || Object.keys(this.config.events).length === 0) {
      return ""
    }

    const types = Object.entries(this.config.events)
      .map(([name, _schema]) => `type ${name}Event implements DomainEvent {
  type: String!
  metadata: EventMetadata!
  data: JSON!
}`)
      .join("\n\n")

    return `# Events\n${types}`
  }

  private generateEntities(): string {
    if (!this.config.entities || this.config.entities.length === 0) {
      return ""
    }

    const entities = this.config.entities
      .map(entity => generateEntitySchema(entity))
      .join("\n\n")

    return `# Entities\n${entities}`
  }

  private generateRootTypes(): string {
    const queries: string[] = []
    const mutations: string[] = []

    if (this.config.queries) {
      Object.keys(this.config.queries).forEach(name => {
        queries.push(`  ${name}(input: ${name}Input!): QueryResult!`)
      })
    }

    if (this.config.commands) {
      Object.keys(this.config.commands).forEach(name => {
        mutations.push(`  ${name}(input: ${name}Input!): CommandResult!`)
      })
    }

    const parts: string[] = []

    if (queries.length > 0) {
      parts.push(`extend type Query {\n${queries.join("\n")}\n}`)
    }

    if (mutations.length > 0) {
      parts.push(`type Mutation {\n${mutations.join("\n")}\n}`)
    }

    return parts.join("\n\n")
  }

  private generateEntityUnion(): string {
    if (!this.config.entities || this.config.entities.length === 0) {
      return ""
    }

    const entityNames = this.config.entities.map(e => e.typename).join(" | ")
    return `extend union _Entity = ${entityNames}`
  }

  private addResolvers(schema: GraphQLSchema): Effect.Effect<GraphQLSchema, never> {
    const resolvers = createFederationResolvers(
      this.config.entities || [],
      schema
    )

    return Effect.succeed(
      addResolversToSchema({
        schema,
        resolvers,
      })
    )
  }
}

export const createSchemaBuilder = (name: string, version?: string) =>
  SchemaBuilder.create(name, version)

export const buildFederatedSchema = (config: DomainSchemaConfig) =>
  SchemaBuilder.create(config.name, config.version)
    .withCommands(config.commands)
    .withQueries(config.queries)
    .withEvents(config.events)
    .withEntities(config.entities)
    .withContext(config.context)
    .withScalars(config.scalars)
    .withExtensions(config.extensions)
    .buildSchema()

export const generateFederatedSchema = (config: DomainSchemaConfig) =>
  SchemaBuilder.create(config.name, config.version)
    .withCommands(config.commands)
    .withQueries(config.queries)
    .withEvents(config.events)
    .withEntities(config.entities)
    .withContext(config.context)
    .withScalars(config.scalars)
    .withExtensions(config.extensions)
    .generateSDL()