// Universal Type System for CQRS/Event Sourcing Framework
// Main exports for @cqrs-framework/types package

// Branded types and utilities
export * from './branded';
export { BrandedTypes, BrandedTypeGuards } from './branded';
export type { Brand, UnBrand, ReBrand, Nullable, Optional, Maybe } from './branded';

// Universal error system
export * from './errors';
export { ErrorFactory, ErrorGuards, Result, ErrorCodes } from './errors';
export type {
  BaseError,
  DomainError,
  ValidationError,
  BusinessRuleError,
  NotFoundError,
  ConflictError,
  InfrastructureError,
  DatabaseError,
  NetworkError,
  ExternalServiceError,
  ApplicationError,
  InvalidOperationError,
  StateTransitionError,
  ConcurrencyError,
  RateLimitError,
  AppError
} from './errors';

// Advanced error system
export * from './errors-advanced';
export { ErrorFactory as AdvancedErrorFactory, ErrorGuards as AdvancedErrorGuards, Result as AdvancedResult, ErrorCodes as AdvancedErrorCodes } from './errors-advanced';
export type {
  ErrorCode,
  DomainErrorCategory,
  InfrastructureErrorCategory,
  ApplicationErrorCategory
} from './errors-advanced';

// Advanced generic types for events, commands, projections
export * from './generics';
export {
  createEvent,
  createCategorizedEvent,
  createTypeGuard,
  createCategoryGuard,
  matchEvent,
  matchEventPartial,
  matchEventAsync,
  commandSuccess,
  commandFailure,
  createSnapshot,
  foldEvents,
  foldEventsAsync,
  filterEventsByType,
  sortEventsByTimestamp,
  sortEventsByVersion
} from './generics';
export type {
  Event,
  EnhancedEvent,
  EventMetadata,
  CategorizedEvent,
  VersionedEvent,
  EventMigration,
  EventMigrationRegistry,
  EventHandler,
  EventReducer,
  AsyncEventReducer,
  Command,
  CommandContext,
  ContextualCommand,
  CommandResult,
  EventPattern,
  PartialEventPattern,
  AsyncEventPattern,
  ConditionalPattern,
  Projection,
  MaterializedView,
  AsyncProjection,
  Snapshot,
  SnapshotStrategy,
  EventStream,
  EventProcessor,
  EventValidationResult,
  EventValidator,
  ValidationResult,
} from './generics';

// Universal validation system
export * from './validation';
export {
  ValidationRules,
  field,
  object,
  validateField,
  validateObject,
  combineValidators,
  validateFieldAsync,
  createBrandedValidator,
  conditionalValidator,
  optionalValidator
} from './validation';
export type {
  ValidationRule,
  FieldValidator,
  ObjectValidator,
  AsyncValidationRule,
  AsyncFieldValidator
} from './validation';

// Template literal type helpers
export type {
  EventName,
  CommandName
} from './generics';

// Type extraction utilities
export type {
  ExtractEventData,
  ExtractAggregateId,
  ExtractEventType,
  ExtractAllEventTypes,
  InferAggregateType
} from './generics';

// Framework constants
export {
  DEFAULT_SNAPSHOT_FREQUENCY,
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_CACHE_TTL_MS
} from './generics';

// Version information
export const TYPES_FRAMEWORK_VERSION = '1.0.0';
export const TYPES_FRAMEWORK_NAME = '@cqrs-framework/types';