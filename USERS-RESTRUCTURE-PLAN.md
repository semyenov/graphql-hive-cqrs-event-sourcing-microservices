# Users Domain Restructuring Plan

## 🎯 Goals
1. Better separation of concerns following DDD principles
2. Improved discoverability and maintainability
3. Clear separation between domain logic and infrastructure
4. Consistent naming conventions
5. Reduced coupling between components

## 📁 Current Structure Issues

### Problems Identified:
- Mixed domain and infrastructure concerns
- Inconsistent file naming (user.ts vs user-list.projection.ts)
- Scattered helpers across multiple files
- Setup and configuration mixed with domain logic
- No clear separation between public API and internal implementation

## 🏗️ Proposed New Structure

```
src/domains/users/
├── domain/                          # Pure domain logic
│   ├── user.aggregate.ts           # User aggregate root
│   ├── user.entity.ts              # User entity/value objects
│   ├── user.events.ts              # Domain events
│   ├── user.commands.ts            # Command definitions
│   ├── user.queries.ts             # Query definitions
│   ├── user.errors.ts              # Domain-specific errors
│   └── user.types.ts               # Domain types and interfaces
├── application/                     # Application services layer
│   ├── commands/
│   │   ├── index.ts                # Command exports
│   │   ├── create-user.handler.ts  # Individual command handlers
│   │   ├── update-user.handler.ts
│   │   ├── delete-user.handler.ts
│   │   ├── verify-email.handler.ts
│   │   └── update-profile.handler.ts
│   ├── queries/
│   │   ├── index.ts                # Query exports
│   │   ├── get-user.handler.ts     # Individual query handlers
│   │   ├── list-users.handler.ts
│   │   ├── search-users.handler.ts
│   │   └── get-stats.handler.ts
│   └── services/                   # Application services
│       ├── user.service.ts         # Orchestration logic
│       └── email.service.ts        # Email notifications
├── infrastructure/                  # Infrastructure layer
│   ├── persistence/
│   │   ├── user.repository.ts      # Repository implementation
│   │   └── user.mapper.ts          # Data mapping
│   ├── projections/
│   │   ├── index.ts                # Projection exports
│   │   ├── user-details.projection.ts
│   │   ├── user-list.projection.ts
│   │   └── user-stats.projection.ts
│   ├── validation/
│   │   ├── index.ts                # Validator exports
│   │   ├── command.validators.ts   # Command validation rules
│   │   └── schema.validators.ts    # Schema validation
│   └── events/
│       ├── event.handlers.ts       # Event handling logic
│       └── event.factories.ts      # Event creation utilities
├── api/                            # API layer (GraphQL, REST, etc.)
│   ├── graphql/
│   │   ├── user.schema.ts          # GraphQL schema
│   │   ├── user.resolvers.ts       # GraphQL resolvers
│   │   └── user.types.ts           # GraphQL type definitions
│   └── dto/                        # Data Transfer Objects
│       ├── user.dto.ts             # User DTOs
│       └── command.dto.ts          # Command DTOs
├── shared/                         # Shared utilities within domain
│   ├── constants.ts                # Domain constants
│   ├── type-guards.ts              # Type checking utilities
│   ├── factories.ts                # Factory functions
│   └── helpers.ts                  # Domain-specific helpers
├── __tests__/                      # Tests organized by layer
│   ├── domain/
│   │   └── user.aggregate.test.ts
│   ├── application/
│   │   ├── commands/
│   │   └── queries/
│   └── infrastructure/
│       └── projections/
├── index.ts                        # Public API exports
├── user.module.ts                  # Module definition and setup
└── README.md                       # Domain documentation
```

## 🔄 Migration Steps

### Phase 1: Create New Structure
1. Create new directory structure
2. Move and rename files according to new organization
3. Update imports and exports

### Phase 2: Separate Concerns
1. Extract domain logic from infrastructure
2. Create proper service layer
3. Separate API concerns from domain logic

### Phase 3: Improve Naming
1. Consistent naming conventions
2. Clear file purposes
3. Better export organization

### Phase 4: Update Dependencies
1. Update imports throughout the application
2. Update tests
3. Update documentation

## 📋 Detailed File Changes

### Domain Layer (Pure Business Logic)
- `user.aggregate.ts` - User aggregate with business rules
- `user.entity.ts` - User entity and value objects
- `user.events.ts` - Domain events (UserCreated, UserUpdated, etc.)
- `user.commands.ts` - Command definitions
- `user.queries.ts` - Query definitions
- `user.errors.ts` - Domain-specific errors
- `user.types.ts` - Domain types and branded types

### Application Layer (Use Cases)
- Individual command handlers for each operation
- Individual query handlers for each query
- Application services for complex orchestration
- Email notification service

### Infrastructure Layer (Technical Implementation)
- Repository implementation
- Projection builders
- Validation logic
- Event handling infrastructure

### API Layer (External Interface)
- GraphQL schema and resolvers
- DTOs for data transfer
- API-specific types

## 🎯 Benefits of New Structure

1. **Clear Separation of Concerns**: Each layer has a specific responsibility
2. **Better Testability**: Easy to test each layer in isolation
3. **Improved Maintainability**: Changes in one layer don't affect others
4. **Scalability**: Easy to add new features following established patterns
5. **Domain Focus**: Core domain logic is isolated and protected
6. **Consistency**: Standard structure can be replicated for other domains

## 🔧 Implementation Order

1. **Start with Domain Layer**: Move pure domain logic first
2. **Application Layer**: Separate command/query handlers
3. **Infrastructure Layer**: Move technical implementations
4. **API Layer**: Separate external interface concerns
5. **Update Exports**: Fix all imports and public API
6. **Update Tests**: Reorganize test structure
7. **Documentation**: Update module documentation

## 🎁 Additional Improvements

- **Type Safety**: Better TypeScript organization
- **Documentation**: Clear README for each layer
- **Consistency**: Standard patterns across all domains
- **Performance**: Better tree-shaking with organized exports
- **DX**: Improved developer experience with clear structure 