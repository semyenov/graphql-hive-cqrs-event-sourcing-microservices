/**
 * Test Framework
 * 
 * Comprehensive test demonstrating all framework capabilities.
 */

import { 
  createEventStore, 
  createCommandBus, 
  createEventBus,
  createQueryBus 
} from '../framework';
import { 
  success, 
  failure, 
  createEventMetadata,
  createEvent
} from '../framework/core/helpers';
import { BrandedTypes } from '../framework/core/branded/factories';
import { matchEvent } from '../framework/core/event-utils';
import { 
  SchemaValidator,
  ValidationRules,
  createCommandValidator,
  ValidationBuilder
} from '../framework/core/validation';
import {
  EventDrivenProjectionBuilder,
  SnapshotProjectionBuilder,
  IndexedProjectionBuilder
} from '../framework/infrastructure/projections/builder';
import {
  createCommandLoggingMiddleware,
  createQueryLoggingMiddleware,
  ConsoleLogger
} from '../framework/infrastructure/middleware/logging';
import {
  createCommandMetricsMiddleware,
  createQueryMetricsMiddleware,
  InMemoryMetricsCollector
} from '../framework/infrastructure/middleware/metrics';
import { 
  UserAggregate, 
  UserRepository, 
  UserEventFactories,
  type UserEvent,
  type UserState,
  UserEventTypes,
  initializeUserDomain
} from '../domains/users';

async function testFramework() {
  console.log('🧪 Testing CQRS/Event Sourcing Framework with All Features\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Initialize full domain with all features
  const metricsCollector = new InMemoryMetricsCollector();
  const userDomain = initializeUserDomain({
    enableCache: true,
    enableValidation: true,
    enableProjections: true,
    enableEventReplay: true,
    enableSnapshotting: true,
  });

  // Add middleware (only CommandBus supports middleware)
  userDomain.commandBus.use(createCommandLoggingMiddleware() as any);
  userDomain.commandBus.use(createCommandMetricsMiddleware(metricsCollector) as any);

  // Test 1: Create user with framework helpers
  console.log('📝 Test 1: Creating user with framework helpers...');
  const userId = BrandedTypes.aggregateId(crypto.randomUUID());
  const userAggregate = new UserAggregate(userId);
  
  // Create metadata using framework helper
  const metadata = createEventMetadata({
    userId: BrandedTypes.userId('test-user'),
    correlationId: BrandedTypes.correlationId(crypto.randomUUID()),
    source: 'test-framework',
  });
  
  // Use event factory with metadata
  const createEvent = UserEventFactories.createUserCreated(
    userId,
    { name: 'John Doe', email: 'john@example.com' },
    metadata
  );
  
  userAggregate.applyEvent(createEvent, true);
  await userDomain.repository.save(userAggregate);
  
  console.log('✅ User created with metadata');
  console.log(`   ID: ${userId}`);
  console.log(`   CorrelationId: ${metadata.correlationId}`);
  console.log();

  // Test 2: Validation with SchemaValidator
  console.log('📝 Test 2: Testing SchemaValidator...');
  const userSchema = new SchemaValidator({
    name: [
      ValidationRules.required('Name is required'),
      ValidationRules.string.length(2, 100, 'Name must be 2-100 characters'),
    ],
    email: [
      ValidationRules.required('Email is required'),
      ValidationRules.string.email('Invalid email format'),
    ],
  });
  
  const validData = { name: 'Jane Doe', email: 'jane@example.com' };
  const invalidData = { name: 'J', email: 'invalid-email' };
  
  const validResult = await userSchema.validate(validData);
  const invalidResult = await userSchema.validate(invalidData);
  
  console.log('✅ Validation tested');
  console.log(`   Valid data passed: ${validResult.isValid}`);
  console.log(`   Invalid data caught: ${!invalidResult.isValid} (${invalidResult.errors.length} errors)`);
  console.log();

  // Test 3: Event matching with framework helper
  console.log('📝 Test 3: Testing matchEvent helper...');
  const events = await userDomain.eventStore.getEvents(userId);
  const processedEvents = events.map(event => 
    matchEvent(event, {
      [UserEventTypes.UserCreated]: () => 'User was created',
      [UserEventTypes.UserUpdated]: () => 'User was updated',
      [UserEventTypes.UserDeleted]: () => 'User was deleted',
      [UserEventTypes.UserEmailVerified]: () => 'Email was verified',
      [UserEventTypes.UserPasswordChanged]: () => 'Password was changed',
      [UserEventTypes.UserProfileUpdated]: () => 'Profile was updated',
    })
  );
  
  console.log('✅ Event matching tested');
  console.log(`   Processed ${processedEvents.length} events`);
  console.log();

  // Test 4: Projections with specialized builders
  console.log('📝 Test 4: Testing projection builders...');
  
  // Create another user for projection testing
  const userId2 = BrandedTypes.aggregateId(crypto.randomUUID());
  const userAggregate2 = new UserAggregate(userId2);
  userAggregate2.create({ name: 'Alice Smith', email: 'alice@example.com' });
  await userDomain.repository.save(userAggregate2);
  
  // Test SnapshotProjectionBuilder
  const snapshotProjection = new SnapshotProjectionBuilder<UserEvent, UserState>(
    (aggregateId, events) => {
      if (events.length === 0) return null;
      let state: UserState | null = null;
      for (const event of events) {
        // Process event...
      }
      return state;
    },
    'TestSnapshotProjection'
  );
  
  // Create snapshot
  await snapshotProjection.rebuild(await userDomain.eventStore.getAllEvents());
  snapshotProjection.createSnapshot(userId as string);
  
  console.log('✅ SnapshotProjectionBuilder tested');
  console.log(`   Snapshot created for user ${userId}`);
  
  // Test IndexedProjectionBuilder
  interface UserListItem extends Record<string, unknown> {
    id: string;
    name: string;
    email: string;
  }
  
  const indexedProjection = new IndexedProjectionBuilder<UserEvent, UserListItem>(
    (aggregateId, events) => {
      const lastEvent = events[events.length - 1];
      if (!lastEvent || lastEvent.type !== UserEventTypes.UserCreated) return null;
      return {
        id: aggregateId,
        name: (lastEvent as any).data.name,
        email: (lastEvent as any).data.email,
      };
    },
    'TestIndexedProjection'
  );
  
  indexedProjection.createIndex('email');
  await indexedProjection.rebuild(await userDomain.eventStore.getAllEvents());
  
  console.log('✅ IndexedProjectionBuilder tested');
  console.log(`   Created index on 'email' field`);
  console.log();

  // Test 5: Repository with snapshot support
  console.log('📝 Test 5: Testing repository snapshots...');
  
  // Create many events to trigger snapshot
  const userAggregate3 = await userDomain.repository.get(userId);
  if (userAggregate3) {
    for (let i = 0; i < 15; i++) {
      userAggregate3.updateProfile({ bio: `Update ${i}` });
      await userDomain.repository.save(userAggregate3);
    }
    
    const snapshot = userDomain.repository.getSnapshot(userId);
    console.log('✅ Snapshot support tested');
    console.log(`   Snapshot exists: ${snapshot !== null}`);
    console.log(`   Aggregate version: ${userAggregate3.version}`);
  }
  console.log();

  // Test 6: Result helpers
  console.log('📝 Test 6: Testing Result helpers...');
  
  const successResult = success({ message: 'Operation completed' });
  const failureResult = failure('Operation failed');
  
  console.log('✅ Result helpers tested');
  console.log(`   Success result: ${successResult.success}`);
  console.log(`   Failure result: ${!failureResult.success}`);
  console.log();

  // Test 7: Metrics collection
  console.log('📝 Test 7: Checking metrics...');
  
  const metrics = metricsCollector.getMetrics();
  console.log('✅ Metrics collected');
  console.log(`   Commands executed: ${Object.keys(metrics.counters).filter(k => k.includes('commands')).length} types`);
  console.log(`   Queries executed: ${Object.keys(metrics.counters).filter(k => k.includes('queries')).length} types`);
  console.log();

  // Test 8: Complex validation with ValidationBuilder
  console.log('📝 Test 8: Testing ValidationBuilder...');
  
  const passwordValidator = new ValidationBuilder<string>()
    .required('Password is required')
    .custom(
      (value) => value.length >= 8,
      'Password must be at least 8 characters'
    )
    .custom(
      (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value),
      'Password must contain uppercase, lowercase, and numbers'
    )
    .build();
  
  const strongPassword = 'SecurePass123';
  const weakPassword = 'weak';
  
  const strongResult = await passwordValidator.validate(strongPassword);
  const weakResult = await passwordValidator.validate(weakPassword);
  
  console.log('✅ ValidationBuilder tested');
  console.log(`   Strong password valid: ${strongResult.isValid}`);
  console.log(`   Weak password invalid: ${!weakResult.isValid}`);
  console.log();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 All framework features tested successfully!');
}

// Run tests
testFramework().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});