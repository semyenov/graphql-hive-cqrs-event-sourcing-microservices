/**
 * Framework Core: Repository Pattern
 * 
 * Repositories provide an abstraction over data access,
 * hiding the complexity of event sourcing from domain logic.
 */

import type { AggregateId } from './branded/types';
import type { IEvent } from './event';
import type { IAggregateBehavior, ISnapshot } from './aggregate';

/**
 * Aggregate repository interface
 */
export interface IAggregateRepository<
  TAggregate extends IAggregateBehavior<unknown, IEvent>,
  TAggregateId extends AggregateId = AggregateId
> {
  get(id: TAggregateId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  exists(id: TAggregateId): Promise<boolean>;
}

/**
 * Aggregate factory interface
 */
export interface IAggregateFactory<
  TAggregate extends IAggregateBehavior<unknown, IEvent>,
  TAggregateId extends AggregateId = AggregateId
> {
  create(id: TAggregateId): TAggregate;
  load(id: TAggregateId): Promise<TAggregate>;
}

/**
 * Snapshot store interface for optimization
 */
export interface ISnapshotStore<
  TState,
  TAggregateId extends AggregateId = AggregateId
> {
  save(snapshot: ISnapshot<TState, TAggregateId>): Promise<void>;
  get(aggregateId: TAggregateId): Promise<ISnapshot<TState, TAggregateId> | null>;
}

/**
 * Unit of Work pattern for transactional consistency
 */
export interface IUnitOfWork {
  registerNew<T extends IAggregateBehavior<unknown, IEvent>>(aggregate: T): void;
  registerDirty<T extends IAggregateBehavior<unknown, IEvent>>(aggregate: T): void;
  registerDeleted<T extends IAggregateBehavior<unknown, IEvent>>(aggregate: T): void;
  commit(): Promise<void>;
  rollback(): void;
}

/**
 * Repository with Unit of Work support
 */
export interface ITransactionalRepository<
  TAggregate extends IAggregateBehavior<unknown, IEvent>,
  TAggregateId extends AggregateId = AggregateId
> extends IAggregateRepository<TAggregate, TAggregateId> {
  beginTransaction(): IUnitOfWork;
}

/**
 * Repository factory for dependency injection
 */
export interface IRepositoryFactory {
  create<
    TAggregate extends IAggregateBehavior<unknown, IEvent>,
    TAggregateId extends AggregateId = AggregateId
  >(
    aggregateType: string
  ): IAggregateRepository<TAggregate, TAggregateId>;
}