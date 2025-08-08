import { readGraphql } from '../read-graphql';
import * as UserFragments from '../fragments/user.fragments';

// Query: Get single user with all details
export const GET_USER_QUERY = readGraphql(`
  query GetUser($id: ID!) {
    getUser(id: $id) {
      ...UserDetailFields
    }
  }
`, [UserFragments.UserDetailFieldsFragment]);

// Query: List users with pagination
export const LIST_USERS_QUERY = readGraphql(`
  query ListUsers($limit: Int, $offset: Int) {
    listUsers(limit: $limit, offset: $offset) {
      ...UserListFields
    }
  }
`, [UserFragments.UserListFieldsFragment]);

// Query: Search users
export const SEARCH_USERS_QUERY = readGraphql(`
  query SearchUsers($query: String!) {
    searchUsers(query: $query) {
      ...UserDetailFields
    }
  }
`, [UserFragments.UserDetailFieldsFragment]);