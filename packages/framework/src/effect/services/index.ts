/**
 * Framework Effect: Service Layer
 * 
 * Service definitions and dependency injection using Effect's Context and Layer patterns.
 * Provides a clean way to compose and inject dependencies throughout the application.
 */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';

import type { IEventStore, IEvent } from '../../core/event';
import type { ICommandBus, ICommand } from '../../core/command';
import type { IQueryBus, IQuery } from '../../core/query';
import type { IProjectionBuilder } from '../../core/query';
import type { AggregateId } from '../../core/branded/types';

/**
 * Event Store Service
 */
export interface EventStoreService<TEvent extends IEvent = IEvent> {
  readonly getEvents: (
    aggregateId: AggregateId,
    fromVersion?: number
  ) => Effect.Effect<ReadonlyArray<TEvent>, Error, never>;
  
  readonly saveEvents: (
    aggregateId: AggregateId,
    events: ReadonlyArray<TEvent>,
    expectedVersion: number
  ) => Effect.Effect<void, Error, never>;
  
  readonly getAllEvents: () => Effect.Effect<ReadonlyArray<TEvent>, Error, never>;
  
  readonly subscribe: (
    callback: (event: TEvent) => void
  ) => Effect.Effect<() => void, never, never>;
}

export const EventStoreService = Context.GenericTag<EventStoreService>('EventStoreService');

/**
 * Command Bus Service
 */
export interface CommandBusService {
  readonly dispatch: <TCommand extends ICommand>(
    command: TCommand
  ) => Effect.Effect<unknown, Error, never>;
  
  readonly register: <TCommand extends ICommand>(
    type: string,
    handler: (command: TCommand) => Effect.Effect<unknown, Error, never>
  ) => Effect.Effect<void, never, never>;
}

export const CommandBusService = Context.GenericTag<CommandBusService>('CommandBusService');

/**
 * Query Bus Service
 */
export interface QueryBusService {
  readonly execute: <TQuery extends IQuery, TResult>(
    query: TQuery
  ) => Effect.Effect<TResult, Error, never>;
  
  readonly register: <TQuery extends IQuery, TResult>(
    type: string,
    handler: (query: TQuery) => Effect.Effect<TResult, Error, never>
  ) => Effect.Effect<void, never, never>;
}

export const QueryBusService = Context.GenericTag<QueryBusService>('QueryBusService');

/**
 * Projection Service
 */
export interface ProjectionService<TEvent extends IEvent = IEvent> {
  readonly register: <TProjection>(
    name: string,
    builder: IProjectionBuilder<TEvent, TProjection>
  ) => Effect.Effect<void, never, never>;
  
  readonly get: <TProjection>(
    name: string,
    id: string
  ) => Effect.Effect<TProjection | null, Error, never>;
  
  readonly rebuild: (name: string) => Effect.Effect<void, Error, never>;
  
  readonly rebuildAll: () => Effect.Effect<void, Error, never>;
}

export const ProjectionService = Context.GenericTag<ProjectionService>('ProjectionService');

/**
 * Notification Service
 */
export interface NotificationService {
  readonly sendEmail: (
    to: string,
    subject: string,
    body: string
  ) => Effect.Effect<void, Error, never>;
  
  readonly sendSMS: (
    to: string,
    message: string
  ) => Effect.Effect<void, Error, never>;
  
  readonly broadcast: (
    channel: string,
    message: unknown
  ) => Effect.Effect<void, Error, never>;
}

export const NotificationService = Context.GenericTag<NotificationService>('NotificationService');

/**
 * Logger Service
 */
export interface LoggerService {
  readonly debug: (message: string, context?: unknown) => Effect.Effect<void, never, never>;
  readonly info: (message: string, context?: unknown) => Effect.Effect<void, never, never>;
  readonly warn: (message: string, context?: unknown) => Effect.Effect<void, never, never>;
  readonly error: (message: string, error?: unknown, context?: unknown) => Effect.Effect<void, never, never>;
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService');

/**
 * Metrics Service
 */
export interface MetricsService {
  readonly increment: (
    name: string,
    value?: number,
    tags?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly gauge: (
    name: string,
    value: number,
    tags?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly histogram: (
    name: string,
    value: number,
    tags?: Record<string, string>
  ) => Effect.Effect<void, never, never>;
  
  readonly timer: <R>(
    name: string,
    effect: Effect.Effect<R, any, any>,
    tags?: Record<string, string>
  ) => Effect.Effect<R, any, any>;
}

export const MetricsService = Context.GenericTag<MetricsService>('MetricsService');

/**
 * Cache Service
 */
export interface CacheService {
  readonly get: <T>(key: string) => Effect.Effect<T | null, Error, never>;
  readonly set: <T>(key: string, value: T, ttl?: Duration.Duration) => Effect.Effect<void, never, never>;
  readonly delete: (key: string) => Effect.Effect<void, never, never>;
  readonly clear: () => Effect.Effect<void, never, never>;
}

export const CacheService = Context.GenericTag<CacheService>('CacheService');

/**
 * Configuration Service
 */
export interface ConfigurationService {
  readonly get: <T>(key: string) => Effect.Effect<T, Error, never>;
  readonly getString: (key: string) => Effect.Effect<string, Error, never>;
  readonly getNumber: (key: string) => Effect.Effect<number, Error, never>;
  readonly getBoolean: (key: string) => Effect.Effect<boolean, Error, never>;
  readonly getDuration: (key: string) => Effect.Effect<Duration.Duration, Error, never>;
}

export const ConfigurationService = Context.GenericTag<ConfigurationService>('ConfigurationService');

/**
 * All services combined for convenience
 */
export interface AppServices {
  readonly eventStore: EventStoreService;
  readonly commandBus: CommandBusService;
  readonly queryBus: QueryBusService;
  readonly projections: ProjectionService;
  readonly notifications: NotificationService;
  readonly logger: LoggerService;
  readonly metrics: MetricsService;
  readonly cache: CacheService;
  readonly config: ConfigurationService;
}

/**
 * Create a mock logger service for testing
 */
export const LoggerServiceLive = Layer.succeed(
  LoggerService,
  LoggerService.of({
    debug: (message, context) => Effect.sync(() => console.debug(message, context)),
    info: (message, context) => Effect.sync(() => console.info(message, context)),
    warn: (message, context) => Effect.sync(() => console.warn(message, context)),
    error: (message, error, context) => Effect.sync(() => console.error(message, error, context)),
  })
);

/**
 * Create a mock metrics service for testing
 */
export const MetricsServiceLive = Layer.succeed(
  MetricsService,
  MetricsService.of({
    increment: (name, value = 1, tags) => 
      Effect.sync(() => console.log(`Metric increment: ${name}`, { value, tags })),
    gauge: (name, value, tags) =>
      Effect.sync(() => console.log(`Metric gauge: ${name}`, { value, tags })),
    histogram: (name, value, tags) =>
      Effect.sync(() => console.log(`Metric histogram: ${name}`, { value, tags })),
    timer: (name, effect, tags) =>
      pipe(
        Effect.sync(() => Date.now()),
        Effect.flatMap((start) =>
          pipe(
            effect,
            Effect.tap(() =>
              Effect.sync(() => {
                const duration = Date.now() - start;
                console.log(`Metric timer: ${name}`, { duration, tags });
              })
            )
          )
        )
      ),
  })
);

/**
 * Create in-memory cache service
 */
export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.sync(() => {
    const cache = new Map<string, { value: unknown; expiry?: number }>();
    
    return CacheService.of({
      get: <T>(key: string) =>
        Effect.sync(() => {
          const entry = cache.get(key);
          if (!entry) return null;
          if (entry.expiry && entry.expiry < Date.now()) {
            cache.delete(key);
            return null;
          }
          return entry.value as T;
        }),
      
      set: <T>(key: string, value: T, ttl?: Duration.Duration) =>
        Effect.sync(() => {
          const expiry = ttl ? Date.now() + Duration.toMillis(ttl) : undefined;
          cache.set(key, { value, expiry });
        }),
      
      delete: (key: string) =>
        Effect.sync(() => {
          cache.delete(key);
        }),
      
      clear: () =>
        Effect.sync(() => {
          cache.clear();
        }),
    });
  })
);

/**
 * Create configuration service from environment
 */
export const ConfigurationServiceLive = Layer.succeed(
  ConfigurationService,
  ConfigurationService.of({
    get: <T>(key: string) =>
      Config.string(key).pipe(
        Config.map((value) => JSON.parse(value) as T),
        Effect.mapError((error) => new Error(`Config error for ${key}: ${error}`))
      ),
    
    getString: (key: string) =>
      Config.string(key).pipe(
        Effect.mapError((error) => new Error(`Config error for ${key}: ${error}`))
      ),
    
    getNumber: (key: string) =>
      Config.number(key).pipe(
        Effect.mapError((error) => new Error(`Config error for ${key}: ${error}`))
      ),
    
    getBoolean: (key: string) =>
      Config.boolean(key).pipe(
        Effect.mapError((error) => new Error(`Config error for ${key}: ${error}`))
      ),
    
    getDuration: (key: string) =>
      Config.duration(key).pipe(
        Effect.mapError((error) => new Error(`Config error for ${key}: ${error}`))
      ),
  })
);

/**
 * Compose all core services
 */
export const CoreServicesLive = Layer.mergeAll(
  LoggerServiceLive,
  MetricsServiceLive,
  CacheServiceLive,
  ConfigurationServiceLive
);

/**
 * Helper to access multiple services at once
 */
export const withServices = <R, E, A>(
  f: (services: {
    logger: LoggerService;
    metrics: MetricsService;
    cache: CacheService;
    config: ConfigurationService;
  }) => Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  E,
  R | LoggerService | MetricsService | CacheService | ConfigurationService
> =>
  Effect.gen(function* (_) {
    const logger = yield* _(LoggerService);
    const metrics = yield* _(MetricsService);
    const cache = yield* _(CacheService);
    const config = yield* _(ConfigurationService);
    
    return yield* _(f({ logger, metrics, cache, config }));
  });

/**
 * Create a service layer from existing implementations
 */
export function adaptLegacyServices<TEvent extends IEvent>(
  implementations: {
    eventStore: IEventStore<TEvent>;
    commandBus: ICommandBus;
    queryBus: IQueryBus;
  }
): Layer.Layer<EventStoreService | CommandBusService | QueryBusService, never, never> {
  const eventStoreLayer = Layer.succeed(
    EventStoreService,
    EventStoreService.of({
      getEvents: (aggregateId, fromVersion) =>
        Effect.tryPromise({
          try: () => implementations.eventStore.getEvents(aggregateId, fromVersion),
          catch: (error) => new Error(`Failed to get events: ${error}`),
        }),
      
      saveEvents: (aggregateId, events, expectedVersion) =>
        Effect.tryPromise({
          try: async () => {
            await implementations.eventStore.appendBatch(events as TEvent[], expectedVersion);
          },
          catch: (error) => new Error(`Failed to save events: ${error}`),
        }),
      
      getAllEvents: () =>
        Effect.tryPromise({
          try: () => implementations.eventStore.getAllEvents(),
          catch: (error) => new Error(`Failed to get all events: ${error}`),
        }),
      
      subscribe: (callback) =>
        Effect.sync(() => {
          implementations.eventStore.subscribe(callback);
          return () => {}; // Return unsubscribe function
        }),
    })
  );

  const commandBusLayer = Layer.succeed(
    CommandBusService,
    CommandBusService.of({
      dispatch: (command) =>
        Effect.tryPromise({
          try: async () => {
            await implementations.commandBus.send(command);
            return {};
          },
          catch: (error) => new Error(`Command dispatch failed: ${error}`),
        }),
      
      register: (type, handler) =>
        Effect.sync(() => {
          // Adapter logic would go here
        }),
    })
  );

  const queryBusLayer = Layer.succeed(
    QueryBusService,
    QueryBusService.of({
      execute: (query) =>
        Effect.tryPromise({
          try: () => implementations.queryBus.ask(query),
          catch: (error) => new Error(`Query execution failed: ${error}`),
        }),
      
      register: (type, handler) =>
        Effect.sync(() => {
          // Adapter logic would go here
        }),
    })
  );

  return Layer.mergeAll(eventStoreLayer, commandBusLayer, queryBusLayer);
}