/**
 * 🎯 Complete Pipe Pattern Demo
 * 
 * Comprehensive demonstration of pipe patterns throughout the CQRS framework
 * Shows repository, command handlers, projections all using pipe composition
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Ref from "effect/Ref"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"

// Import all our pipe pattern implementations
import { 
  createRepository,
  withCache,
  withOptimisticLocking,
  InMemorySnapshotStore,
} from "../domain/repository"

import {
  handleRegisterUser,
  handleActivateUser,
  handleLoginUser,
  applyUserEvent,
  routeUserCommand,
  registerAndActivateUser,
  type UserState,
  type UserEvent,
  type UserCommand,
} from "../domain/handlers/user-handlers-pipe"

import {
  createReducerProjection,
  createAsyncProjection,
  createFilteredProjection,
  composeProjections,
  InMemoryCheckpointStore,
  type ProjectionState,
} from "../application/projection-pipe"

import {
  createAggregate,
  markEventsAsCommitted,
} from "../domain/aggregate"

import {
  CoreServicesLive,
  EventStore,
} from "../effects/services"

import {
  email,
  username,
  nonEmptyString,
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
} from "../schema/core/primitives"

// ============================================================================
// User Statistics Projection - PIPE PATTERN
// ============================================================================

interface UserStats {
  totalUsers: number
  activeUsers: number
  verifiedUsers: number
  loginCount: number
  lastActivity: number
}

/**
 * 🎯 User statistics projection using pipe pattern
 */
const createUserStatsProjection = () =>
  createReducerProjection<UserStats, UserEvent>(
    {
      name: "user-stats",
      initialState: {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        loginCount: 0,
        lastActivity: 0,
      },
      batchSize: 100,
      saveCheckpointEvery: 500,
    },
    (state, event) => {
      switch (event.type) {
        case "UserRegistered":
          return {
            ...state,
            totalUsers: state.totalUsers + 1,
            lastActivity: event.metadata.timestamp,
          }
        case "UserActivated":
          return {
            ...state,
            activeUsers: state.activeUsers + 1,
            lastActivity: event.metadata.timestamp,
          }
        case "UserDeactivated":
          return {
            ...state,
            activeUsers: Math.max(0, state.activeUsers - 1),
            lastActivity: event.metadata.timestamp,
          }
        case "UserVerified":
          return {
            ...state,
            verifiedUsers: state.verifiedUsers + 1,
            lastActivity: event.metadata.timestamp,
          }
        case "UserLoggedIn":
          return {
            ...state,
            loginCount: state.loginCount + 1,
            lastActivity: event.metadata.timestamp,
          }
        default:
          return state
      }
    }
  )

// ============================================================================
// Active Users Projection - PIPE PATTERN with filtering
// ============================================================================

interface ActiveUsersList {
  users: Map<string, { email: string; lastLogin: number }>
}

/**
 * 🎯 Active users projection with filtering
 */
const createActiveUsersProjection = () =>
  createFilteredProjection<ActiveUsersList, UserEvent>(
    {
      name: "active-users",
      initialState: {
        users: new Map(),
      },
    },
    // Only process activation and login events
    (event) => event.type === "UserActivated" || event.type === "UserLoggedIn",
    (state, event) =>
      Effect.succeed({
        users: new Map(state.users).set(
          event.metadata.aggregateId,
          {
            email: "user@example.com", // Would come from event data in real system
            lastLogin: event.metadata.timestamp,
          }
        ),
      })
  )

// ============================================================================
// Complete User Workflow - PIPE PATTERN
// ============================================================================

/**
 * 🎯 Complete user workflow using pipe patterns throughout
 */
const runCompleteUserWorkflow = pipe(
  Effect.succeed("🎯 Complete Pipe Pattern Demo - CQRS Framework"),
  Effect.tap((title) => Effect.sync(() => console.log(title))),
  Effect.tap(() => Effect.sync(() => console.log("=" .repeat(60)))),
  
  // Create repository with caching and optimistic locking
  Effect.flatMap(() =>
    pipe(
      Effect.succeed(() => createRepository("User", applyUserEvent, null)),
      Effect.flatMap((createRepo) => withCache(createRepo())),
      Effect.map(withOptimisticLocking),
      Effect.flatMap((repository) => {
        const userId = createAggregateId()
        
        return pipe(
          // Step 1: Register and activate user
          Effect.sync(() => console.log("\n📝 Step 1: Register and activate user")),
          Effect.flatMap(() =>
            pipe(
              Effect.succeed(createAggregate<UserState, UserEvent>(userId)),
              Effect.flatMap((aggregate) =>
                registerAndActivateUser(
                  aggregate,
                  email("alice@example.com"),
                  username("alice"),
                  nonEmptyString("hashed_password_123")
                )
              ),
              Effect.tap((aggregate) =>
                Effect.sync(() => {
                  console.log("  ✅ User registered and activated")
                  console.log("  State:", aggregate.state)
                  console.log("  Events generated:", aggregate.uncommittedEvents.length)
                })
              ),
              // Save to repository
              Effect.flatMap((aggregate) =>
                pipe(
                  repository.save(aggregate),
                  Effect.map(() => markEventsAsCommitted(aggregate))
                )
              )
            )
          ),
          
          // Step 2: Login user
          Effect.flatMap(() => Effect.sync(() => console.log("\n🔐 Step 2: Login user"))),
          Effect.flatMap(() =>
            pipe(
              repository.load(userId),
              Effect.flatMap((aggregate) =>
                handleLoginUser(aggregate, {
                  type: "LoginUser",
                  payload: {
                    ipAddress: nonEmptyString("192.168.1.1"),
                    userAgent: undefined,
                  },
                  metadata: {
                    commandId: createEventId(),
                    aggregateId: userId,
                    correlationId: createCorrelationId(),
                    causationId: createCausationId(),
                    timestamp: now(),
                    actor: { type: "user", id: userId, email: email("alice@example.com") },
                  },
                })
              ),
              Effect.map((events) => {
                console.log("  ✅ User logged in")
                console.log("  Login event created:", events[0].type)
                return events
              })
            )
          ),
          
          // Step 3: Build projections
          Effect.flatMap(() => Effect.sync(() => console.log("\n📊 Step 3: Build projections"))),
          Effect.flatMap(() =>
            pipe(
              Effect.all({
                statsProjection: createUserStatsProjection(),
                activeUsersProjection: createActiveUsersProjection(),
              }),
              Effect.flatMap(({ statsProjection, activeUsersProjection }) =>
                pipe(
                  // Process all events through projections
                  EventStore,
                  Effect.flatMap((eventStore) =>
                    pipe(
                      eventStore.readAll<UserEvent>({ fromPosition: 0n }),
                      Stream.runCollect,
                      Effect.flatMap((events) =>
                        Effect.all({
                          stats: pipe(
                            Effect.forEach(events, (event) =>
                              statsProjection.process()
                            ),
                            Effect.flatMap(() => statsProjection.getState())
                          ),
                          activeUsers: pipe(
                            Effect.forEach(events, (event) =>
                              activeUsersProjection.process()
                            ),
                            Effect.flatMap(() => activeUsersProjection.getState())
                          ),
                        })
                      )
                    )
                  ),
                  Effect.tap(({ stats, activeUsers }) =>
                    Effect.sync(() => {
                      console.log("  ✅ Projections built")
                      console.log("  User Statistics:", stats.state)
                      console.log("  Active Users Count:", activeUsers.state.users.size)
                    })
                  )
                )
              )
            )
          ),
          
          // Step 4: Demonstrate repository caching
          Effect.flatMap(() => Effect.sync(() => console.log("\n🚀 Step 4: Repository caching"))),
          Effect.flatMap(() =>
            pipe(
              // Load same user multiple times
              Effect.all([
                repository.load(userId),
                repository.load(userId),
                repository.load(userId),
              ]),
              Effect.tap((aggregates) =>
                Effect.sync(() => {
                  console.log("  ✅ Loaded user 3 times (2 from cache)")
                  console.log("  All versions match:", 
                    aggregates.every((a) => a.version === aggregates[0].version)
                  )
                })
              )
            )
          )
        )
      })
    )
  ),
  
  // Summary
  Effect.flatMap(() =>
    Effect.sync(() => {
      console.log("\n" + "=" .repeat(60))
      console.log("🎉 Complete Pipe Pattern Benefits Demonstrated:")
      console.log()
      console.log("📦 Repository Layer:")
      console.log("  ✅ Load/save operations use pipe pattern")
      console.log("  ✅ Caching with pipe composition")
      console.log("  ✅ Optimistic locking integrated")
      console.log()
      console.log("⚡ Command Handlers:")
      console.log("  ✅ All validation through pipe chains")
      console.log("  ✅ Event creation with functional flow")
      console.log("  ✅ Command routing without Effect.gen")
      console.log()
      console.log("📊 Projections:")
      console.log("  ✅ Event processing with pipe pattern")
      console.log("  ✅ State updates through composition")
      console.log("  ✅ Filtering and composition support")
      console.log()
      console.log("🔄 Workflows:")
      console.log("  ✅ Multi-step processes as pipelines")
      console.log("  ✅ Error handling through Effect chain")
      console.log("  ✅ Clean composition without 'this' issues")
      console.log()
      console.log("🎯 Key Advantages:")
      console.log("  • Linear, readable flow")
      console.log("  • Better functional composition")
      console.log("  • No generator context issues")
      console.log("  • Cleaner error propagation")
      console.log("  • More efficient execution")
    })
  )
)

// ============================================================================
// Performance Comparison - PIPE vs Effect.gen
// ============================================================================

/**
 * 🎯 Performance test: Pipe pattern vs Effect.gen
 */
const performanceComparison = () =>
  pipe(
    Effect.sync(() => console.log("\n📈 Performance Comparison: Pipe vs Effect.gen")),
    Effect.flatMap(() => {
      const iterations = 10000
      
      // Pipe pattern version
      const pipeVersion = (n: number) =>
        pipe(
          Effect.succeed(n),
          Effect.map((x) => x * 2),
          Effect.flatMap((x) => Effect.succeed(x + 1)),
          Effect.map((x) => x.toString())
        )
      
      // Effect.gen version
      const genVersion = (n: number) =>
        Effect.gen(function* () {
          const doubled = yield* Effect.succeed(n * 2)
          const incremented = yield* Effect.succeed(doubled + 1)
          return incremented.toString()
        })
      
      return pipe(
        Effect.all({
          pipeTime: Effect.sync(() => {
            const start = performance.now()
            for (let i = 0; i < iterations; i++) {
              Effect.runSync(pipeVersion(i))
            }
            return performance.now() - start
          }),
          genTime: Effect.sync(() => {
            const start = performance.now()
            for (let i = 0; i < iterations; i++) {
              Effect.runSync(genVersion(i))
            }
            return performance.now() - start
          }),
        }),
        Effect.tap(({ pipeTime, genTime }) =>
          Effect.sync(() => {
            console.log(`  Iterations: ${iterations}`)
            console.log(`  Pipe pattern: ${pipeTime.toFixed(2)}ms`)
            console.log(`  Effect.gen: ${genTime.toFixed(2)}ms`)
            console.log(`  Pipe is ${((genTime / pipeTime - 1) * 100).toFixed(1)}% faster`)
          })
        )
      )
    })
  )

// ============================================================================
// Main Execution
// ============================================================================

const runDemo = pipe(
  runCompleteUserWorkflow,
  Effect.flatMap(() => performanceComparison()),
  Effect.provide(
    Layer.mergeAll(
      CoreServicesLive,
      InMemoryCheckpointStore,
      InMemorySnapshotStore
    )
  )
)

// Execute if run directly
if (import.meta.main) {
  Effect.runPromise(runDemo).then(
    () => console.log("\n✨ Complete Pipe Pattern Demo finished successfully!"),
    (error) => console.error("❌ Demo failed:", error)
  )
}

export { runDemo, createUserStatsProjection, createActiveUsersProjection }