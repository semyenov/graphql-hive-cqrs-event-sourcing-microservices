export const userGraphQLSchema = `
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

  type UserProfile {
    bio: String
    avatar: String
    location: String
  }

  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    deletedUsers: Int!
    verifiedEmails: Int!
    createdToday: Int!
  }

  input CreateUserInput {
    name: String!
    email: String!
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  input UpdateUserProfileInput {
    bio: String
    avatar: String
    location: String
  }

  input UserSearchInput {
    searchTerm: String!
    fields: [String!]
  }

  input PaginationInput {
    offset: Int!
    limit: Int!
    sortBy: String
    sortOrder: String
  }

  type UserMutationResponse {
    success: Boolean!
    user: User
    errors: [Error!]
  }

  type UserListResponse {
    users: [User!]!
    total: Int!
    hasNext: Boolean!
  }

  type Error {
    field: String!
    message: String!
    code: String
  }

  extend type Query {
    # Get single user by ID
    user(id: ID!): User
    
    # Get user by email
    userByEmail(email: String!): User
    
    # List users with pagination
    users(pagination: PaginationInput!, includeDeleted: Boolean): UserListResponse!
    
    # Search users
    searchUsers(input: UserSearchInput!): [User!]!
    
    # Get user statistics
    userStats: UserStats!
  }

  extend type Mutation {
    # Create a new user
    createUser(input: CreateUserInput!): UserMutationResponse!
    
    # Update user details
    updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    
    # Delete user (soft delete)
    deleteUser(id: ID!, reason: String): UserMutationResponse!
    
    # Verify user email
    verifyUserEmail(id: ID!, token: String!): UserMutationResponse!
    
    # Update user profile
    updateUserProfile(id: ID!, input: UpdateUserProfileInput!): UserMutationResponse!
  }
`; 