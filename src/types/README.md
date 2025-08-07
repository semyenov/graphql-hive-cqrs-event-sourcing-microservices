# Type System Enhancements

This module contains comprehensive type enhancements for the GraphQL Hive CQRS Event Sourcing microservices project.

## Overview

The type system includes three main components:

1. **Branded Types** (`branded.ts`) - Compile-time type safety for domain concepts
2. **Validation Types** (`validation.ts`) - Advanced validation with template literal types
3. **Error Types** (`errors.ts`) - Comprehensive error hierarchy with functional error handling

## Branded Types

Branded types prevent mixing incompatible values at compile time:

```typescript
import { UserId, Email, BrandedTypes } from './types';

// Create branded types with validation
const userId = BrandedTypes.userId('user-123');
const email = BrandedTypes.email('user@example.com');

// Type-safe - prevents mixing
function sendEmail(to: Email, from: Email) { /* ... */ }
// sendEmail(userId, email); // Compile error!
```

### Available Branded Types

- **IDs**: `UserId`, `AggregateId`, `EventId`, `CorrelationId`, `CausationId`
- **Strings**: `Email`, `PersonName`, `CompanyName`, `UUID`, `URL`, `JWTToken`
- **Timestamps**: `CreatedAt`, `UpdatedAt`, `DeletedAt`, `Timestamp`
- **Versions**: `EventVersion`, `AggregateVersion`, `SchemaVersion`
- **Numbers**: `PositiveNumber`, `Percentage`, `Money`

## Validation System

Type-safe validation with composable validators:

```typescript
import { ValidationBuilder, validate } from './types';

// Define validation schema
const userValidator = ValidationBuilder.object({
  email: ValidationBuilder.string.email(),
  age: ValidationBuilder.number.between(18, 100),
  name: ValidationBuilder.compose.optional(
    ValidationBuilder.string.minLength(2)
  )
});

// Validate with type inference
const user = validate(userValidator, input); // Throws on invalid
```

### Available Validators

- **String**: `required`, `minLength`, `maxLength`, `pattern`, `email`, `uuid`, `url`
- **Number**: `required`, `min`, `max`, `between`, `positive`, `integer`
- **Array**: `required`, `minLength`, `maxLength`, `items`
- **Composite**: `and`, `or`, `optional`, `nullable`
- **Object**: Schema-based validation with nested support

## Error Handling

Comprehensive error hierarchy with functional Result type:

```typescript
import { Result, ErrorFactory, ErrorGuards } from './types';

// Create typed errors
const error = ErrorFactory.validation({
  code: 'INVALID_EMAIL',
  message: 'Invalid email format',
  field: 'email'
});

// Functional error handling
function processUser(email: string): Result<User, AppError> {
  if (!isValidEmail(email)) {
    return Result.err(ErrorFactory.validation({
      code: 'INVALID_EMAIL',
      message: 'Invalid email',
      field: 'email'
    }));
  }
  
  const user = createUser(email);
  return Result.ok(user);
}

// Handle results
const result = processUser('invalid');
Result.match(result, {
  ok: user => console.log('Created:', user),
  err: error => console.error('Failed:', error.message)
});
```

### Error Categories

1. **Domain Errors**
   - `ValidationError` - Field validation failures
   - `BusinessRuleError` - Business rule violations
   - `NotFoundError` - Resource not found
   - `ConflictError` - Version/state conflicts

2. **Infrastructure Errors**
   - `DatabaseError` - Database operations
   - `NetworkError` - Network requests
   - `ExternalServiceError` - Third-party services

3. **Application Errors**
   - `InvalidOperationError` - Invalid operations
   - `StateTransitionError` - Invalid state transitions
   - `ConcurrencyError` - Optimistic locking failures
   - `RateLimitError` - Rate limiting

## Integration Example

Combining all three systems:

```typescript
import { 
  UserId, Email, BrandedTypes,
  ValidationBuilder, validate,
  Result, ErrorFactory
} from './types';

interface CreateUserCommand {
  userId: UserId;
  email: Email;
}

// Validation + Branded Types
const commandValidator = ValidationBuilder.object<CreateUserCommand>({
  userId: value => {
    try {
      const id = BrandedTypes.userId(value as string);
      return { valid: true, value: id };
    } catch {
      return { 
        valid: false, 
        errors: [{ field: 'userId', message: 'Invalid ID', code: 'INVALID_FORMAT' }]
      };
    }
  },
  email: value => {
    const result = ValidationBuilder.string.email()(value);
    if (!result.valid) return result as any;
    try {
      const email = BrandedTypes.email(result.value);
      return { valid: true, value: email };
    } catch (e) {
      return { 
        valid: false, 
        errors: [{ field: 'email', message: 'Invalid email', code: 'INVALID_FORMAT' }]
      };
    }
  }
});

// Error Handling
function handleCommand(input: unknown): Result<User, AppError> {
  const validation = commandValidator(input);
  
  if (!validation.valid) {
    return Result.err(ErrorFactory.validation({
      code: 'INVALID_COMMAND',
      message: validation.errors[0].message,
      field: validation.errors[0].field
    }));
  }
  
  // Process with type-safe command
  const command: CreateUserCommand = validation.value;
  // ... business logic
  
  return Result.ok(user);
}
```

## Testing

Comprehensive type-level and runtime tests are included:

```bash
# Run all type tests
bun test src/types/__tests__

# Run specific test suite
bun test src/types/__tests__/branded.type.test.ts
```

## Benefits

1. **Compile-Time Safety**: Catch type errors during development
2. **Self-Documenting**: Types express domain concepts clearly
3. **Validation**: Type-safe validation with excellent DX
4. **Error Handling**: Consistent, typed error handling
5. **Composable**: All systems work together seamlessly

## Future Enhancements

- Type-Level State Machines
- Enhanced Projection Types
- Command/Query Type Safety
- GraphQL Type Enhancements