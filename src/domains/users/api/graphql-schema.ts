/**
 * User Domain: GraphQL Schema
 * 
 * GraphQL type definitions for the user domain.
 */

export const userGraphQLSchema = `
  # User status enumeration
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
    DEACTIVATED
    DELETED
  }

  # User role enumeration
  enum UserRole {
    USER
    MODERATOR
    ADMIN
    SUPER_ADMIN
  }

  # Theme preference
  enum Theme {
    light
    dark
    system
  }

  # User profile type
  type UserProfile {
    firstName: String!
    lastName: String!
    displayName: String!
    bio: String
    avatarUrl: String
    location: String
    website: String
    socialLinks: SocialLinks
  }

  # Social links type
  type SocialLinks {
    twitter: String
    github: String
    linkedin: String
  }

  # User preferences type
  type UserPreferences {
    theme: Theme!
    language: String!
    timezone: String!
    emailNotifications: Boolean!
    pushNotifications: Boolean!
    twoFactorEnabled: Boolean!
  }

  # Main user type
  type User {
    id: ID!
    email: String!
    username: String!
    status: UserStatus!
    role: UserRole!
    profile: UserProfile!
    preferences: UserPreferences!
    emailVerified: Boolean!
    emailVerifiedAt: String
    createdAt: String!
    updatedAt: String!
    lastLoginAt: String
  }

  # User session type
  type UserSession {
    sessionId: ID!
    userId: ID!
    createdAt: String!
    lastActivityAt: String!
    expiresAt: String!
    ipAddress: String!
    userAgent: String
    isActive: Boolean!
  }

  # User stats type
  type UserStats {
    total: Int!
    active: Int!
    pending: Int!
    suspended: Int!
    deleted: Int!
    verified: Int!
    withTwoFactor: Int!
    newToday: Int!
    newThisWeek: Int!
    newThisMonth: Int!
    byRole: RoleStats!
  }

  # Role statistics
  type RoleStats {
    users: Int!
    moderators: Int!
    admins: Int!
    superAdmins: Int!
  }

  # Pagination input
  input PaginationInput {
    offset: Int
    limit: Int
    sortBy: String
    sortOrder: SortOrder
  }

  # Sort order enum
  enum SortOrder {
    asc
    desc
  }

  # User filter input
  input UserFilterInput {
    status: [UserStatus!]
    role: [UserRole!]
    emailVerified: Boolean
    createdAfter: String
    createdBefore: String
    hasTwoFactor: Boolean
  }

  # User list response
  type UserListResponse {
    users: [User!]!
    total: Int!
    offset: Int!
    limit: Int!
  }

  # Availability check response
  type AvailabilityResponse {
    available: Boolean!
    suggestions: [String!]
  }

  # Authentication response
  type AuthResponse {
    user: User!
    token: String!
    sessionId: ID!
    expiresAt: String!
    requiresTwoFactor: Boolean!
  }

  # Operation result
  type OperationResult {
    success: Boolean!
    message: String
  }

  # Create user input
  input CreateUserInput {
    email: String!
    username: String!
    password: String!
    firstName: String!
    lastName: String!
    displayName: String
  }

  # Update user input
  input UpdateUserInput {
    email: String
    username: String
  }

  # Update profile input
  input UpdateProfileInput {
    firstName: String
    lastName: String
    displayName: String
    bio: String
    avatarUrl: String
    location: String
    website: String
    socialLinks: SocialLinksInput
  }

  # Social links input
  input SocialLinksInput {
    twitter: String
    github: String
    linkedin: String
  }

  # Update preferences input
  input UpdatePreferencesInput {
    theme: Theme
    language: String
    timezone: String
    emailNotifications: Boolean
    pushNotifications: Boolean
  }

  # Change password input
  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  # Reset password input
  input ResetPasswordInput {
    token: String!
    newPassword: String!
  }

  # Login input
  input LoginInput {
    email: String
    username: String
    password: String!
    twoFactorCode: String
    rememberMe: Boolean
  }

  # Setup two-factor input
  input SetupTwoFactorInput {
    method: TwoFactorMethod!
    verificationCode: String!
  }

  # Two-factor method enum
  enum TwoFactorMethod {
    TOTP
    SMS
    EMAIL
  }

  # Query root
  extend type Query {
    # Get current user
    me: User

    # Get user by ID
    user(id: ID!): User

    # Get user by email
    userByEmail(email: String!): User

    # Get user by username
    userByUsername(username: String!): User

    # List users with pagination and filters
    users(
      pagination: PaginationInput
      filters: UserFilterInput
    ): UserListResponse!

    # Search users
    searchUsers(
      searchTerm: String!
      searchFields: [String!]
      pagination: PaginationInput
      filters: UserFilterInput
    ): UserListResponse!

    # Get user statistics
    userStats(
      period: StatsPeriod
      groupBy: String
    ): UserStats!

    # Get user sessions
    userSessions(
      userId: ID!
      activeOnly: Boolean
    ): [UserSession!]!

    # Check email availability
    checkEmailAvailability(email: String!): AvailabilityResponse!

    # Check username availability
    checkUsernameAvailability(username: String!): AvailabilityResponse!
  }

  # Stats period enum
  enum StatsPeriod {
    day
    week
    month
    year
    all
  }

  # Mutation root
  extend type Mutation {
    # Create a new user account
    createUser(input: CreateUserInput!): User!

    # Update user information
    updateUser(
      userId: ID!
      input: UpdateUserInput!
    ): User!

    # Update user profile
    updateProfile(
      userId: ID!
      input: UpdateProfileInput!
    ): User!

    # Update user preferences
    updatePreferences(
      userId: ID!
      input: UpdatePreferencesInput!
    ): User!

    # Delete user account
    deleteUser(
      userId: ID!
      reason: String
    ): OperationResult!
    
    # Verify user email
    verifyUserEmail(
      id: ID!
      token: String!
    ): OperationResult!
    
    # Update user profile
    updateUserProfile(
      id: ID!
      input: UpdateProfileInput!
    ): OperationResult!

    # Suspend user account
    suspendUser(
      userId: ID!
      reason: String!
      until: String
    ): OperationResult!

    # Activate user account
    activateUser(userId: ID!): User!

    # Deactivate user account
    deactivateUser(userId: ID!): User!

    # Verify email address
    verifyEmail(
      token: String!
    ): OperationResult!

    # Request email verification
    requestEmailVerification(
      userId: ID!
    ): OperationResult!

    # Change password
    changePassword(
      userId: ID!
      input: ChangePasswordInput!
    ): OperationResult!

    # Request password reset
    requestPasswordReset(
      email: String!
    ): OperationResult!

    # Reset password
    resetPassword(
      input: ResetPasswordInput!
    ): OperationResult!

    # User login
    login(input: LoginInput!): AuthResponse!

    # User logout
    logout(
      sessionId: ID!
      everywhere: Boolean
    ): OperationResult!

    # Refresh session
    refreshSession(
      sessionId: ID!
    ): AuthResponse!

    # Enable two-factor authentication
    enableTwoFactor(
      userId: ID!
      input: SetupTwoFactorInput!
    ): OperationResult!

    # Disable two-factor authentication
    disableTwoFactor(
      userId: ID!
      password: String!
      verificationCode: String!
    ): OperationResult!

    # Verify two-factor code
    verifyTwoFactor(
      userId: ID!
      code: String!
    ): AuthResponse!

    # Change user role
    changeUserRole(
      userId: ID!
      newRole: UserRole!
    ): User!

    # Revoke user session
    revokeSession(
      sessionId: ID!
    ): OperationResult!

    # Revoke all user sessions
    revokeAllSessions(
      userId: ID!
    ): OperationResult!
  }

  # Subscription root
  extend type Subscription {
    # Subscribe to user updates
    userUpdated(userId: ID!): User!

    # Subscribe to user status changes
    userStatusChanged(userId: ID!): User!

    # Subscribe to new user registrations
    newUserRegistered: User!
  }
`;