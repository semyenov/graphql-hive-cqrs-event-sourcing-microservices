import { graphql } from '../graphql';
import * as UserFragments from './fragments/user.fragments';

// Type-safe queries with fragments
export const GET_USER_QUERY = graphql(`
  query GetUser($id: ID!) {
    getUser(id: $id) {
      ...UserDetail
    }
  }
`, [UserFragments.UserDetailFieldsFragment]);

export const LIST_USERS_QUERY = graphql(`
  query ListUsers($limit: Int, $offset: Int) {
    listUsers(limit: $limit, offset: $offset) {
      users {
        ...UserDetail
      }
      total
      hasMore
    }
  }
`, [UserFragments.UserDetailFieldsFragment]);

export const SEARCH_USERS_QUERY = graphql(`
  query SearchUsers($query: String!) {
    searchUsers(query: $query) {
      ...UserDetail
      createdAt
    }
  }
`, [UserFragments.UserDetailFieldsFragment]);