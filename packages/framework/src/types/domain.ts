/**
 * Framework Types: Domain Modeling Utilities
 * 
 * Type utilities for Domain-Driven Design patterns.
 * Provides value objects, entities, aggregates, and algebraic data types.
 */

import type { IEvent, ICommand } from '../effect/core/types';

/**
 * Value Object type
 * Immutable, compared by value
 */
export type ValueObject<Brand extends string, T> = T & {
  readonly __brand: Brand;
  readonly __valueObject: true;
};

/**
 * Create a value object
 */
export function valueObject<Brand extends string, T>(
  brand: Brand,
  value: T
): ValueObject<Brand, T> {
  return value as ValueObject<Brand, T>;
}

/**
 * Entity type
 * Has identity, compared by ID
 */
export type Entity<Id, Properties> = Properties & {
  readonly id: Id;
  readonly __entity: true;
};

/**
 * Create an entity
 */
export function entity<Id, Properties>(
  id: Id,
  properties: Properties
): Entity<Id, Properties> {
  return {
    ...properties,
    id,
    __entity: true as const,
  } as Entity<Id, Properties>;
}

/**
 * Aggregate Root type
 * Entity that acts as a consistency boundary
 */
export type AggregateRoot<Entity, Event extends IEvent> = Entity & {
  readonly __aggregateRoot: true;
  readonly version: number;
  readonly uncommittedEvents: readonly Event[];
};

/**
 * Domain Event type
 */
export type DomainEvent<
  Type extends string,
  Data,
  AggregateId = string
> = IEvent & {
  readonly type: Type;
  readonly aggregateId: AggregateId;
  readonly data: Data;
  readonly version: number;
  readonly timestamp: Date;
};

/**
 * Domain Command type
 */
export type DomainCommand<
  Type extends string,
  Payload,
  AggregateId = string
> = ICommand & {
  readonly type: Type;
  readonly aggregateId: AggregateId;
  readonly payload: Payload;
};

/**
 * Algebraic Data Types
 */

/**
 * Sum type (discriminated union)
 * Represents a choice between variants
 */
export type Sum<T extends Record<string, any>> = {
  [K in keyof T]: { type: K } & T[K];
}[keyof T];

/**
 * Product type (intersection)
 * Represents a combination of all fields
 */
export type Product<T extends Record<string, any>> = UnionToIntersection<T[keyof T]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Maybe type (Option)
 * Represents a value that may or may not exist
 */
export type Maybe<T> = { type: 'Some'; value: T } | { type: 'None' };

export const Maybe = {
  some: <T>(value: T): Maybe<T> => ({ type: 'Some', value }),
  none: <T>(): Maybe<T> => ({ type: 'None' }),
  isSome: <T>(maybe: Maybe<T>): maybe is { type: 'Some'; value: T } =>
    maybe.type === 'Some',
  isNone: <T>(maybe: Maybe<T>): maybe is { type: 'None' } =>
    maybe.type === 'None',
  map: <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> =>
    Maybe.isSome(maybe) ? Maybe.some(fn(maybe.value)) : Maybe.none(),
  flatMap: <T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U> =>
    Maybe.isSome(maybe) ? fn(maybe.value) : Maybe.none(),
  getOrElse: <T>(maybe: Maybe<T>, defaultValue: T): T =>
    Maybe.isSome(maybe) ? maybe.value : defaultValue,
};

/**
 * Result type (Either)
 * Represents a computation that may fail
 */
export type Result<T, E = Error> =
  | { type: 'Ok'; value: T }
  | { type: 'Err'; error: E };

export const Result = {
  ok: <T, E = Error>(value: T): Result<T, E> => ({ type: 'Ok', value }),
  err: <T, E = Error>(error: E): Result<T, E> => ({ type: 'Err', error }),
  isOk: <T, E>(result: Result<T, E>): result is { type: 'Ok'; value: T } =>
    result.type === 'Ok',
  isErr: <T, E>(result: Result<T, E>): result is { type: 'Err'; error: E } =>
    result.type === 'Err',
  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
    Result.isOk(result) ? Result.ok(fn(result.value)) : Result.err(result.error),
  mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
    Result.isErr(result) ? Result.err(fn(result.error)) : Result.ok(result.value),
  flatMap: <T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> =>
    Result.isOk(result) ? fn(result.value) : Result.err(result.error),
  getOrElse: <T, E>(result: Result<T, E>, defaultValue: T): T =>
    Result.isOk(result) ? result.value : defaultValue,
};

/**
 * NonEmptyArray type
 * Array that must have at least one element
 */
export type NonEmptyArray<T> = [T, ...T[]];

export const NonEmptyArray = {
  of: <T>(...items: [T, ...T[]]): NonEmptyArray<T> => items,
  head: <T>(arr: NonEmptyArray<T>): T => arr[0],
  tail: <T>(arr: NonEmptyArray<T>): T[] => arr.slice(1),
  last: <T>(arr: NonEmptyArray<T>): T => arr[arr.length - 1],
  map: <T, U>(arr: NonEmptyArray<T>, fn: (value: T) => U): NonEmptyArray<U> => {
    const [head, ...tail] = arr;
    return [fn(head), ...tail.map(fn)];
  },
};

/**
 * Specification pattern
 * Encapsulates business rules
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) &&
      this.right.isSatisfiedBy(candidate)
    );
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return (
      this.left.isSatisfiedBy(candidate) ||
      this.right.isSatisfiedBy(candidate)
    );
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * Repository interface
 */
export interface Repository<T, Id> {
  findById(id: Id): Promise<Maybe<T>>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: Id): Promise<void>;
}

/**
 * Unit of Work pattern
 */
export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  registerNew<T>(entity: T): void;
  registerDirty<T>(entity: T): void;
  registerDeleted<T>(entity: T): void;
}

/**
 * Domain Service interface
 */
export interface DomainService<Input, Output> {
  execute(input: Input): Promise<Result<Output>>;
}

/**
 * Application Service interface
 */
export interface ApplicationService<Command, Result> {
  handle(command: Command): Promise<Result>;
}

/**
 * Policy pattern
 */
export interface Policy<Context, Decision> {
  evaluate(context: Context): Decision;
}

/**
 * Factory pattern
 */
export interface Factory<T, Params = any> {
  create(params: Params): T;
}

/**
 * Builder pattern with type-safe fluent interface
 */
export class TypedBuilder<T, Built = {}> {
  constructor(private value: Built) {}

  with<K extends keyof T, V extends T[K]>(
    key: K,
    value: V
  ): TypedBuilder<T, Built & Record<K, V>> {
    return new TypedBuilder({ ...this.value, [key]: value });
  }

  build(): Built extends T ? T : never {
    return this.value as Built extends T ? T : never;
  }
}

/**
 * Invariant checking
 */
export class Invariant {
  static ensure(condition: boolean, message: string): asserts condition {
    if (!condition) {
      throw new Error(`Invariant violation: ${message}`);
    }
  }

  static ensureNotNull<T>(
    value: T | null | undefined,
    message: string
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new Error(`Invariant violation: ${message}`);
    }
  }

  static ensureInRange(
    value: number,
    min: number,
    max: number,
    message: string
  ): void {
    if (value < min || value > max) {
      throw new Error(
        `Invariant violation: ${message}. Value ${value} not in range [${min}, ${max}]`
      );
    }
  }
}

/**
 * Money value object
 */
export type Money = ValueObject<
  'Money',
  {
    amount: number;
    currency: string;
  }
>;

export const Money = {
  of: (amount: number, currency: string): Money => {
    Invariant.ensure(amount >= 0, 'Money amount cannot be negative');
    Invariant.ensure(currency.length === 3, 'Currency must be 3 characters');
    return valueObject('Money', { amount, currency });
  },

  add: (a: Money, b: Money): Money => {
    Invariant.ensure(
      a.currency === b.currency,
      'Cannot add money with different currencies'
    );
    return Money.of(a.amount + b.amount, a.currency);
  },

  subtract: (a: Money, b: Money): Money => {
    Invariant.ensure(
      a.currency === b.currency,
      'Cannot subtract money with different currencies'
    );
    Invariant.ensure(
      a.amount >= b.amount,
      'Cannot subtract more than available'
    );
    return Money.of(a.amount - b.amount, a.currency);
  },

  multiply: (money: Money, factor: number): Money => {
    return Money.of(money.amount * factor, money.currency);
  },
};

/**
 * Email value object
 */
export type Email = ValueObject<'Email', string>;

export const Email = {
  of: (value: string): Email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    Invariant.ensure(emailRegex.test(value), 'Invalid email format');
    return valueObject('Email', value.toLowerCase());
  },
};

/**
 * UUID value object
 */
export type UUID = ValueObject<'UUID', string>;

export const UUID = {
  of: (value: string): UUID => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    Invariant.ensure(uuidRegex.test(value), 'Invalid UUID format');
    return valueObject('UUID', value.toLowerCase());
  },

  generate: (): UUID => {
    // Simple UUID v4 generator
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
    return UUID.of(uuid);
  },
};