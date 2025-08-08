// Universal branded types for enhanced type safety
// Provides compile-time guarantees and prevents mixing incompatible values

// Generic brand type
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

// Core ID Types
export type AggregateId = Brand<string, 'AggregateId'>;
export type EventId = Brand<string, 'EventId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type CausationId = Brand<string, 'CausationId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type SessionId = Brand<string, 'SessionId'>;

// Email type with validation
export type Email = Brand<string, 'Email'>;

// Timestamp types
export type CreatedAt = Brand<Date, 'CreatedAt'>;
export type UpdatedAt = Brand<Date, 'UpdatedAt'>;
export type DeletedAt = Brand<Date, 'DeletedAt'>;
export type Timestamp = Brand<Date, 'Timestamp'>;

// Version types
export type EventVersion = Brand<number, 'EventVersion'>;
export type AggregateVersion = Brand<number, 'AggregateVersion'>;
export type SchemaVersion = Brand<number, 'SchemaVersion'>;

// Numeric types with constraints
export type PositiveNumber = Brand<number, 'PositiveNumber'>;
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Money = Brand<number, 'Money'>;

// String format types
export type UUID = Brand<string, 'UUID'>;
export type URL = Brand<string, 'URL'>;
export type JSONString = Brand<string, 'JSONString'>;
export type Base64String = Brand<string, 'Base64String'>;
export type JWTToken = Brand<string, 'JWTToken'>;

// Type constructors with validation
export const BrandedTypes = {
  // ID constructors
  aggregateId: (id: string): AggregateId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid aggregate ID');
    }
    return id as AggregateId;
  },

  eventId: (id: string): EventId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid event ID');
    }
    return id as EventId;
  },

  correlationId: (id: string): CorrelationId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid correlation ID');
    }
    return id as CorrelationId;
  },

  causationId: (id: string): CausationId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid causation ID');
    }
    return id as CausationId;
  },

  transactionId: (id: string): TransactionId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid transaction ID');
    }
    return id as TransactionId;
  },

  // Email constructor with validation
  email: (email: string): Email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase() as Email;
  },

  // Timestamp constructors
  createdAt: (date: Date = new Date()): CreatedAt => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid created date');
    }
    return date as CreatedAt;
  },

  updatedAt: (date: Date = new Date()): UpdatedAt => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid updated date');
    }
    return date as UpdatedAt;
  },

  deletedAt: (date: Date = new Date()): DeletedAt => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid deleted date');
    }
    return date as DeletedAt;
  },

  timestamp: (date: Date = new Date()): Timestamp => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid timestamp');
    }
    return date as Timestamp;
  },

  // Version constructors
  eventVersion: (version: number): EventVersion => {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('Event version must be a positive integer');
    }
    return version as EventVersion;
  },

  aggregateVersion: (version: number): AggregateVersion => {
    if (!Number.isInteger(version) || version < 0) {
      throw new Error('Aggregate version must be a non-negative integer');
    }
    return version as AggregateVersion;
  },

  schemaVersion: (version: number): SchemaVersion => {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('Schema version must be a positive integer');
    }
    return version as SchemaVersion;
  },

  // Numeric constructors
  positiveNumber: (num: number): PositiveNumber => {
    if (typeof num !== 'number' || num <= 0) {
      throw new Error('Must be a positive number');
    }
    return num as PositiveNumber;
  },

  nonNegativeNumber: (num: number): NonNegativeNumber => {
    if (typeof num !== 'number' || num < 0) {
      throw new Error('Must be a non-negative number');
    }
    return num as NonNegativeNumber;
  },

  percentage: (num: number): Percentage => {
    if (typeof num !== 'number' || num < 0 || num > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return num as Percentage;
  },

  money: (amount: number): Money => {
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('Money amount must be non-negative');
    }
    // Round to 2 decimal places
    return Math.round(amount * 100) / 100 as Money;
  },

  // String format constructors
  uuid: (uuid: string): UUID => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new Error('Invalid UUID format');
    }
    return uuid.toLowerCase() as UUID;
  },

  url: (url: string): URL => {
    try {
      new globalThis.URL(url);
      return url as URL;
    } catch {
      throw new Error('Invalid URL format');
    }
  },

  jsonString: (json: string): JSONString => {
    try {
      JSON.parse(json);
      return json as JSONString;
    } catch {
      throw new Error('Invalid JSON string');
    }
  },

  base64String: (str: string): Base64String => {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      throw new Error('Invalid Base64 string');
    }
    return str as Base64String;
  },

  jwtToken: (token: string): JWTToken => {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
    if (!jwtRegex.test(token)) {
      throw new Error('Invalid JWT token format');
    }
    return token as JWTToken;
  },
} as const;

// Type guards
export const BrandedTypeGuards = {
  isEmail: (value: unknown): value is Email => {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  isUUID: (value: unknown): value is UUID => {
    return typeof value === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  },

  isPositiveNumber: (value: unknown): value is PositiveNumber => {
    return typeof value === 'number' && value > 0;
  },

  isTimestamp: (value: unknown): value is Timestamp => {
    return value instanceof Date && !isNaN(value.getTime());
  },
} as const;

// Utility type to extract the base type from a branded type
export type UnBrand<T> = T extends Brand<infer U, any> ? U : T;

// Utility type to rebrand a type
export type ReBrand<T, TNewBrand extends string> = T extends Brand<infer U, any> 
  ? Brand<U, TNewBrand> 
  : Brand<T, TNewBrand>;

// Utility type for nullable branded types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;