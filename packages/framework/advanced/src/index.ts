// Main exports for the CQRS Framework Advanced package

// Enhanced aggregates
export {
  EnhancedAggregate,
  AggregateError,
  DEFAULT_ENHANCED_OPTIONS,
  type EnhancedAggregateOptions,
  type AggregateErrorCode,
  type AggregateMetrics,
} from './aggregates/EnhancedAggregate';

// Event handler registry
export {
  EventHandlerRegistry,
  EventHandlerError,
  LoggingMiddleware,
  MetricsMiddleware,
  eventHandlerRegistry,
  type EventHandler,
  type RetryableEventHandler,
  type EventHandlerMiddleware,
  type HandlerMetrics,
  type EventHandlerErrorCode,
} from './handlers/EventHandlerRegistry';

// Optimized event store
export {
  InMemoryOptimizedEventStore,
  EventStoreError,
  DEFAULT_OPTIMIZED_OPTIONS,
  type OptimizedEventStore,
  type EventStoreMetrics,
  type CompactionResult,
  type OptimizedEventStoreOptions,
  type EventStoreErrorCode,
} from './stores/OptimizedEventStore';

// Snapshot management
export {
  SnapshotManager,
  InMemorySnapshotStore,
  CountBasedStrategy,
  TimeBasedStrategy,
  SizeBasedStrategy,
  SnapshotError,
  DEFAULT_SNAPSHOT_OPTIONS,
  type SnapshotStrategy,
  type SnapshotStore,
  type SnapshotMetadata,
  type SnapshotManagerOptions,
  type SnapshotStatistics,
  type SnapshotErrorCode,
} from './snapshots/SnapshotManager';

// Event migrations
export {
  EventMigrationRegistry,
  FieldRenameMigration,
  FieldTransformMigration,
  MigrationError,
  BatchMigrationError,
  eventMigrationRegistry,
  type EventMigration,
  type MigrationExecution,
  type MigrationStatistics,
  type MigrationErrorCode,
} from './migrations/EventMigration';

// Pattern matching
export {
  EventPatternMatcher,
  EventPatternBuilder,
  LoggingPatternMiddleware,
  TransformationMiddleware,
  CachingPatternMiddleware,
  PatternMatchError,
  createDomainEventMatcher,
  createCachedMatcher,
  matchEventType,
  type EventPattern,
  type ConditionalPattern,
  type PatternMiddleware,
  type PatternStatistics,
  type PatternMatchErrorCode,
} from './patterns/PatternMatching';

// Re-export commonly used types from dependencies
export type { Event, Snapshot, Command, IEventStore } from '@cqrs-framework/core';
export type { 
  AggregateId, 
  EventVersion, 
  Timestamp, 
  Result, 
  BaseError 
} from '@cqrs-framework/types';

// Package metadata
export const ADVANCED_PACKAGE_VERSION = '1.0.0';
export const ADVANCED_PACKAGE_NAME = '@cqrs-framework/advanced';