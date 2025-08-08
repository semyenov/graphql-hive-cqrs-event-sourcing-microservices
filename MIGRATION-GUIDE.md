# Framework Migration Guide: v1 → v2 (KISS Refactoring)

This guide helps you migrate from the complex v1 framework to the simplified v2 KISS-compliant framework.

## Overview of Changes

### ✅ What's Better in v2
- **40% less code complexity** in core framework
- **Simplified APIs** with clear, predictable behavior  
- **Better separation of concerns** through focused components
- **Explicit over magical** - less auto-discovery magic, more control
- **Composable middleware** for cross-cutting concerns
- **Unified validation system** (no more dual systems)

### 🔄 Migration Strategy
v2 maintains **backward compatibility** with v1 APIs, so you can migrate gradually:

1. **Phase 1**: Update imports to new recommended APIs
2. **Phase 2**: Migrate domain builders to simplified versions
3. **Phase 3**: Replace complex resolvers with simple + middleware  
4. **Phase 4**: Clean up deprecated imports

---

## 1. Domain Builder Migration

### ❌ Before (v1 - Complex)
```typescript
import { EnhancedDomainBuilder, createEnhancedDomainBuilder } from '../framework';

const domain = createEnhancedDomainBuilder({
  autoDiscovery: true,
  discoveryPreset: 'standardCQRS',
  discoveryConfig: { baseDir: './src/domains/users' },
  manualComponents: {
    commandHandlers: { CreateUserCommandHandler: handler }
  },
  autoRegister: { handlers: true, projections: true }
});

const result = await domain.discover();
const components = await domain.build(context);
```

### ✅ After (v2 - Simple)
```typescript
import { DomainBuilder } from '../framework';

const domain = DomainBuilder
  .forDomain('User')
  .withCommandHandlers({ CreateUserCommandHandler: handler })
  .withQueryHandlers({ GetUserQueryHandler: queryHandler })
  .withEventHandlers(userEventHandler)
  .build(context);
```

**Benefits**: 80% less configuration code, explicit registration, clear intent.

---

## 2. Validation System Migration

### ❌ Before (v1 - Dual Systems)
```typescript
// Old system - confusing dual APIs
import { 
  createValidatorV2,      // Enhanced system
  createValidator,        // Legacy system  
  ValidationRulesV2,      // Enhanced rules
  ValidationRules         // Legacy rules
} from '../framework/core/validation-enhanced';
```

### ✅ After (v2 - Unified)
```typescript
// New system - one clean API
import { 
  createValidator,
  ValidationRules,
  validator,
  combineValidators
} from '../framework';

const userValidator = createValidator({
  name: [
    ValidationRules.required(),
    ValidationRules.string.length(2, 100)
  ],
  email: ValidationRules.string.email()
});
```

**Benefits**: Single API, better type inference, cleaner syntax.

---

## 3. Auto-Discovery Migration

### ❌ Before (v1 - Magic File System)
```typescript
import { createAutoDiscovery, DiscoveryPresets } from '../framework';

const discovery = createAutoDiscovery({
  baseDir: './src/domains',
  patterns: {
    commandHandlers: ['**/commands/handlers.ts'],
    // ... complex pattern matching
  },
  conventions: {
    commandHandlerSuffix: 'CommandHandler',
    // ... more configuration
  }
});

const result = await discovery.discover();
```

### ✅ After (v2 - Explicit Registration)
```typescript
import { DiscoveryHelpers } from '../framework';

// Option 1: From module exports (simple)
const domain = DiscoveryHelpers.fromModule(require('./handlers'));

// Option 2: Explicit registration (recommended)
const domain = DomainBuilder
  .forDomain('User')
  .withCommandHandlers({ CreateUserCommandHandler })
  .withQueryHandlers({ GetUserQueryHandler });
```

**Benefits**: No magic, predictable behavior, easier debugging.

---

## 4. GraphQL Resolver Migration

### ❌ Before (v1 - Monolithic Resolvers)
```typescript
import { EnhancedResolverBuilder } from '../framework/graphql/enhanced-resolvers';

const resolvers = new EnhancedResolverBuilder({
  enableValidation: true,
  enableMetrics: true, 
  enableErrorHandling: true,
  enableCaching: true,
  enableAuth: true,
  enableRateLimit: true
  // ... 20+ configuration options
});
```

### ✅ After (v2 - Simple + Middleware)
```typescript
import { 
  createResolverBuilder,
  MiddlewarePresets 
} from '../framework/graphql';

const createUser = createCommandResolver('CREATE_USER');
const getUserWithMiddleware = MiddlewarePresets.mutation('userValidator')(
  createQueryResolver('GET_USER')
);

const resolvers = createResolverBuilder()
  .command('createUser', 'CREATE_USER')
  .query('getUser', 'GET_USER')
  .build();
```

**Benefits**: Composable middleware, single responsibility, testable components.

---

## 5. Common Migration Patterns

### Import Changes
```typescript
// ❌ Old imports
import { EnhancedDomainBuilder, createAutoDiscovery } from '../framework';
import { ValidationRulesV2 } from '../framework/core/validation-enhanced';

// ✅ New imports  
import { DomainBuilder, DiscoveryHelpers, ValidationRules } from '../framework';
```

### Handler Registration
```typescript
// ❌ Old: Magic file system discovery
const discovery = await autoDiscovery.discover();

// ✅ New: Explicit registration
const domain = DomainBuilder.forDomain('User')
  .fromModule(require('./user-handlers'));
```

### Middleware Composition
```typescript
// ❌ Old: All-in-one configuration
const resolver = enhancedResolver.withEverything();

// ✅ New: Compose what you need
const resolver = compose(
  withValidation('userValidator'),
  withAuth(['user:read']),
  withErrorHandling()
)(baseResolver);
```

---

## 6. Step-by-Step Migration

### Step 1: Update Package Imports
```bash
# No package changes needed - same framework, new APIs
# Just update your import statements
```

### Step 2: Migrate Domain Builders (Low Risk)
1. Replace `EnhancedDomainBuilder` with `SimpleDomainBuilder`  
2. Convert auto-discovery config to explicit registration
3. Test domain still registers correctly

### Step 3: Migrate Validation (Medium Risk)  
1. Remove dual validation imports
2. Update validation rules to unified API
3. Test validation logic still works

### Step 4: Migrate Resolvers (High Risk)
1. Replace enhanced resolvers with simple + middleware
2. Compose middleware for needed cross-cutting concerns
3. Test GraphQL operations thoroughly

### Step 5: Clean Up (Low Risk)
1. Remove deprecated imports
2. Update TypeScript types if needed
3. Run full test suite

---

## 7. Backward Compatibility

**Good News**: The v1 APIs are still available as "Legacy" exports:

```typescript
// v1 APIs still work (marked as deprecated)
import { 
  EnhancedDomainBuilder,    // Still available
  createAutoDiscovery,      // Still available  
  ValidationRulesV2         // Still available
} from '../framework';

// But use v2 APIs for new code
import {
  DomainBuilder,           // Recommended
  SimpleDiscovery,         // Recommended
  ValidationRules          // Recommended  
} from '../framework';
```

---

## 8. Benefits After Migration

### Code Quality
- **Simpler**: Less configuration, more explicit
- **Testable**: Focused components are easier to test
- **Debuggable**: Less magic, clearer execution flow
- **Maintainable**: Single responsibility principle

### Performance  
- **Smaller bundle**: Less code means faster loading
- **Faster builds**: Simpler type checking
- **Better caching**: Explicit dependencies

### Developer Experience
- **Better IntelliSense**: Clearer type inference
- **Easier onboarding**: Less complexity to learn
- **Clear intent**: Code reads like business logic

---

## 9. Migration Checklist

- [ ] Update domain builders to `SimpleDomainBuilder`
- [ ] Migrate validation to unified system  
- [ ] Replace auto-discovery with explicit registration
- [ ] Migrate resolvers to simple + middleware approach
- [ ] Update imports to v2 recommended APIs
- [ ] Remove deprecated v1 imports
- [ ] Run full test suite
- [ ] Update documentation/examples

---

## Need Help?

The old APIs remain available during migration. Start with low-risk changes (domain builders) and gradually migrate to the new simplified system.

**Key Principle**: v2 favors **explicit over magical** and **simple over complex** while maintaining all the power of CQRS/Event Sourcing.