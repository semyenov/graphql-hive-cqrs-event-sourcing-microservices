/**
 * API Layer: GraphQL Schema
 * 
 * Defines the GraphQL API contract for user operations.
 * Exposes domain capabilities through a clean GraphQL interface.
 */

export const userGraphQLSchema = `
  # User entity with complete profile information
  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    deleted: Boolean!
    createdAt: String!
    updatedAt: String!
    profile: UserProfile
  }

  # User profile information
  type UserProfile {
    bio: String
    avatar: String
    location: String
  }

  # User statistics for analytics
  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    deletedUsers: Int!
    verifiedEmails: Int!
    createdToday: Int!
    lastActivity: String!
  }

  # User list result with pagination
  type UsersResult {
    users: [User!]!
    total: Int!
    offset: Int!
    limit: Int!
  }

  # Pagination input
  input PaginationInput {
    offset: Int! = 0
    limit: Int! = 10
    sortBy: String
    sortOrder: SortOrder = ASC
  }

  # Sort order enum
  enum SortOrder {
    ASC
    DESC
  }

  # Create user input
  input CreateUserInput {
    name: String!
    email: String!
  }

  # Update user input
  input UpdateUserInput {
    name: String
    email: String
  }

  # Update user profile input
  input UpdateUserProfileInput {
    bio: String
    avatar: String
    location: String
  }

  # Change password input
  input ChangePasswordInput {
    newPassword: String!
  }

  # Delete user input
  input DeleteUserInput {
    reason: String
  }

  # Command result type
  type CommandResult {
    success: Boolean!
    message: String
    userId: ID
  }

  # Root query type
  extend type Query {
    # Get user by ID
    user(id: ID!): User
    
    # Get user by email
    userByEmail(email: String!): User
    
    # List users with pagination and filtering
    users(
      pagination: PaginationInput!
      includeDeleted: Boolean = false
    ): UsersResult!
    
    # Get user statistics
    userStats: UserStats!
  }

  # Root mutation type
  extend type Mutation {
    # Create a new user
    createUser(input: CreateUserInput!): CommandResult!
    
    # Update user information
    updateUser(id: ID!, input: UpdateUserInput!): CommandResult!
    
    # Delete user (soft delete)
    deleteUser(id: ID!, input: DeleteUserInput): CommandResult!
    
    # Verify user email
    verifyUserEmail(id: ID!): CommandResult!
    
    # Change user password
    changeUserPassword(id: ID!, input: ChangePasswordInput!): CommandResult!
    
    # Update user profile
    updateUserProfile(id: ID!, input: UpdateUserProfileInput!): CommandResult!
  }
`; 