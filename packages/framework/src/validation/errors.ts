/**
 * Framework Validation: Error Types
 * 
 * Custom error types for validation failures.
 */

import { DomainError } from '../core/errors';
import type { ZodIssue } from 'zod';

/**
 * Validation error with detailed field-level errors
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors: ReadonlyArray<ZodIssue | { field: string; message: string; code?: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  /**
   * Get formatted error messages
   */
  getFormattedErrors(): string[] {
    return this.errors.map(error => {
      if ('path' in error) {
        // ZodIssue
        return `${error.path.join('.')}: ${error.message}`;
      } else {
        // Custom error format
        return error.field ? `${error.field}: ${error.message}` : error.message;
      }
    });
  }

  /**
   * Get errors as a map by field name
   */
  getErrorsByField(): Map<string, string[]> {
    const errorMap = new Map<string, string[]>();
    
    for (const error of this.errors) {
      const field = 'path' in error ? error.path.join('.') : error.field;
      const message = error.message;
      
      if (!errorMap.has(field)) {
        errorMap.set(field, []);
      }
      errorMap.get(field)!.push(message);
    }
    
    return errorMap;
  }
}

/**
 * Schema definition error
 */
export class SchemaError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * Type mismatch error
 */
export class TypeMismatchError extends DomainError {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
    field?: string
  ) {
    super(
      field
        ? `Type mismatch for field "${field}": expected ${expected}, got ${actual}`
        : `Type mismatch: expected ${expected}, got ${actual}`
    );
    this.name = 'TypeMismatchError';
  }
}