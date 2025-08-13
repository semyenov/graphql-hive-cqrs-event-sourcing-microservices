import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

export class EntityResolverError extends Data.TaggedError("EntityResolverError")<{
  readonly reason: "NotFound" | "InvalidReference" | "ResolutionFailed" | "Unauthorized"
  readonly entityType: string
  readonly reference: unknown
  readonly details?: string
}> {
  get message() {
    return `${this.reason}: ${this.entityType} - ${this.details || JSON.stringify(this.reference)}`
  }
}

export class FieldResolverError extends Data.TaggedError("FieldResolverError")<{
  readonly field: string
  readonly entityType: string
  readonly reason: string
  readonly cause?: unknown
}> {
  get message() {
    return `Field resolution failed: ${this.entityType}.${this.field} - ${this.reason}`
  }
}

export class SchemaConversionError extends Data.TaggedError("SchemaConversionError")<{
  readonly schemaType: string
  readonly astType: string
  readonly reason: string
  readonly path?: ReadonlyArray<string>
}> {
  get message() {
    const pathStr = this.path?.length ? ` at ${this.path.join(".")}` : ""
    return `Cannot convert ${this.schemaType} (AST: ${this.astType})${pathStr}: ${this.reason}`
  }
}

export class FederationConfigError extends Data.TaggedError("FederationConfigError")<{
  readonly reason: "InvalidConfig" | "MissingRequired" | "ValidationFailed"
  readonly field?: string
  readonly details: string
}> {
  get message() {
    const fieldStr = this.field ? ` (field: ${this.field})` : ""
    return `Federation config ${this.reason}${fieldStr}: ${this.details}`
  }
}

export const isEntityResolverError = (error: unknown): error is EntityResolverError =>
  Predicate.hasProperty(error, "_tag") && error._tag === "EntityResolverError"

export const isFieldResolverError = (error: unknown): error is FieldResolverError =>
  Predicate.hasProperty(error, "_tag") && error._tag === "FieldResolverError"

export const isSchemaConversionError = (error: unknown): error is SchemaConversionError =>
  Predicate.hasProperty(error, "_tag") && error._tag === "SchemaConversionError"

export const isFederationConfigError = (error: unknown): error is FederationConfigError =>
  Predicate.hasProperty(error, "_tag") && error._tag === "FederationConfigError"

export type FederationError =
  | EntityResolverError
  | FieldResolverError
  | SchemaConversionError
  | FederationConfigError