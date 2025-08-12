/**
 * GraphQL Federation Demo
 * 
 * Demonstrates native GraphQL Federation v2.5 integration with the ultra-clean framework
 * Shows entity resolution, field composition, and cross-service relationships
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Stream from "effect/Stream"
import { pipe } from "effect/Function"

import {
  AggregateId,
  Email,
  Username,
  NonEmptyString,
  Timestamp,
  createAggregateId,
  createEventId,
  createCausationId,
  createCorrelationId,
  nonEmptyString,
  now,
  timestamp,
  createEventSchema,
  createEventApplicator,
  loadFromEvents,
  CoreServicesLive,
  EventStore,
  type FederationEntity,
  EntityResolverError
} from "../index"

// ============================================================================
// Federation Registry (Simple implementation for demo)
// ============================================================================

const FederationRegistry = {
  entities: new Map<string, FederationEntity<any>>(),
  
  register<T>(entity: FederationEntity<T>) {
    this.entities.set(entity.typename, entity)
  },
  
  resolveEntity(typename: string, reference: any) {
    const entity = this.entities.get(typename)
    if (!entity) {
      return Effect.fail(new Error(`Entity ${typename} not found`))
    }
    return Effect.gen(function* () {
      yield* Effect.log(`🌐 Federation: Resolving ${typename} entity`)
      return yield* entity.resolveReference(reference)
    })
  },
  
  getEntityFields(typename: string, source: any) {
    const entity = this.entities.get(typename)
    if (!entity || !entity.fields) {
      return {}
    }
    
    const result: Record<string, any> = {}
    for (const [field, resolver] of Object.entries(entity.fields)) {
      const value = (resolver as any)(source, {}, {}, {} as any)
      result[field] = Effect.isEffect(value) ? Effect.runSync(value as any) : value
    }
    return result
  }
}

// ============================================================================
// User Service Domain (Service A)
// ============================================================================

const UserState = Schema.Struct({
  id: AggregateId,
  email: Email,
  username: Username,
  firstName: NonEmptyString,
  lastName: NonEmptyString,
  isActive: Schema.Boolean,
  joinedAt: Schema.Number
})
type UserState = Schema.Schema.Type<typeof UserState>

const UserRegistered = createEventSchema(
  "UserRegistered",
  Schema.Struct({
    email: Email,
    username: Username,
    firstName: NonEmptyString,
    lastName: NonEmptyString
  })
)

const UserActivated = createEventSchema(
  "UserActivated",
  Schema.Struct({})
)

type UserEvent = 
  | Schema.Schema.Type<typeof UserRegistered>
  | Schema.Schema.Type<typeof UserActivated>

// User Federation Entity
export const UserEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState as any,
  
  resolveReference: (reference: { id: AggregateId }) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔍 Resolving User entity: ${reference.id}`)
      
      const eventStore = yield* EventStore
      const streamName = `User-${reference.id}` as any
      
      const events = yield* pipe(
        eventStore.read<UserEvent>(streamName),
        Stream.runCollect,
        Effect.map(chunk => Array.from(chunk)),
        Effect.orElseSucceed(() => [])
      )
      
      if (events.length === 0) {
        yield* Effect.log(`❌ User not found: ${reference.id}`)
        return yield* Effect.fail(new EntityResolverError("NotFound", `User not found: ${reference.id}`))
      }
      
      const aggregate = loadFromEvents(reference.id, events, applyUserEvent)
      yield* Effect.log(`✅ User resolved: ${aggregate.state?.username}`)
      
      return aggregate.state
    }).pipe(
      Effect.mapError((error: any) => 
        error instanceof EntityResolverError ? error : 
        new EntityResolverError("ResolutionFailed", error.message || String(error), error)
      )
    ) as Effect.Effect<UserState, EntityResolverError, never>,
  
  // Extended fields available to other services
  fields: {
    fullName: (user: UserState) => `${user.firstName} ${user.lastName}`,
    displayName: (user: UserState) => user.username,
    accountAge: (user: UserState) => Math.floor((Date.now() - user.joinedAt) / (1000 * 60 * 60 * 24)),
    isVerified: (user: UserState) => user.isActive,
    profileUrl: (user: UserState) => `https://example.com/users/${user.username}`
  }
}

const applyUserEvent = createEventApplicator<UserState, UserEvent>({
  UserRegistered: (_state, event) => ({
    id: event.metadata.aggregateId,
    email: event.data.email,
    username: event.data.username,
    firstName: event.data.firstName,
    lastName: event.data.lastName,
    isActive: false,
    joinedAt: event.metadata.timestamp
  }),
  
  UserActivated: (state, _event) =>
    state ? { ...state, isActive: true } : null
})

// ============================================================================
// Order Service Domain (Service B)
// ============================================================================

const OrderState = Schema.Struct({
  id: AggregateId,
  userId: AggregateId, // Reference to User entity
  items: Schema.Array(Schema.Struct({
    productId: AggregateId,
    quantity: Schema.Number,
    price: Schema.Number
  })),
  total: Schema.Number,
  status: Schema.Literal("pending", "confirmed", "shipped", "delivered"),
  createdAt: Schema.Number
})
type OrderState = Schema.Schema.Type<typeof OrderState>

const OrderCreated = createEventSchema(
  "OrderCreated",
  Schema.Struct({
    userId: AggregateId,
    items: Schema.Array(Schema.Struct({
      productId: AggregateId,
      quantity: Schema.Number,
      price: Schema.Number
    })),
    total: Schema.Number
  })
)

const OrderConfirmed = createEventSchema(
  "OrderConfirmed",
  Schema.Struct({})
)

type OrderEvent = 
  | Schema.Schema.Type<typeof OrderCreated>
  | Schema.Schema.Type<typeof OrderConfirmed>

// Order Federation Entity
export const OrderEntity: FederationEntity<OrderState> = {
  typename: "Order",
  key: "id",
  schema: OrderState as any,
  
  resolveReference: (reference: { id: AggregateId }) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔍 Resolving Order entity: ${reference.id}`)
      
      const eventStore = yield* EventStore
      const streamName = `Order-${reference.id}` as any
      
      const events = yield* pipe(
        eventStore.read<OrderEvent>(streamName),
        Stream.runCollect,
        Effect.map(chunk => Array.from(chunk)),
        Effect.orElseSucceed(() => [])
      )
      
      if (events.length === 0) {
        return yield* Effect.fail(new EntityResolverError("NotFound", `Order not found: ${reference.id}`))
      }
      
      const aggregate = loadFromEvents(reference.id, events, applyOrderEvent)
      return aggregate.state
    }).pipe(
      Effect.mapError((error: any) => 
        error instanceof EntityResolverError ? error :
        new EntityResolverError("ResolutionFailed", error.message || String(error), error)
      )
    ) as Effect.Effect<OrderState, EntityResolverError, never>,
  
  fields: {
    itemCount: (order: OrderState) => order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    averageItemPrice: (order: OrderState) => order.total / order.items.length,
    isRecent: (order: OrderState) => (Date.now() - order.createdAt) < (24 * 60 * 60 * 1000), // Last 24 hours
    formattedTotal: (order: OrderState) => `$${order.total.toFixed(2)}`
  }
}

const applyOrderEvent = createEventApplicator<OrderState, OrderEvent>({
  OrderCreated: (_state, event) => ({
    id: event.metadata.aggregateId,
    userId: event.data.userId,
    items: event.data.items,
    total: event.data.total,
    status: "pending" as const,
    createdAt: event.metadata.timestamp
  }),
  
  OrderConfirmed: (state, _event) =>
    state ? { ...state, status: "confirmed" as const } : null
})

// ============================================================================
// Federation Service Registry
// ============================================================================

// ============================================================================
// Federation Demo Scenarios
// ============================================================================

/**
 * Create demo data for federation testing
 */
const createDemoData = () =>
  Effect.gen(function* () {
    yield* Effect.log("📋 Creating demo data for federation...")
    
    const eventStore = yield* EventStore
    
    // Create a user
    const userId = createAggregateId()
    const userEvents: UserEvent[] = [
      {
        type: "UserRegistered" as const,
        data: {
          email: "alice@example.com" as Email,
          username: "alice" as Username,
          firstName: "Alice" as NonEmptyString,
          lastName: "Johnson" as NonEmptyString
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: userId,
          version: 0,
          timestamp: (now() - 86400000) as Timestamp, // 1 day ago
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      },
      {
        type: "UserActivated" as const,
        data: {},
        metadata: {
          eventId: createEventId(),
          aggregateId: userId,
          version: 1,
          timestamp: (now() - 43200000) as Timestamp, // 12 hours ago
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      }
    ]
    
    yield* eventStore.append(`User-${userId}` as any, userEvents, -1 as any)
    
    // Create orders for the user
    const order1Id = createAggregateId()
    const order1Events: OrderEvent[] = [
      {
        type: "OrderCreated" as const,
        data: {
          userId,
          items: [
            { productId: createAggregateId(), quantity: 2, price: 29.99 },
            { productId: createAggregateId(), quantity: 1, price: 15.50 }
          ],
          total: 75.48
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: order1Id,
          version: 0,
          timestamp: (now() - 3600000) as Timestamp, // 1 hour ago
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      },
      {
        type: "OrderConfirmed" as const,
        data: {},
        metadata: {
          eventId: createEventId(),
          aggregateId: order1Id,
          version: 1,
          timestamp: timestamp(now() - 1800000), // 30 minutes ago
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      }
    ]
    
    yield* eventStore.append(`Order-${order1Id}` as any, order1Events, -1 as any)
    
    const order2Id = createAggregateId()
    const order2Events: OrderEvent[] = [
      {
        type: "OrderCreated" as const,
        data: {
          userId,
          items: [
            { productId: createAggregateId(), quantity: 1, price: 99.99 }
          ],
          total: 99.99
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: order2Id,
          version: 0,
          timestamp: timestamp(now() - 300000), // 5 minutes ago
          correlationId: createCorrelationId(),
          causationId: createCausationId(),
          actor: { type: "system", service: nonEmptyString("demo") }
        }
      }
    ]
    
    yield* eventStore.append(`Order-${order2Id}` as any, order2Events, -1 as any)
    
    yield* Effect.log(`✅ Created demo data: User ${userId}, Orders ${order1Id}, ${order2Id}`)
    
    return { userId, orders: [order1Id, order2Id] }
  })

/**
 * Demonstrate entity resolution
 */
const demoEntityResolution = (userId: AggregateId, orderIds: AggregateId[]) =>
  Effect.gen(function* () {
    yield* Effect.log("🌐 Demonstrating Federation Entity Resolution")
    
    // Resolve User entity
    yield* Effect.log("\n1. Resolving User entity...")
    const user = yield* FederationRegistry.resolveEntity("User", { id: userId })
    yield* Effect.log(`👤 User resolved: ${JSON.stringify(user, null, 2)}`)
    
    // Get User extended fields
    const userFields = FederationRegistry.getEntityFields("User", user)
    yield* Effect.log(`🔧 User extended fields: ${JSON.stringify(userFields, null, 2)}`)
    
    // Resolve Order entities
    yield* Effect.log("\n2. Resolving Order entities...")
    for (const orderId of orderIds) {
      const order = yield* FederationRegistry.resolveEntity("Order", { id: orderId })
      const orderFields = FederationRegistry.getEntityFields("Order", order)
      
      yield* Effect.log(`📦 Order ${orderId}:`)
      yield* Effect.log(`   Base: ${JSON.stringify(order, null, 2)}`)
      yield* Effect.log(`   Extended: ${JSON.stringify(orderFields, null, 2)}`)
    }
    
    return { user, userFields }
  })

/**
 * Simulate GraphQL Federation query
 */
const simulateFederationQuery = (userId: AggregateId, orderIds: AggregateId[]) =>
  Effect.gen(function* () {
    yield* Effect.log("📊 Simulating GraphQL Federation Query")
    yield* Effect.log("Query: { user(id: \"...\") { fullName, orders { total, itemCount } } }")
    
    // This simulates what a GraphQL gateway would do:
    // 1. Resolve the User entity
    // 2. Get related Order entities
    // 3. Compose the response with extended fields
    
    const user = yield* FederationRegistry.resolveEntity("User", { id: userId })
    const userExtended = FederationRegistry.getEntityFields("User", user)
    
    const orders = []
    for (const orderId of orderIds) {
      const order = yield* FederationRegistry.resolveEntity("Order", { id: orderId })
      const orderExtended = FederationRegistry.getEntityFields("Order", order)
      
      orders.push({
        id: order.id,
        total: order.total,
        itemCount: orderExtended.itemCount,
        formattedTotal: orderExtended.formattedTotal,
        isRecent: orderExtended.isRecent
      })
    }
    
    const response = {
      user: {
        id: user.id,
        fullName: userExtended.fullName,
        displayName: userExtended.displayName,
        accountAge: userExtended.accountAge,
        isVerified: userExtended.isVerified,
        profileUrl: userExtended.profileUrl,
        orders
      }
    }
    
    yield* Effect.log("🎯 Federation Query Response:")
    yield* Effect.log(JSON.stringify(response, null, 2))
    
    return response
  })

// ============================================================================
// Complete Federation Demo
// ============================================================================

const runFederationDemo = () =>
  Effect.gen(function* () {
    yield* Effect.log("🚀 GraphQL Federation Demo - Ultra-Clean Framework")
    yield* Effect.log("=" .repeat(60))
    
    // Register federation entities
    FederationRegistry.register(UserEntity)
    FederationRegistry.register(OrderEntity)
    
    // Create demo data
    const { userId, orders } = yield* createDemoData()
    yield* Effect.log("")
    
    // Demonstrate entity resolution
    yield* demoEntityResolution(userId, orders)
    yield* Effect.log("")
    
    // Simulate GraphQL federation query
    const response = yield* simulateFederationQuery(userId, orders)
    yield* Effect.log("")
    
    yield* Effect.log("✅ Federation Demo Completed!")
    yield* Effect.log("🌟 Key Features Demonstrated:")
    yield* Effect.log("   • Native GraphQL Federation v2.5 support")
    yield* Effect.log("   • Cross-service entity resolution")
    yield* Effect.log("   • Extended field composition")
    yield* Effect.log("   • Type-safe entity references")
    yield* Effect.log("   • Effect-native resolution")
    
    return {
      message: "GraphQL Federation demo completed successfully!",
      userId,
      orders,
      response
    }
  }).pipe(
    Effect.provide(CoreServicesLive),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`❌ Federation demo failed: ${JSON.stringify(error)}`)
        return { error: JSON.stringify(error) }
      })
    )
  )

// ============================================================================
// GraphQL Schema Generation Example
// ============================================================================

/**
 * Generate GraphQL SDL from federation entities
 */
export const generateFederationSchema = () => {
  const userSchema = `
    type User @key(fields: "id") {
      id: ID!
      email: String!
      username: String!
      firstName: String!
      lastName: String!
      isActive: Boolean!
      joinedAt: Int!
      
      # Extended fields resolved by User service
      fullName: String!
      displayName: String!
      accountAge: Int!
      isVerified: Boolean!
      profileUrl: String!
      
      # Cross-service relationship
      orders: [Order!]! @requires(fields: "id")
    }
  `
  
  const orderSchema = `
    type Order @key(fields: "id") {
      id: ID!
      userId: ID!
      total: Float!
      status: OrderStatus!
      createdAt: Int!
      
      # Extended fields resolved by Order service
      itemCount: Int!
      averageItemPrice: Float!
      isRecent: Boolean!
      formattedTotal: String!
      
      # Cross-service relationship
      user: User! @requires(fields: "userId")
    }
    
    enum OrderStatus {
      PENDING
      CONFIRMED
      SHIPPED
      DELIVERED
    }
  `
  
  return {
    userSchema,
    orderSchema,
    combinedSchema: userSchema + "\n" + orderSchema
  }
}

// ============================================================================
// Run Demo
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runFederationDemo()).then(
    result => {
      console.log("🎯 Federation Demo Result:", result)
      console.log("\n📝 Generated Federation Schema:")
      const { combinedSchema } = generateFederationSchema()
      console.log(combinedSchema)
      process.exit(0)
    },
    error => {
      console.error("💥 Federation Demo Error:", error)
      process.exit(1)
    }
  )
}

export { runFederationDemo }