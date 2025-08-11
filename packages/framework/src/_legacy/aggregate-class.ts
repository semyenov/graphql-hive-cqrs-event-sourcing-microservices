/**
 * Aggregate - Domain-driven design aggregate root
 * 
 * Using Effect for error handling and ts-pattern for event application
 */

import * as Effect from "effect/Effect"
import * as Data from "effect/Data"
import * as ReadonlyArray from "effect/Array"
import { match, P } from "ts-pattern"
import {
  AggregateId,
  Version,
  Timestamp,
} from "../schema/core/primitives"
import type { DomainEvent } from "../schema/core/messages"

// ============================================================================
// Aggregate Errors
// ============================================================================

export class AggregateNotFoundError extends Data.TaggedError("AggregateNotFoundError")<{
  readonly aggregateId: AggregateId
  readonly aggregateType: string
}> {}

export class ConcurrencyError extends Data.TaggedError("ConcurrencyError")<{
  readonly aggregateId: AggregateId
  readonly expectedVersion: Version
  readonly actualVersion: Version
}> {}

export class InvalidStateError extends Data.TaggedError("InvalidStateError")<{
  readonly aggregateId: AggregateId
  readonly reason: string
}> {}

export class BusinessRuleViolationError extends Data.TaggedError("BusinessRuleViolationError")<{
  readonly aggregateId: AggregateId
  readonly rule: string
  readonly details?: unknown
}> {}

export type AggregateError =
  | AggregateNotFoundError
  | ConcurrencyError
  | InvalidStateError
  | BusinessRuleViolationError

// ============================================================================
// Aggregate State
// ============================================================================

/**
 * Base state for all aggregates
 */
export interface AggregateState {
  readonly aggregateId: AggregateId
  readonly version: Version
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
  readonly deletedAt?: Timestamp
  readonly metadata?: Record<string, unknown>
}

/**
 * Snapshot of aggregate state at a point in time
 */
export interface AggregateSnapshot<S extends AggregateState = AggregateState> {
  readonly aggregateId: AggregateId
  readonly version: Version
  readonly state: S
  readonly timestamp: Timestamp
}

// ============================================================================
// Aggregate Base Class
// ============================================================================

/**
 * Base aggregate class with event sourcing capabilities
 */
export abstract class Aggregate<
  State extends AggregateState = AggregateState,
  Event extends DomainEvent = DomainEvent,
  Command = unknown
> {
  private uncommittedEvents: Event[] = []
  private version: Version
  
  constructor(
    protected state: State,
    initialVersion: Version = Version.initial()
  ) {
    this.version = initialVersion
  }
  
  /**
   * Get aggregate ID
   */
  get id(): AggregateId {
    return this.state.aggregateId
  }
  
  /**
   * Get current version
   */
  get currentVersion(): Version {
    return this.version
  }
  
  /**
   * Get current state (readonly)
   */
  getState(): Readonly<State> {
    return this.state
  }
  
  /**
   * Check if aggregate is deleted
   */
  isDeleted(): boolean {
    return this.state.deletedAt !== undefined
  }
  
  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): ReadonlyArray<Event> {
    return this.uncommittedEvents
  }
  
  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = []
  }
  
  /**
   * Apply an event to update state
   */
  protected abstract applyEvent(event: Event): State
  
  /**
   * Validate command before execution
   */
  protected abstract validateCommand(command: Command): Effect.Effect<void, AggregateError>
  
  /**
   * Execute command and produce events
   */
  protected abstract executeCommand(command: Command): Effect.Effect<Event[], AggregateError>
  
  /**
   * Apply event and add to uncommitted list
   */
  protected raiseEvent(event: Event): void {
    this.state = this.applyEvent(event)
    this.version = Version.increment(this.version)
    this.uncommittedEvents.push(event)
  }
  
  /**
   * Apply multiple events
   */
  protected raiseEvents(events: Event[]): void {
    events.forEach((event) => this.raiseEvent(event))
  }
  
  /**
   * Handle command with validation
   */
  handle(command: Command): Effect.Effect<void, AggregateError> {
    const self = this
    return Effect.gen(function* () {
      // Check if deleted
      if (self.isDeleted()) {
        return yield* Effect.fail(
          new InvalidStateError({
            aggregateId: self.id,
            reason: "Cannot execute commands on deleted aggregate",
          })
        )
      }
      
      // Validate command
      yield* self.validateCommand(command)
      
      // Execute command and get events
      const events = yield* self.executeCommand(command)
      
      // Apply events
      self.raiseEvents(events)
    })
  }
  
  /**
   * Load from event history
   */
  static fromEvents<A extends Aggregate>(
    this: new (state: any, version?: Version) => A,
    events: ReadonlyArray<DomainEvent>,
    initialState: any
  ): A {
    const aggregate = new this(initialState, 0 as unknown as Version)
    
    events.forEach((event) => {
      aggregate.state = aggregate.applyEvent(event as any)
      aggregate.version = ((aggregate.version as unknown as number) + 1) as unknown as Version
    })
    
    return aggregate
  }
  
  /**
   * Create snapshot
   */
  toSnapshot(): AggregateSnapshot<State> {
    return {
      aggregateId: this.id,
      version: this.version,
      state: { ...this.state },
      timestamp: Date.now() as unknown as Timestamp,
    }
  }
  
  /**
   * Load from snapshot
   */
  static fromSnapshot<A extends Aggregate>(
    this: new (state: any, version?: Version) => A,
    snapshot: AggregateSnapshot
  ): A {
    return new this(snapshot.state, snapshot.version)
  }
}

// ============================================================================
// Aggregate Builder
// ============================================================================

/**
 * Builder for creating aggregate classes with type safety
 */
export class AggregateBuilder<
  State extends AggregateState,
  Event extends DomainEvent,
  Command
> {
  constructor(
    private readonly config: {
      name: string
      initialState: (id: AggregateId) => State
      eventHandlers: {
        [K in Event["type"]]: (
          state: State,
          event: Extract<Event, { type: K }>
        ) => State
      }
      commandHandlers: {
        [K in keyof Command]: {
          validate?: (
            state: State,
            command: Command[K]
          ) => Effect.Effect<void, AggregateError>
          execute: (
            state: State,
            command: Command[K]
          ) => Effect.Effect<Event[], AggregateError>
        }
      }
    }
  ) {}
  
  /**
   * Build aggregate class
   */
  build() {
    const config = this.config
    
    return class extends Aggregate<State, Event, Command[keyof Command]> {
      static readonly aggregateType = config.name
      
      protected applyEvent(event: Event): State {
        const type = event.type as Event["type"]
        const handler = config.eventHandlers[type]
        if (!handler) {
          console.warn(`No handler for event type: ${type}`)
          return this.state
        }
        return handler(this.state, event as any)
      }
      
      protected validateCommand(
        command: Command[keyof Command]
      ): Effect.Effect<void, AggregateError> {
        const commandType = (command as any).type || (command as any).constructor?.name
        const handler = config.commandHandlers[commandType as keyof Command]
        
        if (!handler) {
          return Effect.fail(
            new InvalidStateError({
              aggregateId: this.id,
              reason: `Unknown command: ${commandType}`,
            })
          )
        }
        
        return handler.validate
          ? handler.validate(this.state, command)
          : Effect.succeed(undefined)
      }
      
      protected executeCommand(
        command: Command[keyof Command]
      ): Effect.Effect<Event[], AggregateError> {
        const commandType = (command as any).type || (command as any).constructor?.name
        const handler = config.commandHandlers[commandType as keyof Command]
        
        if (!handler) {
          return Effect.fail(
            new InvalidStateError({
              aggregateId: this.id,
              reason: `Unknown command: ${commandType}`,
            })
          )
        }
        
        return handler.execute(this.state, command)
      }
      
      static create(id: AggregateId): InstanceType<typeof this> {
        return new this(config.initialState(id)) as any
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create aggregate builder
 */
export const aggregate = <
  State extends AggregateState,
  Event extends DomainEvent,
  Command
>(config: {
  name: string
  initialState: (id: AggregateId) => State
  eventHandlers: {
    [K in Event["type"]]: (
      state: State,
      event: Extract<Event, { type: K }>
    ) => State
  }
  commandHandlers: {
    [K in keyof Command]: {
      validate?: (
        state: State,
        command: Command[K]
      ) => Effect.Effect<void, AggregateError>
      execute: (
        state: State,
        command: Command[K]
      ) => Effect.Effect<Event[], AggregateError>
    }
  }
}) => new AggregateBuilder(config)

/**
 * Validate business rule
 */
export const validateRule = (
  condition: boolean,
  aggregateId: AggregateId,
  rule: string,
  details?: unknown
): Effect.Effect<void, BusinessRuleViolationError> =>
  condition
    ? Effect.succeed(undefined)
    : Effect.fail(
        new BusinessRuleViolationError({
          aggregateId,
          rule,
          details,
        })
      )

/**
 * Ensure aggregate exists
 */
export const ensureExists = <S extends AggregateState>(
  state: S | undefined,
  aggregateId: AggregateId,
  aggregateType: string
): Effect.Effect<S, AggregateNotFoundError> =>
  state
    ? Effect.succeed(state)
    : Effect.fail(
        new AggregateNotFoundError({
          aggregateId,
          aggregateType,
        })
      )

/**
 * Check version for optimistic concurrency
 */
export const checkVersion = (
  expectedVersion: Version,
  actualVersion: Version,
  aggregateId: AggregateId
): Effect.Effect<void, ConcurrencyError> =>
  expectedVersion === actualVersion
    ? Effect.succeed(undefined)
    : Effect.fail(
        new ConcurrencyError({
          aggregateId,
          expectedVersion,
          actualVersion,
        })
      )