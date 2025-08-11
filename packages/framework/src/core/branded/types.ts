/**
 * Shared: Branded Types
 * 
 * Branded types provide compile-time type safety by preventing
 * primitive type mixing and enforcing domain constraints.
 * Uses Effect's Brand module for enhanced type safety and validation.
 */

import * as Brand from 'effect/Brand';

/**
 * Core ID types with branding
 */
export type AggregateId<T extends string = string> = Brand.Branded<string, T>;
export type EventId = AggregateId<'EventId'>;
export type CommandId = AggregateId<'CommandId'>;
export type QueryId = AggregateId<'QueryId'>;
export type CorrelationId = AggregateId<'CorrelationId'>;
export type CausationId = AggregateId<'CausationId'>;
export type TransactionId = AggregateId<'TransactionId'>;
export type SessionId = AggregateId<'SessionId'>;
export type UserId = AggregateId<'UserId'>;

/**
 * Value object types
 */
export type URL = Brand.Branded<string, 'URL'>;
export type UUID = Brand.Branded<string, 'UUID'>;
export type JSONString = Brand.Branded<string, 'JSONString'>;
export type Base64String = Brand.Branded<string, 'Base64String'>;
export type JWTToken = Brand.Branded<string, 'JWTToken'>;

/**
 * Temporal types
 */
export type Timestamp = Brand.Branded<string, 'Timestamp'>;
export type CreatedAt = Brand.Branded<string, 'CreatedAt'>;
export type UpdatedAt = Brand.Branded<string, 'UpdatedAt'>;
export type DeletedAt = Brand.Branded<string, 'DeletedAt'>;
export type ExpiredAt = Brand.Branded<string, 'ExpiredAt'>;

/**
 * Version types
 */
export type EventVersion = Brand.Branded<number, 'EventVersion'>;
export type AggregateVersion = Brand.Branded<number, 'AggregateVersion'>;
export type SchemaVersion = Brand.Branded<number, 'SchemaVersion'>;
export type APIVersion = Brand.Branded<number, 'APIVersion'>;

/**
 * Numeric constraint types
 */
export type PositiveNumber = Brand.Branded<number, 'PositiveNumber'>;
export type NonNegativeNumber = Brand.Branded<number, 'NonNegativeNumber'>;
export type Percentage = Brand.Branded<number, 'Percentage'>;
export type Money = Brand.Branded<number, 'Money'>;
export type Count = Brand.Branded<number, 'Count'>;
export type Index = Brand.Branded<number, 'Index'>;

/**
 * Utility type to extract the base type from a branded type
 */
export type UnBrand<T> = Brand.Brand.Unbranded<T>;

/**
 * Utility type to rebrand a type
 */
export type ReBrand<T, TNewBrand extends string> = 
  T extends Brand.Brand<any> 
    ? Brand.Branded<Brand.Brand.Unbranded<T>, TNewBrand>
    : Brand.Branded<T, TNewBrand>;

/**
 * Nullable branded types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;