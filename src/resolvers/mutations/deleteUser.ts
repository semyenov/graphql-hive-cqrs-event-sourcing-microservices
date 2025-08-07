import type { MutationResolvers } from '../../types/generated/resolvers';
import { userRepository } from '../../repositories';
import { errorToGraphQL } from '../../types/graphql-error-adapter';

export const deleteUserResolver: MutationResolvers['deleteUser'] = async (
  _parent,
  args,
  _context,
  _info
) => {
  try {
    // Get existing aggregate
    const aggregate = await userRepository.get(args.id);
    
    if (!aggregate) {
      throw new Error(`User with id ${args.id} not found`);
    }
    
    // Execute domain command
    aggregate.delete();
    
    // Save aggregate (this will append events to event store)
    await userRepository.save(aggregate);
    
    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      errors: [errorToGraphQL(error)]
    };
  }
};