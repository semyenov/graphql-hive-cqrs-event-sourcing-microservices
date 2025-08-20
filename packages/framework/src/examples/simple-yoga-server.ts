/**
 * Simple Yoga GraphQL Federation Server
 * 
 * Demonstrates the federation framework with a real GraphQL server
 */

import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import {
  generateFederatedSchema,
  buildFederatedSchema,
  createEntityResolver,
  type DomainSchemaConfig,
  type FederationEntity,
  EntityResolverError
} from "../graphql/federation"
import { federationConfig, OrderItem, OrderState, ProductState, UserState } from './federation-example'
import { Option } from 'effect'

// ============================================================================
// Server Configuration
// ============================================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000
const HOST = process.env.HOST || 'localhost'

// ============================================================================
// Mock Data Store
// ============================================================================

const mockUsers = new Map<string, UserState>([
  ['user-1', {
    id: 'user-1' as UserState['id'],
    email: 'alice@example.com' as UserState['email'],
    username: 'alice' as UserState['username'],
    firstName: 'Alice',
    lastName: 'Johnson',
    isActive: true,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    updatedAt: Date.now()
  }],
  ['user-2', {
    id: 'user-2' as UserState['id'],
    email: 'bob@example.com' as UserState['email'],
    username: 'bob' as UserState['username'],
    firstName: 'Bob',
    lastName: 'Smith',
    isActive: true,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    updatedAt: Date.now()
  }]
])

const mockProducts = new Map<string, ProductState>([
  ['product-1', {
    id: 'product-1' as ProductState['id'],
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99 as ProductState['price'],
    categoryId: 'electronics' as ProductState['categoryId'],
    inStock: true,
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now()
  }],
  ['product-2', {
    id: 'product-2' as ProductState['id'],
    name: 'Mouse',
    description: 'Wireless mouse',
    price: 29.99 as ProductState['price'],
    categoryId: 'electronics' as ProductState['categoryId'],
    inStock: true,
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now()
  }]
])

const mockOrders = new Map<string, OrderState>([
  ['order-1', {
    id: 'order-1' as OrderState['id'],
    userId: 'user-1' as UserState['id'],
    items: [
      { productId: 'product-1' as ProductState['id'], quantity: 1, price: 999.99 as ProductState['price'] }
    ],
    total: 999.99 as OrderState['total'],
    status: 'completed' as OrderState['status'],
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now()
  }],
  ['order-2', {
    id: 'order-2' as OrderState['id'],
    userId: 'user-2' as UserState['id'],
    items: [
      { productId: 'product-2' as ProductState['id'], quantity: 2, price: 29.99 as ProductState['price'] }
    ],
    total: 59.98 as OrderState['total'],
    status: 'pending' as OrderState['status'],
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now()
  }]
])

// ============================================================================
// Simple Entity Definitions
// ============================================================================

const userEntity: FederationEntity<UserState, unknown, unknown, UserState> = {
  typename: 'User',
  key: 'id',
  schema: UserState,
  resolveReference: (reference) => Effect.succeed(mockUsers.get(reference.id as string) as UserState),
  fields: {}
}

const productEntity: FederationEntity<ProductState, unknown, unknown, ProductState> = {
  typename: 'Product',
  key: 'id',
  schema: ProductState,
  resolveReference: (reference) => Effect.succeed(mockProducts.get(reference.id as string) as ProductState),
  fields: {}
}

const orderEntity: FederationEntity<OrderState, unknown, unknown, OrderState> = {
  typename: 'Order',
  key: 'id',
  schema: OrderState,
  resolveReference: (reference) => Effect.succeed(mockOrders.get(reference.id as string) as OrderState),
  fields: {}
}


// ============================================================================
// Query Resolvers
// ============================================================================

const createQueryResolvers = () => ({
  GetUser: async (_parent: unknown, { input }: { input: { id: string } }) => {
    const user = mockUsers.get(input.id)
    if (!user) {
      throw new Error(`User ${input.id} not found`)
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

  GetProduct: async (_parent: unknown, { input }: { input: { id: string } }) => {
    const product = mockProducts.get(input.id)
    if (!product) {
      throw new Error(`Product ${input.id} not found`)
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

  GetOrder: async (_parent: unknown, { input }: { input: { id: string } }) => {
    const order = mockOrders.get(input.id)
    if (!order) {
      throw new Error(`Order ${input.id} not found`)
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

const createMutationResolvers = () => ({
  CreateUser: async (_parent: unknown, { input }: { input: any }) => {
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

  CreateProduct: async (_parent: unknown, { input }: { input: any }) => {
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

  CreateOrder: async (_parent: unknown, { input }: { input: any }) => {
    const orderId = `order-${Date.now()}` as OrderState['id']
    const order: OrderState = {
      id: orderId,
      userId: input.userId,
      items: input.items,
      total: input.items.reduce((sum: number, item: OrderItem) => sum + (item.price || 0), 0),
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

const createYogaServer = async () => {
  // Generate the federated schema
  const schemaResult = await Effect.runPromise(
    buildFederatedSchema(federationConfig)
  )

  // Create Yoga server
  const yoga = createYoga({
    schema: schemaResult,
    context: () => ({
      userId: 'system',
      traceId: `trace-${Date.now()}`,
      timestamp: Date.now()
    }),
    plugins: [
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

const startServer = async () => {
  try {
    console.log('🚀 Starting Simple GraphQL Federation Server...')

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