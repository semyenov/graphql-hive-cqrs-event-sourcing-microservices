# AGENTS.md - Coding Agent Guidelines

## Build/Lint/Test Commands
```bash
bun test                   # Run all tests
bun test <path>            # Run single test file (e.g., bun test src/domains/users/__tests__/domain/user.aggregate.test.ts)
bun run test:framework     # Run framework test suite
bun run typecheck          # TypeScript type checking (no lint command - use typecheck)
bun run generate:all       # Generate GraphQL types after schema changes
bun run clean:unused       # Remove unused exports
```

## Code Style Guidelines
- **Runtime**: Always use Bun APIs (Bun.serve, bun:test, Bun.file) - never Node.js equivalents
- **Imports**: Use workspace imports `@cqrs/framework` and submodules `@cqrs/framework/core`
- **Types**: Strict TypeScript with branded types (AggregateId, Email, etc.) from framework
- **Architecture**: Follow 4-layer pattern: domain → application → infrastructure → api
- **Naming**: PascalCase for classes/types, camelCase for functions/variables, kebab-case for files
- **Exports**: Use named exports, group by type (e.g., export type {...}, export {...})
- **Error Handling**: Use domain-specific error classes extending framework errors
- **Testing**: Place tests in `__tests__/` folders, use bun:test with describe/it/expect
- **Comments**: Minimal - only JSDoc for public APIs and complex business logic
- **Async**: Always use async/await, never callbacks or raw promises