import type { MutationResolvers } from '../../types/generated/resolvers';
import { userRepository } from '../../repositories';
import { updateUserMapper } from '../../types/integration';
import { errorToGraphQL } from '../../types/graphql-error-adapter';

export const updateUserResolver: MutationResolvers['updateUser'] = async (
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
    
    // Map GraphQL input to domain event data
    const eventData = updateUserMapper(args.input);
    
    // Execute domain command
    aggregate.update(eventData);
    
    // Save aggregate (this will append events to event store)
    await userRepository.save(aggregate);
    
    // Get the updated user
    const user = aggregate.getUser();
    
    return {
      success: true,
      user,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      errors: [errorToGraphQL(error)],
      user: null
    };
  }
};