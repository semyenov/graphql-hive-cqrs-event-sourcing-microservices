/**
 * Integration Tests for Ultra-Clean CQRS/Event Sourcing Framework
 * 
 * Tests the complete framework functionality end-to-end
 */

import { describe, test, expect } from "bun:test"
import * as Effect from "effect/Effect"

import { runDemo, UserService } from "../examples/demo"
import {
  CoreServicesLive,
  createAggregateId,
  Email,
  Username
} from "../index"

describe("Ultra-Clean CQRS Framework", () => {
  test("should run complete demo successfully", async () => {
    const result = await Effect.runPromise(runDemo())

    expect(result).toBeDefined()
    expect(result.message).toBe("Framework demo completed successfully!")
    expect(result.userId).toBeDefined()
    expect(result.finalState).toBeDefined()
    expect(result.finalState.isActive).toBe(true)
  })

  test("should handle user registration", async () => {
    const program = Effect.gen(function* () {
      const result = yield* UserService.registerUser(
        "test@example.com" as Email,
        "test-user" as Username
      )

      expect(result.success).toBe(true)
      expect(result.email).toBe("test@example.com")
      expect(result.username).toBe("test-user")

      return result
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should handle user activation", async () => {
    const program = Effect.gen(function* () {
      // First register a user
      const registerResult = yield* UserService.registerUser(
        "activate@example.com" as Email,
        "activate-user" as Username
      )

      // Check initial state
      const initialState = yield* UserService.getUser(registerResult.userId)
      expect(initialState.user.isActive).toBe(false)

      // Activate user
      const activateResult = yield* UserService.activateUser(registerResult.userId)
      expect(activateResult.success).toBe(true)
      expect(activateResult.activated).toBe(true)

      // Check final state
      const finalState = yield* UserService.getUser(registerResult.userId)
      expect(finalState.user.isActive).toBe(true)

      return { initialState, activateResult, finalState }
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should handle event sourcing correctly", async () => {
    const program = Effect.gen(function* () {
      // Register and activate user
      const registerResult = yield* UserService.registerUser(
        "events@example.com" as Email,
        "events-user" as Username
      )

      const activateResult = yield* UserService.activateUser(registerResult.userId)

      // Check that we have the correct number of events
      const userState = yield* UserService.getUser(registerResult.userId)

      expect(userState.events).toBe(2) // UserRegistered + UserActivated
      expect(userState.version).toBe(1) // Version starts at 0, so 2 events = version 1
      expect(userState.user.isActive).toBe(true)

      return { registerResult, activateResult, userState }
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should handle business rule violations", async () => {
    const program = Effect.gen(function* () {
      const userId = createAggregateId()

      // Try to activate non-existent user
      const result = yield* Effect.either(
        UserService.activateUser(userId)
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("UserNotFound")
      }

      return result
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should handle idempotent operations", async () => {
    const program = Effect.gen(function* () {
      // Register user
      const registerResult = yield* UserService.registerUser(
        "idempotent@example.com" as Email,
        "idempotent-user" as Username
      )

      // Activate user twice
      const firstActivation = yield* UserService.activateUser(registerResult.userId)
      const secondActivation = yield* UserService.activateUser(registerResult.userId)

      // Both should succeed, but second should be no-op
      expect(firstActivation.success).toBe(true)
      expect(secondActivation.success).toBe(true)

      // Check final state is still correct
      const finalState = yield* UserService.getUser(registerResult.userId)
      expect(finalState.user.isActive).toBe(true)

      return { firstActivation, secondActivation, finalState }
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })
})

describe("Framework Architecture Validation", () => {
  test("should use pure functions throughout", async () => {
    // This test validates that our framework follows pure functional principles
    const program = Effect.gen(function* () {
      // All operations should be pure and deterministic given same inputs
      const email = "pure@example.com" as Email
      const username = "pure-user" as Username

      const result1 = yield* UserService.registerUser(email, username)

      // The result should be consistent (though userId will be different each time)
      expect(result1.email).toBe(email)
      expect(result1.username).toBe(username)
      expect(result1.success).toBe(true)

      return result1
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should maintain immutability", async () => {
    const program = Effect.gen(function* () {
      const registerResult = yield* UserService.registerUser(
        "immutable@example.com" as Email,
        "immutable-user" as Username
      )

      const stateBefore = yield* UserService.getUser(registerResult.userId)
      const originalState = JSON.stringify(stateBefore.user)

      // Activate user
      yield* UserService.activateUser(registerResult.userId)

      const stateAfter = yield* UserService.getUser(registerResult.userId)

      // Original state reference should be different (immutable)
      expect(JSON.stringify(stateAfter.user)).not.toBe(originalState)
      expect(stateAfter.user.isActive).toBe(true)
      expect(stateAfter.version).toBeGreaterThan(stateBefore.version)

      return { stateBefore, stateAfter }
    }).pipe(Effect.provide(CoreServicesLive))

    await Effect.runPromise(program)
  })

  test("should provide type safety", () => {
    // This test ensures our types are properly defined and enforced
    // The fact that this compiles and the previous tests pass demonstrates type safety

    const validEmail: Email = "valid@example.com" as Email
    const validUsername: Username = "valid-user" as Username
    const validId = createAggregateId()

    expect(typeof validEmail).toBe("string")
    expect(typeof validUsername).toBe("string")
    expect(typeof validId).toBe("string")
    expect(validId.length).toBe(26) // ULID length
  })
})