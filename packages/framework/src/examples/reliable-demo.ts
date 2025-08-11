/**
 * Reliable Framework Demo
 * 
 * Simplified but complete demonstration that avoids Stream complexities
 * while showing all core framework patterns working perfectly
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"

import {
  AggregateId,
  Email,
  Username,
  createAggregateId,
  createEventId,
  createCausationId,
  now,
  createEventSchema,
  createCommandSchema,
  createEventApplicator,
  createCommandHandler,
  createAggregate,
  executeCommand,
  loadFromEvents,
  createProjection
} from "../index"

// ============================================================================
// Simple Domain Model
// ============================================================================

const WalletState = Schema.Struct({
  id: AggregateId,
  ownerId: AggregateId,
  balance: Schema.Number,
  currency: Schema.Literal("USD", "EUR", "GBP"),
  isActive: Schema.Boolean,
  transactionCount: Schema.Number
})
type WalletState = Schema.Schema.Type<typeof WalletState>

// Events
const WalletCreated = createEventSchema(
  "WalletCreated",
  Schema.Struct({
    ownerId: AggregateId,
    initialBalance: Schema.Number,
    currency: Schema.Literal("USD", "EUR", "GBP")
  })
)

const MoneyDeposited = createEventSchema(
  "MoneyDeposited",
  Schema.Struct({
    amount: Schema.Number,
    reference: Schema.String
  })
)

const MoneyWithdrawn = createEventSchema(
  "MoneyWithdrawn",
  Schema.Struct({
    amount: Schema.Number,
    reference: Schema.String
  })
)

const WalletDeactivated = createEventSchema(
  "WalletDeactivated",
  Schema.Struct({
    reason: Schema.String
  })
)

type WalletEvent = 
  | Schema.Schema.Type<typeof WalletCreated>
  | Schema.Schema.Type<typeof MoneyDeposited>
  | Schema.Schema.Type<typeof MoneyWithdrawn>
  | Schema.Schema.Type<typeof WalletDeactivated>

// Commands
const CreateWallet = createCommandSchema(
  "CreateWallet",
  Schema.Struct({
    ownerId: AggregateId,
    initialBalance: Schema.Number,
    currency: Schema.Literal("USD", "EUR", "GBP")
  })
)

const DepositMoney = createCommandSchema(
  "DepositMoney",
  Schema.Struct({
    amount: Schema.Number,
    reference: Schema.String
  })
)

const WithdrawMoney = createCommandSchema(
  "WithdrawMoney",
  Schema.Struct({
    amount: Schema.Number,
    reference: Schema.String
  })
)

type WalletCommand =
  | Schema.Schema.Type<typeof CreateWallet>
  | Schema.Schema.Type<typeof DepositMoney>
  | Schema.Schema.Type<typeof WithdrawMoney>

// Errors
class WalletNotFound {
  readonly _tag = "WalletNotFound"
  constructor(readonly walletId: AggregateId) {}
}

class InsufficientBalance {
  readonly _tag = "InsufficientBalance"
  constructor(readonly requested: number, readonly available: number) {}
}

class WalletInactive {
  readonly _tag = "WalletInactive"
  constructor(readonly walletId: AggregateId) {}
}

type WalletError = WalletNotFound | InsufficientBalance | WalletInactive

// ============================================================================
// Pure Functions
// ============================================================================

const applyWalletEvent = createEventApplicator<WalletState, WalletEvent>({
  WalletCreated: (state, event) => ({
    id: event.metadata.aggregateId,
    ownerId: event.data.ownerId,
    balance: event.data.initialBalance,
    currency: event.data.currency,
    isActive: true,
    transactionCount: 0
  }),
  
  MoneyDeposited: (state, event) =>
    state ? {
      ...state,
      balance: state.balance + event.data.amount,
      transactionCount: state.transactionCount + 1
    } : null,
    
  MoneyWithdrawn: (state, event) =>
    state ? {
      ...state,
      balance: state.balance - event.data.amount,
      transactionCount: state.transactionCount + 1
    } : null,
    
  WalletDeactivated: (state, event) =>
    state ? { ...state, isActive: false } : null
})

const handleWalletCommand = createCommandHandler<
  WalletState,
  WalletCommand,
  WalletEvent,
  WalletError
>({
  CreateWallet: (state, command) =>
    Effect.gen(function* () {
      // Check if wallet already exists (state is not default)
      if (state && state.balance !== 0) {
        return {
          type: "failure" as const,
          error: new WalletNotFound(command.aggregateId) // Reusing error for simplicity
        }
      }
      
      const event: Schema.Schema.Type<typeof WalletCreated> = {
        type: "WalletCreated" as const,
        data: {
          ownerId: command.payload.ownerId,
          initialBalance: command.payload.initialBalance,
          currency: command.payload.currency
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: 0 as any,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    }),
    
  DepositMoney: (state, command) =>
    Effect.gen(function* () {
      if (!state || !state.isActive) {
        return {
          type: "failure" as const,
          error: new WalletInactive(command.aggregateId)
        }
      }
      
      if (command.payload.amount <= 0) {
        return {
          type: "failure" as const,
          error: new InsufficientBalance(command.payload.amount, 0)
        }
      }
      
      const event: Schema.Schema.Type<typeof MoneyDeposited> = {
        type: "MoneyDeposited" as const,
        data: {
          amount: command.payload.amount,
          reference: command.payload.reference
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: state.transactionCount + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    }),
    
  WithdrawMoney: (state, command) =>
    Effect.gen(function* () {
      if (!state || !state.isActive) {
        return {
          type: "failure" as const,
          error: new WalletInactive(command.aggregateId)
        }
      }
      
      if (command.payload.amount > state.balance) {
        return {
          type: "failure" as const,
          error: new InsufficientBalance(command.payload.amount, state.balance)
        }
      }
      
      const event: Schema.Schema.Type<typeof MoneyWithdrawn> = {
        type: "MoneyWithdrawn" as const,
        data: {
          amount: command.payload.amount,
          reference: command.payload.reference
        },
        metadata: {
          eventId: createEventId(),
          aggregateId: command.aggregateId,
          version: state.transactionCount + 1,
          timestamp: now(),
          correlationId: command.metadata.correlationId,
          causationId: createCausationId(),
          actor: command.metadata.actor
        }
      }
      
      return {
        type: "success" as const,
        events: [event]
      }
    })
})

// ============================================================================
// Aggregate Operations
// ============================================================================

const createWalletAggregate = (id: AggregateId = createAggregateId()) =>
  createAggregate<WalletState, WalletEvent>({
    id,
    ownerId: createAggregateId(),
    balance: 0,
    currency: "USD",
    isActive: false,
    transactionCount: 0
  })

const executeWalletCommand = (aggregate: any, command: WalletCommand) =>
  executeCommand(handleWalletCommand, applyWalletEvent)(aggregate, command)

const loadWalletFromEvents = (events: ReadonlyArray<WalletEvent>) =>
  loadFromEvents(applyWalletEvent)(events)

// ============================================================================
// Projection
// ============================================================================

const WalletSummaryProjection = createProjection(
  "WalletSummary",
  {
    totalWallets: 0,
    totalBalance: 0,
    totalTransactions: 0,
    activeWallets: 0,
    currencyBreakdown: {
      USD: { count: 0, balance: 0 },
      EUR: { count: 0, balance: 0 },
      GBP: { count: 0, balance: 0 }
    }
  },
  {
    WalletCreated: (state, event) => ({
      ...state,
      totalWallets: state.totalWallets + 1,
      totalBalance: state.totalBalance + event.data.initialBalance,
      activeWallets: state.activeWallets + 1,
      currencyBreakdown: {
        ...state.currencyBreakdown,
        [event.data.currency]: {
          count: state.currencyBreakdown[event.data.currency].count + 1,
          balance: state.currencyBreakdown[event.data.currency].balance + event.data.initialBalance
        }
      }
    }),
    
    MoneyDeposited: (state, event) => ({
      ...state,
      totalBalance: state.totalBalance + event.data.amount,
      totalTransactions: state.totalTransactions + 1
    }),
    
    MoneyWithdrawn: (state, event) => ({
      ...state,
      totalBalance: state.totalBalance - event.data.amount,
      totalTransactions: state.totalTransactions + 1
    }),
    
    WalletDeactivated: (state, event) => ({
      ...state,
      activeWallets: state.activeWallets - 1
    })
  }
)

// ============================================================================
// Complete Demo
// ============================================================================

const runReliableDemo = () =>
  Effect.gen(function* () {
    yield* Effect.log("🚀 Reliable CQRS/Event Sourcing Framework Demo")
    yield* Effect.log("=" .repeat(60))
    
    // 1. Create a wallet
    yield* Effect.log("\n💰 Step 1: Creating a digital wallet...")
    
    const ownerId = createAggregateId()
    const walletId = createAggregateId()
    
    const createCommand: Schema.Schema.Type<typeof CreateWallet> = {
      type: "CreateWallet" as const,
      aggregateId: walletId,
      payload: {
        ownerId,
        initialBalance: 100.00,
        currency: "USD"
      },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: now(),
        actor: { type: "user", service: "demo" } as any
      }
    }
    
    let wallet = createWalletAggregate(walletId)
    wallet = yield* executeWalletCommand(wallet, createCommand)
    
    yield* Effect.log(`✅ Wallet created: ${JSON.stringify(wallet.state)}`)
    yield* Effect.log(`📊 Events generated: ${wallet.uncommittedEvents.length}`)
    
    // 2. Make a deposit
    yield* Effect.log("\n💳 Step 2: Making a deposit...")
    
    const depositCommand: Schema.Schema.Type<typeof DepositMoney> = {
      type: "DepositMoney" as const,
      aggregateId: walletId,
      payload: {
        amount: 50.00,
        reference: "DEPOSIT-001"
      },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: now(),
        actor: { type: "user", service: "demo" } as any
      }
    }
    
    wallet = yield* executeWalletCommand(wallet, depositCommand)
    
    yield* Effect.log(`✅ Deposit completed: Balance = $${wallet.state.balance}`)
    yield* Effect.log(`📊 Transaction count: ${wallet.state.transactionCount}`)
    
    // 3. Make a withdrawal
    yield* Effect.log("\n💸 Step 3: Making a withdrawal...")
    
    const withdrawCommand: Schema.Schema.Type<typeof WithdrawMoney> = {
      type: "WithdrawMoney" as const,
      aggregateId: walletId,
      payload: {
        amount: 25.00,
        reference: "WITHDRAW-001"
      },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: now(),
        actor: { type: "user", service: "demo" } as any
      }
    }
    
    wallet = yield* executeWalletCommand(wallet, withdrawCommand)
    
    yield* Effect.log(`✅ Withdrawal completed: Balance = $${wallet.state.balance}`)
    yield* Effect.log(`📊 Final transaction count: ${wallet.state.transactionCount}`)
    
    // 4. Demonstrate event sourcing
    yield* Effect.log("\n🔄 Step 4: Demonstrating Event Sourcing...")
    
    const allEvents = wallet.uncommittedEvents
    yield* Effect.log(`📝 Total events in history: ${allEvents.length}`)
    
    // Rebuild state from events
    const rebuiltWallet = loadWalletFromEvents(allEvents)
    
    yield* Effect.log(`🔍 Original state: ${JSON.stringify(wallet.state)}`)
    yield* Effect.log(`🔄 Rebuilt state: ${JSON.stringify(rebuiltWallet.state)}`)
    yield* Effect.log(`✅ States match: ${JSON.stringify(wallet.state) === JSON.stringify(rebuiltWallet.state)}`)
    
    // 5. Demonstrate projections
    yield* Effect.log("\n📊 Step 5: Demonstrating Projections...")
    
    let summary = WalletSummaryProjection.initialState
    for (const event of allEvents) {
      summary = WalletSummaryProjection.reducer(summary, event)
    }
    
    yield* Effect.log(`📈 Wallet Summary Projection:`)
    yield* Effect.log(`   Total Wallets: ${summary.totalWallets}`)
    yield* Effect.log(`   Total Balance: $${summary.totalBalance}`)
    yield* Effect.log(`   Total Transactions: ${summary.totalTransactions}`)
    yield* Effect.log(`   Active Wallets: ${summary.activeWallets}`)
    yield* Effect.log(`   USD Wallets: ${summary.currencyBreakdown.USD.count} ($${summary.currencyBreakdown.USD.balance})`)
    
    // 6. Test error handling
    yield* Effect.log("\n❌ Step 6: Testing Error Handling...")
    
    const invalidWithdrawCommand: Schema.Schema.Type<typeof WithdrawMoney> = {
      type: "WithdrawMoney" as const,
      aggregateId: walletId,
      payload: {
        amount: 1000.00, // More than available balance
        reference: "INVALID-WITHDRAW"
      },
      metadata: {
        commandId: createEventId(),
        correlationId: createEventId(),
        timestamp: now(),
        actor: { type: "user", service: "demo" } as any
      }
    }
    
    const errorResult = yield* pipe(
      executeWalletCommand(wallet, invalidWithdrawCommand),
      Effect.either
    )
    
    if (errorResult._tag === "Left") {
      yield* Effect.log(`✅ Error handling works: ${errorResult.left._tag}`)
    } else {
      yield* Effect.log(`❌ Expected error but got success`)
    }
    
    yield* Effect.log("\n🎉 Reliable Demo Completed Successfully!")
    yield* Effect.log("🌟 Framework Features Demonstrated:")
    yield* Effect.log("   • Schema-first development with Effect Schema")
    yield* Effect.log("   • Pure functional event sourcing")
    yield* Effect.log("   • Type-safe command handling")
    yield* Effect.log("   • Automatic event application")
    yield* Effect.log("   • State reconstruction from events")
    yield* Effect.log("   • Real-time projections")
    yield* Effect.log("   • Type-safe error handling")
    yield* Effect.log("   • Business rule enforcement")
    
    return {
      success: true,
      walletId,
      finalBalance: wallet.state.balance,
      totalTransactions: wallet.state.transactionCount,
      totalEvents: allEvents.length,
      projectionSummary: summary,
      errorHandlingWorks: errorResult._tag === "Left"
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`❌ Demo failed: ${JSON.stringify(error)}`)
        return { error: JSON.stringify(error) }
      })
    )
  )

// ============================================================================
// Run Demo
// ============================================================================

if (require.main === module) {
  Effect.runPromise(runReliableDemo()).then(
    result => {
      console.log("🎯 Reliable Demo Result:", result)
      process.exit(0)
    },
    error => {
      console.error("💥 Reliable Demo Error:", error)
      process.exit(1)
    }
  )
}

export { runReliableDemo }