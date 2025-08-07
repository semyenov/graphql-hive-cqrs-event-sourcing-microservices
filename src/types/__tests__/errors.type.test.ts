// Type-level tests for error types
import type {
  ErrorCode,
  BaseError,
  DomainErrorCategory,
  InfrastructureErrorCategory,
  ApplicationErrorCategory,
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
  AppError,
  Result
} from '../errors';

import {
  ErrorFactory,
  ErrorGuards,
  Result as ResultHelpers,
  ErrorCodes
} from '../errors';

import type {
  AssertEquals,
  AssertExtends,
  AssertNotExtends,
  TypeTests,
  CompileTimeTest,
  IsUnion
} from './type-assertions';

// Test error type hierarchy
type ErrorHierarchyTests = TypeTests<{
  // Test that all errors extend BaseError
  domainExtendsBase: AssertExtends<DomainError, BaseError>;
  infrastructureExtendsBase: AssertExtends<InfrastructureError, BaseError>;
  applicationExtendsBase: AssertExtends<ApplicationError, BaseError>;
  
  // Test that specific errors extend their category
  validationExtendsDomain: AssertExtends<ValidationError, DomainError>;
  businessRuleExtendsDomain: AssertExtends<BusinessRuleError, DomainError>;
  databaseExtendsInfrastructure: AssertExtends<DatabaseError, InfrastructureError>;
  concurrencyExtendsApplication: AssertExtends<ConcurrencyError, ApplicationError>;
  
  // Test that errors from different categories are not compatible
  domainNotInfrastructure: AssertNotExtends<DomainError, InfrastructureError>;
  infrastructureNotApplication: AssertNotExtends<InfrastructureError, ApplicationError>;
  applicationNotDomain: AssertNotExtends<ApplicationError, DomainError>;
}>;

// Test discriminated union
type DiscriminatedUnionTests = TypeTests<{
  // Test that AppError is a union of all error types
  appErrorIsUnion: IsUnion<AppError>;
  
  // Test that each error type is part of AppError
  validationInUnion: AssertExtends<ValidationError, AppError>;
  databaseInUnion: AssertExtends<DatabaseError, AppError>;
  rateLimitInUnion: AssertExtends<RateLimitError, AppError>;
}>;

// Test Result type
type ResultTypeTests = TypeTests<{
  // Test Result structure
  successResult: AssertEquals<
    Result<string, never>,
    { success: true; value: string }
  >;
  
  errorResult: AssertEquals<
    Result<never, ValidationError>,
    { success: false; error: ValidationError }
  >;
  
  // Test Result with AppError union
  resultWithAppError: AssertExtends<
    Result<string, AppError>,
    { success: true; value: string } | { success: false; error: AppError }
  >;
}>;

import { describe, it, expect } from 'bun:test';

// Runtime tests for ErrorFactory
describe('ErrorFactory', () => {
  describe('domain errors', () => {
    describe('validation', () => {
      it('should create validation error', () => {
        const error = ErrorFactory.validation({
          code: 'FIELD_REQUIRED',
          message: 'Email is required',
          field: 'email',
          correlationId: 'test-123'
        });
        
        expect(error.type).toBe('DOMAIN');
        expect(error.category).toBe('VALIDATION');
        expect(error.code).toBe('FIELD_REQUIRED');
        expect(error.field).toBe('email');
        expect(error.correlationId).toBe('test-123');
        expect(error.timestamp).toBeInstanceOf(Date);
      });
    });
    
    describe('businessRule', () => {
      it('should create business rule error', () => {
        const error = ErrorFactory.businessRule({
          code: 'INVARIANT_VIOLATION',
          message: 'User must have unique email',
          rule: 'unique_email',
          aggregate: 'User',
          aggregateId: 'user-123',
          context: { email: 'test@example.com' }
        });
        
        expect(error.type).toBe('DOMAIN');
        expect(error.category).toBe('BUSINESS_RULE');
        expect(error.rule).toBe('unique_email');
        expect(error.aggregate).toBe('User');
        expect(error.aggregateId).toBe('user-123');
        expect(error.context).toEqual({ email: 'test@example.com' });
      });
    });
    
    describe('notFound', () => {
      it('should create not found error', () => {
        const error = ErrorFactory.notFound({
          code: 'ENTITY_NOT_FOUND',
          message: 'User not found',
          resourceType: 'User',
          resourceId: 'user-123'
        });
        
        expect(error.type).toBe('DOMAIN');
        expect(error.category).toBe('NOT_FOUND');
        expect(error.resourceType).toBe('User');
        expect(error.resourceId).toBe('user-123');
      });
    });
    
    describe('conflict', () => {
      it('should create conflict error', () => {
        const error = ErrorFactory.conflict({
          code: 'VERSION_MISMATCH',
          message: 'Version mismatch',
          conflictType: 'VERSION_MISMATCH',
          currentValue: 2,
          attemptedValue: 1
        });
        
        expect(error.type).toBe('DOMAIN');
        expect(error.category).toBe('CONFLICT');
        expect(error.conflictType).toBe('VERSION_MISMATCH');
        expect(error.currentValue).toBe(2);
        expect(error.attemptedValue).toBe(1);
      });
    });
  });
  
  describe('infrastructure errors', () => {
    describe('database', () => {
      it('should create database error', () => {
        const error = ErrorFactory.database({
          code: 'CONNECTION_FAILED',
          message: 'Database connection failed',
          operation: 'connect',
          retryable: true
        });
        
        expect(error.type).toBe('INFRASTRUCTURE');
        expect(error.category).toBe('DATABASE');
        expect(error.service).toBe('database');
        expect(error.retryable).toBe(true);
      });
    });
    
    describe('network', () => {
      it('should create network error', () => {
        const error = ErrorFactory.network({
          code: 'NETWORK_TIMEOUT',
          message: 'Request timeout',
          url: 'https://api.example.com/users',
          method: 'GET',
          statusCode: 504,
          retryable: true
        });
        
        expect(error.type).toBe('INFRASTRUCTURE');
        expect(error.category).toBe('NETWORK');
        expect(error.url).toBe('https://api.example.com/users');
        expect(error.method).toBe('GET');
        expect(error.statusCode).toBe(504);
        expect(error.retryable).toBe(true);
      });
    });
  });
  
  describe('application errors', () => {
    describe('stateTransition', () => {
      it('should create state transition error', () => {
        const error = ErrorFactory.stateTransition({
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot transition from draft to published',
          operation: 'publish',
          fromState: 'draft',
          toState: 'published',
          allowedTransitions: ['draft->review', 'review->published']
        });
        
        expect(error.type).toBe('APPLICATION');
        expect(error.category).toBe('STATE_TRANSITION');
        expect(error.fromState).toBe('draft');
        expect(error.toState).toBe('published');
        expect(error.allowedTransitions).toEqual(['draft->review', 'review->published']);
      });
    });
    
    describe('concurrency', () => {
      it('should create concurrency error', () => {
        const error = ErrorFactory.concurrency({
          code: 'CONCURRENCY_CONFLICT',
          message: 'Version mismatch',
          operation: 'update',
          expectedVersion: 2,
          actualVersion: 3,
          entityType: 'User',
          entityId: 'user-123'
        });
        
        expect(error.type).toBe('APPLICATION');
        expect(error.category).toBe('CONCURRENCY');
        expect(error.expectedVersion).toBe(2);
        expect(error.actualVersion).toBe(3);
      });
    });
    
    describe('rateLimit', () => {
      it('should create rate limit error', () => {
        const retryAfter = new Date(Date.now() + 60000);
        const error = ErrorFactory.rateLimit({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          operation: 'createUser',
          limit: 100,
          window: 3600,
          retryAfter
        });
        
        expect(error.type).toBe('APPLICATION');
        expect(error.category).toBe('RATE_LIMIT');
        expect(error.limit).toBe(100);
        expect(error.window).toBe(3600);
        expect(error.retryAfter).toBe(retryAfter);
      });
    });
  });
});

// Runtime tests for ErrorGuards
describe('ErrorGuards', () => {
  const validationError = ErrorFactory.validation({
    code: 'FIELD_REQUIRED',
    message: 'Email required',
    field: 'email'
  });
  
  const databaseError = ErrorFactory.database({
    code: 'CONNECTION_FAILED',
    message: 'Connection failed',
    retryable: true
  });
  
  const rateLimitError = ErrorFactory.rateLimit({
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    operation: 'createUser',
    limit: 100,
    window: 3600
  });
  
  describe('type guards', () => {
    it('should correctly identify domain errors', () => {
      expect(ErrorGuards.isDomainError(validationError)).toBe(true);
      expect(ErrorGuards.isDomainError(databaseError)).toBe(false);
    });
    
    it('should correctly identify infrastructure errors', () => {
      expect(ErrorGuards.isInfrastructureError(databaseError)).toBe(true);
      expect(ErrorGuards.isInfrastructureError(validationError)).toBe(false);
    });
    
    it('should correctly identify application errors', () => {
      expect(ErrorGuards.isApplicationError(rateLimitError)).toBe(true);
      expect(ErrorGuards.isApplicationError(validationError)).toBe(false);
    });
    
    it('should correctly identify specific error types', () => {
      expect(ErrorGuards.isValidationError(validationError)).toBe(true);
      expect(ErrorGuards.isDatabaseError(databaseError)).toBe(true);
      expect(ErrorGuards.isRateLimitError(rateLimitError)).toBe(true);
    });
  });
  
  describe('isRetryableError', () => {
    it('should identify retryable infrastructure errors', () => {
      expect(ErrorGuards.isRetryableError(databaseError)).toBe(true);
    });
    
    it('should identify rate limit errors as retryable', () => {
      expect(ErrorGuards.isRetryableError(rateLimitError)).toBe(true);
    });
    
    it('should identify non-retryable errors', () => {
      expect(ErrorGuards.isRetryableError(validationError)).toBe(false);
    });
  });
});

// Runtime tests for Result helpers
describe('Result helpers', () => {
  describe('ok and err', () => {
    it('should create success result', () => {
      const result = ResultHelpers.ok('success');
      expect(result).toEqual({ success: true, value: 'success' });
    });
    
    it('should create error result', () => {
      const error = ErrorFactory.validation({
        code: 'INVALID',
        message: 'Invalid',
        field: 'test'
      });
      const result = ResultHelpers.err(error);
      expect(result).toEqual({ success: false, error });
    });
  });
  
  describe('type guards', () => {
    const okResult = ResultHelpers.ok('value');
    const errResult = ResultHelpers.err(
      ErrorFactory.validation({ code: 'ERROR', message: 'Error', field: 'test' })
    );
    
    it('should identify ok results', () => {
      expect(ResultHelpers.isOk(okResult)).toBe(true);
      expect(ResultHelpers.isOk(errResult)).toBe(false);
    });
    
    it('should identify error results', () => {
      expect(ResultHelpers.isErr(errResult)).toBe(true);
      expect(ResultHelpers.isErr(okResult)).toBe(false);
    });
  });
  
  describe('map', () => {
    it('should map success values', () => {
      const result = ResultHelpers.ok(5);
      const mapped = ResultHelpers.map(result, x => x * 2);
      
      expect(mapped).toEqual({ success: true, value: 10 });
    });
    
    it('should pass through errors', () => {
      const error = ErrorFactory.validation({ code: 'ERROR', message: 'Error', field: 'test' });
      const result = ResultHelpers.err(error);
      const mapped = ResultHelpers.map(result, x => x * 2);
      
      expect(mapped).toEqual({ success: false, error });
    });
  });
  
  describe('mapErr', () => {
    it('should map error values', () => {
      const error = ErrorFactory.validation({ code: 'ERROR', message: 'Error', field: 'test' });
      const result = ResultHelpers.err(error);
      const mapped = ResultHelpers.mapErr(result, err => 
        ErrorFactory.businessRule({
          code: 'MAPPED',
          message: err.message,
          rule: 'mapped'
        })
      );
      
      expect(ResultHelpers.isErr(mapped)).toBe(true);
      if (!mapped.success) {
        expect(ErrorGuards.isBusinessRuleError(mapped.error)).toBe(true);
      }
    });
    
    it('should pass through success values', () => {
      const result = ResultHelpers.ok('value');
      const mapped = ResultHelpers.mapErr(result, err => 
        ErrorFactory.businessRule({ code: 'MAPPED', message: 'Mapped', rule: 'mapped' })
      );
      
      expect(mapped).toEqual({ success: true, value: 'value' });
    });
  });
  
  describe('chain', () => {
    it('should chain success results', () => {
      const result = ResultHelpers.ok(5);
      const chained = ResultHelpers.chain(result, x => ResultHelpers.ok(x * 2));
      
      expect(chained).toEqual({ success: true, value: 10 });
    });
    
    it('should short-circuit on error', () => {
      const error = ErrorFactory.validation({ code: 'ERROR', message: 'Error', field: 'test' });
      const result = ResultHelpers.err(error);
      const chained = ResultHelpers.chain(result, x => ResultHelpers.ok(x * 2));
      
      expect(chained).toEqual({ success: false, error });
    });
    
    it('should propagate errors from chained function', () => {
      const result = ResultHelpers.ok(5);
      const error = ErrorFactory.validation({ code: 'ERROR', message: 'Error', field: 'test' });
      const chained = ResultHelpers.chain(result, x => ResultHelpers.err(error));
      
      expect(chained).toEqual({ success: false, error });
    });
  });
  
  describe('match', () => {
    it('should match success case', () => {
      const result = ResultHelpers.ok('success');
      const matched = ResultHelpers.match(result, {
        ok: value => `OK: ${value}`,
        err: error => `ERROR: ${error.message}`
      });
      
      expect(matched).toBe('OK: success');
    });
    
    it('should match error case', () => {
      const error = ErrorFactory.validation({ code: 'ERROR', message: 'Test error', field: 'test' });
      const result = ResultHelpers.err(error);
      const matched = ResultHelpers.match(result, {
        ok: value => `OK: ${value}`,
        err: error => `ERROR: ${error.message}`
      });
      
      expect(matched).toBe('ERROR: Test error');
    });
  });
});

// Test ErrorCodes constants
describe('ErrorCodes', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCodes.FIELD_REQUIRED).toBe('FIELD_REQUIRED');
    expect(ErrorCodes.INVALID_FORMAT).toBe('INVALID_FORMAT');
    expect(ErrorCodes.ENTITY_NOT_FOUND).toBe('ENTITY_NOT_FOUND');
    expect(ErrorCodes.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
    expect(ErrorCodes.CONNECTION_FAILED).toBe('CONNECTION_FAILED');
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });
});

// Compile-time assertion that all tests pass
const _errorTypeTests: CompileTimeTest = true;