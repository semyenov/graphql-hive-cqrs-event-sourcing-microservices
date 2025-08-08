// Universal CQRS/Event Sourcing Framework Core
// Main exports for @cqrs-framework/core package

// Type system exports
export * from './types/branded';
export type { 
  ValidationError as CoreValidationError,
  BaseError,
  DomainError,
  AppError,
  Result,
  ErrorFactory,
  ErrorGuards,
  ErrorCodes
} from './types/errors';
export * from './types/validation';

// Event sourcing core exports - interfaces first (has re-exports)
export * from './event-sourcing/interfaces';

// Then export specific items from other modules to avoid conflicts
export {
  // From events.ts
  type EventMetadata,
  type EnhancedEvent,
  type EventCategory,
  type CategorizedEvent,
  type EventSchemaVersion,
  type VersionedEvent,
  type EventMigration,
  type EventReducer,
  type AsyncEventReducer,
  type EventValidationResult,
  type EventValidator,
  type ExtractEventData,
  type ExtractAggregateId,
  type ExtractEventType,
  type ExtractAllEventTypes,
  type InferAggregateType,
  type AggregateEvents,
  type EventIndex,
  type AggregateIndex,
  type CompoundIndex,
  createEvent,
  createCategorizedEvent,
  createTypeGuard,
  createCategoryGuard,
  foldEvents,
  foldEventsAsync,
  filterEventsByType,
  sortEventsByTimestamp,
  sortEventsByVersion,
} from './event-sourcing/events';

export {
  // From commands.ts
  type CommandContext,
  type ContextualCommand,
  type CommandResult,
  type CommandFactory,
  type BatchCommandResult,
  type CommandValidationResult,
  type CommandValidator,
  commandSuccess,
  commandFailure,
  executeWithTimeout,
  executeBatch,
  CommandBuilder,
} from './event-sourcing/commands';

export {
  // From projections.ts
  type Projection,
  type MaterializedView,
  type AsyncProjection,
  type IProjectionBuilder,
  type ProjectionState,
  ProjectionBuilder,
  MaterializedViewBuilder,
  AsyncProjectionBuilder,
  ProjectionRegistry,
} from './event-sourcing/projections';

export {
  // From snapshots.ts
  type SnapshotStrategy,
  type ISnapshotStore,
  createSnapshot,
  SnapshotManager,
  InMemorySnapshotStore,
  compressSnapshot,
  decompressSnapshot,
  calculateChecksum,
} from './event-sourcing/snapshots';

export {
  // From pattern-matching.ts
  type EventPattern,
  type PartialEventPattern,
  type AsyncEventPattern,
  type PartialAsyncEventPattern,
  type ConditionalPattern,
  type PriorityPattern,
  matchEvent,
  matchEventPartial,
  matchEventAsync,
  matchEventPartialAsync,
  EventPatternBuilder,
  ConditionalPatternMatcher,
  PriorityPatternMatcher,
  composePatterns,
  fromTypeGuard,
  matchMultipleTypes,
  matchByAggregateId,
  matchByVersionRange,
} from './event-sourcing/pattern-matching';

// Aggregate framework exports
export type { 
  InferAggregateState,
  InferAggregateEvent,
  InferAggregateId,
  AggregateFactory as CoreAggregateFactory,
  AggregateRepository,
  AggregateRoot
} from './aggregates/Aggregate';
export { 
  Aggregate,
  CommandHandler
} from './aggregates/Aggregate';

// Event store implementations
export * from './stores/InMemoryEventStore';

// Event handling system
export * from './handlers/EventHandler';

// Template literal type utilities
export * from './utils/template-literal-types';

// Version information
export const FRAMEWORK_VERSION = '1.0.0';
export const FRAMEWORK_NAME = '@cqrs-framework/core';