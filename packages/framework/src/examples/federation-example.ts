/**
 * GraphQL Federation Example
 * 
 * Demonstrates how to use the federation module to create a federated GraphQL schema
 * with multiple services, entities, and proper Effect integration.
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Option from "effect/Option"
import { pipe } from "effect/Function"
import {
  generateFederatedSchema,
  buildFederatedSchema,
  createEntityResolver,
  EntityResolverError,
  type FederationEntity,
  type DomainSchemaConfig,
} from "../graphql/federation"
import * as fs from "fs"

// ============================================================================
// Domain Schemas
// ============================================================================

/**
 * User domain schemas
 */
export const UserId = pipe(
  Schema.String,
  Schema.brand("UserId"),
)
export type UserId = Schema.Schema.Type<typeof UserId>

export const Email = pipe(
  Schema.String,
  Schema.brand("Email"),
)
export type Email = Schema.Schema.Type<typeof Email>

export const Username = pipe(
  Schema.String,
  Schema.brand("Username"),
)
export type Username = Schema.Schema.Type<typeof Username>

export const UserState = Schema.Struct({
  id: UserId,
  email: Email,
  username: Username,
  firstName: Schema.String,
  lastName: Schema.String,
  isActive: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number
}).pipe(Schema.annotations({
  title: "User",
  description: "A user is a person who can purchase products."
}))
export type UserState = Schema.Schema.Type<typeof UserState>

export const CreateUserCommand = Schema.Struct({
  email: Email,
  username: Username,
  firstName: Schema.String,
  lastName: Schema.String
}).pipe(Schema.annotations({
  title: "CreateUser",
  description: "Create a user."
}))
export type CreateUserCommand = Schema.Schema.Type<typeof CreateUserCommand>

export const GetUserQuery = Schema.Struct({
  id: UserId
}).pipe(Schema.annotations({
  title: "GetUser",
  description: "Get a user by their id."
}))
export type GetUserQuery = Schema.Schema.Type<typeof GetUserQuery>

export const UserCreatedEvent = Schema.Struct({
  userId: UserId,
  email: Email,
  username: Username,
  timestamp: Schema.Number
}).pipe(Schema.annotations({
  title: "UserCreated",
  description: "A user has been created."
}))
export type UserCreatedEvent = Schema.Schema.Type<typeof UserCreatedEvent>

/**
 * Product domain schemas
 */
export const ProductId = pipe(
  Schema.String,
  Schema.brand("ProductId"),
)
export type ProductId = Schema.Schema.Type<typeof ProductId>

export const Money = pipe(
  Schema.Number,
  Schema.brand("Money"),
)
export type Money = Schema.Schema.Type<typeof Money>

export const ProductState = Schema.Struct({
  id: ProductId,
  name: Schema.String,
  description: Schema.String,
  price: Money,
  categoryId: Schema.String,
  inStock: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number
}).pipe(Schema.annotations({
  title: "Product",
  description: "A product is a thing that can be purchased."
}))
export type ProductState = Schema.Schema.Type<typeof ProductState>

export const CreateProductCommand = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  price: Money,
  categoryId: Schema.String
}).pipe(Schema.annotations({
  title: "CreateProduct",
  description: "Create a product."
}))
export type CreateProductCommand = Schema.Schema.Type<typeof CreateProductCommand>

export const GetProductQuery = Schema.Struct({
  id: ProductId
}).pipe(Schema.annotations({
  title: "GetProduct",
  description: "Get a product by its id."
}))
export type GetProductQuery = Schema.Schema.Type<typeof GetProductQuery>

export const ProductCreatedEvent = Schema.Struct({
  productId: ProductId,
  name: Schema.String,
  price: Money,
  timestamp: Schema.Number
}).pipe(Schema.annotations({
  title: "ProductCreated",
  description: "A product has been created."
}))
export type ProductCreatedEvent = Schema.Schema.Type<typeof ProductCreatedEvent>

/**
 * Order domain schemas
 */
export const OrderId = pipe(
  Schema.String,
  Schema.brand("OrderId"),
)
export type OrderId = Schema.Schema.Type<typeof OrderId>

export const OrderItem = Schema.Struct({
  productId: ProductId,
  quantity: Schema.Number,
  price: Money
}).pipe(Schema.annotations({
  title: "OrderItem",
  description: "An item in an order."
}))
export type OrderItem = Schema.Schema.Type<typeof OrderItem>

export const OrderStatus = Schema.Literal(
  "pending",
  "confirmed",
  "shipped",
  "delivered"
)
export type OrderStatus = Schema.Schema.Type<typeof OrderStatus>

export const OrderState = Schema.Struct({
  id: OrderId,
  userId: UserId,
  items: Schema.Array(OrderItem),
  total: Money,
  status: OrderStatus,
  createdAt: Schema.Number,
  updatedAt: Schema.Number
}).pipe(Schema.annotations({
  title: "Order",
  description: "An order is a collection of items that have been purchased by a user."
}))
export type OrderState = Schema.Schema.Type<typeof OrderState>

export const CreateOrderCommand = Schema.Struct({
  userId: UserId,
  items: Schema.Array(OrderItem)
}).pipe(Schema.annotations({
  title: "CreateOrder",
  description: "Create an order for a user."
}))
export type CreateOrderCommand = Schema.Schema.Type<typeof CreateOrderCommand>

export const GetOrderQuery = Schema.Struct({
  id: OrderId
}).pipe(Schema.annotations({
  title: "GetOrder",
  description: "Get an order by its id."
}))
export type GetOrderQuery = Schema.Schema.Type<typeof GetOrderQuery>

export const OrderCreatedEvent = Schema.Struct({
  orderId: OrderId,
  userId: UserId,
  total: Money,
  timestamp: Schema.Number
}).pipe(Schema.annotations({
  title: "OrderCreated",
  description: "An order has been created."
}))
export type OrderCreatedEvent = Schema.Schema.Type<typeof OrderCreatedEvent>

// ============================================================================
// Mock Data Store
// ============================================================================

const mockUsers = new Map<string, UserState>([
  ["user-1", {
    id: "user-1" as UserId,
    email: "alice@example.com" as Email,
    username: "alice" as Username,
    firstName: "Alice",
    lastName: "Smith",
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }],
  ["user-2", {
    id: "user-2" as UserId,
    email: "bob@example.com" as Email,
    username: "bob" as Username,
    firstName: "Bob",
    lastName: "Johnson",
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }]
])

const mockProducts = new Map<string, ProductState>([
  ["product-1", {
    id: "product-1" as ProductId,
    name: "Laptop",
    description: "High-performance laptop",
    price: 999.99 as Money,
    categoryId: "electronics",
    inStock: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }],
  ["product-2", {
    id: "product-2" as ProductId,
    name: "Mouse",
    description: "Wireless mouse",
    price: 29.99 as Money,
    categoryId: "electronics",
    inStock: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }]
])

const mockOrders = new Map<string, OrderState>([
  ["order-1", {
    id: "order-1" as OrderId,
    userId: "user-1" as UserId,
    items: [
      {
        productId: "product-1" as ProductId,
        quantity: 1,
        price: 999.99 as Money
      }
    ],
    total: 999.99 as Money,
    status: "pending" as const,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }]
])

// ============================================================================
// Entity Resolvers
// ============================================================================

/**
 * User entity resolver
 */
const userEntity: FederationEntity<UserState> = {
  typename: "User",
  key: "id",
  schema: UserState,
  resolveReference: (reference) =>
    pipe(
      Option.fromNullable(mockUsers.get(reference.id as string)),
      Option.match({
        onSome: (user) => Effect.succeed(user),
        onNone: () => Effect.fail(new EntityResolverError(
          "NotFound",
          `User with id ${reference.id} not found`
        ))
      })
    ),
  fields: {
    id: (user) => Effect.succeed(user.id),
    email: (user) => Effect.succeed(user.email),
    username: (user) => Effect.succeed(user.username),
    firstName: (user) => Effect.succeed(user.firstName),
    lastName: (user) => Effect.succeed(user.lastName),
    isActive: (user) => Effect.succeed(user.isActive),
    createdAt: (user) => Effect.succeed(user.createdAt),
    updatedAt: (user) => Effect.succeed(user.updatedAt),
  }
}

/**
 * Product entity resolver
 */
const productEntity: FederationEntity<ProductState> = {
  typename: "Product",
  key: "id",
  schema: ProductState,
  resolveReference: (reference) =>
    pipe(
      Option.fromNullable(mockProducts.get(reference.id as string)),
      Option.match({
        onSome: (product) => Effect.succeed(product),
        onNone: () => Effect.fail(new EntityResolverError(
          "NotFound",
          `Product with id ${reference.id} not found`
        ))
      })
    ),
  fields: {
    id: (product) => Effect.succeed(product.id),
    name: (product) => Effect.succeed(product.name),
    description: (product) => Effect.succeed(product.description),
    price: (product) => Effect.succeed(product.price),
    categoryId: (product) => Effect.succeed(product.categoryId),
    inStock: (product) => Effect.succeed(product.inStock),
  }
}

/**
 * Order entity resolver
 */
const orderEntity: FederationEntity<OrderState> = {
  typename: "Order",
  key: "id",
  schema: OrderState,
  resolveReference: (reference) =>
    pipe(
      Option.fromNullable(mockOrders.get(reference.id as string)),
      Option.match({
        onSome: (order) => Effect.succeed(order),
        onNone: () => Effect.fail(new EntityResolverError(
          "NotFound",
          `Order with id ${reference.id} not found`
        ))
      })
    ),
  fields: {}
}

// ============================================================================
// Context Schema
// ============================================================================

const RequestContext = Schema.Struct({
  userId: Schema.optional(UserId),
  traceId: Schema.String,
  timestamp: Schema.Number
}).pipe(Schema.annotations({ title: "RequestContext" }))

// ============================================================================
// Federation Configuration
// ============================================================================

const federationConfig: DomainSchemaConfig = {
  commands: {
    CreateUser: CreateUserCommand,
    CreateProduct: CreateProductCommand,
    CreateOrder: CreateOrderCommand
  },
  queries: {
    GetUser: GetUserQuery,
    GetProduct: GetProductQuery,
    GetOrder: GetOrderQuery
  },
  events: {
    UserCreated: UserCreatedEvent,
    ProductCreated: ProductCreatedEvent,
    OrderCreated: OrderCreatedEvent
  },
  entities: [
    userEntity,
    productEntity,
    orderEntity
  ],
  context: RequestContext
}

// ============================================================================
// Federation Schema Generation
// ============================================================================

/**
 * Generate the complete federated schema
 */
export const generateExampleSchema = () =>
  pipe(
    generateFederatedSchema(federationConfig),
    Effect.tapBoth({
      onFailure: (error) =>
        Effect.logError(`Failed to generate schema: ${error.message}`),
      onSuccess: (sdl) =>
        Effect.logInfo("Successfully generated federated schema")
    })
  )

/**
 * Build the complete GraphQL schema
 */
export const buildExampleSchema = () =>
  pipe(
    buildFederatedSchema(federationConfig),
    Effect.tapBoth({
      onFailure: (error) =>
        Effect.logError(`Failed to build schema: ${error.message}`),
      onSuccess: (schema) =>
        Effect.logInfo("Successfully built GraphQL schema")
    })
  )

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example: Generate and print the federated schema SDL
 */
export const printSchemaExample = () =>
  pipe(
    generateExampleSchema(),
    Effect.map(sdl => {
      console.log("Generated Federation Schema:")
      console.log("=".repeat(50) + "\n" + sdl + "\n" + "=".repeat(50))
      return sdl
    }),
    Effect.catchAll(error => {
      console.error("Error generating schema:", error)
      return Effect.succeed("")
    })
  )

/**
 * Example: Create entity resolvers
 */
export const createEntityResolversExample = () => {
  const userResolver = createEntityResolver(userEntity)
  const productResolver = createEntityResolver(productEntity)
  const orderResolver = createEntityResolver(orderEntity)

  console.log("Entity Resolvers Created:")
  console.log("- User Resolver:", Object.keys(userResolver))
  console.log("- Product Resolver:", Object.keys(productResolver))
  console.log("- Order Resolver:", Object.keys(orderResolver))

  return {
    User: userResolver,
    Product: productResolver,
    Order: orderResolver
  }
}

/**
 * Example: Test entity reference resolution
 */
export const testEntityResolutionExample = () =>
  pipe(
    Effect.all([
      userEntity.resolveReference?.({ id: "user-1" }),
      productEntity.resolveReference?.({ id: "product-1" }),
      orderEntity.resolveReference?.({ id: "order-1" })
    ]),
    Effect.map(([user, product, order]) => {
      console.log("Entity Resolution Results:")
      console.log("- User:", user.username)
      console.log("- Product:", product.name)
      console.log("- Order:", order.id, "for user", order.userId)
      return { user, product, order }
    }),
    Effect.catchAll(error => {
      console.error("Error resolving entities:", error)
      return Effect.succeed(null)
    })
  )

/**
 * Example: Complete federation setup demonstration
 */
export const runFederationExample = () =>
  pipe(
    Effect.logInfo("Starting Federation Example"),
    Effect.flatMap(() => printSchemaExample()),
    Effect.flatMap(() => Effect.succeed(createEntityResolversExample())),
    Effect.flatMap(() => testEntityResolutionExample()),
    Effect.flatMap(() => buildExampleSchema()),
    Effect.map(() => {
      console.log("\nFederation example completed successfully!")
      console.log("This example demonstrates:")
      console.log("- Multi-domain schema generation")
      console.log("- Entity federation with reference resolution")
      console.log("- Cross-service field resolution")
      console.log("- Proper error handling with Effect")
      console.log("- Type-safe schema definitions")
    }),
    Effect.catchAll(error => {
      console.error("Federation example failed:", error)
      return Effect.succeed(undefined)
    })
  )

// ============================================================================
// Service-Specific Schemas (for microservice deployment)
// ============================================================================

/**
 * User Service Schema
 */
export const userServiceConfig: DomainSchemaConfig = {
  commands: { CreateUser: CreateUserCommand },
  queries: { GetUser: GetUserQuery },
  events: { UserCreated: UserCreatedEvent },
  entities: [userEntity],
  context: RequestContext
}

/**
 * Product Service Schema
 */
export const productServiceConfig: DomainSchemaConfig = {
  commands: { CreateProduct: CreateProductCommand },
  queries: { GetProduct: GetProductQuery },
  events: { ProductCreated: ProductCreatedEvent },
  entities: [productEntity],
  context: RequestContext
}

/**
 * Order Service Schema
 */
export const orderServiceConfig: DomainSchemaConfig = {
  commands: { CreateOrder: CreateOrderCommand },
  queries: { GetOrder: GetOrderQuery },
  events: { OrderCreated: OrderCreatedEvent },
  entities: [orderEntity],
  context: RequestContext
}

/**
 * Generate individual service schemas
 */
export const generateServiceSchemas = () =>
  pipe(
    Effect.all([
      generateFederatedSchema(userServiceConfig),
      generateFederatedSchema(productServiceConfig),
      generateFederatedSchema(orderServiceConfig)
    ]),
    Effect.map(([userSchema, productSchema, orderSchema]) => ({
      userService: userSchema,
      productService: productSchema,
      orderService: orderSchema
    })),
    Effect.tapBoth({
      onFailure: (error) =>
        Effect.logError(`Failed to generate service schemas: ${error.message}`),
      onSuccess: (schemas) =>
        Effect.logInfo("Successfully generated service schemas")
    }),
    Effect.tap((schemas) =>
      Effect.sync(() => {
        fs.writeFileSync("service-schemas.json", JSON.stringify(schemas, null, 2));
        console.log("Successfully saved service schemas to file");
      })
    )
  )

// Export the main function for use in other files
export { runFederationExample as main }

// Export entities and configs for use in other files
export {
  federationConfig,
  userEntity,
  productEntity,
  orderEntity,
  mockUsers,
  mockProducts,
  mockOrders
} 