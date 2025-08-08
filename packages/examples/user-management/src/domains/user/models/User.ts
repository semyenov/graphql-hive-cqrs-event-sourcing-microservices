// User domain models and types using framework branded types
import type { AggregateId, CreatedAt, UpdatedAt } from '@cqrs-framework/core';

// Domain User model 
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// Command input types
export interface CreateUserInput extends Record<string, unknown> {
  name: string;
  email: string;
}

export interface UpdateUserInput extends Record<string, unknown> {
  name?: string;
  email?: string;
}