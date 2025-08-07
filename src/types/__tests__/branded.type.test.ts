// Type-level tests for branded types
import type {
  Brand,
  UserId,
  AggregateId,
  EventId,
  Email,
  PersonName,
  Timestamp,
  EventVersion,
  PositiveNumber,
  UUID,
  UnBrand,
  ReBrand,
  Nullable,
  Optional,
  Maybe
} from '../branded';

import { BrandedTypes, BrandedTypeGuards } from '../branded';

import type {
  AssertEquals,
  AssertExtends,
  AssertNotExtends,
  AssertNever,
  TypeTests,
  CompileTimeTest
} from './type-assertions';

// Test Brand type construction
type BrandTests = TypeTests<{
  // Test that branded types are distinct from their base types
  userIdNotString: AssertNotExtends<UserId, string>;
  stringNotUserId: AssertNotExtends<string, UserId>;
  
  // Test that different branded types are not assignable to each other
  userIdNotAggregateId: AssertNotExtends<UserId, AggregateId>;
  aggregateIdNotEventId: AssertNotExtends<AggregateId, EventId>;
  
  // Test that branded types extend their base types
  userIdExtendsString: AssertExtends<UserId, string>;
  emailExtendsString: AssertExtends<Email, string>;
  timestampExtendsDate: AssertExtends<Timestamp, Date>;
  eventVersionExtendsNumber: AssertExtends<EventVersion, number>;
}>;

// Test UnBrand utility type
type UnBrandTests = TypeTests<{
  unBrandUserId: AssertEquals<UnBrand<UserId>, string>;
  unBrandEmail: AssertEquals<UnBrand<Email>, string>;
  unBrandTimestamp: AssertEquals<UnBrand<Timestamp>, Date>;
  unBrandEventVersion: AssertEquals<UnBrand<EventVersion>, number>;
  unBrandString: AssertEquals<UnBrand<string>, string>;
  unBrandNumber: AssertEquals<UnBrand<number>, number>;
}>;

// Test ReBrand utility type
type ReBrandTests = TypeTests<{
  reBrandUserIdToEmail: AssertEquals<ReBrand<UserId, 'Email'>, Brand<string, 'Email'>>;
  reBrandStringToUserId: AssertEquals<ReBrand<string, 'UserId'>, Brand<string, 'UserId'>>;
  reBrandTimestampToCreatedAt: AssertEquals<ReBrand<Timestamp, 'CreatedAt'>, Brand<Date, 'CreatedAt'>>;
}>;

// Test nullable utility types
type NullableTests = TypeTests<{
  nullableUserId: AssertEquals<Nullable<UserId>, UserId | null>;
  optionalEmail: AssertEquals<Optional<Email>, Email | undefined>;
  maybeTimestamp: AssertEquals<Maybe<Timestamp>, Timestamp | null | undefined>;
}>;

import { describe, it, expect } from 'bun:test';

// Runtime tests for branded type constructors
describe('BrandedTypes constructors', () => {
  describe('userId', () => {
    it('should create valid UserId', () => {
      const id = BrandedTypes.userId('123');
      expect(typeof id).toBe('string');
      expect(id).toBe('123');
    });

    it('should throw for invalid input', () => {
      expect(() => BrandedTypes.userId('')).toThrow('Invalid user ID');
      expect(() => BrandedTypes.userId(null as unknown as string)).toThrow('Invalid user ID');
      expect(() => BrandedTypes.userId(undefined as unknown as string)).toThrow('Invalid user ID');
    });
  });

  describe('email', () => {
    it('should create valid Email and normalize to lowercase', () => {
      const email = BrandedTypes.email('User@Example.com');
      expect(email).toBe('user@example.com');
    });

    it('should throw for invalid email format', () => {
      expect(() => BrandedTypes.email('invalid')).toThrow('Invalid email format');
      expect(() => BrandedTypes.email('invalid@')).toThrow('Invalid email format');
      expect(() => BrandedTypes.email('@invalid.com')).toThrow('Invalid email format');
    });
  });

  describe('personName', () => {
    it('should create valid PersonName and trim whitespace', () => {
      const name = BrandedTypes.personName('  John Doe  ');
      expect(name).toBe('John Doe');
    });

    it('should throw for invalid names', () => {
      expect(() => BrandedTypes.personName('a')).toThrow('Person name must be between 2 and 100 characters');
      expect(() => BrandedTypes.personName('x'.repeat(101))).toThrow('Person name must be between 2 and 100 characters');
      expect(() => BrandedTypes.personName('  ')).toThrow('Person name must be between 2 and 100 characters');
    });
  });

  describe('timestamp', () => {
    it('should create valid Timestamp', () => {
      const date = new Date('2024-01-01');
      const timestamp = BrandedTypes.timestamp(date);
      expect(timestamp).toEqual(date);
    });

    it('should create current timestamp when no date provided', () => {
      const before = new Date();
      const timestamp = BrandedTypes.timestamp();
      const after = new Date();
      
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw for invalid dates', () => {
      expect(() => BrandedTypes.timestamp(new Date('invalid'))).toThrow('Invalid timestamp');
      expect(() => BrandedTypes.timestamp('2024-01-01' as unknown as Date)).toThrow('Invalid timestamp');
    });
  });

  describe('eventVersion', () => {
    it('should create valid EventVersion', () => {
      const version = BrandedTypes.eventVersion(1);
      expect(version).toBe(1);
    });

    it('should throw for invalid versions', () => {
      expect(() => BrandedTypes.eventVersion(0)).toThrow('Event version must be a positive integer');
      expect(() => BrandedTypes.eventVersion(-1)).toThrow('Event version must be a positive integer');
      expect(() => BrandedTypes.eventVersion(1.5)).toThrow('Event version must be a positive integer');
    });
  });

  describe('positiveNumber', () => {
    it('should create valid PositiveNumber', () => {
      const num = BrandedTypes.positiveNumber(42);
      expect(num).toBe(42);
    });

    it('should throw for non-positive numbers', () => {
      expect(() => BrandedTypes.positiveNumber(0)).toThrow('Must be a positive number');
      expect(() => BrandedTypes.positiveNumber(-1)).toThrow('Must be a positive number');
    });
  });

  describe('percentage', () => {
    it('should create valid Percentage', () => {
      expect(BrandedTypes.percentage(0)).toBe(0);
      expect(BrandedTypes.percentage(50)).toBe(50);
      expect(BrandedTypes.percentage(100)).toBe(100);
    });

    it('should throw for out of range values', () => {
      expect(() => BrandedTypes.percentage(-1)).toThrow('Percentage must be between 0 and 100');
      expect(() => BrandedTypes.percentage(101)).toThrow('Percentage must be between 0 and 100');
    });
  });

  describe('money', () => {
    it('should create valid Money and round to 2 decimal places', () => {
      expect(BrandedTypes.money(10.999)).toBe(11);
      expect(BrandedTypes.money(10.994)).toBe(10.99);
      expect(BrandedTypes.money(10)).toBe(10);
    });

    it('should throw for negative amounts', () => {
      expect(() => BrandedTypes.money(-1)).toThrow('Money amount must be non-negative');
    });
  });

  describe('uuid', () => {
    it('should create valid UUID and normalize to lowercase', () => {
      const uuid = BrandedTypes.uuid('550E8400-E29B-41D4-A716-446655440000');
      expect(uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw for invalid UUID format', () => {
      expect(() => BrandedTypes.uuid('invalid')).toThrow('Invalid UUID format');
      expect(() => BrandedTypes.uuid('550e8400-e29b-41d4-a716')).toThrow('Invalid UUID format');
    });
  });

  describe('url', () => {
    it('should create valid URL', () => {
      const url = BrandedTypes.url('https://example.com');
      expect(url).toBe('https://example.com');
    });

    it('should throw for invalid URLs', () => {
      expect(() => BrandedTypes.url('not a url')).toThrow('Invalid URL format');
      expect(() => BrandedTypes.url('ftp://example.com')).not.toThrow(); // Valid URL
    });
  });
});

// Runtime tests for type guards
describe('BrandedTypeGuards', () => {
  describe('isUserId', () => {
    it('should correctly identify UserId', () => {
      expect(BrandedTypeGuards.isUserId('123')).toBe(true);
      expect(BrandedTypeGuards.isUserId('')).toBe(false);
      expect(BrandedTypeGuards.isUserId(123)).toBe(false);
      expect(BrandedTypeGuards.isUserId(null)).toBe(false);
    });
  });

  describe('isEmail', () => {
    it('should correctly identify Email', () => {
      expect(BrandedTypeGuards.isEmail('user@example.com')).toBe(true);
      expect(BrandedTypeGuards.isEmail('invalid')).toBe(false);
      expect(BrandedTypeGuards.isEmail(123)).toBe(false);
    });
  });

  describe('isUUID', () => {
    it('should correctly identify UUID', () => {
      expect(BrandedTypeGuards.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(BrandedTypeGuards.isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(BrandedTypeGuards.isUUID('invalid')).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should correctly identify positive numbers', () => {
      expect(BrandedTypeGuards.isPositiveNumber(1)).toBe(true);
      expect(BrandedTypeGuards.isPositiveNumber(0.1)).toBe(true);
      expect(BrandedTypeGuards.isPositiveNumber(0)).toBe(false);
      expect(BrandedTypeGuards.isPositiveNumber(-1)).toBe(false);
      expect(BrandedTypeGuards.isPositiveNumber('1')).toBe(false);
    });
  });

  describe('isTimestamp', () => {
    it('should correctly identify timestamps', () => {
      expect(BrandedTypeGuards.isTimestamp(new Date())).toBe(true);
      expect(BrandedTypeGuards.isTimestamp(new Date('invalid'))).toBe(false);
      expect(BrandedTypeGuards.isTimestamp('2024-01-01')).toBe(false);
      expect(BrandedTypeGuards.isTimestamp(Date.now())).toBe(false);
    });
  });
});

// Compile-time assertion that all tests pass
const _brandedTypeTests: CompileTimeTest = true;