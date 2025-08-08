import { readGraphql } from '../read-graphql';
import { writeGraphql } from '../write-graphql';

// Read schema fragments
export const UserBasicFieldsFragment = readGraphql(`
  fragment UserBasicFields on User {
    id
    name
    email
  }
`);

export const UserDetailFieldsFragment = readGraphql(`
  fragment UserDetailFields on User {
    ...UserBasicFields
    createdAt
    updatedAt
  }
`, [UserBasicFieldsFragment]);

export const UserListFieldsFragment = readGraphql(`
  fragment UserListFields on UserList {
    users {
      ...UserBasicFields
    }
    total
    hasMore
  }
`, [UserBasicFieldsFragment]);

// Write schema fragments
export const WriteUserFieldsFragment = writeGraphql(`
  fragment WriteUserFields on User {
    id
    name
    email
  }
`);

export const ErrorFieldsFragment = writeGraphql(`
  fragment ErrorFields on Error {
    field
    message
  }
`);

export const MutationPayloadFieldsFragment = writeGraphql(`
  fragment MutationPayloadFields on CreateUserPayload {
    success
    errors {
      ...ErrorFields
    }
  }
`, [ErrorFieldsFragment]);

// Specific payload fragments for each mutation
export const CreateUserPayloadFragment = writeGraphql(`
  fragment CreateUserPayload on CreateUserPayload {
    ...MutationPayloadFields
    user {
      ...WriteUserFields
    }
  }
`, [MutationPayloadFieldsFragment, WriteUserFieldsFragment]);

export const UpdateUserPayloadFragment = writeGraphql(`
  fragment UpdateUserPayload on UpdateUserPayload {
    success
    errors {
      ...ErrorFields
    }
    user {
      ...WriteUserFields
    }
  }
`, [ErrorFieldsFragment, WriteUserFieldsFragment]);

export const DeleteUserPayloadFragment = writeGraphql(`
  fragment DeleteUserPayload on DeleteUserPayload {
    success
    errors {
      ...ErrorFields
    }
  }
`, [ErrorFieldsFragment]);