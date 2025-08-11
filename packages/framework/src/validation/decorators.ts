/**
 * Framework Validation: Decorators
 * 
 * TypeScript decorators for automatic validation in class-based handlers.
 * Provides seamless integration with command handlers and aggregates.
 */

import 'reflect-metadata';
import { z } from 'zod';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { validate, validateEffect, ValidationError } from './validators';
import { CommandValidationError } from '../effect/core/command-effects';

/**
 * Metadata keys for validation
 */
const VALIDATION_METADATA = {
  SCHEMA: Symbol('validation:schema'),
  VALIDATOR: Symbol('validation:validator'),
  AGGREGATE_RULES: Symbol('validation:aggregate-rules'),
};

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Whether to throw on validation failure
   */
  throwOnError?: boolean;
  
  /**
   * Whether to cache validation results
   */
  cache?: boolean;
  
  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number;
  
  /**
   * Custom error handler
   */
  onError?: (error: ValidationError) => void;
}

/**
 * Validate method parameters with Zod schema
 * 
 * @example
 * ```typescript
 * class UserCommandHandler {
 *   @Validate(CreateUserSchema)
 *   async handleCreateUser(command: CreateUserCommand) {
 *     // Command is automatically validated
 *   }
 * }
 * ```
 */
export function Validate(
  schema: z.ZodSchema,
  options: ValidationOptions = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Validate the first argument (typically the command/event)
      const [input, ...restArgs] = args;
      const validation = validate(schema, input);
      
      if (validation._tag === 'Left') {
        const error = validation.left;
        
        if (options.onError) {
          options.onError(error);
        }
        
        if (options.throwOnError !== false) {
          throw error;
        }
        
        return { success: false, error };
      }
      
      // Call original method with validated input
      return originalMethod.apply(this, [validation.right, ...restArgs]);
    };
    
    // Store metadata for introspection
    Reflect.defineMetadata(VALIDATION_METADATA.SCHEMA, schema, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Validate aggregate state transitions
 * 
 * @example
 * ```typescript
 * class UserAggregate {
 *   @ValidateAggregate(UserStateSchema)
 *   applyEvent(event: UserEvent) {
 *     // State is validated after applying event
 *   }
 * }
 * ```
 */
export function ValidateAggregate(
  stateSchema: z.ZodSchema,
  options: ValidationOptions = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);
      
      // Validate the aggregate state after method execution
      const state = (this as any).state || (this as any)._state;
      const validation = validate(stateSchema, state);
      
      if (validation._tag === 'Left') {
        const error = validation.left;
        
        if (options.onError) {
          options.onError(error);
        }
        
        if (options.throwOnError !== false) {
          throw new Error(`Invalid aggregate state: ${error.message}`);
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Schema decorator for class-level validation
 * 
 * @example
 * ```typescript
 * @Schema(UserCommandSchema)
 * class UserCommand {
 *   constructor(public data: unknown) {
 *     // Data is automatically validated
 *   }
 * }
 * ```
 */
export function Schema(schema: z.ZodSchema) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        
        // Validate the instance against the schema
        const validation = validate(schema, this);
        
        if (validation._tag === 'Left') {
          throw validation.left;
        }
        
        // Replace properties with validated values
        Object.assign(this, validation.right);
      }
    };
  };
}

/**
 * Validate method parameters individually
 * 
 * @example
 * ```typescript
 * class Service {
 *   process(
 *     @ValidateParam(z.string().email()) email: string,
 *     @ValidateParam(z.number().positive()) amount: number
 *   ) {
 *     // Parameters are validated
 *   }
 * }
 * ```
 */
export function ValidateParam(schema: z.ZodSchema) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number
  ) {
    const existingSchemas = Reflect.getOwnMetadata(
      VALIDATION_METADATA.VALIDATOR,
      target,
      propertyKey
    ) || [];
    
    existingSchemas[parameterIndex] = schema;
    
    Reflect.defineMetadata(
      VALIDATION_METADATA.VALIDATOR,
      existingSchemas,
      target,
      propertyKey
    );
  };
}

/**
 * Apply parameter validation to a method
 */
export function ApplyParamValidation(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  const paramSchemas = Reflect.getOwnMetadata(
    VALIDATION_METADATA.VALIDATOR,
    target,
    propertyKey
  );
  
  if (!paramSchemas || paramSchemas.length === 0) {
    return descriptor;
  }
  
  descriptor.value = function (...args: any[]) {
    // Validate each parameter
    for (let i = 0; i < paramSchemas.length; i++) {
      const schema = paramSchemas[i];
      if (schema) {
        const validation = validate(schema, args[i]);
        
        if (validation._tag === 'Left') {
          throw new Error(
            `Parameter ${i} validation failed: ${validation.left.message}`
          );
        }
        
        args[i] = validation.right;
      }
    }
    
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}

/**
 * Validate with Effect for async operations
 * 
 * @example
 * ```typescript
 * class UserService {
 *   @ValidateEffect(CreateUserSchema)
 *   createUser(command: unknown) {
 *     return Effect.succeed({ userId: '123' });
 *   }
 * }
 * ```
 */
export function ValidateEffect(schema: z.ZodSchema) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const [input, ...restArgs] = args;
      
      return pipe(
        validateEffect(schema, input),
        Effect.mapError((error) =>
          new CommandValidationError({
            message: error.message,
            issues: error.issues,
            command: input,
          })
        ),
        Effect.flatMap((validated) =>
          originalMethod.apply(this, [validated, ...restArgs])
        )
      );
    };
    
    return descriptor;
  };
}

/**
 * Business rule validation decorator
 * 
 * @example
 * ```typescript
 * class OrderAggregate {
 *   @BusinessRule((order) => order.total > 0, 'Order total must be positive')
 *   placeOrder(order: Order) {
 *     // Business rule is validated
 *   }
 * }
 * ```
 */
export function BusinessRule<T>(
  rule: (value: T) => boolean,
  message: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const [input] = args;
      
      if (!rule(input)) {
        throw new ValidationError(message, [], input);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Compose multiple validation decorators
 * 
 * @example
 * ```typescript
 * class Handler {
 *   @ComposeValidation(
 *     Validate(CommandSchema),
 *     BusinessRule((cmd) => cmd.amount > 0, 'Amount must be positive')
 *   )
 *   handle(command: Command) {
 *     // Multiple validations applied
 *   }
 * }
 * ```
 */
export function ComposeValidation(
  ...decorators: Array<MethodDecorator>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    decorators.reduce(
      (desc, decorator) => decorator(target, propertyKey, desc) || desc,
      descriptor
    );
    
    return descriptor;
  };
}

/**
 * Validation metadata utilities
 */
export const ValidationMetadata = {
  /**
   * Get schema for a method
   */
  getSchema(target: any, propertyKey: string): z.ZodSchema | undefined {
    return Reflect.getMetadata(VALIDATION_METADATA.SCHEMA, target, propertyKey);
  },
  
  /**
   * Check if a method has validation
   */
  hasValidation(target: any, propertyKey: string): boolean {
    return Reflect.hasMetadata(VALIDATION_METADATA.SCHEMA, target, propertyKey);
  },
  
  /**
   * Get all validated methods in a class
   */
  getValidatedMethods(target: any): string[] {
    const methods: string[] = [];
    const prototype = target.prototype || target;
    
    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (this.hasValidation(prototype, key)) {
        methods.push(key);
      }
    }
    
    return methods;
  },
};