/**
 * Runtime Configuration
 *
 * Effect runtime configuration and application bootstrap
 */

import * as Runtime from "effect/Runtime";
import * as Layer from "effect/Layer";
import * as Effect from "effect/Effect";
import * as Config from "effect/Config";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as Cause from "effect/Cause";
import { pipe } from "effect/Function";

import {
  CommandBus,
  CoreServicesLive,
  EventStore,
  ProjectionStore,
  QueryBus,
} from "../effects/services";

// ============================================================================
// Application Configuration
// ============================================================================

/**
 * Application configuration schema
 */
export const AppConfig = Config.all({
  environment: Config.string("NODE_ENV").pipe(
    Config.withDefault("development"),
  ),

  server: Config.all({
    port: Config.number("PORT").pipe(
      Config.withDefault(4000),
    ),
    host: Config.string("HOST").pipe(
      Config.withDefault("0.0.0.0"),
    ),
  }),

  graphql: Config.all({
    introspection: Config.boolean("GRAPHQL_INTROSPECTION").pipe(
      Config.withDefault(true),
    ),
    playground: Config.boolean("GRAPHQL_PLAYGROUND").pipe(
      Config.withDefault(true),
    ),
    federationVersion: Config.string("FEDERATION_VERSION").pipe(
      Config.withDefault("2.5"),
    ),
  }),

  eventStore: Config.all({
    type: Config.string("EVENT_STORE_TYPE").pipe(
      Config.withDefault("memory"),
    ),
    snapshotThreshold: Config.number("SNAPSHOT_THRESHOLD").pipe(
      Config.withDefault(100),
    ),
  }),

  monitoring: Config.all({
    enabled: Config.boolean("MONITORING_ENABLED").pipe(
      Config.withDefault(true),
    ),
    metricsPort: Config.number("METRICS_PORT").pipe(
      Config.withDefault(9090),
    ),
  }),
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;

// ============================================================================
// Logger Configuration
// ============================================================================

/**
 * Configure logger based on environment
 */
export const LoggerLive = Layer.effect(
  Logger.Logger,
  Effect.gen(function* () {
    const config = yield* AppConfig;

    const level = config.environment === "production"
      ? LogLevel.Info
      : LogLevel.Debug;

    return Logger.make({
      log: (options) => {
        const timestamp = new Date().toISOString();
        const level = LogLevel.label(options.logLevel);
        const message = options.message;
        const annotations = options.annotations;

        const formatted = JSON.stringify({
          timestamp,
          level,
          message,
          ...annotations,
        });

        console.log(formatted);
      },
    });
  }),
);

// ============================================================================
// Service Layers
// ============================================================================

/**
 * Production services configuration
 */
export const ProductionServicesLive = pipe(
  CoreServicesLive,
  Layer.provide(LoggerLive),
);

/**
 * Development services configuration
 */
export const DevelopmentServicesLive = pipe(
  CoreServicesLive,
  Layer.provide(LoggerLive),
);

/**
 * Test services configuration
 */
export const TestServicesLive = CoreServicesLive;

// ============================================================================
// Runtime Creation
// ============================================================================

/**
 * Create application runtime
 */
export const createRuntime = <R>(
  layer: Layer.Layer<R, never, never>,
): Runtime.Runtime<R> => Runtime.make(layer);

/**
 * Production runtime
 */
export const ProductionRuntime = createRuntime(ProductionServicesLive);

/**
 * Development runtime
 */
export const DevelopmentRuntime = createRuntime(DevelopmentServicesLive);

/**
 * Test runtime
 */
export const TestRuntime = createRuntime(TestServicesLive);

// ============================================================================
// Application Bootstrap
// ============================================================================

/**
 * Bootstrap application
 */
export const bootstrap = <E, A>(
  program: Effect.Effect<
    A,
    E,
    EventStore | CommandBus | QueryBus | ProjectionStore
  >,
): Effect.Effect<A, E | BootstrapError> =>
  Effect.gen(function* () {
    // Load configuration
    const config = yield* pipe(
      AppConfig,
      Effect.mapError((error) =>
        new BootstrapError("Configuration error", error)
      ),
    );

    yield* Effect.log(`Starting application in ${config.environment} mode`);
    yield* Effect.log(
      `Server will listen on ${config.server.host}:${config.server.port}`,
    );

    // Initialize services
    yield* Effect.log("Initializing services...");

    // Run program
    return yield* program;
  });

export class BootstrapError {
  readonly _tag = "BootstrapError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Setup graceful shutdown
 */
export const withGracefulShutdown = <R, E, A>(
  program: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    // Register shutdown handlers
    const shutdown = () => {
      console.log("\nShutting down gracefully...");
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Run program
    return yield* program;
  });

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Global error handler
 */
export const withErrorHandler = <R, E, A>(
  program: Effect.Effect<A, E, R>,
): Effect.Effect<A, never, R> =>
  pipe(
    program,
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Application error: ${JSON.stringify(error)}`);

        // In production, might send to error tracking service
        if (process.env.NODE_ENV === "production") {
          // await sendToErrorTracking(error)
        }

        // Re-throw for process to handle
        return yield* Effect.die(error);
      })
    ),
  );

// ============================================================================
// Application Runner
// ============================================================================

/**
 * Run application with proper configuration
 */
export const runApplication = <E, A>(
  program: Effect.Effect<
    A,
    E,
    EventStore | CommandBus | QueryBus | ProjectionStore
  >,
): Promise<A> => {
  const runtime = process.env.NODE_ENV === "production"
    ? ProductionRuntime
    : DevelopmentRuntime;

  return pipe(
    program,
    bootstrap,
    withGracefulShutdown,
    withErrorHandler,
    Runtime.runPromise(runtime),
  );
};

// ============================================================================
// Health Checks
// ============================================================================

/**
 * Health check for the application
 */
export const healthCheck = Effect.gen(function* () {
  const eventStore = yield* EventStore;
  const commandBus = yield* CommandBus;
  const queryBus = yield* QueryBus;
  const projectionStore = yield* ProjectionStore;

  // Check all services are available
  const checks = {
    eventStore: !!eventStore,
    commandBus: !!commandBus,
    queryBus: !!queryBus,
    projectionStore: !!projectionStore,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  return {
    status: allHealthy ? "healthy" : "unhealthy",
    checks,
    timestamp: new Date().toISOString(),
  };
});

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Metrics collector
 */
export const collectMetrics = Effect.gen(function* () {
  // Would integrate with Prometheus or similar
  return {
    eventStore: {
      eventsAppended: 0,
      streamsCreated: 0,
    },
    commandBus: {
      commandsProcessed: 0,
      commandsFailed: 0,
    },
    queryBus: {
      queriesExecuted: 0,
      queriesFailed: 0,
    },
    projections: {
      projectionUpdates: 0,
      checkpointsSaved: 0,
    },
  };
});
