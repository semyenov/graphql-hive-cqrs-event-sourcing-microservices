/**
 * User Domain: GraphQL Schema
 * 
 * GraphQL type definitions for user domain.
 */

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
    user(id: ID!): User
    userByEmail(email: String!): User
    users(pagination: PaginationInput!, includeDeleted: Boolean): UserListResponse!
    searchUsers(input: UserSearchInput!): [User!]!
    userStats: UserStats!
  }

  extend type Mutation {
    createUser(input: CreateUserInput!): UserMutationResponse!
    updateUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    deleteUser(id: ID!, input: UpdateUserInput!): UserMutationResponse!
    verifyUserEmail(id: ID!, token: String!): UserMutationResponse!
    updateUserProfile(id: ID!, input: UpdateUserProfileInput!): UserMutationResponse!
  }
`;