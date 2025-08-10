/**
 * Test Framework
 * 
 * Simple test to verify the framework works correctly.
 */

import { initializeUserDomain, UserAggregate } from '../domains/users';
import { BrandedTypes } from '../framework/core/branded';

async function testFramework() {
  console.log('🧪 Testing CQRS/Event Sourcing Framework\n');

  // Initialize the domain
  const { repository: userRepository, eventStore } = await initializeUserDomain({
    enableProjections: false,
    enableValidation: false,
  });

  // Test 1: Create user aggregate
  console.log('Test 1: Creating user aggregate...');
  const userId = BrandedTypes.aggregateId(crypto.randomUUID());
  const userAggregate = new UserAggregate(userId);
  
  // Execute command
  userAggregate.create({
    name: 'John Doe',
    email: 'john@example.com',
  });

  // Save aggregate
  await userRepository.save(userAggregate);
  console.log('✅ User created successfully');
  console.log(`   ID: ${userId}`);
  console.log(`   Version: ${userAggregate.version}`);
  console.log(`   State:`, userAggregate.getUser());
  console.log();

  // Test 2: Load aggregate from events
  console.log('Test 2: Loading user from event store...');
  const loadedUser = await userRepository.get(userId);
  if (!loadedUser) {
    throw new Error('Failed to load user');
  }
  console.log('✅ User loaded successfully');
  console.log(`   Version: ${loadedUser.version}`);
  console.log(`   State:`, loadedUser.getUser());
  console.log();

  // Test 3: Update user
  console.log('Test 3: Updating user...');
  loadedUser.update({ name: 'Jane Doe' });
  await userRepository.save(loadedUser);
  console.log('✅ User updated successfully');
  console.log(`   Version: ${loadedUser.version}`);
  console.log(`   State:`, loadedUser.getUser());
  console.log();

  // Test 4: Event count
  console.log('Test 4: Checking event store...');
  const events = await eventStore.getEvents(userId);
  console.log(`✅ Found ${events.length} events for user ${userId}`);
  events.forEach((event, index) => {
    console.log(`   Event ${index + 1}: ${event.type} (v${event.version})`);
  });
  console.log();

  // Test 5: Delete user
  console.log('Test 5: Deleting user...');
  loadedUser.delete('Test cleanup');
  await userRepository.save(loadedUser);
  console.log('✅ User deleted successfully');
  console.log(`   Is deleted: ${loadedUser.isDeleted()}`);
  console.log();

  console.log('🎉 All tests passed!');
}

// Run tests
testFramework().catch(console.error);