/**
 * Minimal GraphQL Federation Example
 * 
 * Shows the simplest possible usage of the federation package
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { buildFederatedSchema, type FederationEntity } from "./index"

// 1. Define your domain schema using Effect Schema
const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String
})

// 2. Create a federation entity
const userEntity: FederationEntity = {
  typename: "User",
  key: "id",
  schema: UserSchema,
  resolveReference: (reference) => 
    Effect.succeed({
      id: reference.id,
      name: "John Doe",
      email: "john@example.com"
    }),
  fields: {}
}

// 3. Build the federated schema
const program = Effect.gen(function* () {
  const schema = yield* buildFederatedSchema({
    name: "UserService",
    version: "1.0.0",
    entities: [userEntity],
    commands: {},
    queries: {},
    events: {}
  })
  
  console.log("✅ Schema created successfully!")
  console.log("🚀 Ready to use with Apollo Federation Gateway")
  
  return schema
})

// 4. Run the program
Effect.runPromise(program)
  .then(() => {
    console.log("\nYour federated GraphQL schema is ready!")
    console.log("Add this service to your Apollo Gateway configuration")
  })
  .catch(error => {
    console.error("Failed to create schema:", error)
  })

/**
 * That's it! In just 50 lines, you have:
 * - Type-safe schema definition with Effect Schema
 * - Apollo Federation support with @key directives
 * - Entity reference resolution
 * - Error handling with Effect
 * 
 * Next steps:
 * 1. Add more entities
 * 2. Implement real data fetching in resolveReference
 * 3. Add field resolvers for cross-service data
 * 4. Deploy with Apollo Gateway
 */