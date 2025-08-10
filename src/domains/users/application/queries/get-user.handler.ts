/**
 * Application Layer: Get User Query Handler
 * 
 * Handles queries for retrieving a specific user by ID.
 * Uses projections for optimized read operations.
 */

import type { GetUserByIdQuery } from '../../domain/user.queries';
import type { UserState } from '../../domain/user.types';
import type { ProjectionBuilder } from '../../../../framework/infrastructure/projections/builder';
import type { UserEvent } from '../../domain/user.events';

/**
 * Get user by ID query handler
 * 
 * @param userProjection - User projection for reading user data
 * @param query - Get user by ID query
 * @returns User state or null if not found
 */
export async function getUserHandler(
  userProjection: ProjectionBuilder<UserEvent, UserState>,
  query: GetUserByIdQuery
): Promise<UserState | null> {
  const userId = query.parameters.userId as string;
  return userProjection.get(userId);
}

/**
 * Get user by email query handler
 * 
 * @param userProjection - User projection for reading user data
 * @param query - Get user by email query
 * @returns User state or null if not found
 */
export async function getUserByEmailHandler(
  userProjection: ProjectionBuilder<UserEvent, UserState>,
  query: { parameters: { email: string } }
): Promise<UserState | null> {
  const users = userProjection.search(user => user.email === query.parameters.email);
  return users[0] || null;
} 