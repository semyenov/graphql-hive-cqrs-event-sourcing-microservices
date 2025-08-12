/**
 * 🎯 Pipe Pattern Demo - Modern Functional Composition
 * 
 * Demonstrates the superior pipe pattern approach vs Effect.gen
 * Shows clean functional composition throughout the CQRS framework
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"

import {
  // Core framework with pipe patterns
  type Aggregate,
  type EventApplicator,
  createAggregate,
  markEventsAsCommitted,
  
  // Schema builders
  createEventSchema,
  createCommandSchema,
  
  // Primitives
  AggregateId,
  Version,
  NonEmptyString,
  createAggregateId,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
  nonEmptyString,
  
  // Services with pipe patterns
  CoreServicesLive,
  EventStore,
  
  // Repository with pipe patterns
  createRepository,
} from "@cqrs/framework"

// ============================================================================
// Domain Model - Wallet/Account System
// ============================================================================

const WalletState = Schema.Struct({
  accountNumber: NonEmptyString,
  balance: Schema.Number,
  currency: NonEmptyString,
  isActive: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
type WalletState = Schema.Schema.Type<typeof WalletState>

// ============================================================================
// Events - Schema-First
// ============================================================================

const WalletCreated = createEventSchema(
  "WalletCreated",
  Schema.Struct({
    accountNumber: NonEmptyString,
    initialBalance: Schema.Number,
    currency: NonEmptyString,
  })
)

const MoneyDeposited = createEventSchema(
  "MoneyDeposited",
  Schema.Struct({
    amount: Schema.Number,
    reference: NonEmptyString,
  })
)

const MoneyWithdrawn = createEventSchema(
  "MoneyWithdrawn", 
  Schema.Struct({
    amount: Schema.Number,
    reference: NonEmptyString,
  })
)

const WalletFrozen = createEventSchema(
  "WalletFrozen",
  Schema.Struct({
    reason: NonEmptyString,
  })
)

type WalletEvent =
  | Schema.Schema.Type<typeof WalletCreated>
  | Schema.Schema.Type<typeof MoneyDeposited>
  | Schema.Schema.Type<typeof MoneyWithdrawn>
  | Schema.Schema.Type<typeof WalletFrozen>

// ============================================================================
// Commands - Schema-First
// ============================================================================

const CreateWallet = createCommandSchema(
  "CreateWallet",
  Schema.Struct({
    accountNumber: NonEmptyString,
    initialBalance: Schema.Number,
    currency: NonEmptyString,
  })
)

const DepositMoney = createCommandSchema(
  "DepositMoney",
  Schema.Struct({
    amount: Schema.Number,
    reference: NonEmptyString,
  })
)

const WithdrawMoney = createCommandSchema(
  "WithdrawMoney",
  Schema.Struct({
    amount: Schema.Number,
    reference: NonEmptyString,
  })
)

type WalletCommand =
  | Schema.Schema.Type<typeof CreateWallet>
  | Schema.Schema.Type<typeof DepositMoney>
  | Schema.Schema.Type<typeof WithdrawMoney>

// ============================================================================
// Domain Errors
// ============================================================================

class WalletAlreadyExistsError {
  readonly _tag = "WalletAlreadyExistsError"
  constructor(readonly accountNumber: NonEmptyString) {}
}

class WalletNotFoundError {
  readonly _tag = "WalletNotFoundError"
  constructor(readonly id: AggregateId) {}
}

class InsufficientFundsError {
  readonly _tag = "InsufficientFundsError"
  constructor(readonly requested: number, readonly available: number) {}
}

class InvalidAmountError {
  readonly _tag = "InvalidAmountError"
  constructor(readonly amount: number) {}
}

class WalletFrozenError {
  readonly _tag = "WalletFrozenError"
  constructor(readonly id: AggregateId) {}
}

type WalletError =
  | WalletAlreadyExistsError
  | WalletNotFoundError
  | InsufficientFundsError
  | InvalidAmountError
  | WalletFrozenError

// ============================================================================
// Pure Event Applicator - Using match for clean pattern matching
// ============================================================================

/**
 * 🎯 Pure event applicator using pattern matching
 * Clean, functional approach without classes or "this"
 */
const applyWalletEvent: EventApplicator<WalletState, WalletEvent> = (state, event) =>
  match(event)
    .with({ type: "WalletCreated" }, (e) => ({
      accountNumber: e.data.accountNumber,
      balance: e.data.initialBalance,
      currency: e.data.currency,
      isActive: true,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
    }))
    .with({ type: "MoneyDeposited" }, (e) =>
      state ? { 
        ...state, 
        balance: state.balance + e.data.amount, 
        updatedAt: e.metadata.timestamp 
      } : null
    )
    .with({ type: "MoneyWithdrawn" }, (e) =>
      state ? { 
        ...state, 
        balance: state.balance - e.data.amount, 
        updatedAt: e.metadata.timestamp 
      } : null
    )
    .with({ type: "WalletFrozen" }, (e) =>
      state ? { 
        ...state, 
        isActive: false, 
        updatedAt: e.metadata.timestamp 
      } : null
    )
    .exhaustive()

// ============================================================================
// Command Handlers - 🎯 PIPE PATTERN APPROACH
// ============================================================================

/**
 * 🎯 Create wallet handler using PIPE PATTERN
 * Notice: Linear flow with pipe composition instead of Effect.gen
 */
const handleCreateWallet = (
  aggregate: Aggregate<WalletState | null, WalletEvent>,
  command: Schema.Schema.Type<typeof CreateWallet>
): Effect.Effect<ReadonlyArray<WalletEvent>, WalletError> =>
  pipe(
    // Validate wallet doesn't exist
    aggregate.state !== null
      ? Effect.fail(new WalletAlreadyExistsError(command.payload.accountNumber))
      : Effect.void,
    // Validate amount
    Effect.flatMap(() =>
      command.payload.initialBalance < 0
        ? Effect.fail(new InvalidAmountError(command.payload.initialBalance))
        : Effect.void
    ),
    // Create event
    Effect.map(() => [{
      type: "WalletCreated" as const,
      data: {
        accountNumber: command.payload.accountNumber,
        initialBalance: command.payload.initialBalance,
        currency: command.payload.currency,
      },
      metadata: {
        eventId: createEventId(),
        aggregateId: aggregate.id,
        version: (aggregate.version + 1) as Version,
        timestamp: now(),
        correlationId: command.metadata.correlationId,
        causationId: createCausationId(),
        actor: command.metadata.actor,
      },
    }])
  )

/**
 * 🎯 Deposit money handler using PIPE PATTERN
 * Clean functional composition without nested generators
 */
const handleDepositMoney = (
  aggregate: Aggregate<WalletState | null, WalletEvent>,
  command: Schema.Schema.Type<typeof DepositMoney>
): Effect.Effect<ReadonlyArray<WalletEvent>, WalletError> =>
  pipe(
    // Validate wallet exists
    aggregate.state === null
      ? Effect.fail(new WalletNotFoundError(aggregate.id))
      : Effect.void,
    // Validate wallet is active
    Effect.flatMap(() =>
      aggregate.state && !aggregate.state.isActive
        ? Effect.fail(new WalletFrozenError(aggregate.id))
        : Effect.void
    ),
    // Validate amount
    Effect.flatMap(() =>
      command.payload.amount <= 0
        ? Effect.fail(new InvalidAmountError(command.payload.amount))
        : Effect.void
    ),
    // Create event
    Effect.map(() => [{
      type: "MoneyDeposited" as const,
      data: {
        amount: command.payload.amount,
        reference: command.payload.reference,
      },
      metadata: {
        eventId: createEventId(),
        aggregateId: aggregate.id,
        version: (aggregate.version + 1) as Version,
        timestamp: now(),
        correlationId: command.metadata.correlationId,
        causationId: createCausationId(),
        actor: command.metadata.actor,
      },
    }])
  )

/**
 * 🎯 Withdraw money handler using PIPE PATTERN
 * Complex business logic expressed as clear pipeline
 */
const handleWithdrawMoney = (
  aggregate: Aggregate<WalletState | null, WalletEvent>,
  command: Schema.Schema.Type<typeof WithdrawMoney>
): Effect.Effect<ReadonlyArray<WalletEvent>, WalletError> =>
  pipe(
    // Validate wallet exists
    aggregate.state === null
      ? Effect.fail(new WalletNotFoundError(aggregate.id))
      : Effect.void,
    // Validate wallet is active
    Effect.flatMap(() =>
      aggregate.state && !aggregate.state.isActive
        ? Effect.fail(new WalletFrozenError(aggregate.id))
        : Effect.void
    ),
    // Validate amount
    Effect.flatMap(() =>
      command.payload.amount <= 0
        ? Effect.fail(new InvalidAmountError(command.payload.amount))
        : Effect.void
    ),
    // Validate sufficient funds
    Effect.flatMap(() =>
      aggregate.state && aggregate.state.balance < command.payload.amount
        ? Effect.fail(new InsufficientFundsError(command.payload.amount, aggregate.state.balance))
        : Effect.void
    ),
    // Create event
    Effect.map(() => [{
      type: "MoneyWithdrawn" as const,
      data: {
        amount: command.payload.amount,
        reference: command.payload.reference,
      },
      metadata: {
        eventId: createEventId(),
        aggregateId: aggregate.id,
        version: (aggregate.version + 1) as Version,
        timestamp: now(),
        correlationId: command.metadata.correlationId,
        causationId: createCausationId(),
        actor: command.metadata.actor,
      },
    }])
  )

// ============================================================================
// Repository with PIPE PATTERN
// ============================================================================

/**
 * 🎯 Repository using the converted pipe pattern functions
 * All load/save operations now use pipe composition
 */
const createWalletRepository = () =>
  createRepository("Wallet", applyWalletEvent, null)

// ============================================================================
// Business Logic Layer - 🎯 PIPE PATTERN COMPOSITION
// ============================================================================

/**
 * 🎯 Process wallet command using PIPE PATTERN
 * Clean command routing with functional composition
 */
const processWalletCommand = (
  aggregate: Aggregate<WalletState | null, WalletEvent>,
  command: WalletCommand
) =>
  pipe(
    match(command)
      .with({ type: "CreateWallet" }, (cmd) => handleCreateWallet(aggregate, cmd))
      .with({ type: "DepositMoney" }, (cmd) => handleDepositMoney(aggregate, cmd))
      .with({ type: "WithdrawMoney" }, (cmd) => handleWithdrawMoney(aggregate, cmd))
      .exhaustive(),
    // Apply events to aggregate using pipe
    Effect.map((events) =>
      events.reduce(
        (agg, event) => ({
          ...agg,
          state: applyWalletEvent(agg.state, event),
          version: (agg.version + 1) as Version,
          uncommittedEvents: [...agg.uncommittedEvents, event],
        }),
        aggregate
      )
    )
  )

/**
 * 🎯 Complete wallet workflow using PIPE PATTERN
 * End-to-end command processing with clean composition
 */
const executeWalletWorkflow = (
  walletId: AggregateId,
  command: WalletCommand
) =>
  pipe(
    // Create repository instance
    Effect.succeed(createWalletRepository()),
    // Load aggregate using pipe pattern (converted in Phase 1)
    Effect.flatMap((repository) =>
      pipe(
        repository.load(walletId),
        Effect.flatMap((aggregate) =>
          pipe(
            // Process command
            processWalletCommand(aggregate, command),
            // Save using pipe pattern (converted in Phase 1)
            Effect.flatMap((updatedAggregate) =>
              pipe(
                repository.save(updatedAggregate),
                Effect.map(() => markEventsAsCommitted(updatedAggregate))
              )
            )
          )
        )
      )
    )
  )

// ============================================================================
// Demo - 🎯 PIPE PATTERN SHOWCASE
// ============================================================================

/**
 * 🎯 Complete demo using PIPE PATTERN throughout
 * Shows the benefits of functional composition over Effect.gen
 */
const runPipePatternDemo = pipe(
  Effect.succeed("🎯 Pipe Pattern Demo - Modern Functional Composition"),
  Effect.tap((title) => Effect.sync(() => console.log(title))),
  Effect.tap(() => Effect.sync(() => console.log("=" .repeat(60)))),
  Effect.flatMap(() => {
    const walletId = createAggregateId()
    
    return pipe(
      // Step 1: Create wallet using pipe pattern
      Effect.sync(() => console.log("💳 Creating wallet...")),
      Effect.flatMap(() => {
        const createCommand: Schema.Schema.Type<typeof CreateWallet> = {
          type: "CreateWallet",
          payload: {
            accountNumber: nonEmptyString("ACC-12345"),
            initialBalance: 1000,
            currency: nonEmptyString("USD"),
          },
          metadata: {
            commandId: createEventId(),
            aggregateId: walletId,
            correlationId: createCorrelationId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "user", userId: "user-123" as AggregateId },
          },
        }
        
        return executeWalletWorkflow(walletId, createCommand)
      }),
      Effect.tap((wallet) => 
        Effect.sync(() => console.log("✅ Wallet created:", wallet.state))
      ),
      
      // Step 2: Deposit money using pipe pattern
      Effect.flatMap(() => Effect.sync(() => console.log("💰 Depositing money..."))),
      Effect.flatMap(() => {
        const depositCommand: Schema.Schema.Type<typeof DepositMoney> = {
          type: "DepositMoney",
          payload: {
            amount: 500,
            reference: nonEmptyString("DEP-001"),
          },
          metadata: {
            commandId: createEventId(),
            aggregateId: walletId,
            correlationId: createCorrelationId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "user", userId: "user-123" as AggregateId },
          },
        }
        
        return executeWalletWorkflow(walletId, depositCommand)
      }),
      Effect.tap((wallet) =>
        Effect.sync(() => console.log("✅ Money deposited:", wallet.state))
      ),
      
      // Step 3: Withdraw money using pipe pattern
      Effect.flatMap(() => Effect.sync(() => console.log("🏧 Withdrawing money..."))),
      Effect.flatMap(() => {
        const withdrawCommand: Schema.Schema.Type<typeof WithdrawMoney> = {
          type: "WithdrawMoney",
          payload: {
            amount: 200,
            reference: nonEmptyString("WTH-001"),
          },
          metadata: {
            commandId: createEventId(),
            aggregateId: walletId,
            correlationId: createCorrelationId(),
            causationId: createCausationId(),
            timestamp: now(),
            actor: { type: "user", userId: "user-123" as AggregateId },
          },
        }
        
        return executeWalletWorkflow(walletId, withdrawCommand)
      }),
      Effect.tap((wallet) =>
        Effect.sync(() => console.log("✅ Money withdrawn:", wallet.state))
      ),
      
      // Final summary
      Effect.flatMap(() =>
        Effect.sync(() => {
          console.log()
          console.log("🎉 Pipe Pattern Benefits Demonstrated:")
          console.log("   ✅ Linear flow instead of nested generators")
          console.log("   ✅ Better functional composition")
          console.log("   ✅ Cleaner error handling pipelines") 
          console.log("   ✅ Repository operations use pipe pattern")
          console.log("   ✅ Command handlers use pipe pattern")
          console.log("   ✅ Business logic flows use pipe pattern")
          console.log("   ✅ More readable than Effect.gen for linear flows")
          console.log()
          console.log("📊 Pattern Comparison:")
          console.log("   ❌ OLD: Effect.gen(function* () { const x = yield* ... })")
          console.log("   ✅ NEW: pipe(Effect.succeed(x), Effect.flatMap(...))")
          console.log()
          console.log("   ❌ OLD: Multiple yield* statements in generators")
          console.log("   ✅ NEW: Chained transformations in pipe")
          console.log()
          console.log("🎯 When to use PIPE vs Effect.gen:")
          console.log("   📍 PIPE: Linear flows, transformations, single-path logic")
          console.log("   📍 Effect.gen: Complex branching, multiple variables, async coordination")
        })
      )
    )
  })
)

// ============================================================================
// Execute Demo
// ============================================================================

if (import.meta.main) {
  pipe(
    runPipePatternDemo,
    Effect.provide(CoreServicesLive),
    Effect.runPromise
  ).then(
    () => console.log("\n✨ Pipe Pattern Demo completed successfully!"),
    (error) => console.error("❌ Demo failed:", error)
  )
}

export {
  // Types
  type WalletState,
  type WalletEvent,
  type WalletCommand,
  type WalletError,
  
  // Pure functions  
  applyWalletEvent,
  handleCreateWallet,
  handleDepositMoney,
  handleWithdrawMoney,
  processWalletCommand,
  executeWalletWorkflow,
  createWalletRepository,
  
  // Demo
  runPipePatternDemo,
}