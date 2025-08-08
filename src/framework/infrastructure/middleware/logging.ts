/**
 * Framework Infrastructure: Logging Middleware
 * 
 * Command and query logging middleware for observability.
 */

import type { ICommandMiddleware } from '../../core/command';
import type { IQueryMiddleware } from '../../core/query';
import type { ICommand, IQuery } from '../../core';

/**
 * Logging configuration
 */
export interface LoggingConfig {
  enabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  includePayload?: boolean;
  includeResult?: boolean;
  maskSensitiveFields?: string[];
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly prefix = '[CQRS]') {}
  
  debug(message: string, data?: Record<string, unknown>): void {
    console.debug(`${this.prefix} DEBUG:`, message, data || '');
  }
  
  info(message: string, data?: Record<string, unknown>): void {
    console.info(`${this.prefix} INFO:`, message, data || '');
  }
  
  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`${this.prefix} WARN:`, message, data || '');
  }
  
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    console.error(`${this.prefix} ERROR:`, message, error?.message || '', data || '');
    if (error?.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Mask sensitive fields in payload
 */
function maskSensitiveData(
  data: unknown,
  sensitiveFields: string[]
): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const masked = { ...data } as Record<string, unknown>;
  
  for (const field of sensitiveFields) {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  }
  
  // Recursively mask nested objects
  for (const [key, value] of Object.entries(masked)) {
    if (value && typeof value === 'object') {
      masked[key] = maskSensitiveData(value, sensitiveFields);
    }
  }
  
  return masked;
}

/**
 * Create command logging middleware
 */
export function createCommandLoggingMiddleware<TCommand extends ICommand = ICommand>(
  config: LoggingConfig = {},
  logger: ILogger = new ConsoleLogger('[Command]')
): ICommandMiddleware<TCommand> {
  const {
    enabled = true,
    logLevel = 'info',
    includePayload = true,
    includeResult = false,
    maskSensitiveFields = ['password', 'token', 'secret', 'apiKey'],
  } = config;
  
  return {
    async execute(command, next) {
      if (!enabled) {
        return next(command);
      }
      
      const startTime = Date.now();
      const correlationId = (command as any).metadata?.correlationId || 'N/A';
      
      // Log command execution start
      const logData: Record<string, unknown> = {
        type: command.type,
        correlationId,
      };
      
      if (includePayload) {
        logData.payload = maskSensitiveData(command.payload, maskSensitiveFields);
      }
      
      logger.info(`Executing command: ${command.type}`, logData);
      
      try {
        const result = await next(command);
        const duration = Date.now() - startTime;
        
        // Log successful execution
        const successData: Record<string, unknown> = {
          type: command.type,
          correlationId,
          duration: `${duration}ms`,
        };
        
        if (includeResult) {
          successData.result = maskSensitiveData(result, maskSensitiveFields);
        }
        
        logger.info(`Command executed successfully: ${command.type}`, successData);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log failed execution
        logger.error(
          `Command failed: ${command.type}`,
          error as Error,
          {
            type: command.type,
            correlationId,
            duration: `${duration}ms`,
          }
        );
        
        throw error;
      }
    },
  };
}

/**
 * Create query logging middleware
 */
export function createQueryLoggingMiddleware<TQuery extends IQuery = IQuery>(
  config: LoggingConfig = {},
  logger: ILogger = new ConsoleLogger('[Query]')
): IQueryMiddleware<TQuery> {
  const {
    enabled = true,
    logLevel = 'debug',
    includePayload = true,
    includeResult = false,
    maskSensitiveFields = ['password', 'token', 'secret', 'apiKey'],
  } = config;
  
  return {
    async execute(query, next) {
      if (!enabled) {
        return next(query);
      }
      
      const startTime = Date.now();
      
      // Log query execution start
      const logData: Record<string, unknown> = {
        type: query.type,
      };
      
      if (includePayload && query.parameters) {
        logData.parameters = maskSensitiveData(query.parameters, maskSensitiveFields);
      }
      
      logger.debug(`Executing query: ${query.type}`, logData);
      
      try {
        const result = await next(query);
        const duration = Date.now() - startTime;
        
        // Log successful execution
        const successData: Record<string, unknown> = {
          type: query.type,
          duration: `${duration}ms`,
        };
        
        if (includeResult) {
          successData.resultCount = Array.isArray(result) ? result.length : 1;
        }
        
        logger.debug(`Query executed successfully: ${query.type}`, successData);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log failed execution
        logger.error(
          `Query failed: ${query.type}`,
          error as Error,
          {
            type: query.type,
            duration: `${duration}ms`,
          }
        );
        
        throw error;
      }
    },
  };
}