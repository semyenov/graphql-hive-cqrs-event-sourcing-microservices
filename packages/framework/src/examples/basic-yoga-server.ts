/**
 * Basic Yoga GraphQL Server
 * 
 * Simple demonstration of Yoga with GraphQL
 */

import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQLNonNull } from 'graphql'

// ============================================================================
// Server Configuration
// ============================================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000
const HOST = process.env.HOST || 'localhost'

// ============================================================================
// Mock Data
// ============================================================================

const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com' }
]

const products = [
  { id: '1', name: 'Laptop', price: 999.99 },
  { id: '2', name: 'Mouse', price: 29.99 },
  { id: '3', name: 'Keyboard', price: 79.99 }
]

// ============================================================================
// GraphQL Schema
// ============================================================================

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: new GraphQLNonNull(GraphQLString) }
  }
})

const ProductType = new GraphQLObjectType({
  name: 'Product',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    price: { type: new GraphQLNonNull(GraphQLInt) }
  }
})

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    users: {
      type: new GraphQLList(UserType),
      resolve: () => users
    },
    user: {
      type: UserType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: (_, { id }) => users.find(user => user.id === id)
    },
    products: {
      type: new GraphQLList(ProductType),
      resolve: () => products
    },
    product: {
      type: ProductType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: (_, { id }) => products.find(product => product.id === id)
    },
    hello: {
      type: GraphQLString,
      resolve: () => 'Hello from Yoga GraphQL Server!'
    }
  }
})

const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createUser: {
      type: UserType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: (_, { name, email }) => {
        const newUser = {
          id: String(users.length + 1),
          name,
          email
        }
        users.push(newUser)
        return newUser
      }
    },
    createProduct: {
      type: ProductType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
        price: { type: new GraphQLNonNull(GraphQLInt) }
      },
      resolve: (_, { name, price }) => {
        const newProduct = {
          id: String(products.length + 1),
          name,
          price
        }
        products.push(newProduct)
        return newProduct
      }
    }
  }
})

const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType
})

// ============================================================================
// Yoga Server
// ============================================================================

const yoga = createYoga({
  schema,
  graphiql: {
    title: 'Basic GraphQL Server',
    defaultQuery: `# Welcome to the Basic GraphQL Server!
# Try these queries:

# Get all users
query GetUsers {
  users {
    id
    name
    email
  }
}

# Get a specific user
query GetUser {
  user(id: "1") {
    id
    name
    email
  }
}

# Get all products
query GetProducts {
  products {
    id
    name
    price
  }
}

# Get a specific product
query GetProduct {
  product(id: "1") {
    id
    name
    price
  }
}

# Create a new user
mutation CreateUser {
  createUser(name: "New User", email: "newuser@example.com") {
    id
    name
    email
  }
}

# Create a new product
mutation CreateProduct {
  createProduct(name: "New Product", price: 100) {
    id
    name
    price
  }
}`
  }
})

// ============================================================================
// Server Startup
// ============================================================================

const server = createServer(yoga)

server.listen(PORT, HOST, () => {
  console.log('🚀 Basic GraphQL Server Started!')
  console.log(`✅ Server running at http://${HOST}:${PORT}`)
  console.log(`📊 GraphiQL available at http://${HOST}:${PORT}/graphiql`)
  console.log(`🔗 Health check at http://${HOST}:${PORT}/health`)
  console.log('')
  console.log('📋 Available Operations:')
  console.log('  • users: [User]')
  console.log('  • user(id: String!): User')
  console.log('  • products: [Product]')
  console.log('  • product(id: String!): Product')
  console.log('  • createUser(name: String!, email: String!): User')
  console.log('  • createProduct(name: String!, price: Int!): Product')
  console.log('')
  console.log('Press Ctrl+C to stop the server')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  server.close(() => {
    console.log('✅ Server stopped')
    process.exit(0)
  })
}) 