import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import { GraphQLResolveInfo } from "graphql"
import { EntityResolverError, FieldResolverError } from "../errors"

export interface FederationEntity<
  TSource = unknown,
  TArgs = unknown,
  TContext = unknown,
  TResult = TSource
> {
  readonly typename: string
  readonly key: string | readonly string[]
  readonly schema: Schema.Schema.Any
  readonly fields: FieldResolverMap<TSource, TArgs, TContext, TResult>
  readonly resolveReference: EntityReferenceResolver<TResult>
  readonly extensions?: Record<string, unknown>
}

export type EntityReferenceResolver<TResult> = <TReference extends Record<string, unknown>>(
  reference: TReference
) => Effect.Effect<TResult, EntityResolverError>

export type FieldResolver<TSource, TArgs, TContext, TResult> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Effect.Effect<TResult, FieldResolverError>

export type FieldResolverMap<TSource, TArgs, TContext, TResult> = {
  readonly [K in keyof TResult]?: FieldResolver<TSource, TArgs, TContext, TResult[K]>
}

export interface DomainSchemaConfig<TSource = unknown, TArgs = unknown, TContext = unknown> {
  readonly name: string
  readonly version: string
  readonly commands: SchemaMap
  readonly queries: SchemaMap
  readonly events: SchemaMap
  readonly entities: ReadonlyArray<FederationEntity<TSource, TArgs, TContext>>
  readonly context: Schema.Schema.Any
  readonly scalars: GraphQLScalarMap
  readonly extensions?: FederationExtensions
}

export type SchemaMap = Readonly<Record<string, Schema.Schema.Any>>

export type GraphQLScalarMap = Readonly<Record<string, import("graphql").GraphQLScalarType>>

export interface FederationExtensions {
  readonly serviceName?: string
  readonly serviceUrl?: string
  readonly federationVersion?: 1 | 2
  readonly tags?: ReadonlyArray<string>
}




export interface TypeConversionContext {
  readonly cache: Map<string, any>
  readonly isInput: boolean
  readonly scalars?: GraphQLScalarMap
  readonly depth: number
  readonly maxDepth: number
}