/**
 * Framework Core: Logger
 * 
 * Centralized logging configuration using consola.
 * Provides scoped loggers for different parts of the framework.
 */

import { createConsola, type ConsolaInstance } from 'consola';

/**
 * Logger configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Create a scoped logger instance
 */
export function createLogger(scope: string): ConsolaInstance {
  const logger = createConsola({
    level: isTest ? 0 : undefined, // Silent in test mode
    formatOptions: {
      columns: 80,
      colors: true,
      compact: !isDevelopment,
      date: true,
    },
  });

  return logger.withTag(scope);
}

/**
 * Framework-wide logger instances
 */
export const loggers = {
  framework: createLogger('framework'),
  eventStore: createLogger('event-store'),
  commandBus: createLogger('command-bus'),
  eventBus: createLogger('event-bus'),
  queryBus: createLogger('query-bus'),
  repository: createLogger('repository'),
  aggregate: createLogger('aggregate'),
  projection: createLogger('projection'),
  snapshot: createLogger('snapshot'),
} as const;

/**
 * Domain-specific logger factory
 */
export function createDomainLogger(domain: string, component?: string): ConsolaInstance {
  const scope = component ? `${domain}:${component}` : domain;
  return createLogger(scope);
}

/**
 * Sanitize sensitive data for logging
 */
export function sanitizeForLog<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey']
): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field as keyof T] = '[REDACTED]' as T[keyof T];
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLog(sanitized[key], sensitiveFields);
    }
  }

  return sanitized;
}

/**
 * Format execution duration for logging
 */
export function formatDuration(startTime: number): string {
  const duration = Date.now() - startTime;
  if (duration < 1000) {
    return `${duration}ms`;
  }
  return `${(duration / 1000).toFixed(2)}s`;
}

/**
 * Create a correlation ID for tracing
 */
export function createCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log levels enum for type safety
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];