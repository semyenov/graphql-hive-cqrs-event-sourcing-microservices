/**
 * Framework Builder Demo
 * 
 * Demonstrates the complete framework builder pattern for setting up
 * a multi-domain CQRS application with minimal configuration.
 */

import { Framework } from '../framework/core/framework-builder';
import type { IEvent, ICommand, IQuery, ICommandHandler, IQueryHandler } from '../framework';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Events
interface UserEvent extends IEvent {
  type: 'USER_CREATED' | 'USER_UPDATED';
  data: { id: string; name: string; email?: string };
}

interface ProductEvent extends IEvent {
  type: 'PRODUCT_CREATED' | 'PRODUCT_UPDATED';
  data: { id: string; name: string; price: number };
}

// Commands  
interface CreateUserCommand extends ICommand {
  type: 'CREATE_USER';
  payload: { id: string; name: string; email: string };
}

interface CreateProductCommand extends ICommand {
  type: 'CREATE_PRODUCT';
  payload: { id: string; name: string; price: number };
}

// Queries
interface GetUserQuery extends IQuery {
  type: 'GET_USER';
  parameters: { id: string };
}

interface GetProductQuery extends IQuery {
  type: 'GET_PRODUCT';
  parameters: { id: string };
}

// Union types
type AppEvent = UserEvent | ProductEvent;
type AppCommand = CreateUserCommand | CreateProductCommand;
type AppQuery = GetUserQuery | GetProductQuery;

// =============================================================================
// HANDLERS (Simple implementations)
// =============================================================================

const userStore = new Map();
const productStore = new Map();

const createUserHandler: ICommandHandler<CreateUserCommand> = {
  canHandle: (cmd) => cmd.type === 'CREATE_USER',
  async handle(command) {
    userStore.set(command.payload.id, command.payload);
    console.log(`👤 Created user: ${command.payload.name}`);
    return { success: true, data: command.payload };
  }
};

const createProductHandler: ICommandHandler<CreateProductCommand> = {
  canHandle: (cmd) => cmd.type === 'CREATE_PRODUCT',
  async handle(command) {
    productStore.set(command.payload.id, command.payload);
    console.log(`📦 Created product: ${command.payload.name} - $${command.payload.price}`);
    return { success: true, data: command.payload };
  }
};

const getUserHandler: IQueryHandler<GetUserQuery, any> = {
  canHandle: (query) => query.type === 'GET_USER',
  async handle(query) {
    const user = userStore.get(query.parameters.id);
    console.log(`👤 Retrieved user: ${user?.name || 'Not found'}`);
    return user || null;
  }
};

const getProductHandler: IQueryHandler<GetProductQuery, any> = {
  canHandle: (query) => query.type === 'GET_PRODUCT',
  async handle(query) {
    const product = productStore.get(query.parameters.id);
    console.log(`📦 Retrieved product: ${product?.name || 'Not found'}`);
    return product || null;
  }
};

// =============================================================================
// APPLICATION SETUP
// =============================================================================

async function main() {
  console.log('🏗️  Framework Builder Demo');
  console.log('==========================\n');

  // 1. Create application using Framework Builder pattern
  console.log('⚡ Step 1: Building application...');
  
  const app = Framework
    .development<AppEvent, AppCommand, AppQuery>('E-Commerce Demo')
    .withDomain(builder => 
      builder
        .withCommandHandlers({ 
          CreateUserCommandHandler: createUserHandler 
        })
        .withQueryHandlers({ 
          GetUserQueryHandler: getUserHandler 
        })
        .withEventHandlers(
          async (event: AppEvent) => {
            if (event.type.startsWith('USER_')) {
              console.log(`📢 User event: ${event.type}`);
            }
          }
        )
    )
    .withDomain(builder =>
      builder
        .withCommandHandlers({ 
          CreateProductCommandHandler: createProductHandler 
        })
        .withQueryHandlers({ 
          GetProductQueryHandler: getProductHandler 
        })
        .withEventHandlers(
          async (event: AppEvent) => {
            if (event.type.startsWith('PRODUCT_')) {
              console.log(`📢 Product event: ${event.type}`);
            }
          }
        )
    )
    .build();

  // 2. Start the application
  console.log('\n🟢 Step 2: Starting application...');
  await app.start();

  // 3. Test the multi-domain system
  console.log('\n🧪 Step 3: Testing multi-domain operations...');

  // Create user
  console.log('\n👤 Creating user...');
  const createUserCmd: CreateUserCommand = {
    type: 'CREATE_USER',
    payload: { id: 'user-1', name: 'Alice Johnson', email: 'alice@example.com' }
  };
  const userResult = await app.commands.send(createUserCmd);
  console.log('   ✅ User created:', userResult.success);

  // Create product
  console.log('\n📦 Creating product...');
  const createProductCmd: CreateProductCommand = {
    type: 'CREATE_PRODUCT',
    payload: { id: 'prod-1', name: 'Laptop', price: 1299.99 }
  };
  const productResult = await app.commands.send(createProductCmd);
  console.log('   ✅ Product created:', productResult.success);

  // Query user
  console.log('\n🔍 Querying user...');
  const getUserQuery: GetUserQuery = {
    type: 'GET_USER',
    parameters: { id: 'user-1' }
  };
  const user = await app.queries.ask(getUserQuery);
  console.log('   ✅ User retrieved:', user ? (user as any).name : 'null');

  // Query product
  console.log('\n🔍 Querying product...');
  const getProductQuery: GetProductQuery = {
    type: 'GET_PRODUCT',
    parameters: { id: 'prod-1' }
  };
  const product = await app.queries.ask(getProductQuery);
  console.log('   ✅ Product retrieved:', product ? `${(product as any).name} ($${(product as any).price})` : 'null');

  // 4. Check application health
  console.log('\n❤️  Step 4: Checking application health...');
  const health = app.getHealth();
  console.log('   Status:', health.status);
  console.log('   Details:', health.details);

  // 5. Demonstrate framework capabilities
  console.log('\n📊 Step 5: Framework capabilities summary...');
  console.log('   ✅ Multi-domain architecture');
  console.log('   ✅ Fluent configuration API');
  console.log('   ✅ Automatic infrastructure setup');
  console.log('   ✅ Development mode features');
  console.log('   ✅ Health monitoring');
  console.log('   ✅ Clean separation of concerns');

  // 6. Stop the application
  console.log('\n🔴 Step 6: Stopping application...');
  await app.stop();

  console.log('\n🎉 Framework Builder demo complete!');
  console.log('=====================================\n');
  
  console.log('💡 Key benefits of Framework Builder:');
  console.log('   • 🏗️  One fluent API to rule them all');
  console.log('   • 📦 Multi-domain applications made easy');
  console.log('   • ⚙️  Sensible defaults with customization');
  console.log('   • 🔧 Development vs production modes');
  console.log('   • 📊 Built-in health and lifecycle management');
  console.log('   • 🧹 Clean, maintainable application structure');
}

// Run the demo
main().catch(console.error);