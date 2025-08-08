/**
 * Framework Core: Query Types and Interfaces
 * 
 * Queries represent read operations in the CQRS pattern.
 * They read from projections and read models without side effects.
 */

/**
 * Base query interface for read operations
 * @template TType - Query type discriminator
 * @template TParams - Query parameters type
 * @template TResult - Query result type
 */
export interface IQuery<
  TType extends string = string,
  TParams = unknown,
  TResult = unknown
> {
  readonly type: TType;
  readonly parameters?: TParams;
  readonly _result?: TResult; // Phantom type for result inference
}

/**
 * Query handler interface
 */
export interface IQueryHandler<
  TQuery extends IQuery<string, unknown, unknown>,
  TResult = TQuery extends IQuery<string, unknown, infer R> ? R : unknown
> {
  handle(query: TQuery): Promise<TResult>;
  canHandle(query: IQuery): boolean;
}

/**
 * Query bus for routing queries to handlers
 */
export interface IQueryBus {
  ask<TQuery extends IQuery<string, unknown, unknown>>(
    query: TQuery
  ): Promise<TQuery extends IQuery<string, unknown, infer R> ? R : unknown>;
  register<TQuery extends IQuery<string, unknown, unknown>>(
    handler: IQueryHandler<TQuery>
  ): void;
}

/**
 * Projection interface for read models
 */
export interface IProjection<TData> {
  readonly id: string;
  readonly data: TData;
  readonly version: number;
  readonly lastUpdated: Date;
}

/**
 * Projection builder for creating read models from events
 */
export interface IProjectionBuilder<TEvent, TProjection> {
  rebuild(events: TEvent[]): Promise<void>;
  get(id: string): TProjection | null;
  getAll(): TProjection[];
  search(predicate: (projection: TProjection) => boolean): TProjection[];
}

/**
 * Projection rebuilder for replaying events
 */
export interface IProjectionRebuilder {
  rebuild(): Promise<void>;
  rebuildFrom(version: number): Promise<void>;
}

/**
 * Read model repository interface
 */
export interface IReadRepository<TEntity> {
  findById(id: string): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  findByPredicate(predicate: (entity: TEntity) => boolean): Promise<TEntity[]>;
}

/**
 * Materialized view for optimized queries
 */
export interface IMaterializedView<TData> {
  readonly name: string;
  readonly data: TData;
  readonly refreshedAt: Date;
  refresh(): Promise<void>;
}

/**
 * Query specification pattern for complex queries
 */
export interface ISpecification<TEntity> {
  isSatisfiedBy(entity: TEntity): boolean;
  and(other: ISpecification<TEntity>): ISpecification<TEntity>;
  or(other: ISpecification<TEntity>): ISpecification<TEntity>;
  not(): ISpecification<TEntity>;
}

/**
 * Pagination parameters
 */
export interface IPaginationParams {
  readonly offset: number;
  readonly limit: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface IPaginatedResult<TData> {
  readonly items: TData[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/**
 * Query factory type
 */
export type QueryFactory<TQuery extends IQuery> = (
  parameters: TQuery['parameters']
) => TQuery;

/**
 * Extract query result type
 */
export type ExtractQueryResult<TQuery> = 
  TQuery extends IQuery<infer R> ? R : never;

/**
 * Query pattern matching for type-safe query handling
 */
export type QueryPattern<TQuery extends IQuery, TResult> = {
  readonly [K in TQuery['type']]: (
    query: Extract<TQuery, { type: K }>
  ) => Promise<TResult>;
};