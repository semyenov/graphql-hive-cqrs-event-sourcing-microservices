import type { MutationResolvers } from '../../../generated/resolvers';
import { BrandedTypes } from '@cqrs-framework/core';
import { errorToGraphQL } from '@cqrs-framework/graphql';
import { UserAggregate } from '../../../domains/user/aggregates/UserAggregate';
import { userRepository } from '../../../repositories';
import { createUserMapper } from '../../../integration';

export const createUserResolver: MutationResolvers['createUser'] = async (
  _parent,
  args,
  _context,
  _info
) => {
  try {
    // Generate new aggregate ID
    const aggregateId = BrandedTypes.aggregateId(crypto.randomUUID());
    
    // Create new aggregate
    const aggregate = new UserAggregate(aggregateId);
    
    // Map GraphQL input to domain event data
    const eventData = createUserMapper(args.input);
    
    // Execute domain command
    aggregate.create(eventData);
    
    // Save aggregate (this will append events to event store)
    await userRepository.save(aggregate);
    
    // Get the created user
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