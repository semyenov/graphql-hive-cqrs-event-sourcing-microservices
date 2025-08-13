import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type {
  FederationEntity,
  EntityReferenceResolver,
  FieldResolver,
  FieldResolverMap,
} from "../types"
import { EntityResolverError } from "../errors"

export class EntityBuilder<TSource = unknown, TArgs = unknown, TContext = unknown, TResult = TSource> {
  private constructor(
    private readonly config: Partial<FederationEntity<TSource, TArgs, TContext, TResult>>
  ) {}

  static create<TSource = unknown, TArgs = unknown, TContext = unknown, TResult = TSource>(): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({});
  }

  withTypename(typename: string): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      typename,
    })
  }

  withKey(key: string | readonly string[]): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      key,
    })
  }

  withSchema(schema: Schema.Schema.Any): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      schema,
    })
  }

  withReferenceResolver(
    resolver: EntityReferenceResolver<TResult>
  ): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      resolveReference: resolver,
    })
  }

  withField<K extends keyof TResult>(
    field: K,
    resolver: FieldResolver<TSource, TArgs, TContext, TResult[K]>
  ): EntityBuilder<TSource, TArgs, TContext, TResult> {
    const fields = (this.config.fields || {}) as FieldResolverMap<TSource, TArgs, TContext, TResult>
    
    return new EntityBuilder({
      ...this.config,
      fields: {
        ...fields,
        [field]: resolver,
      },
    })
  }

  withFields(
    fields: FieldResolverMap<TSource, TArgs, TContext, TResult>
  ): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      fields: {
        ...this.config.fields,
        ...fields,
      },
    })
  }

  withExtensions(extensions: Record<string, unknown>): EntityBuilder<TSource, TArgs, TContext, TResult> {
    return new EntityBuilder({
      ...this.config,
      extensions: {
        ...this.config.extensions,
        ...extensions,
      },
    })
  }

  build(): Effect.Effect<FederationEntity<TSource, TArgs, TContext, TResult>, EntityResolverError> {
    const { typename, key, schema, resolveReference, fields } = this.config

    if (!typename) {
      return Effect.fail(
        new EntityResolverError({
          reason: "InvalidReference",
          entityType: "unknown",
          reference: this.config,
          details: "Entity typename is required",
        })
      )
    }

    if (!key) {
      return Effect.fail(
        new EntityResolverError({
          reason: "InvalidReference",
          entityType: typename,
          reference: this.config,
          details: "Entity key is required",
        })
      )
    }

    if (!schema) {
      return Effect.fail(
        new EntityResolverError({
          reason: "InvalidReference",
          entityType: typename,
          reference: this.config,
          details: "Entity schema is required",
        })
      )
    }

    if (!resolveReference) {
      return Effect.fail(
        new EntityResolverError({
          reason: "InvalidReference",
          entityType: typename,
          reference: this.config,
          details: "Entity reference resolver is required",
        })
      )
    }

    return Effect.succeed({
      typename,
      key,
      schema,
      resolveReference,
      fields: fields || {},
      extensions: this.config.extensions,
    })
  }
}

export const createEntity = <TSource = unknown, TArgs = unknown, TContext = unknown, TResult = TSource>(
  builder: (b: EntityBuilder<TSource, TArgs, TContext, TResult>) => EntityBuilder<TSource, TArgs, TContext, TResult>
): Effect.Effect<FederationEntity<TSource, TArgs, TContext, TResult>, EntityResolverError> => {
  return builder(EntityBuilder.create<TSource, TArgs, TContext, TResult>()).build()
}

export const createEntities = <TSource = unknown, TArgs = unknown, TContext = unknown, TResult = TSource>(
  ...builders: Array<
    (b: EntityBuilder<TSource, TArgs, TContext, TResult>) => EntityBuilder<TSource, TArgs, TContext, TResult>
  >
): Effect.Effect<ReadonlyArray<FederationEntity<TSource, TArgs, TContext, TResult>>, EntityResolverError> => {
  return pipe(
    builders,
    ReadonlyArray.map(builder => createEntity(builder)),
    Effect.all
  )
}