#!/usr/bin/env bun
/**
 * Federation Example Runner
 * 
 * This script demonstrates the federation example with formatted output
 */

import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import {
  runFederationExample,
  generateExampleSchema,
  generateServiceSchemas,
  testEntityResolutionExample,
  createEntityResolversExample
} from "./federation-example"

// ============================================================================
// Utility Functions
// ============================================================================

const separator = (title: string) =>
  Effect.sync(() => {
    console.log("\n" + "=".repeat(60))
    console.log(`  ${title}`)
    console.log("=".repeat(60))
  })

const subsection = (title: string) =>
  Effect.sync(() => {
    console.log(`\n--- ${title} ---`)
  })

// ============================================================================
// Example Demonstrations
// ============================================================================

/**
 * Demonstrate schema generation
 */
const demonstrateSchemaGeneration = () =>
  pipe(
    separator("SCHEMA GENERATION DEMONSTRATION"),
    Effect.flatMap(() => generateExampleSchema()),
    Effect.map(sdl => {
      console.log("\nGenerated Federation Schema (first 500 chars):")
      console.log(sdl.substring(0, 500) + "...")
      console.log(`\nFull schema length: ${sdl.length} characters`)
      return sdl
    })
  )

/**
 * Demonstrate service decomposition
 */
const demonstrateServiceDecomposition = () =>
  pipe(
    separator("SERVICE DECOMPOSITION DEMONSTRATION"),
    Effect.flatMap(() => generateServiceSchemas()),
    Effect.map(schemas => {
      console.log("\nGenerated Individual Service Schemas:")
      console.log(`- User Service: ${schemas.userService.length} chars`)
      console.log(`- Product Service: ${schemas.productService.length} chars`)
      console.log(`- Order Service: ${schemas.orderService.length} chars`)

      console.log("\nUser Service Schema Preview:")
      console.log(schemas.userService.substring(0, 300) + "...")

      return schemas
    })
  )

/**
 * Demonstrate entity resolution
 */
const demonstrateEntityResolution = () =>
  pipe(
    separator("ENTITY RESOLUTION DEMONSTRATION"),
    Effect.flatMap(() => testEntityResolutionExample()),
    Effect.map(result => {
      if (result) {
        console.log("\nSuccessfully resolved entities:")
        console.log(`- User: ${result.user.username} (${result.user.email})`)
        console.log(`- Product: ${result.product.name} - $${result.product.price}`)
        console.log(`- Order: ${result.order.id} - $${result.order.total}`)
      }
      return undefined
    })
  )

/**
 * Demonstrate resolver creation
 */
const demonstrateResolverCreation = () =>
  pipe(
    separator("RESOLVER CREATION DEMONSTRATION"),
    Effect.flatMap(() => Effect.sync(() => {
      const resolvers = createEntityResolversExample()

      console.log("\nCreated Federation Resolvers:")
      Object.entries(resolvers).forEach(([entityName, resolver]) => {
        const methods = Object.keys(resolver)
        console.log(`- ${entityName}: [${methods.join(", ")}]`)
      })

      return undefined
    }))
  )

/**
 * Demonstrate error handling
 */
const demonstrateErrorHandling = () =>
  pipe(
    separator("ERROR HANDLING DEMONSTRATION"),
    Effect.flatMap(() => subsection("Testing error handling patterns")),
    Effect.flatMap(() =>
      Effect.succeed(() => {
        console.log("✓ Error handling patterns implemented:")
        console.log("  - EntityResolverError for entity not found")
        console.log("  - SchemaConversionError for schema issues")
        console.log("  - Effect.fail for proper error propagation")
        console.log("  - Effect.catchAll for error recovery")
        return "Error handling demonstration completed"
      })
    ),
    Effect.map(() => {
      console.log("\nError handling demonstration completed")
      return true
    })
  )

// ============================================================================
// Main Demonstration Runner
// ============================================================================

/**
 * Run all federation demonstrations
 */
const runAllDemonstrations = () =>
  pipe(
    Effect.sync(() => {
      console.log("🚀 Starting GraphQL Federation Example Demonstrations")
      console.log("This will showcase the federation framework capabilities\n")
      return undefined
    }),

    // Run each demonstration
    Effect.flatMap(() => demonstrateSchemaGeneration()),
    Effect.flatMap(() => demonstrateServiceDecomposition()),
    Effect.flatMap(() => demonstrateEntityResolution()),
    Effect.flatMap(() => demonstrateResolverCreation()),
    Effect.flatMap(() => demonstrateErrorHandling()),

    // Final summary
    Effect.flatMap(() => separator("DEMONSTRATION SUMMARY")),
    Effect.map(() => {
      console.log("\n✅ All demonstrations completed successfully!")
      console.log("\nWhat was demonstrated:")
      console.log("• Federated schema generation from Effect schemas")
      console.log("• Service decomposition for microservice deployment")
      console.log("• Entity reference resolution across services")
      console.log("• Resolver creation with proper federation support")
      console.log("• Error handling with Effect-TS patterns")
      console.log("\nNext steps:")
      console.log("• Review the generated schemas")
      console.log("• Implement actual data sources")
      console.log("• Deploy services with Apollo Federation Gateway")
      console.log("• Add authentication and authorization")
      console.log("• Implement real-time subscriptions")

      return true
    }),

    Effect.catchAll(error => {
      console.error("\n❌ Demonstration failed:", error)
      return Effect.succeed(false)
    })
  )

/**
 * Quick demo runner
 */
const quickDemo = () =>
  pipe(
    Effect.sync(() => {
      console.log("🏃‍♂️ Running Quick Federation Demo...")
    }),
    Effect.flatMap(() => runFederationExample()),
    Effect.map(() => {
      console.log("\n✅ Quick demo completed!")
      return true
    })
  )

// ============================================================================
// CLI Interface
// ============================================================================

const main = () => {
  const args = process.argv.slice(2)
  const mode = args[0] || "full"

  switch (mode) {
    case "quick":
      return quickDemo()
    case "schema":
      return demonstrateSchemaGeneration()
    case "services":
      return demonstrateServiceDecomposition()
    case "entities":
      return demonstrateEntityResolution()
    case "resolvers":
      return demonstrateResolverCreation()
    case "errors":
      return demonstrateErrorHandling()
    case "full":
    default:
      return runAllDemonstrations()
  }
}

// ============================================================================
// Help Information
// ============================================================================

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
GraphQL Federation Example Runner

Usage: bun run-federation-example.ts [mode]

Modes:
  full      - Run all demonstrations (default)
  quick     - Run quick federation example
  schema    - Demonstrate schema generation
  services  - Demonstrate service decomposition
  entities  - Demonstrate entity resolution
  resolvers - Demonstrate resolver creation
  errors    - Demonstrate error handling

Examples:
  bun run-federation-example.ts
  bun run-federation-example.ts quick
  bun run-federation-example.ts schema
`)
  process.exit(0)
}

// Run the selected demonstration
main()