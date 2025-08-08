import { graphql } from '../graphql';
import * as UserFragments from './fragments/user.fragments';

// Type-safe mutations
export const CREATE_USER_MUTATION = graphql(`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      user {
        ...UserDetail
      }
      errors {
        ...ErrorFields
      }
    }
  }
`, [UserFragments.UserDetailFieldsFragment, UserFragments.ErrorFieldsFragment]);

export const UPDATE_USER_MUTATION = graphql(`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      user {
        ...UserDetailFields
      }
      errors {
        ...ErrorFields
      }
    }
  }
`, [UserFragments.UserDetailFieldsFragment, UserFragments.ErrorFieldsFragment]);

export const DELETE_USER_MUTATION = graphql(`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      errors {
        ...ErrorFields
      }
    }
  }
`, [UserFragments.ErrorFieldsFragment]);