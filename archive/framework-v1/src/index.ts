/**
 * CQRS/Event Sourcing Framework with Effect-TS
 * 
 * A modern functional framework for building event-sourced applications
 * with CQRS pattern using Effect-TS for functional programming.
 * 
 * Features:
 * - Runtime validation with Zod and compile-time safety
 * - Pattern matching with ts-pattern for exhaustive checking
 * - Functional effects with Effect-TS v3
 * - Type-safe error handling with Data.TaggedError
 * - Dependency injection with Context/Layer
 * - Streaming and reactive patterns
 * - Circuit breaker and retry patterns
 * - Repository patterns with caching and snapshots
 * - Comprehensive testing utilities
 */

// Effect-based CQRS/Event Sourcing Framework
export * from './effect';

// Branded types for type safety 
export * from './core/branded';
export * from './core/branded/factories';
export * from './core/branded/guards';
export * from './core/branded/types';

// Validation module with Zod
export * from './validation';

// Pattern matching utilities
export * from './patterns';

// Type utilities for inference and domain modeling
export * from './types';

// Core interfaces for compatibility
export type { ICommand, IEvent, IEventStore, IQuery } from './effect/core/types';