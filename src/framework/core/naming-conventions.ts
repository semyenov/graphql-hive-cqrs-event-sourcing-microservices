/**
 * Framework Core: Naming Conventions Utility
 * 
 * Shared utilities for extracting types from handler names
 * and other naming convention operations.
 */

/**
 * Naming convention utilities for CQRS handlers
 */
export const NamingConventions = {
  /**
   * Extract command type from handler name using convention
   * e.g., 'CreateUserCommandHandler' -> 'CREATE_USER'
   */
  extractCommandType(handlerName: string, suffix: string = 'CommandHandler'): string {
    const baseName = handlerName.replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
    return baseName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  },

  /**
   * Extract query type from handler name using convention
   * e.g., 'GetUserByIdQueryHandler' -> 'GET_USER_BY_ID'
   */
  extractQueryType(handlerName: string, suffix: string = 'QueryHandler'): string {
    const baseName = handlerName.replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
    return baseName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  },

  /**
   * Extract event type from handler name using convention
   * e.g., 'UserCreatedEventHandler' -> 'USER_CREATED'
   */
  extractEventType(handlerName: string, suffix: string = 'EventHandler'): string {
    const baseName = handlerName.replace(new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
    return baseName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  },

  /**
   * Convert camelCase to CONSTANT_CASE
   * e.g., 'createUser' -> 'CREATE_USER'
   */
  toConstantCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  },

  /**
   * Convert CONSTANT_CASE to camelCase
   * e.g., 'CREATE_USER' -> 'createUser'
   */
  toCamelCase(str: string): string {
    return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  },

  /**
   * Convert CONSTANT_CASE to PascalCase
   * e.g., 'CREATE_USER' -> 'CreateUser'
   */
  toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  },

  /**
   * Extract entity name from command/query type
   * e.g., 'CREATE_USER' -> 'User'
   */
  extractEntityName(typeString: string): string {
    // Remove common prefixes
    const withoutPrefix = typeString
      .replace(/^(CREATE|UPDATE|DELETE|GET|LIST|SEARCH|FIND)_/, '')
      .replace(/_COMMAND$|_QUERY$|_EVENT$/, '');
    
    return this.toPascalCase(withoutPrefix);
  },

  /**
   * Generate handler name from type
   * e.g., 'CREATE_USER' -> 'CreateUserCommandHandler'
   */
  generateHandlerName(typeString: string, handlerType: 'command' | 'query' | 'event'): string {
    const baseName = this.toPascalCase(typeString);
    const suffix = handlerType === 'command' ? 'CommandHandler' :
                  handlerType === 'query' ? 'QueryHandler' :
                  'EventHandler';
    return baseName + suffix;
  }
};

/**
 * Type-safe naming convention helpers
 */
export type HandlerNamingConfig = {
  commandSuffix?: string;
  querySuffix?: string;
  eventSuffix?: string;
  projectionSuffix?: string;
  validatorSuffix?: string;
};

/**
 * Configurable naming convention extractor
 */
export class NamingConventionExtractor {
  private config: Required<HandlerNamingConfig>;

  constructor(config: HandlerNamingConfig = {}) {
    this.config = {
      commandSuffix: 'CommandHandler',
      querySuffix: 'QueryHandler',
      eventSuffix: 'EventHandler',
      projectionSuffix: 'Projection',
      validatorSuffix: 'Validator',
      ...config
    };
  }

  /**
   * Extract command type with custom suffix
   */
  extractCommandType(handlerName: string): string {
    return NamingConventions.extractCommandType(handlerName, this.config.commandSuffix);
  }

  /**
   * Extract query type with custom suffix
   */
  extractQueryType(handlerName: string): string {
    return NamingConventions.extractQueryType(handlerName, this.config.querySuffix);
  }

  /**
   * Extract event type with custom suffix
   */
  extractEventType(handlerName: string): string {
    return NamingConventions.extractEventType(handlerName, this.config.eventSuffix);
  }

  /**
   * Determine component type from name
   */
  determineComponentType(name: string): 'command' | 'query' | 'event' | 'projection' | 'validator' | null {
    if (name.endsWith(this.config.commandSuffix)) return 'command';
    if (name.endsWith(this.config.querySuffix)) return 'query';
    if (name.endsWith(this.config.eventSuffix)) return 'event';
    if (name.includes(this.config.projectionSuffix)) return 'projection';
    if (name.includes(this.config.validatorSuffix)) return 'validator';
    return null;
  }
}

/**
 * Default naming convention extractor instance
 */
export const defaultNamingExtractor = new NamingConventionExtractor();