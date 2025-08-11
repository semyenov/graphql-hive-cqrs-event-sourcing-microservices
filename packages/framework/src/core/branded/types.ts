/**
 * Shared: Branded Types
 *
 * Branded types provide compile-time type safety by preventing
 * primitive type mixing and enforcing domain constraints.
 */

/**
 * Generic brand type for nominal typing
 */
export type Brand<T, TBrand extends string> = T & { readonly __typename: TBrand };

/**
 * Core ID types with branding
 */
export type AggregateId = Brand<string, 'AggregateId'>;
export type AggregateType = Brand<string, 'AggregateType'>;
export type EventId = Brand<string, 'EventId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type QueryId = Brand<string, 'QueryId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type CausationId = Brand<string, 'CausationId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Value object types
 */
export type URL = Brand<string, 'URL'>;
export type UUID = Brand<string, 'UUID'>;
export type JSONString = Brand<string, 'JSONString'>;
export type Base64String = Brand<string, 'Base64String'>;
export type JWTToken = Brand<string, 'JWTToken'>;

/**
 * Temporal types
 */
export type Timestamp = Brand<Date, 'Timestamp'>;
export type CreatedAt = Brand<Date, 'CreatedAt'>;
export type UpdatedAt = Brand<Date, 'UpdatedAt'>;
export type DeletedAt = Brand<Date, 'DeletedAt'>;
export type ExpiredAt = Brand<Date, 'ExpiredAt'>;

/**
 * Version types
 */
export type EventVersion = Brand<number, 'EventVersion'>;
export type AggregateVersion = Brand<number, 'AggregateVersion'>;
export type SchemaVersion = Brand<number, 'SchemaVersion'>;
export type APIVersion = Brand<number, 'APIVersion'>;

/**
 * Numeric constraint types
 */
export type PositiveNumber = Brand<number, 'PositiveNumber'>;
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Money = Brand<number, 'Money'>;
export type Count = Brand<number, 'Count'>;
export type Index = Brand<number, 'Index'>;

/**
 * Utility type to extract the base type from a branded type
 */
export type UnBrand<T> = T extends Brand<infer U, any> ? U : T;

/**
 * Utility type to rebrand a type
 */
export type ReBrand<T, TNewBrand extends string> =
  T extends Brand<infer U, any>
  ? Brand<U, TNewBrand>
  : Brand<T, TNewBrand>;

/**
 * Nullable branded types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
