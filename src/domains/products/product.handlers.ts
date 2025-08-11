/**
 * Product Command Handlers
 * 
 * Effect-based command handlers implementing the product use cases
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { createRepository, type RepositoryContext } from '@cqrs/framework/effect/core/repository-effects';
import { ProductAggregate } from './product.aggregate';
import type { 
  ProductCommand,
  ProductEvent,
  ProductId,
  ProductDomainError,
  CreateProductCommand,
  UpdateProductCommand,
  ActivateProductCommand,
  DeactivateProductCommand,
  UpdateInventoryCommand,
  ReserveInventoryCommand,
  ReleaseInventoryCommand,
  UpdatePriceCommand,
  ProductCommandTypes
} from './product.types';

/**
 * Product service dependencies
 */
export interface ProductServiceContext {
  readonly productRepository: ProductRepository;
}

export const ProductServiceContext = Context.GenericTag<ProductServiceContext>('ProductServiceContext');

/**
 * Product repository using the generic repository pattern
 */
export type ProductRepository = ReturnType<typeof createProductRepository>;

export const createProductRepository = () => 
  createRepository({
    createAggregate: (id: ProductId) => ProductAggregate.create(id),
    snapshotFrequency: 10,
    cacheCapacity: 100
  });

/**
 * Product command handler interface
 */
export interface ProductCommandHandler<TCommand extends ProductCommand, TResult> {
  handle(command: TCommand): Effect.Effect<TResult, ProductDomainError, ProductServiceContext>;
}

/**
 * Create Product Command Handler
 */
export class CreateProductHandler implements ProductCommandHandler<CreateProductCommand, { productId: ProductId }> {
  handle(command: CreateProductCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      // Load or create aggregate
      const aggregate = yield* _(
        productRepository.load(command.aggregateId).pipe(
          Effect.catchTag('AggregateNotFoundError', () => 
            Effect.succeed(ProductAggregate.create(command.aggregateId))
          )
        )
      );
      
      // Execute business logic
      yield* _(aggregate.createProduct({
        name: command.payload.name,
        description: command.payload.description,
        sku: command.payload.sku,
        price: command.payload.price,
        categoryId: command.payload.categoryId,
        initialQuantity: command.payload.initialQuantity,
        metadata: command.payload.metadata
      }));
      
      // Save aggregate
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Update Product Command Handler
 */
export class UpdateProductHandler implements ProductCommandHandler<UpdateProductCommand, { productId: ProductId }> {
  handle(command: UpdateProductCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      // Load aggregate
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      
      // Execute business logic
      yield* _(aggregate.updateProduct(command.payload));
      
      // Save aggregate
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Activate Product Command Handler
 */
export class ActivateProductHandler implements ProductCommandHandler<ActivateProductCommand, { productId: ProductId }> {
  handle(command: ActivateProductCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.activateProduct());
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Deactivate Product Command Handler
 */
export class DeactivateProductHandler implements ProductCommandHandler<DeactivateProductCommand, { productId: ProductId }> {
  handle(command: DeactivateProductCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.deactivateProduct(command.payload.reason));
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Update Inventory Command Handler
 */
export class UpdateInventoryHandler implements ProductCommandHandler<UpdateInventoryCommand, { productId: ProductId }> {
  handle(command: UpdateInventoryCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.updateInventory(command.payload.quantity, command.payload.reason));
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Reserve Inventory Command Handler
 */
export class ReserveInventoryHandler implements ProductCommandHandler<ReserveInventoryCommand, { productId: ProductId }> {
  handle(command: ReserveInventoryCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.reserveInventory(
        command.payload.quantity,
        command.payload.reservationId,
        command.payload.reason
      ));
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Release Inventory Command Handler
 */
export class ReleaseInventoryHandler implements ProductCommandHandler<ReleaseInventoryCommand, { productId: ProductId }> {
  handle(command: ReleaseInventoryCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.releaseInventory(
        command.payload.quantity,
        command.payload.reservationId,
        command.payload.reason
      ));
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Update Price Command Handler
 */
export class UpdatePriceHandler implements ProductCommandHandler<UpdatePriceCommand, { productId: ProductId }> {
  handle(command: UpdatePriceCommand): Effect.Effect<{ productId: ProductId }, ProductDomainError, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const { productRepository } = yield* _(ProductServiceContext);
      
      const aggregate = yield* _(productRepository.load(command.aggregateId));
      yield* _(aggregate.updatePrice(
        command.payload.newPrice,
        command.payload.effectiveDate,
        command.payload.reason
      ));
      yield* _(productRepository.save(aggregate));
      
      return { productId: command.aggregateId };
    });
  }
}

/**
 * Product command dispatcher
 */
export class ProductCommandDispatcher {
  private handlers: Map<string, ProductCommandHandler<any, any>>;

  constructor() {
    this.handlers = new Map([
      [ProductCommandTypes.CREATE_PRODUCT, new CreateProductHandler()],
      [ProductCommandTypes.UPDATE_PRODUCT, new UpdateProductHandler()],
      [ProductCommandTypes.ACTIVATE_PRODUCT, new ActivateProductHandler()],
      [ProductCommandTypes.DEACTIVATE_PRODUCT, new DeactivateProductHandler()],
      [ProductCommandTypes.UPDATE_INVENTORY, new UpdateInventoryHandler()],
      [ProductCommandTypes.RESERVE_INVENTORY, new ReserveInventoryHandler()],
      [ProductCommandTypes.RELEASE_INVENTORY, new ReleaseInventoryHandler()],
      [ProductCommandTypes.UPDATE_PRICE, new UpdatePriceHandler()],
    ]);
  }

  dispatch<TCommand extends ProductCommand>(
    command: TCommand
  ): Effect.Effect<any, ProductDomainError | Error, ProductServiceContext> {
    return Effect.gen(function* (_) {
      const handler = this.handlers.get(command.type);
      if (!handler) {
        yield* _(Effect.fail(new Error(`No handler found for command type: ${command.type}`)));
      }
      
      return yield* _(handler.handle(command));
    });
  }
}

/**
 * Product service layer factory
 */
export const createProductServiceLayer = (
  repositoryContext: RepositoryContext<ProductEvent>
): Layer.Layer<ProductServiceContext, never, never> => {
  return Layer.succeed(ProductServiceContext, {
    productRepository: createProductRepository().pipe(
      Effect.provide(Layer.succeed({} as any, repositoryContext))
    ) as any
  });
};

/**
 * Product module exports
 */
export const ProductModule = {
  handlers: {
    CreateProductHandler,
    UpdateProductHandler,
    ActivateProductHandler,
    DeactivateProductHandler,
    UpdateInventoryHandler,
    ReserveInventoryHandler,
    ReleaseInventoryHandler,
    UpdatePriceHandler,
  },
  dispatcher: ProductCommandDispatcher,
  serviceLayer: createProductServiceLayer,
  repository: createProductRepository,
} as const;