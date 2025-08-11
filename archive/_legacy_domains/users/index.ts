/**
 * User Domain - Main Entry Point
 * 
 * Exports the public API of the user domain using the new layered architecture.
 * Provides clean separation between layers and controlled access to domain functionality.
 */

// Domain Layer - Pure business logic
export * from './domain';

// Application Layer - Use cases and workflows  
export * from './application/commands';
export * from './application/queries';

// Infrastructure Layer - Technical implementation
export * from './infrastructure';

// API Layer - External interfaces
export * from './api';

// Shared utilities
export * from './shared/type-guards';

// Module initialization  
export { createUserDomain, initializeUserDomain, type UserDomainConfig, type UserDomainContext } from './user.module';