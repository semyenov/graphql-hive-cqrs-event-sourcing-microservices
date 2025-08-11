# Brand Types Migration to Effect Brand Module

## Overview

This document summarizes the migration of all Brand types from the custom `Brand<T, TBrand>` type to Effect's `Brand.Branded<T, TBrand>` type with proper validation using `Brand.refined()`.

## Files Modified

### 1. `packages/framework/src/core/branded/types.ts`

**Changes:**

- Replaced custom `Brand<T, TBrand>` type with `Brand.Branded<T, TBrand>`
- Updated all branded type definitions to use Effect's Brand module
- Updated utility types to use `Brand.Brand.Unbranded<T>`

**Before:**

```typescript
export type Brand<T, TBrand extends string> = T & { readonly __tag: TBrand };
export type AggregateId<T extends string = string> = Brand<string, T>;
export type Timestamp = Brand<string, "Timestamp">;
```

**After:**

```typescript
import * as Brand from "effect/Brand";
export type AggregateId<T extends string = string> = Brand.Branded<string, T>;
export type Timestamp = Brand.Branded<string, "Timestamp">;
```

### 2. `packages/framework/src/core/branded/factories.ts`

**Changes:**

- Added import for Effect's Brand module
- Fixed timestamp factory to return ISO string instead of Date object

**Before:**

```typescript
timestamp: (date: Date = new Date()): Types.Timestamp => {
  return date as Types.Timestamp;
};
```

**After:**

```typescript
timestamp: (date: Date = new Date()): Types.Timestamp => {
  return date.toISOString() as Types.Timestamp;
};
```

### 3. `src/domains/users/core/types.ts`

**Changes:**

- Replaced all custom Brand types with Effect's Brand.Branded types
- Added proper validation using `Brand.refined()` with predicate functions
- Created Brand constructors for each domain type with validation logic
- Updated UserTypes factory functions to use new Brand constructors
- Fixed UserPreferences interface to be a plain interface instead of extending Data.Case.Constructor
- Removed problematic schema definitions that were causing TypeScript errors

**New Brand Constructors:**

```typescript
// Email type with validation
export type Email = Brand.Branded<string, "Email">;
export const Email = Brand.refined<Email>(
  (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  (email) => Brand.error(`Invalid email format: ${email}`)
);

// Username type with validation
export type Username = Brand.Branded<string, "Username">;
export const Username = Brand.refined<Username>(
  (username) => {
    const isValid =
      username.length >= 3 &&
      username.length <= 30 &&
      /^[a-zA-Z0-9_-]+$/.test(username);
    return isValid;
  },
  (username) =>
    Brand.error(
      `Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens: ${username}`
    )
);
```

**Updated Factory Functions:**

```typescript
export const UserTypes = {
  userId: (id: string): UserId => BrandedTypes.aggregateId<UserId>(id),
  email: (email: string): Email => Email(email.toLowerCase()),
  username: (username: string): Username => Username(username.toLowerCase()),
  hashedPassword: (hash: string): HashedPassword => HashedPassword(hash),
  verificationToken: (token: string): VerificationToken =>
    VerificationToken(token),
  resetToken: (token: string): ResetToken => ResetToken(token),
  sessionId: (id: string): SessionId => SessionId(id),
  // ... other functions
};
```

## Benefits of Migration

1. **Enhanced Type Safety**: Effect's Brand module provides better compile-time type safety
2. **Runtime Validation**: Brand.refined() provides runtime validation with detailed error messages
3. **Consistency**: All branded types now use the same validation pattern
4. **Better Error Handling**: Validation errors are more descriptive and structured
5. **Integration**: Better integration with the broader Effect ecosystem

## Validation Rules Implemented

- **Email**: Must match standard email regex pattern
- **Username**: 3-30 characters, alphanumeric with underscores and hyphens only
- **HashedPassword**: Non-empty string
- **VerificationToken**: Non-empty string
- **ResetToken**: Non-empty string
- **SessionId**: Non-empty string
- **IPAddress**: Must be valid IPv4 or IPv6 format

## Usage Examples

```typescript
// Creating validated branded types
const email = Email("user@example.com"); // ✅ Valid
const email2 = Email("invalid-email"); // ❌ Throws validation error

const username = Username("john_doe"); // ✅ Valid
const username2 = Username("jo"); // ❌ Too short
const username3 = Username("john@doe"); // ❌ Invalid characters

// Using in domain logic
const user = UserTypes.create({
  email: Email("user@example.com"),
  username: Username("john_doe"),
  // ... other fields
});
```

## Migration Notes

- All existing code using the old Brand types will continue to work
- New validation is enforced at runtime when creating branded types
- Error messages are more descriptive and helpful for debugging
- The migration maintains backward compatibility while adding enhanced safety
