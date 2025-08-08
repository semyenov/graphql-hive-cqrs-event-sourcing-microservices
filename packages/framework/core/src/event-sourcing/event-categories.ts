// Event Categorization System for CQRS/Event Sourcing Framework

// Event categories for better organization
export type EventCategory = 'domain' | 'system' | 'integration' | 'audit' | 'notification';

// Event priority levels
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

// Event processing strategies
export type ProcessingStrategy = 'sync' | 'async' | 'deferred' | 'batch';

// Event metadata interface
export interface EventMetadata {
  category?: EventCategory;
  priority?: EventPriority;
  processingStrategy?: ProcessingStrategy;
  retryable?: boolean;
  maxRetries?: number;
  ttl?: number; // Time to live in milliseconds
  tags?: string[];
}

// Enhanced event with metadata
export interface CategorizedEvent {
  category: EventCategory;
  priority: EventPriority;
  metadata: EventMetadata;
}

// Event category helpers
export const EventCategories = {
  isDomainEvent: (category: EventCategory): boolean => category === 'domain',
  isSystemEvent: (category: EventCategory): boolean => category === 'system',
  isIntegrationEvent: (category: EventCategory): boolean => category === 'integration',
  isAuditEvent: (category: EventCategory): boolean => category === 'audit',
  isNotificationEvent: (category: EventCategory): boolean => category === 'notification',
} as const;

// Priority helpers
export const EventPriorities = {
  isHighPriority: (priority: EventPriority): boolean => 
    priority === 'high' || priority === 'critical',
  isLowPriority: (priority: EventPriority): boolean => priority === 'low',
  compare: (a: EventPriority, b: EventPriority): number => {
    const priorityOrder = { low: 0, normal: 1, high: 2, critical: 3 };
    return priorityOrder[a] - priorityOrder[b];
  },
} as const;

// Processing strategy helpers
export const ProcessingStrategies = {
  shouldProcessSync: (strategy: ProcessingStrategy): boolean => strategy === 'sync',
  shouldProcessAsync: (strategy: ProcessingStrategy): boolean => strategy === 'async',
  shouldDefer: (strategy: ProcessingStrategy): boolean => strategy === 'deferred',
  shouldBatch: (strategy: ProcessingStrategy): boolean => strategy === 'batch',
} as const;