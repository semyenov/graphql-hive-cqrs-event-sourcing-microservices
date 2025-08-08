import { graphql } from '../graphql';

// Define reusable fragments for common data shapes
export const UserFragment = graphql(`
  fragment UserFields on User {
    id
    name
    email
  }
`);

export const UserDetailFragment = graphql(`
  fragment UserDetail on User {
    ...UserFields
    createdAt
    updatedAt
  }
`, [UserFragment]);

export const ErrorFragment = graphql(`
  fragment ErrorFields on Error {
    field
    message
  }
`);

export const MutationPayloadFragment = graphql(`
  fragment MutationPayload on CreateUserPayload {
    success
    errors {
      ...ErrorFields
    }
  }
`, [ErrorFragment]);