/**
 * Framework Core: Error Types
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class CommandHandlerNotFoundError extends DomainError {
  constructor(commandType: string, registered: string[]) {
    super(
      `No handler registered for command type: ${commandType}. Registered types: ${registered.length ? registered.join(', ') : '(none)'}`
    );
    this.name = 'CommandHandlerNotFoundError';
  }
}

export class QueryHandlerNotFoundError extends DomainError {
  constructor(queryType: string, registered: string[]) {
    super(
      `No handler registered for query type: ${queryType}. Registered types: ${registered.length ? registered.join(', ') : '(none)'}`
    );
    this.name = 'QueryHandlerNotFoundError';
  }
}

export class AggregateNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Aggregate not found for id '${id}'`);
    this.name = 'AggregateNotFoundError';
  }
}

export class EventHandlerError extends DomainError {
  constructor(eventType: string, aggregateId: unknown, cause: unknown) {
    super(`Event handler error for event ${eventType} (aggregate ${String(aggregateId)}): ${String((cause as any)?.message ?? cause)}`);
    this.name = 'EventHandlerError';
  }
}

export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class IdMismatchError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'IdMismatchError';
  }
}

export class VersionMismatchError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'VersionMismatchError';
  }
}

export class PatternHandlerNotFoundError extends DomainError {
  constructor(type: string) {
    super(`No handler found for type '${type}' in pattern.`);
    this.name = 'PatternHandlerNotFoundError';
  }
} 