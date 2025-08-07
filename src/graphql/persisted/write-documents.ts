import { writeGraphql } from '../write-graphql';
import {
  CREATE_USER_MUTATION,
  UPDATE_USER_MUTATION,
  DELETE_USER_MUTATION
} from '../write/mutations';

// Persisted write mutations with unique IDs
export const PERSISTED_CREATE_USER = writeGraphql.persisted('createNewUser', CREATE_USER_MUTATION);
export const PERSISTED_UPDATE_USER = writeGraphql.persisted('updateExistingUser', UPDATE_USER_MUTATION);
export const PERSISTED_DELETE_USER = writeGraphql.persisted('deleteUserById', DELETE_USER_MUTATION);

// Export all persisted documents for manifest generation
export const writePersistedDocuments = [
  PERSISTED_CREATE_USER,
  PERSISTED_UPDATE_USER,
  PERSISTED_DELETE_USER,
];