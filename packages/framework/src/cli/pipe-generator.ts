#!/usr/bin/env bun
/**
 * 🛠️ Pipe Pattern Code Generator CLI
 * 
 * Automatic conversion from Effect.gen to pipe patterns
 * Scaffolding for new pipe-based domains
 * Migration assistance tools
 */

import * as fs from "fs"
import * as path from "path"
import { parseArgs } from "util"
import * as ts from "typescript"
import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import * as Stream from "effect/Stream"
import * as Either from "effect/Either"

// ============================================================================
// CLI Configuration
// ============================================================================

const VERSION = "1.0.0"
const DESCRIPTION = "Pipe Pattern Code Generator - Convert Effect.gen to pipe patterns"

interface CliOptions {
  command: "convert" | "scaffold" | "analyze" | "help"
  input?: string
  output?: string
  type?: "domain" | "handler" | "saga" | "projection"
  name?: string
  dryRun?: boolean
  verbose?: boolean
}

// ============================================================================
// AST Transformation Engine
// ============================================================================

class EffectGenToPipeTransformer {
  private sourceFile: ts.SourceFile
  private printer: ts.Printer

  constructor(private source: string) {
    this.sourceFile = ts.createSourceFile(
      "temp.ts",
      source,
      ts.ScriptTarget.Latest,
      true
    )
    this.printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  }

  /**
   * Transform Effect.gen to pipe pattern
   */
  transform(): string {
    const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
      return (sourceFile) => {
        const visitor: ts.Visitor = (node) => {
          if (this.isEffectGen(node)) {
            return this.transformEffectGen(node as ts.CallExpression)
          }
          return ts.visitEachChild(node, visitor, context)
        }
        return ts.visitNode(sourceFile, visitor) as ts.SourceFile
      }
    }

    const result = ts.transform(this.sourceFile, [transformer])
    const transformedFile = result.transformed[0]
    return this.printer.printFile(transformedFile)
  }

  private isEffectGen(node: ts.Node): boolean {
    if (!ts.isCallExpression(node)) return false
    
    const expression = node.expression
    if (!ts.isPropertyAccessExpression(expression)) return false
    
    const object = expression.expression
    const property = expression.name
    
    return (
      ts.isIdentifier(object) &&
      object.text === "Effect" &&
      property.text === "gen"
    )
  }

  private transformEffectGen(node: ts.CallExpression): ts.Node {
    const genFunction = node.arguments[0]
    if (!genFunction || !ts.isFunctionExpression(genFunction)) {
      return node
    }

    const body = genFunction.body
    if (!ts.isBlock(body)) return node

    const operations = this.extractOperations(body)
    if (operations.length === 0) return node

    return this.buildPipeline(operations)
  }

  private extractOperations(block: ts.Block): Operation[] {
    const operations: Operation[] = []
    
    for (const statement of block.statements) {
      if (ts.isVariableStatement(statement)) {
        const declaration = statement.declarationList.declarations[0]
        if (declaration && ts.isVariableDeclaration(declaration)) {
          const initializer = declaration.initializer
          if (initializer && this.isYieldExpression(initializer)) {
            operations.push({
              type: "yield",
              name: declaration.name.getText(),
              expression: (initializer as any).expression
            })
          }
        }
      } else if (ts.isReturnStatement(statement) && statement.expression) {
        operations.push({
          type: "return",
          expression: statement.expression
        })
      }
    }
    
    return operations
  }

  private isYieldExpression(node: ts.Node): boolean {
    return node.kind === ts.SyntaxKind.YieldExpression
  }

  private buildPipeline(operations: Operation[]): ts.Node {
    if (operations.length === 0) {
      return ts.factory.createIdentifier("Effect.void")
    }

    let pipeline: ts.Expression = operations[0].expression

    for (let i = 1; i < operations.length; i++) {
      const op = operations[i]
      if (op.type === "return") {
        pipeline = this.wrapInPipe(pipeline, 
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("Effect"),
              "map"
            ),
            undefined,
            [ts.factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              undefined,
              op.expression
            )]
          )
        )
      } else {
        pipeline = this.wrapInPipe(pipeline,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("Effect"),
              "flatMap"
            ),
            undefined,
            [ts.factory.createArrowFunction(
              undefined,
              undefined,
              [ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                op.name
              )],
              undefined,
              undefined,
              operations[i + 1]?.expression || ts.factory.createIdentifier("Effect.void")
            )]
          )
        )
      }
    }

    return this.wrapInPipe(pipeline)
  }

  private wrapInPipe(...expressions: ts.Expression[]): ts.CallExpression {
    return ts.factory.createCallExpression(
      ts.factory.createIdentifier("pipe"),
      undefined,
      expressions
    )
  }
}

interface Operation {
  type: "yield" | "return"
  name?: string
  expression: ts.Expression
}

// ============================================================================
// Code Generators
// ============================================================================

/**
 * Generate a new domain with pipe patterns
 */
const generateDomain = (name: string): string => {
  const pascalCase = name.charAt(0).toUpperCase() + name.slice(1)
  const camelCase = name.charAt(0).toLowerCase() + name.slice(1)

  return `/**
 * 🎯 ${pascalCase} Domain - Pipe Pattern Implementation
 */

import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import {
  createEventSchema,
  createCommandSchema,
  createQuerySchema,
  type EventApplicator,
  NonEmptyString,
  AggregateId,
  Version,
  createEventId,
  createCorrelationId,
  createCausationId,
  now,
} from "@cqrs/framework"

// ============================================================================
// Domain State
// ============================================================================

export const ${pascalCase}State = Schema.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  status: Schema.Literal("active", "inactive", "deleted"),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export type ${pascalCase}State = Schema.Schema.Type<typeof ${pascalCase}State>

// ============================================================================
// Events
// ============================================================================

export const ${pascalCase}Created = createEventSchema("${pascalCase}Created", Schema.Struct({
  name: NonEmptyString,
}))

export const ${pascalCase}Updated = createEventSchema("${pascalCase}Updated", Schema.Struct({
  name: Schema.optional(NonEmptyString),
  status: Schema.optional(Schema.Literal("active", "inactive")),
}))

export const ${pascalCase}Deleted = createEventSchema("${pascalCase}Deleted", Schema.Struct({
  reason: NonEmptyString,
}))

export type ${pascalCase}Event =
  | Schema.Schema.Type<typeof ${pascalCase}Created>
  | Schema.Schema.Type<typeof ${pascalCase}Updated>
  | Schema.Schema.Type<typeof ${pascalCase}Deleted>

// ============================================================================
// Commands
// ============================================================================

export const Create${pascalCase} = createCommandSchema("Create${pascalCase}", Schema.Struct({
  name: NonEmptyString,
}))

export const Update${pascalCase} = createCommandSchema("Update${pascalCase}", Schema.Struct({
  id: NonEmptyString,
  name: Schema.optional(NonEmptyString),
  status: Schema.optional(Schema.Literal("active", "inactive")),
}))

export const Delete${pascalCase} = createCommandSchema("Delete${pascalCase}", Schema.Struct({
  id: NonEmptyString,
  reason: NonEmptyString,
}))

export type ${pascalCase}Command =
  | Schema.Schema.Type<typeof Create${pascalCase}>
  | Schema.Schema.Type<typeof Update${pascalCase}>
  | Schema.Schema.Type<typeof Delete${pascalCase}>

// ============================================================================
// Errors
// ============================================================================

export class ${pascalCase}NotFoundError {
  readonly _tag = "${pascalCase}NotFoundError"
  constructor(readonly id: string) {}
}

export class ${pascalCase}AlreadyExistsError {
  readonly _tag = "${pascalCase}AlreadyExistsError"
  constructor(readonly name: string) {}
}

export type ${pascalCase}Error = ${pascalCase}NotFoundError | ${pascalCase}AlreadyExistsError

// ============================================================================
// Event Applicator - PIPE PATTERN
// ============================================================================

export const apply${pascalCase}Event: EventApplicator<${pascalCase}State | null, ${pascalCase}Event> = (
  state,
  event
) =>
  match(event)
    .with({ type: "${pascalCase}Created" }, (e) => ({
      id: e.metadata.aggregateId as NonEmptyString,
      name: e.data.name,
      status: "active" as const,
      createdAt: e.metadata.timestamp,
      updatedAt: e.metadata.timestamp,
    }))
    .with({ type: "${pascalCase}Updated" }, (e) =>
      state
        ? {
            ...state,
            ...(e.data.name && { name: e.data.name }),
            ...(e.data.status && { status: e.data.status }),
            updatedAt: e.metadata.timestamp,
          }
        : null
    )
    .with({ type: "${pascalCase}Deleted" }, () => null)
    .exhaustive()

// ============================================================================
// Command Handlers - PIPE PATTERN
// ============================================================================

export const handle${pascalCase}Command = (
  state: ${pascalCase}State | null,
  command: ${pascalCase}Command
): Effect.Effect<ReadonlyArray<${pascalCase}Event>, ${pascalCase}Error> =>
  pipe(
    Effect.succeed(command),
    Effect.flatMap((cmd) =>
      match(cmd)
        .with({ type: "Create${pascalCase}" }, (c) =>
          state !== null
            ? Effect.fail(new ${pascalCase}AlreadyExistsError(c.payload.name))
            : Effect.succeed([{
                type: "${pascalCase}Created" as const,
                data: { name: c.payload.name },
                metadata: {
                  eventId: createEventId(),
                  aggregateId: c.metadata.aggregateId,
                  version: 0 as Version,
                  timestamp: now(),
                  correlationId: c.metadata.correlationId,
                  causationId: c.metadata.commandId,
                  actor: c.metadata.actor,
                },
              }])
        )
        .with({ type: "Update${pascalCase}" }, (c) =>
          state === null
            ? Effect.fail(new ${pascalCase}NotFoundError(c.payload.id))
            : Effect.succeed([{
                type: "${pascalCase}Updated" as const,
                data: {
                  ...(c.payload.name && { name: c.payload.name }),
                  ...(c.payload.status && { status: c.payload.status }),
                },
                metadata: {
                  eventId: createEventId(),
                  aggregateId: c.metadata.aggregateId,
                  version: (state.version + 1) as Version,
                  timestamp: now(),
                  correlationId: c.metadata.correlationId,
                  causationId: c.metadata.commandId,
                  actor: c.metadata.actor,
                },
              }])
        )
        .with({ type: "Delete${pascalCase}" }, (c) =>
          state === null
            ? Effect.fail(new ${pascalCase}NotFoundError(c.payload.id))
            : Effect.succeed([{
                type: "${pascalCase}Deleted" as const,
                data: { reason: c.payload.reason },
                metadata: {
                  eventId: createEventId(),
                  aggregateId: c.metadata.aggregateId,
                  version: (state.version + 1) as Version,
                  timestamp: now(),
                  correlationId: c.metadata.correlationId,
                  causationId: c.metadata.commandId,
                  actor: c.metadata.actor,
                },
              }])
        )
        .exhaustive()
    )
  )

// ============================================================================
// Repository - PIPE PATTERN
// ============================================================================

import { createRepository } from "@cqrs/framework"

export const ${camelCase}Repository = createRepository(
  "${pascalCase}",
  apply${pascalCase}Event,
  null
)
`
}

/**
 * Generate a saga with pipe patterns
 */
const generateSaga = (name: string): string => {
  const pascalCase = name.charAt(0).toUpperCase() + name.slice(1)

  return `/**
 * 🎯 ${pascalCase} Saga - Pipe Pattern Implementation
 */

import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type { DomainEvent, CommandBus, EventStore } from "@cqrs/framework"

export interface ${pascalCase}SagaState {
  status: "pending" | "processing" | "completed" | "failed"
  steps: Array<{ name: string; status: "pending" | "completed" | "failed" }>
  startedAt: number
  completedAt?: number
}

/**
 * ${pascalCase} Saga - Orchestrates complex workflows
 */
export const create${pascalCase}Saga = () => {
  const processEvent = (
    event: DomainEvent
  ): Effect.Effect<void, Error, CommandBus | EventStore> =>
    pipe(
      Effect.succeed(event),
      Effect.tap(() => Effect.log(\`Processing event: \${event.type}\`)),
      Effect.flatMap((e) =>
        match(e)
          .with({ type: "OrderPlaced" }, (orderEvent) =>
            pipe(
              // Step 1: Reserve inventory
              CommandBus,
              Effect.flatMap((bus) =>
                bus.send("inventory", {
                  type: "ReserveInventory",
                  payload: { orderId: orderEvent.data.orderId },
                })
              ),
              Effect.tap(() => Effect.log("Inventory reserved")),
              // Step 2: Process payment
              Effect.flatMap(() => CommandBus),
              Effect.flatMap((bus) =>
                bus.send("payment", {
                  type: "ProcessPayment",
                  payload: { orderId: orderEvent.data.orderId },
                })
              ),
              Effect.tap(() => Effect.log("Payment processed")),
              // Step 3: Arrange shipping
              Effect.flatMap(() => CommandBus),
              Effect.flatMap((bus) =>
                bus.send("shipping", {
                  type: "ArrangeShipping",
                  payload: { orderId: orderEvent.data.orderId },
                })
              ),
              Effect.tap(() => Effect.log("Shipping arranged"))
            )
          )
          .with({ type: "PaymentFailed" }, (paymentEvent) =>
            pipe(
              // Compensation: Release inventory
              CommandBus,
              Effect.flatMap((bus) =>
                bus.send("inventory", {
                  type: "ReleaseInventory",
                  payload: { orderId: paymentEvent.data.orderId },
                })
              ),
              Effect.tap(() => Effect.log("Inventory released due to payment failure"))
            )
          )
          .otherwise(() => Effect.void)
      ),
      Effect.catchAll((error) =>
        pipe(
          Effect.log(\`Saga failed: \${error}\`),
          Effect.flatMap(() => Effect.fail(error))
        )
      )
    )

  return { processEvent }
}
`
}

/**
 * Generate a projection with pipe patterns
 */
const generateProjection = (name: string): string => {
  const pascalCase = name.charAt(0).toUpperCase() + name.slice(1)
  const camelCase = name.charAt(0).toLowerCase() + name.slice(1)

  return `/**
 * 🎯 ${pascalCase} Projection - Pipe Pattern Implementation
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { pipe } from "effect/Function"
import { match } from "ts-pattern"
import type { DomainEvent } from "@cqrs/framework"

export interface ${pascalCase}View {
  totalCount: number
  activeCount: number
  lastUpdated: number
  topItems: Array<{ id: string; score: number }>
}

const initial${pascalCase}View: ${pascalCase}View = {
  totalCount: 0,
  activeCount: 0,
  lastUpdated: Date.now(),
  topItems: [],
}

/**
 * ${pascalCase} Projection - Builds read model from events
 */
export const create${pascalCase}Projection = () => {
  const apply = (
    view: ${pascalCase}View,
    event: DomainEvent
  ): ${pascalCase}View =>
    match(event)
      .with({ type: "ItemCreated" }, (e) => ({
        ...view,
        totalCount: view.totalCount + 1,
        activeCount: view.activeCount + 1,
        lastUpdated: e.metadata.timestamp,
      }))
      .with({ type: "ItemDeleted" }, (e) => ({
        ...view,
        activeCount: Math.max(0, view.activeCount - 1),
        lastUpdated: e.metadata.timestamp,
      }))
      .otherwise(() => view)

  const buildFromStream = (
    events: Stream.Stream<DomainEvent, Error, never>
  ): Effect.Effect<${pascalCase}View, Error, never> =>
    pipe(
      events,
      Stream.runFold(initial${pascalCase}View, apply)
    )

  const buildFromArray = (
    events: ReadonlyArray<DomainEvent>
  ): ${pascalCase}View =>
    events.reduce(apply, initial${pascalCase}View)

  return { apply, buildFromStream, buildFromArray }
}
`
}

// ============================================================================
// Code Analysis
// ============================================================================

/**
 * Analyze code for Effect.gen usage
 */
const analyzeCode = (source: string): AnalysisResult => {
  const effectGenRegex = /Effect\.gen\s*\(/g
  const yieldRegex = /yield\s*\*/g
  const thisRegex = /this\./g
  
  const effectGenMatches = source.match(effectGenRegex) || []
  const yieldMatches = source.match(yieldRegex) || []
  const thisMatches = source.match(thisRegex) || []
  
  const lines = source.split('\n')
  const locations: Location[] = []
  
  lines.forEach((line, index) => {
    if (line.includes('Effect.gen')) {
      locations.push({
        line: index + 1,
        column: line.indexOf('Effect.gen'),
        type: 'Effect.gen'
      })
    }
  })
  
  return {
    totalEffectGen: effectGenMatches.length,
    totalYield: yieldMatches.length,
    totalThis: thisMatches.length,
    canConvert: effectGenMatches.length > 0 && thisMatches.length === 0,
    locations,
    complexity: calculateComplexity(source)
  }
}

interface AnalysisResult {
  totalEffectGen: number
  totalYield: number
  totalThis: number
  canConvert: boolean
  locations: Location[]
  complexity: number
}

interface Location {
  line: number
  column: number
  type: string
}

const calculateComplexity = (source: string): number => {
  // Simple complexity calculation based on nesting and conditions
  let complexity = 1
  const lines = source.split('\n')
  
  for (const line of lines) {
    if (line.includes('if') || line.includes('switch')) complexity++
    if (line.includes('for') || line.includes('while')) complexity += 2
    if (line.includes('catch')) complexity++
  }
  
  return complexity
}

// ============================================================================
// File Operations
// ============================================================================

const readFile = (filePath: string): Effect.Effect<string, Error> =>
  Effect.try({
    try: () => fs.readFileSync(filePath, 'utf-8'),
    catch: (e) => new Error(`Failed to read file: ${e}`)
  })

const writeFile = (filePath: string, content: string): Effect.Effect<void, Error> =>
  Effect.try({
    try: () => {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
    },
    catch: (e) => new Error(`Failed to write file: ${e}`)
  })

// ============================================================================
// CLI Commands
// ============================================================================

/**
 * Convert Effect.gen to pipe pattern
 */
const convertCommand = (options: CliOptions): Effect.Effect<void, Error> =>
  pipe(
    Effect.succeed(options),
    Effect.tap(() => Console.log(`Converting ${options.input} to pipe pattern...`)),
    Effect.flatMap(() => readFile(options.input!)),
    Effect.map((source) => new EffectGenToPipeTransformer(source).transform()),
    Effect.tap((transformed) =>
      options.dryRun
        ? Console.log(`\n--- Transformed Code ---\n${transformed}`)
        : writeFile(options.output || options.input!, transformed)
    ),
    Effect.tap(() =>
      Console.log(options.dryRun ? "Dry run complete" : `✅ Converted successfully`)
    )
  )

/**
 * Scaffold new pipe-based code
 */
const scaffoldCommand = (options: CliOptions): Effect.Effect<void, Error> =>
  pipe(
    Effect.succeed(options),
    Effect.tap(() => Console.log(`Scaffolding ${options.type}: ${options.name}...`)),
    Effect.map(() => {
      switch (options.type) {
        case "domain":
          return generateDomain(options.name!)
        case "saga":
          return generateSaga(options.name!)
        case "projection":
          return generateProjection(options.name!)
        default:
          return generateDomain(options.name!)
      }
    }),
    Effect.tap((code) =>
      options.dryRun
        ? Console.log(`\n--- Generated Code ---\n${code}`)
        : writeFile(options.output || `${options.name}.ts`, code)
    ),
    Effect.tap(() =>
      Console.log(options.dryRun ? "Dry run complete" : `✅ Scaffolded successfully`)
    )
  )

/**
 * Analyze code for conversion potential
 */
const analyzeCommand = (options: CliOptions): Effect.Effect<void, Error> =>
  pipe(
    Effect.succeed(options),
    Effect.tap(() => Console.log(`Analyzing ${options.input}...`)),
    Effect.flatMap(() => readFile(options.input!)),
    Effect.map(analyzeCode),
    Effect.tap((result) => {
      console.log("\n📊 Analysis Results:")
      console.log(`  Effect.gen calls: ${result.totalEffectGen}`)
      console.log(`  yield* statements: ${result.totalYield}`)
      console.log(`  'this' references: ${result.totalThis}`)
      console.log(`  Complexity score: ${result.complexity}`)
      console.log(`  Can auto-convert: ${result.canConvert ? "✅ Yes" : "❌ No"}`)
      
      if (!result.canConvert && result.totalThis > 0) {
        console.log("\n⚠️  Cannot auto-convert due to 'this' keyword usage")
        console.log("   Manual conversion recommended")
      }
      
      if (result.locations.length > 0) {
        console.log("\n📍 Effect.gen locations:")
        result.locations.forEach((loc) => {
          console.log(`   Line ${loc.line}, Column ${loc.column}`)
        })
      }
    })
  )

/**
 * Show help
 */
const showHelp = (): Effect.Effect<void> =>
  Console.log(`
${DESCRIPTION}
Version: ${VERSION}

Usage: pipe-generator <command> [options]

Commands:
  convert     Convert Effect.gen code to pipe patterns
  scaffold    Generate new pipe-based code
  analyze     Analyze code for conversion potential
  help        Show this help message

Options:
  --input, -i      Input file path
  --output, -o     Output file path (defaults to input)
  --type, -t       Type of scaffold (domain|saga|projection)
  --name, -n       Name for scaffolded code
  --dry-run, -d    Show output without writing files
  --verbose, -v    Show detailed output

Examples:
  # Convert a file from Effect.gen to pipe
  pipe-generator convert -i src/domain.ts -o src/domain-pipe.ts

  # Analyze a file for conversion potential
  pipe-generator analyze -i src/handlers.ts

  # Scaffold a new domain
  pipe-generator scaffold -t domain -n Product

  # Scaffold a saga with dry run
  pipe-generator scaffold -t saga -n OrderProcessing --dry-run
`)

// ============================================================================
// Main CLI Entry Point
// ============================================================================

const parseCliArgs = (): CliOptions => {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    return { command: "help" }
  }
  
  const command = args[0] as CliOptions["command"]
  const options: CliOptions = { command }
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case "--input":
      case "-i":
        options.input = args[++i]
        break
      case "--output":
      case "-o":
        options.output = args[++i]
        break
      case "--type":
      case "-t":
        options.type = args[++i] as any
        break
      case "--name":
      case "-n":
        options.name = args[++i]
        break
      case "--dry-run":
      case "-d":
        options.dryRun = true
        break
      case "--verbose":
      case "-v":
        options.verbose = true
        break
    }
  }
  
  return options
}

const main = (): Effect.Effect<void, Error> => {
  const options = parseCliArgs()
  
  switch (options.command) {
    case "convert":
      if (!options.input) {
        return Effect.fail(new Error("Input file required for convert command"))
      }
      return convertCommand(options)
      
    case "scaffold":
      if (!options.name) {
        return Effect.fail(new Error("Name required for scaffold command"))
      }
      return scaffoldCommand(options)
      
    case "analyze":
      if (!options.input) {
        return Effect.fail(new Error("Input file required for analyze command"))
      }
      return analyzeCommand(options)
      
    case "help":
    default:
      return showHelp()
  }
}

// Execute CLI
if (import.meta.main) {
  Effect.runPromise(main()).catch((error) => {
    console.error(`\n❌ Error: ${error.message}`)
    process.exit(1)
  })
}

// ============================================================================
// Exports for programmatic usage
// ============================================================================

export {
  EffectGenToPipeTransformer,
  generateDomain,
  generateSaga,
  generateProjection,
  analyzeCode,
  type AnalysisResult,
  type CliOptions,
}