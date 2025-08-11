/**
 * Framework Pattern Matching Module
 * 
 * Advanced pattern matching utilities using ts-pattern for exhaustive checking
 * and better type safety in event-driven systems.
 */

// Core pattern matching utilities
export * from './matchers';

// Reducer patterns with exhaustive matching
export * from './reducers';

// Event handler patterns
export * from './event-handlers';

// Command handler patterns  
export * from './command-handlers';

// Re-export ts-pattern for convenience
export { match, P } from 'ts-pattern';

/**
 * Quick start guide for pattern matching:
 * 
 * 1. Exhaustive event matching:
 * ```typescript
 * import { createEventMatcher } from '@cqrs/framework/patterns';
 * 
 * const handleEvent = createEventMatcher<UserEvent>()
 *   .when('USER_CREATED', (event) => console.log('User created'))
 *   .when('USER_UPDATED', (event) => console.log('User updated'))
 *   .when('USER_DELETED', (event) => console.log('User deleted'))
 *   .exhaustive();
 * ```
 * 
 * 2. Pattern-based reducers:
 * ```typescript
 * import { createPatternReducer } from '@cqrs/framework/patterns';
 * 
 * const reducer = createPatternReducer<State, Event>(initialState)
 *   .on('ADD_ITEM', (state, event) => ({
 *     ...state,
 *     items: [...state.items, event.data.item]
 *   }))
 *   .on('REMOVE_ITEM', (state, event) => ({
 *     ...state,
 *     items: state.items.filter(i => i.id !== event.data.id)
 *   }))
 *   .build();
 * ```
 * 
 * 3. Command routing:
 * ```typescript
 * import { createCommandRouter } from '@cqrs/framework/patterns';
 * 
 * const router = createCommandRouter<Command>()
 *   .route('CREATE_USER', createUserHandler)
 *   .route('UPDATE_USER', updateUserHandler)
 *   .route('DELETE_USER', deleteUserHandler)
 *   .build();
 * ```
 */