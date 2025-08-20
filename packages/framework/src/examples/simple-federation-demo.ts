#!/usr/bin/env bun
/**
 * Simple Federation Demo
 * 
 * A straightforward demonstration of the federation example
 */

import * as Effect from "effect/Effect"
import {
  runFederationExample,
  generateExampleSchema,
  generateServiceSchemas
} from "./federation-example"

console.log("🚀 GraphQL Federation Framework Demo")
console.log("=====================================\n")

/**
 * Run the federation demo
 */
const runDemo = async () => {
  try {
    console.log("1. Running complete federation example...")
    await Effect.runPromise(runFederationExample())

    console.log("\n2. Generating individual service schemas...")
    const serviceSchemas = await Effect.runPromise(generateServiceSchemas())

    console.log(`\n📊 Service Schema Sizes:`)
    console.log(`- User Service: ${serviceSchemas.userService.length} characters`)
    console.log(`- Product Service: ${serviceSchemas.productService.length} characters`)
    console.log(`- Order Service: ${serviceSchemas.orderService.length} characters`)

    console.log("\n✅ Federation demo completed successfully!")
    console.log("\n🎯 Key Features Demonstrated:")
    console.log("• Effect-TS integration with GraphQL Federation")
    console.log("• Type-safe schema generation from Effect Schemas")
    console.log("• Cross-service entity reference resolution")
    console.log("• Service decomposition for microservices")
    console.log("• Proper error handling with Effect patterns")

  } catch (error) {
    console.error("❌ Demo failed:", error)
    process.exit(1)
  }
}

// Run the demo
runDemo() 