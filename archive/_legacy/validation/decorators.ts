/**
 * Framework Validation: Decorators
 * 
 * TypeScript decorators for automatic validation of methods and classes.
 */

import 'reflect-metadata';
import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Method decorator for validating input parameters
 */
export function validates<T>(schema: z.ZodSchema<T>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate first argument
      const input = args[0];
      const result = await schema.safeParseAsync(input);
      
      if (!result.success) {
        throw new ValidationError(
          `Validation failed for ${propertyKey}`,
          result.error.errors
        );
      }

      // Call original method with validated input
      return originalMethod.apply(this, [result.data, ...args.slice(1)]);
    };

    return descriptor;
  };
}

/**
 * Class decorator for adding validation to all methods
 */
export function validatable<T extends { new(...args: any[]): {} }>(
  schemas: Record<string, z.ZodSchema<any>>
) {
  return function (constructor: T) {
    const proto = constructor.prototype;
    
    for (const [methodName, schema] of Object.entries(schemas)) {
      const originalMethod = proto[methodName];
      
      if (typeof originalMethod === 'function') {
        proto[methodName] = async function (...args: any[]) {
          const input = args[0];
          const result = await schema.safeParseAsync(input);
          
          if (!result.success) {
            throw new ValidationError(
              `Validation failed for ${methodName}`,
              result.error.errors
            );
          }
          
          return originalMethod.apply(this, [result.data, ...args.slice(1)]);
        };
      }
    }
    
    return constructor;
  };
}

/**
 * Property decorator for validating property assignments
 */
export function validate<T>(schema: z.ZodSchema<T>) {
  return function (target: any, propertyKey: string) {
    let value: T;
    
    const getter = function () {
      return value;
    };
    
    const setter = function (newVal: T) {
      const result = schema.safeParse(newVal);
      
      if (!result.success) {
        throw new ValidationError(
          `Validation failed for property ${propertyKey}`,
          result.error.errors
        );
      }
      
      value = result.data;
    };
    
    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Parameter decorator for validating specific parameters
 */
export function param<T>(schema: z.ZodSchema<T>) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number
  ) {
    const existingValidators = Reflect.getMetadata(
      'validators',
      target,
      propertyKey
    ) || [];
    
    existingValidators[parameterIndex] = schema;
    
    Reflect.defineMetadata(
      'validators',
      existingValidators,
      target,
      propertyKey
    );
  };
}

/**
 * Apply parameter validators
 */
export function applyParamValidators(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  const validators = Reflect.getMetadata('validators', target, propertyKey) || [];
  
  descriptor.value = async function (...args: any[]) {
    for (let i = 0; i < validators.length; i++) {
      if (validators[i]) {
        const result = await validators[i].safeParseAsync(args[i]);
        
        if (!result.success) {
          throw new ValidationError(
            `Validation failed for parameter ${i} of ${propertyKey}`,
            result.error.errors
          );
        }
        
        args[i] = result.data;
      }
    }
    
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}