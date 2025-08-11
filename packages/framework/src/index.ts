/**
 * @cqrs/framework - Ultra-Clean CQRS/Event Sourcing Framework
 * 
 * Schema-first, pure functional, Effect-native framework
 * with GraphQL Federation as a first-class citizen
 */

// ============================================================================
// Core Schemas - Single Source of Truth
// ============================================================================

export * from "./schema/core/primitives"
export * from "./schema/core/messages"

// ============================================================================
// Pure Functions - No Classes, Just Functions
// ============================================================================

export * from "./functions/event-sourcing"
export * from "./functions/aggregate"

// ============================================================================
// Effect Services - Dependency Injection via Layers
// ============================================================================

export * from "./effects/services"

// ============================================================================
// GraphQL Federation - First-Class Support
// ============================================================================

export * from "./graphql/federation"
export type { FederationEntity } from "./graphql/federation"

// ============================================================================
// Pattern Matching - Re-export for convenience
// ============================================================================

export { match, P } from "ts-pattern"

// ============================================================================
// Effect - Re-export core Effect modules
// ============================================================================

export * as Effect from "effect/Effect"
export * as Schema from "@effect/schema/Schema"
export * as Layer from "effect/Layer"
export * as Context from "effect/Context"
export * as Option from "effect/Option"
export * as Either from "effect/Either"
export * as Stream from "effect/Stream"
export * as Ref from "effect/Ref"
export * as Queue from "effect/Queue"
export * as Duration from "effect/Duration"
export * as Exit from "effect/Exit"
export * as Cause from "effect/Cause"
export { pipe } from "effect/Function"

// ============================================================================
// Framework Metadata
// ============================================================================

export const VERSION = "3.0.0"
export const FRAMEWORK_NAME = "@cqrs/framework"

/**
 * Framework Features
 */
export const FEATURES = {
  schemaFirst: true,
  pureFunctional: true,
  effectNative: true,
  graphqlFederation: true,
  patternMatching: true,
  zeroClasses: true,
  typeLevel: true,
  noRuntimeSurprises: true
} as const

/**
 * Quick Start Example
 * 
 * @example
 * ```typescript
 * import { 
 *   createEventSchema,
 *   createCommandSchema,
 *   createEventApplicator,
 *   createCommandHandler,
 *   executeCommand,
 *   Effect,
 *   Layer,
 *   pipe
 * } from "@cqrs/framework"
 * 
 * // 1. Define your schemas (single source of truth)
 * const UserCreated = createEventSchema("UserCreated", Schema.Struct({
 *   email: Email,
 *   username: Username
 * }))
 * 
 * // 2. Create pure event applicator
 * const applyUserEvent = createEventApplicator({
 *   UserCreated: (state, event) => ({
 *     id: event.metadata.aggregateId,
 *     email: event.data.email,
 *     username: event.data.username
 *   })
 * })
 * 
 * // 3. Create pure command handler
 * const handleUserCommand = createCommandHandler({
 *   CreateUser: (state, command) =>
 *     Effect.succeed({
 *       type: "success",
 *       events: [createUserCreatedEvent(command)]
 *     })
 * })
 * 
 * // 4. Compose with Effect services
 * const program = pipe(
 *   executeCommand(handleUserCommand, applyUserEvent)(aggregate, command),
 *   Effect.provide(CoreServicesLive)
 * )
 * 
 * // 5. Run the program
 * Effect.runPromise(program)
 * ```
 */

/**
 * Architecture Principles
 * 
 * 1. **Schema-First Development**
 *    - Define schemas once using Effect Schema
 *    - Derive validation, serialization, and GraphQL types
 *    - Single source of truth for all types
 * 
 * 2. **Pure Functional Core**
 *    - No classes or inheritance
 *    - Pure functions and immutable data
 *    - Composable operations
 * 
 * 3. **Effect-Native Services**
 *    - All operations return Effects
 *    - Dependency injection via Layers
 *    - Type-safe error handling
 * 
 * 4. **GraphQL Federation**
 *    - Native federation support
 *    - Automatic schema generation
 *    - Entity resolution built-in
 * 
 * 5. **Exhaustive Pattern Matching**
 *    - Use ts-pattern for all branching
 *    - Compile-time exhaustiveness checking
 *    - No runtime surprises
 */

/**
 * Migration from Previous Versions
 * 
 * If migrating from v1 or v2:
 * 
 * 1. Replace class-based aggregates with pure functions
 * 2. Convert inheritance to composition
 * 3. Replace builders with direct function calls
 * 4. Use Schema.decode instead of manual validation
 * 5. Replace abstract classes with discriminated unions
 * 
 * @see examples/migration-guide.ts for detailed examples
 */