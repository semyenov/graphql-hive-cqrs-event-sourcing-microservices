import { writeGraphql } from '../write-graphql';
import * as UserFragments from '../fragments/user.fragments';

// Mutation: Create a new user
export const CREATE_USER_MUTATION = writeGraphql(`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      ...CreateUserPayload
    }
  }
`, [UserFragments.CreateUserPayloadFragment]);

// Mutation: Update existing user
export const UPDATE_USER_MUTATION = writeGraphql(`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      ...UpdateUserPayload
    }
  }
`, [UserFragments.UpdateUserPayloadFragment]);

// Mutation: Delete user
export const DELETE_USER_MUTATION = writeGraphql(`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      ...DeleteUserPayload
    }
  }
`, [UserFragments.DeleteUserPayloadFragment]);
