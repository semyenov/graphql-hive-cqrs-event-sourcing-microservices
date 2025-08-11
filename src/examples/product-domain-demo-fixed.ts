/**
 * Product Domain Demo - Fixed for Effect v3
 * 
 * Demonstrates CQRS/Event Sourcing with Effect-TS for a product domain.
 * Uses pipe-based composition instead of generators for Bun compatibility.
 */

import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { aggregateId, eventId } from '@cqrs/framework/core/branded/factories';
import type { AggregateId, EventId } from '@cqrs/framework/core/branded/types';
import type { ICommand, IEvent, IQuery } from '@cqrs/framework';

// ============================================================================
// Product Domain Types
// ============================================================================

interface ProductState {
  id: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  status: 'active' | 'discontinued';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Command Types
enum ProductCommandType {
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  ADD_STOCK = 'ADD_STOCK',
  REMOVE_STOCK = 'REMOVE_STOCK',
  DISCONTINUE_PRODUCT = 'DISCONTINUE_PRODUCT',
}

// Event Types
enum ProductEventType {
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  STOCK_ADDED = 'STOCK_ADDED',
  STOCK_REMOVED = 'STOCK_REMOVED',
  PRODUCT_DISCONTINUED = 'PRODUCT_DISCONTINUED',
}

// ============================================================================
// Commands
// ============================================================================

interface CreateProductCommand extends ICommand {
  type: ProductCommandType.CREATE_PRODUCT;
  aggregateId: AggregateId;
  payload: {
    name: string;
    description?: string;
    sku: string;
    price: number;
    initialStock: number;
    category: string;
  };
}

interface UpdateProductCommand extends ICommand {
  type: ProductCommandType.UPDATE_PRODUCT;
  aggregateId: AggregateId;
  payload: {
    name?: string;
    description?: string;
    price?: number;
  };
}

interface AddStockCommand extends ICommand {
  type: ProductCommandType.ADD_STOCK;
  aggregateId: AggregateId;
  payload: {
    quantity: number;
    reason?: string;
  };
}

interface RemoveStockCommand extends ICommand {
  type: ProductCommandType.REMOVE_STOCK;
  aggregateId: AggregateId;
  payload: {
    quantity: number;
    reason?: string;
  };
}

interface DiscontinueProductCommand extends ICommand {
  type: ProductCommandType.DISCONTINUE_PRODUCT;
  aggregateId: AggregateId;
  payload: {
    reason?: string;
  };
}

type ProductCommand =
  | CreateProductCommand
  | UpdateProductCommand
  | AddStockCommand
  | RemoveStockCommand
  | DiscontinueProductCommand;

// ============================================================================
// Events
// ============================================================================

interface ProductCreatedEvent extends IEvent {
  type: ProductEventType.PRODUCT_CREATED;
  aggregateId: AggregateId;
  data: {
    name: string;
    description?: string;
    sku: string;
    price: number;
    initialStock: number;
    category: string;
  };
  version: number;
  timestamp: Date;
}

interface ProductUpdatedEvent extends IEvent {
  type: ProductEventType.PRODUCT_UPDATED;
  aggregateId: AggregateId;
  data: {
    name?: string;
    description?: string;
    price?: number;
  };
  version: number;
  timestamp: Date;
}

interface StockAddedEvent extends IEvent {
  type: ProductEventType.STOCK_ADDED;
  aggregateId: AggregateId;
  data: {
    quantity: number;
    reason?: string;
    newStock: number;
  };
  version: number;
  timestamp: Date;
}

interface StockRemovedEvent extends IEvent {
  type: ProductEventType.STOCK_REMOVED;
  aggregateId: AggregateId;
  data: {
    quantity: number;
    reason?: string;
    newStock: number;
  };
  version: number;
  timestamp: Date;
}

interface ProductDiscontinuedEvent extends IEvent {
  type: ProductEventType.PRODUCT_DISCONTINUED;
  aggregateId: AggregateId;
  data: {
    reason?: string;
  };
  version: number;
  timestamp: Date;
}

type ProductDomainEvent =
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | StockAddedEvent
  | StockRemovedEvent
  | ProductDiscontinuedEvent;

// ============================================================================
// Mock Services
// ============================================================================

// Command Context
interface CommandContext {
  eventStore: any;
  repository: any;
}

const CommandContextTag = Context.GenericTag<CommandContext>('CommandContext');

// Mock repository
const repository = {
  products: new Map<string, ProductState>(),
  
  get(id: string): ProductState | undefined {
    return this.products.get(id);
  },
  
  save(product: ProductState): void {
    this.products.set(product.id, product);
  }
};

// ============================================================================
// Command Handlers (Simplified)
// ============================================================================

const createProductHandler = {
  handle: (command: CreateProductCommand) => 
    pipe(
      Effect.sync(() => {
        const productId = crypto.randomUUID();
        const product: ProductState = {
          id: productId,
          name: command.payload.name,
          description: command.payload.description,
          sku: command.payload.sku,
          price: command.payload.price,
          stock: command.payload.initialStock,
          category: command.payload.category,
          status: 'active',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        repository.save(product);
        return { productId };
      }),
      Effect.catchAll((error) => Effect.fail(new Error(`Failed to create product: ${error}`)))
    )
};

const updateProductHandler = {
  handle: (command: UpdateProductCommand) =>
    pipe(
      Effect.sync(() => {
        const product = repository.get(command.aggregateId as string);
        if (!product) {
          throw new Error('Product not found');
        }
        
        if (command.payload.name) product.name = command.payload.name;
        if (command.payload.description) product.description = command.payload.description;
        if (command.payload.price) product.price = command.payload.price;
        product.updatedAt = new Date();
        product.version++;
        
        repository.save(product);
        return { success: true };
      }),
      Effect.catchAll((error) => Effect.fail(error))
    )
};

const addStockHandler = {
  handle: (command: AddStockCommand) =>
    pipe(
      Effect.sync(() => {
        const product = repository.get(command.aggregateId as string);
        if (!product) {
          throw new Error('Product not found');
        }
        
        product.stock += command.payload.quantity;
        product.updatedAt = new Date();
        product.version++;
        
        repository.save(product);
        return { newStock: product.stock };
      }),
      Effect.catchAll((error) => Effect.fail(error))
    )
};

const removeStockHandler = {
  handle: (command: RemoveStockCommand) =>
    pipe(
      Effect.sync(() => {
        const product = repository.get(command.aggregateId as string);
        if (!product) {
          throw new Error('Product not found');
        }
        
        if (product.stock < command.payload.quantity) {
          throw new Error('Insufficient stock');
        }
        
        product.stock -= command.payload.quantity;
        product.updatedAt = new Date();
        product.version++;
        
        repository.save(product);
        return { newStock: product.stock };
      }),
      Effect.catchAll((error) => Effect.fail(error))
    )
};

const discontinueProductHandler = {
  handle: (command: DiscontinueProductCommand) =>
    pipe(
      Effect.sync(() => {
        const product = repository.get(command.aggregateId as string);
        if (!product) {
          throw new Error('Product not found');
        }
        
        product.status = 'discontinued';
        product.updatedAt = new Date();
        product.version++;
        
        repository.save(product);
        return { success: true };
      }),
      Effect.catchAll((error) => Effect.fail(error))
    )
};

// ============================================================================
// Demo Execution
// ============================================================================

const runDemo = pipe(
  Effect.succeed({}),
  Effect.tap(() => Effect.sync(() => {
    console.log('\n🚀 Product Domain Demo with Effect-TS\n');
    console.log('=' .repeat(50));
    console.log();
  })),
  
  // Step 1: Create Product
  Effect.flatMap(() => {
    console.log('1. Creating a new product...');
    const createCommand: CreateProductCommand = {
      type: ProductCommandType.CREATE_PRODUCT,
      aggregateId: aggregateId('temp'),
      payload: {
        name: 'MacBook Pro M3',
        description: 'Latest MacBook Pro with M3 chip',
        sku: 'MBP-M3-2024',
        price: 2499.99,
        initialStock: 50,
        category: 'Electronics',
      },
    };
    
    return pipe(
      createProductHandler.handle(createCommand),
      Effect.tap((result) => Effect.sync(() => 
        console.log(`   ✅ Product created with ID: ${result.productId}\n`)
      )),
      Effect.map((result) => result.productId)
    );
  }),
  
  // Step 2: Add Stock
  Effect.flatMap((productId) => {
    console.log('2. Adding stock to the product...');
    const addStockCommand: AddStockCommand = {
      type: ProductCommandType.ADD_STOCK,
      aggregateId: aggregateId(productId),
      payload: {
        quantity: 25,
        reason: 'New shipment received',
      },
    };
    
    return pipe(
      addStockHandler.handle(addStockCommand),
      Effect.tap((result) => Effect.sync(() => 
        console.log(`   ✅ Stock added. New stock level: ${result.newStock}\n`)
      )),
      Effect.map(() => productId)
    );
  }),
  
  // Step 3: Remove Stock
  Effect.flatMap((productId) => {
    console.log('3. Processing a sale (removing stock)...');
    const removeStockCommand: RemoveStockCommand = {
      type: ProductCommandType.REMOVE_STOCK,
      aggregateId: aggregateId(productId),
      payload: {
        quantity: 5,
        reason: 'Customer purchase',
      },
    };
    
    return pipe(
      removeStockHandler.handle(removeStockCommand),
      Effect.tap((result) => Effect.sync(() => 
        console.log(`   ✅ Stock removed. New stock level: ${result.newStock}\n`)
      )),
      Effect.map(() => productId)
    );
  }),
  
  // Step 4: Update Price
  Effect.flatMap((productId) => {
    console.log('4. Updating product price...');
    const updateCommand: UpdateProductCommand = {
      type: ProductCommandType.UPDATE_PRODUCT,
      aggregateId: aggregateId(productId),
      payload: {
        price: 2299.99,
      },
    };
    
    return pipe(
      updateProductHandler.handle(updateCommand),
      Effect.tap(() => Effect.sync(() => 
        console.log('   ✅ Price updated successfully\n')
      )),
      Effect.map(() => productId)
    );
  }),
  
  // Step 5: Show Final State
  Effect.tap((productId) => Effect.sync(() => {
    console.log('5. Retrieving current product state...');
    const product = repository.get(productId);
    if (product) {
      console.log('   Current State:');
      console.log(`   - Name: ${product.name}`);
      console.log(`   - SKU: ${product.sku}`);
      console.log(`   - Price: $${product.price}`);
      console.log(`   - Stock: ${product.stock}`);
      console.log(`   - Status: ${product.status}`);
      console.log(`   - Version: ${product.version}`);
      console.log();
    }
    
    console.log('=' .repeat(50));
    console.log('✅ Demo completed successfully!\n');
  }))
);

// Run the demo
Effect.runPromise(runDemo).then(
  () => {
    console.log('Demo finished');
    process.exit(0);
  },
  (error: any) => {
    console.error('Demo failed:', error);
    process.exit(1);
  }
);