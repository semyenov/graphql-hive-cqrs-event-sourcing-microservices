/**
 * Framework Type Utilities Module
 * 
 * Advanced TypeScript type utilities for better type inference,
 * domain modeling, and compile-time type safety.
 */

// Type inference utilities
export * from './inference';

// Domain modeling utilities
export * from './domain';

/**
 * Quick reference for type utilities:
 * 
 * 1. Type Inference:
 * ```typescript
 * import { InferCommand, InferEvent } from '@cqrs/framework/types';
 * 
 * type CreateUserCmd = InferCommand<typeof CreateUserSchema>;
 * type UserCreatedEvt = InferEvent<typeof UserCreatedSchema>;
 * ```
 * 
 * 2. Domain Modeling:
 * ```typescript
 * import { ValueObject, Entity, AggregateRoot } from '@cqrs/framework/types';
 * 
 * type UserId = ValueObject<'UserId', string>;
 * type User = Entity<UserId, UserProperties>;
 * type UserAggregate = AggregateRoot<User, UserEvent>;
 * ```
 * 
 * 3. Algebraic Data Types:
 * ```typescript
 * import { Sum, Product, Maybe, Result } from '@cqrs/framework/types';
 * 
 * type PaymentMethod = Sum<{
 *   CreditCard: { number: string; cvv: string };
 *   PayPal: { email: string };
 *   BankTransfer: { accountNumber: string };
 * }>;
 * 
 * type UserProfile = Product<{
 *   personalInfo: PersonalInfo;
 *   preferences: Preferences;
 *   settings: Settings;
 * }>;
 * ```
 */