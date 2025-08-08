/**
 * Simple Framework Demo
 * 
 * Demonstrates the new KISS-compliant framework API
 */

import { 
  createEventStore, 
  createCommandBus, 
  createEventBus,
  createQueryBus,
  DomainBuilder,
  type ICommand,
  type IQuery,
  type IEvent,
  type ICommandHandler,
  type IQueryHandler
} from '../framework';

// Define simple domain types
interface UserCreatedEvent extends IEvent {
  type: 'USER_CREATED';
  data: { id: string; name: string; email: string };
}

interface CreateUserCommand extends ICommand {
  type: 'CREATE_USER';
  payload: { name: string; email: string };
}

interface GetUserQuery extends IQuery {
  type: 'GET_USER';
  parameters: { id: string };
}

// Simple handlers
const createUserHandler: ICommandHandler<CreateUserCommand> = {
  canHandle: (cmd) => cmd.type === 'CREATE_USER',
  async handle(command) {
    console.log(`Creating user: ${command.payload.name}`);
    return { success: true, data: { id: 'user-123' } };
  }
};

const getUserHandler: IQueryHandler<GetUserQuery, { name: string; email: string }> = {
  canHandle: (query) => query.type === 'GET_USER',
  async handle(query) {
    console.log(`Getting user: ${query.parameters.id}`);
    return { name: 'John Doe', email: 'john@example.com' };
  }
};

const userCreatedHandler = async (event: UserCreatedEvent) => {
  console.log(`User created event: ${event.data.name}`);
};

async function main() {
  console.log('🚀 Simple Framework Demo');
  console.log('========================\n');

  // 1. Create infrastructure
  const eventStore = createEventStore<UserCreatedEvent>();
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();
  const eventBus = createEventBus<UserCreatedEvent>();

  const context = {
    eventStore,
    commandBus,
    queryBus,
    eventBus,
  };

  // 2. Build domain using simple API (much cleaner than before!)
  const userDomain = DomainBuilder
    .forDomain<UserCreatedEvent, CreateUserCommand, GetUserQuery>('User')
    .withCommandHandlers({ 
      CreateUserCommandHandler: createUserHandler 
    })
    .withQueryHandlers({ 
      GetUserQueryHandler: getUserHandler 
    })
    .withEventHandlers(userCreatedHandler)
    .build(context);

  console.log(`\n✅ Domain built successfully!`);
  console.log(`📊 Total components: ${
    userDomain.commandHandlers.size + 
    userDomain.queryHandlers.size + 
    userDomain.eventHandlers.length
  }`);

  // 3. Test the system
  console.log('\n🧪 Testing the system...');
  
  const command: CreateUserCommand = {
    type: 'CREATE_USER',
    payload: { name: 'Jane Doe', email: 'jane@example.com' },
  };

  const result = await commandBus.send(command);
  console.log('Command result:', result);

  const query: GetUserQuery = {
    type: 'GET_USER',
    parameters: { id: 'user-123' },
  };

  const queryResult = await queryBus.ask(query);
  console.log('Query result:', queryResult);

  console.log('\n✅ Demo completed! The new API is much simpler and cleaner.');
}

// Run the demo
main().catch(console.error);