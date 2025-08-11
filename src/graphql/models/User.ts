/**
 * User Model for GraphQL
 * 
 * Represents the User type in GraphQL schema
 */

import type { AggregateId } from '@cqrs/framework/core/branded/types';

export interface UserModel {
  id: AggregateId;
  email: string;
  name: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}