import type { MutationResolvers } from '../../../generated/resolvers';
import { createUserResolver } from './createUser';
import { updateUserResolver } from './updateUser';
import { deleteUserResolver } from './deleteUser';

// Type-safe mutation resolvers
export const mutationResolvers: MutationResolvers = {
  createUser: createUserResolver,
  updateUser: updateUserResolver,  
  deleteUser: deleteUserResolver,
};