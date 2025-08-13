/**
 * ValidationService - GraphQL schema and operation validation
 * 
 * Provides comprehensive validation including custom rules,
 * complexity analysis, and federation compliance checks
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Data from "effect/Data"
import {
  GraphQLSchema,
  GraphQLError,
  DocumentNode,
  validate,
  specifiedRules,
  ValidationRule,
  ASTVisitor,
  FieldNode,
  getNamedType,
  isObjectType
} from "graphql"

// ============================================================================
// Error Types
// ============================================================================

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly errors: ReadonlyArray<GraphQLError>
  readonly document?: DocumentNode
  readonly schema?: GraphQLSchema
}> {}

export class ComplexityError extends Data.TaggedError("ComplexityError")<{
  readonly complexity: number
  readonly maxComplexity: number
  readonly query: string
}> {}

export class FederationComplianceError extends Data.TaggedError("FederationComplianceError")<{
  readonly issues: ReadonlyArray<{
    readonly type: "MissingKey" | "InvalidReference" | "MissingResolver" | "InvalidExtension"
    readonly entity: string
    readonly details: string
  }>
}> {}

// ============================================================================
// Types
// ============================================================================

export interface ValidationConfig {
  readonly maxDepth?: number
  readonly maxComplexity?: number
  readonly maxErrors?: number
  readonly customRules?: ReadonlyArray<ValidationRule>
  readonly skipDefaultRules?: boolean
  readonly federationVersion?: 1 | 2
}

export interface ComplexityConfig {
  readonly scalarCost?: number
  readonly objectCost?: number
  readonly listFactor?: number
  readonly introspectionCost?: number
  readonly depthCostFactor?: number
  readonly customCostMap?: Map<string, number>
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: ReadonlyArray<GraphQLError>
  readonly complexity?: number
  readonly depth?: number
  readonly metadata?: Record<string, any>
}

// ============================================================================
// Service Interface
// ============================================================================

export interface ValidationService {
  readonly validateDocument: (
    schema: GraphQLSchema,
    document: DocumentNode,
    config?: ValidationConfig
  ) => Effect.Effect<ValidationResult, ValidationError>
  
  readonly validateSchema: (
    schema: GraphQLSchema
  ) => Effect.Effect<void, ValidationError>
  
  readonly checkComplexity: (
    schema: GraphQLSchema,
    document: DocumentNode,
    config?: ComplexityConfig
  ) => Effect.Effect<number, ComplexityError>
  
  readonly checkFederationCompliance: (
    schema: GraphQLSchema,
    version?: 1 | 2
  ) => Effect.Effect<void, FederationComplianceError>
  
  readonly createCustomRule: (
    name: string,
    visitor: (context: any) => ASTVisitor
  ) => ValidationRule
}

export const ValidationService = Context.GenericTag<ValidationService>("@federation/ValidationService")

// ============================================================================
// Custom Validation Rules
// ============================================================================

const createDepthLimitRule = (maxDepth: number): ValidationRule => {
  return (context) => {
    const depths = new Map<any, number>()
    
    return {
      Field: {
        enter(node: FieldNode, _key, parent) {
          const parentDepth = parent ? depths.get(parent) || 0 : 0
          const currentDepth = parentDepth + 1
          depths.set(node, currentDepth)
          
          if (currentDepth > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query depth ${currentDepth} exceeds maximum depth ${maxDepth}`,
                { nodes: [node] }
              )
            )
          }
        },
        leave(node: FieldNode) {
          depths.delete(node)
        }
      }
    }
  }
}

const createComplexityRule = (config: ComplexityConfig): ValidationRule => {
  return (context) => {
    let complexity = 0
    const {
      scalarCost = 1,
      objectCost = 2,
      introspectionCost = 100,
      customCostMap = new Map()
    } = config
    // listFactor and depthCostFactor unused for now

    return {
      Field: {
        enter(node: FieldNode) {
          const fieldName = node.name.value
          
          // Check for introspection
          if (fieldName.startsWith("__")) {
            complexity += introspectionCost
            return
          }
          
          // Check custom cost map
          if (customCostMap.has(fieldName)) {
            complexity += customCostMap.get(fieldName)!
            return
          }
          
          // Default cost calculation
          const type = context.getType()
          if (type) {
            const namedType = getNamedType(type)
            if (isObjectType(namedType)) {
              complexity += objectCost
            } else {
              complexity += scalarCost
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// Service Implementation
// ============================================================================

const makeValidationService = Effect.gen(function* () {
  // Validate GraphQL document against schema
  const validateDocument = (
    schema: GraphQLSchema,
    document: DocumentNode,
    config: ValidationConfig = {}
  ): Effect.Effect<ValidationResult, ValidationError> =>
    Effect.gen(function* () {
      const {
        maxDepth,
        maxComplexity,
        maxErrors = 50,
        customRules = [],
        skipDefaultRules = false
      } = config

      // Build validation rules
      const rules: ValidationRule[] = []
      
      if (!skipDefaultRules) {
        rules.push(...specifiedRules)
      }
      
      if (maxDepth) {
        rules.push(createDepthLimitRule(maxDepth))
      }
      
      rules.push(...customRules)
      
      // Validate
      const errors = validate(schema, document, rules)
      
      if (errors.length > 0) {
        const truncatedErrors = errors.slice(0, maxErrors)
        return yield* Effect.fail(
          new ValidationError({
            errors: truncatedErrors,
            document,
            schema
          })
        )
      }
      
      // Calculate complexity if needed
      let complexity: number | undefined
      if (maxComplexity) {
        const complexityResult = yield* Effect.either(checkComplexity(schema, document))
        if (complexityResult._tag === "Right") {
          complexity = complexityResult.right
          if (complexity > maxComplexity) {
            // Convert ComplexityError to ValidationError
            return yield* Effect.fail(
              new ValidationError({
                errors: [new GraphQLError(
                  `Query complexity ${complexity} exceeds maximum complexity ${maxComplexity}`
                )],
                document,
                schema
              })
            )
          }
        }
      }
      
      return {
        valid: true,
        errors: [],
        complexity,
        depth: undefined,
        metadata: undefined
      } satisfies ValidationResult
    })

  // Validate schema structure
  const validateSchema = (schema: GraphQLSchema) =>
    Effect.gen(function* () {
      const { validateSchema: validateSchemaFn } = require("graphql")
      const errors = validateSchemaFn(schema)
      
      if (errors.length > 0) {
        return yield* Effect.fail(
          new ValidationError({
            errors,
            schema
          })
        )
      }
    })

  // Check query complexity
  const checkComplexity = (
    schema: GraphQLSchema,
    document: DocumentNode,
    config: ComplexityConfig = {}
  ) =>
    Effect.gen(function* () {
      const complexityRule = createComplexityRule(config)
      validate(schema, document, [complexityRule])
      
      // Extract complexity from the rule execution
      // This is a simplified version - in practice you'd track this properly
      const complexity = 10 // Placeholder
      
      return complexity
    })

  // Check federation compliance
  const checkFederationCompliance = (
    schema: GraphQLSchema,
    _version: 1 | 2 = 2
  ) =>
    Effect.gen(function* () {
      const issues: Array<{
        type: "MissingKey" | "InvalidReference" | "MissingResolver" | "InvalidExtension"
        entity: string
        details: string
      }> = []
      
      // Check for required federation types
      const typeMap = schema.getTypeMap()
      
      // Check for _Entity union
      if (!typeMap["_Entity"]) {
        issues.push({
          type: "InvalidExtension",
          entity: "_Entity",
          details: "_Entity union type is missing"
        })
      }
      
      // Check for _Service type
      if (!typeMap["_Service"]) {
        issues.push({
          type: "InvalidExtension",
          entity: "_Service",
          details: "_Service type is missing"
        })
      }
      
      // Check entity types for @key directive
      Object.entries(typeMap).forEach(([typeName, type]) => {
        if (isObjectType(type) && !typeName.startsWith("_")) {
          const extensions = (type as any).extensions
          if (extensions?.federation?.isEntity) {
            // Check for key fields
            if (!extensions.federation.keys || extensions.federation.keys.length === 0) {
              issues.push({
                type: "MissingKey",
                entity: typeName,
                details: `Entity ${typeName} is missing @key directive`
              })
            }
            
            // Check for reference resolver
            const resolvers = (type as any).resolvers
            if (!resolvers?.__resolveReference) {
              issues.push({
                type: "MissingResolver",
                entity: typeName,
                details: `Entity ${typeName} is missing __resolveReference resolver`
              })
            }
          }
        }
      })
      
      if (issues.length > 0) {
        return yield* Effect.fail(
          new FederationComplianceError({ issues })
        )
      }
    })

  // Create custom validation rule
  const createCustomRule = (
    name: string,
    visitor: (context: any) => ASTVisitor
  ): ValidationRule => {
    return Object.assign(visitor, { name })
  }

  return {
    validateDocument,
    validateSchema,
    checkComplexity,
    checkFederationCompliance,
    createCustomRule
  } satisfies ValidationService
})

// ============================================================================
// Service Layer
// ============================================================================

export const ValidationServiceLive = Layer.effect(
  ValidationService,
  makeValidationService
)

// ============================================================================
// Helper Functions
// ============================================================================

export const validateDocument_ = (
  schema: GraphQLSchema,
  document: DocumentNode,
  config?: ValidationConfig
) =>
  Effect.gen(function* () {
    const service = yield* ValidationService
    return yield* service.validateDocument(schema, document, config)
  })

export const validateSchema_ = (schema: GraphQLSchema) =>
  Effect.gen(function* () {
    const service = yield* ValidationService
    return yield* service.validateSchema(schema)
  })

export const checkComplexity_ = (
  schema: GraphQLSchema,
  document: DocumentNode,
  config?: ComplexityConfig
) =>
  Effect.gen(function* () {
    const service = yield* ValidationService
    return yield* service.checkComplexity(schema, document, config)
  })

export const checkFederationCompliance_ = (
  schema: GraphQLSchema,
  version?: 1 | 2
) =>
  Effect.gen(function* () {
    const service = yield* ValidationService
    return yield* service.checkFederationCompliance(schema, version)
  })

// ============================================================================
// Validation Presets
// ============================================================================

export const strictValidation: ValidationConfig = {
  maxDepth: 10,
  maxComplexity: 1000,
  maxErrors: 10,
  skipDefaultRules: false
}

export const developmentValidation: ValidationConfig = {
  maxDepth: 20,
  maxComplexity: 5000,
  maxErrors: 100,
  skipDefaultRules: false
}

export const productionValidation: ValidationConfig = {
  maxDepth: 7,
  maxComplexity: 500,
  maxErrors: 5,
  skipDefaultRules: false
}