import { readGraphql } from '../read-graphql';

import {
  GET_USER_QUERY,
  LIST_USERS_QUERY,
  SEARCH_USERS_QUERY
} from '../read/queries';

// Persisted read queries with unique IDs
export const PERSISTED_GET_USER = readGraphql.persisted('getUserById', GET_USER_QUERY);
export const PERSISTED_LIST_USERS = readGraphql.persisted('listUsersWithPagination', LIST_USERS_QUERY);
export const PERSISTED_SEARCH_USERS = readGraphql.persisted('searchUsersByQuery', SEARCH_USERS_QUERY);

// Export all persisted documents for manifest generation
export const readPersistedDocuments = [
  PERSISTED_GET_USER,
  PERSISTED_LIST_USERS,
  PERSISTED_SEARCH_USERS,
];