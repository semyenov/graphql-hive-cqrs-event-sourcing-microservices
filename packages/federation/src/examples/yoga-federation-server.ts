/**
 * Yoga GraphQL Federation Server
 *
 * Demonstrates the federation framework with a real GraphQL server
 */

import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { addResolversToSchema } from '@graphql-tools/schema'
import * as Effect from "effect/Effect"
import {
  buildFederatedSchema,
  createEntityResolvers,
  type DomainSchemaConfig,
  type FederationEntity
} from "../core"
import {
  federationConfig,
  userEntity,
  productEntity,
  orderEntity,
  mockUsers,
  mockProducts,
  mockOrders,
} from "./federation-example"
import { UserState, ProductState, OrderState } from "./federation-example"
// ============================================================================
// Server Configuration
// ============================================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000
const HOST = process.env.HOST || 'localhost'

// ============================================================================
// Enhanced Entity Resolvers with Real Data
// ============================================================================

/**
 * Enhanced user entity with real data access
 */
const enhancedUserEntity: FederationEntity<UserState> = {
  ...userEntity,
  resolveReference: (reference) => Effect.succeed(mockUsers.get(reference.id as string) as UserState),
  fields: {}
}

/**
 * Enhanced product entity with real data access
 */
const enhancedProductEntity: FederationEntity<ProductState> = {
  ...productEntity,
  resolveReference: (reference) => Effect.succeed(mockProducts.get(reference.id as string) as ProductState),
  fields: {}
}

/**
 * Enhanced order entity with real data access
 */
const enhancedOrderEntity: FederationEntity<OrderState> = {
  ...orderEntity,
  resolveReference: (reference) => Effect.succeed(mockOrders.get(reference.id as string) as OrderState),
  fields: {}
}

// ============================================================================
// Enhanced Federation Config
// ============================================================================

const enhancedFederationConfig: DomainSchemaConfig<any> = {
  ...federationConfig,
  entities: [
    enhancedUserEntity as FederationEntity<any>,
    enhancedProductEntity as FederationEntity<any>,
    enhancedOrderEntity as FederationEntity<any>
  ]
}

// ============================================================================
// Query Resolvers
// ============================================================================

/**
 * Create query resolvers for the federation server
 */
const createQueryResolvers = () => ({
  // User queries
  GetUser: async (_parent: unknown, args: any) => {
    console.log('GetUser args:', args)
    
    if (!args.input || !args.input.id) {
      throw new Error(`User ID is required. Received args: ${JSON.stringify(args)}`)
    }
    
    const user = mockUsers.get(args.input.id)
    if (!user) {
      throw new Error(`User ${args.input.id} not found`)
    }
    return {
      data: JSON.stringify(user),
      metadata: {
        timestamp: Date.now(),
        executionTime: 0,
        cached: false
      }
    }
  },

  // Product queries
  GetProduct: async (_parent: unknown, args: any) => {
    console.log('GetProduct args:', args)
    
    if (!args.input || !args.input.id) {
      throw new Error(`Product ID is required. Received args: ${JSON.stringify(args)}`)
    }
    
    const product = mockProducts.get(args.input.id)
    if (!product) {
      throw new Error(`Product ${args.input.id} not found`)
    }
    return {
      data: JSON.stringify(product),
      metadata: {
        timestamp: Date.now(),
        executionTime: 0,
        cached: false
      }
    }
  },

  // Order queries
  GetOrder: async (_parent: unknown, args: any) => {
    console.log('GetOrder args:', args)
    
    if (!args.input || !args.input.id) {
      throw new Error(`Order ID is required. Received args: ${JSON.stringify(args)}`)
    }
    
    const order = mockOrders.get(args.input.id)
    if (!order) {
      throw new Error(`Order ${args.input.id} not found`)
    }
    return {
      data: JSON.stringify(order),
      metadata: {
        timestamp: Date.now(),
        executionTime: 0,
        cached: false
      }
    }
  },

  // Federation queries
  _entities: async (_parent: unknown, { representations }: { representations: any[] }) => {
    return representations.map(rep => {
      switch (rep.__typename) {
        case 'User':
          return mockUsers.get(rep.id) || null
        case 'Product':
          return mockProducts.get(rep.id) || null
        case 'Order':
          return mockOrders.get(rep.id) || null
        default:
          return null
      }
    })
  },

  _service: () => ({ sdl: "Federation SDL" })
})

// ============================================================================
// Mutation Resolvers
// ============================================================================

/**
 * Create mutation resolvers for the federation server
 */
const createMutationResolvers = () => ({
  CreateUser: async (_parent: UserState, { input }: { input: any }) => {
    const userId = `user-${Date.now()}` as UserState['id']
    const user: UserState = {
      id: userId,
      email: input.email,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    mockUsers.set(userId, user)

    return {
      success: true,
      aggregateId: userId,
      version: 1,
      error: null
    }
  },

  CreateProduct: async (_parent: ProductState, { input }: { input: any }) => {
    const productId = `product-${Date.now()}` as ProductState['id']
    const product: ProductState = {
      id: productId,
      name: input.name,
      description: input.description,
      price: input.price,
      categoryId: input.categoryId,
      inStock: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    mockProducts.set(productId, product)

    return {
      success: true,
      aggregateId: productId,
      version: 1,
      error: null
    }
  },

  CreateOrder: async (_parent: OrderState, { input }: { input: any }) => {
    const orderId = `order-${Date.now()}` as OrderState['id']
    const order: OrderState = {
      id: orderId,
      userId: input.userId,
      items: input.items,
      total: input.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    mockOrders.set(orderId, order)

    return {
      success: true,
      aggregateId: orderId,
      version: 1,
      error: null
    }
  }
})

// ============================================================================
// Yoga Server Setup
// ============================================================================

/**
 * Create and configure the Yoga server
 */
const createYogaServer = async () => {
  // Generate the federated schema
  const schemaResult = await Effect.runPromise(
    buildFederatedSchema(enhancedFederationConfig)
  )

  // Add resolvers to schema
  const schemaWithResolvers = addResolversToSchema({
    schema: schemaResult,
    resolvers: {
      Query: createQueryResolvers(),
      Mutation: createMutationResolvers(),
      User: createEntityResolvers(enhancedUserEntity),
      Product: createEntityResolvers(enhancedProductEntity),
      Order: createEntityResolvers(enhancedOrderEntity)
    }
  })

  // Create Yoga server
  const yoga = createYoga({
    schema: schemaWithResolvers,
    context: () => ({
      userId: 'system',
      traceId: `trace-${Date.now()}`,
      timestamp: Date.now()
    }),
    plugins: [
      // Add logging
      {
        onRequest: ({ request }) => {
          console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`)
        }
      }
    ],
    graphiql: {
      title: 'GraphQL Federation Server',
      defaultQuery: `# Welcome to the Federation Server!
# Try these queries:

# Get a user
query GetUser {
  GetUser(input: { id: "user-1" }) {
    data
    metadata {
      timestamp
      executionTime
      cached
    }
  }
}

# Get a product
query GetProduct {
  GetProduct(input: { id: "product-1" }) {
    data
    metadata {
      timestamp
      executionTime
      cached
    }
  }
}

# Get an order
query GetOrder {
  GetOrder(input: { id: "order-1" }) {
    data
    metadata {
      timestamp
      executionTime
      cached
    }
  }
}

# Create a user
mutation CreateUser {
  CreateUser(input: {
    email: "newuser@example.com"
    username: "newuser"
    firstName: "New"
    lastName: "User"
  }) {
    success
    aggregateId
    version
    error
  }
}`
    }
  })

  return yoga
}

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the federation server
 */
const startServer = async () => {
  try {
    console.log('🚀 Starting GraphQL Federation Server...')

    const yoga = await createYogaServer()
    const server = createServer(yoga)

    server.listen(PORT, HOST, () => {
      console.log(`✅ Federation server running at http://${HOST}:${PORT}`)
      console.log(`📊 GraphiQL available at http://${HOST}:${PORT}/graphiql`)
      console.log(`🔗 Health check at http://${HOST}:${PORT}/health`)
      console.log('')
      console.log('📋 Available Operations:')
      console.log('  • GetUser(input: { id: String! }): QueryResult!')
      console.log('  • GetProduct(input: { id: String! }): QueryResult!')
      console.log('  • GetOrder(input: { id: String! }): QueryResult!')
      console.log('  • CreateUser(input: CreateUserInput!): CommandResult!')
      console.log('  • CreateProduct(input: CreateProductInput!): CommandResult!')
      console.log('  • CreateOrder(input: CreateOrderInput!): CommandResult!')
      console.log('')
      console.log('🏗️  Federation Features:')
      console.log('  • Entity resolution with @key directives')
      console.log('  • Cross-service field resolution')
      console.log('  • Effect-TS error handling')
      console.log('  • Type-safe schema generation')
      console.log('')
      console.log('Press Ctrl+C to stop the server')
    })

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down federation server...')
      server.close(() => {
        console.log('✅ Server stopped')
        process.exit(0)
      })
    })

  } catch (error) {
    console.error('❌ Failed to start federation server:', error)
    process.exit(1)
  }
}

// ============================================================================
// Export and Run
// ============================================================================

export { createYogaServer, startServer }

// Export for programmatic execution
export { startServer as main }

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}
