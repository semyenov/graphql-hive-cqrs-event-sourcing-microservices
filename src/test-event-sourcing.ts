#!/usr/bin/env bun

import { eventStore } from './repositories';
import { UserAggregate } from './events/UserAggregate';
import { BrandedTypes } from './types';
import { 
  isUserCreatedEvent, 
  isUserUpdatedEvent, 
  isUserDeletedEvent,
  matchEvent,
  foldEvents,
  type UserEvent,
} from './events/generic-types';

// Test Event Sourcing functionality
const testEventSourcing = async () => {
  console.log('🔍 Testing Event Sourcing System...\n');

  // Test 1: Create aggregate and emit events
  console.log('1️⃣ Creating user aggregate and events...');
  const aggregateId = BrandedTypes.aggregateId('test-user-123');
  const aggregate = new UserAggregate(aggregateId);

  // Create user
  aggregate.create({
    name: 'Alice Johnson',
    email: 'alice@example.com',
  });

  console.log(`Created aggregate with ${aggregate.getUncommittedEvents().length} uncommitted events`);

  // Update user
  aggregate.update({
    name: 'Alice Smith',
  });

  console.log(`After update: ${aggregate.getUncommittedEvents().length} uncommitted events`);

  // Test 2: Event type guards
  console.log('\n2️⃣ Testing event type guards...');
  const events = aggregate.getUncommittedEvents();
  
  events.forEach((event, index) => {
    console.log(`\nEvent ${index + 1}:`);
    console.log(`  Type: ${event.type}`);
    console.log(`  Version: ${event.version}`);
    
    if (isUserCreatedEvent(event)) {
      console.log(`  ✅ UserCreated - Name: ${event.data.name}, Email: ${event.data.email}`);
    } else if (isUserUpdatedEvent(event)) {
      console.log(`  ✅ UserUpdated - Changes:`, event.data);
    } else if (isUserDeletedEvent(event)) {
      console.log(`  ✅ UserDeleted`);
    }
  });

  // Test 3: Pattern matching
  console.log('\n3️⃣ Testing pattern matching...');
  events.forEach(event => {
    const description = matchEvent(event as UserEvent, {
      UserCreated: (e) => `New user "${e.data.name}" with email ${e.data.email}`,
      UserUpdated: (e) => `Updated user: ${JSON.stringify(e.data)}`,
      UserDeleted: () => 'User deleted',
    });
    console.log(`  ${description}`);
  });

  // Test 4: Event persistence
  console.log('\n4️⃣ Testing event persistence...');
  
  // Get all events before saving
  const eventsBefore = await eventStore.getAllEvents();
  console.log(`Events in store before save: ${eventsBefore.length}`);
  
  // Mark events as committed (simulating save)
  aggregate.markEventsAsCommitted();
  
  // Append events to store
  for (const event of events) {
    await eventStore.append(event as UserEvent);
  }
  
  const eventsAfter = await eventStore.getAllEvents();
  console.log(`Events in store after save: ${eventsAfter.length}`);

  // Test 5: Event replay
  console.log('\n5️⃣ Testing event replay...');
  const storedEvents = await eventStore.getEvents(aggregateId);
  console.log(`Retrieved ${storedEvents.length} events for aggregate ${aggregateId}`);

  // Filter to only user events for the user aggregate
  const userEvents = storedEvents.filter(event => 
    event.type === 'UserCreated' || 
    event.type === 'UserUpdated' || 
    event.type === 'UserDeleted'
  );

  // Create new aggregate from events
  const replayedAggregate = new UserAggregate(aggregateId);
  userEvents.forEach(event => replayedAggregate.applyEvent(event as any, false));

  const user = replayedAggregate.getUser();
  console.log('Replayed user state:', user);

  // Test 6: Event folding
  console.log('\n6️⃣ Testing event folding...');
  
  interface UserState {
    exists: boolean;
    name?: string;
    email?: string;
    updateCount: number;
  }

  const initialState: UserState = { exists: false, updateCount: 0 };
  
  const finalState = foldEvents(
    userEvents,  // Use the filtered user events instead of all events
    (state, event) => {
      return matchEvent(event, {
        UserCreated: (e) => ({
          exists: true,
          name: e.data.name,
          email: e.data.email,
          updateCount: 0,
        }),
        UserUpdated: (e) => ({
          ...state!,
          ...(e.data.name && { name: e.data.name }),
          ...(e.data.email && { email: e.data.email }),
          updateCount: state!.updateCount + 1,
        }),
        UserDeleted: () => ({
          exists: false,
          updateCount: state!.updateCount,
        }),
      });
    },
    initialState
  );

  console.log('Final state from fold:', finalState);

  // Test 7: Event stream statistics
  console.log('\n7️⃣ Event stream statistics...');
  const allEvents = await eventStore.getAllEvents();
  
  const stats = allEvents.reduce((acc, event) => {
    acc.total++;
    acc.byType[event.type] = (acc.byType[event.type] || 0) + 1;
    return acc;
  }, { total: 0, byType: {} as Record<string, number> });

  console.log('Event statistics:', stats);

  console.log('\n✅ Event sourcing tests completed!');
};

// Test Event Sourcing patterns
const testAdvancedPatterns = async () => {
  console.log('\n🎯 Testing Advanced Event Sourcing Patterns...\n');

  // Test: Multiple aggregates
  console.log('Testing multiple aggregates...');
  
  const user1 = new UserAggregate(BrandedTypes.aggregateId('user-1'));
  const user2 = new UserAggregate(BrandedTypes.aggregateId('user-2'));
  
  user1.create({ name: 'User One', email: 'one@example.com' });
  user2.create({ name: 'User Two', email: 'two@example.com' });
  
  // Save both
  for (const event of user1.getUncommittedEvents()) {
    await eventStore.append(event as UserEvent);
  }
  for (const event of user2.getUncommittedEvents()) {
    await eventStore.append(event as UserEvent);
  }
  
  // Query specific aggregate
  const user1Events = await eventStore.getEvents(BrandedTypes.aggregateId('user-1'));
  const user2Events = await eventStore.getEvents(BrandedTypes.aggregateId('user-2'));
  
  console.log(`User 1 events: ${user1Events.length}`);
  console.log(`User 2 events: ${user2Events.length}`);
  
  // Test: Event ordering
  console.log('\nVerifying event ordering...');
  const allEvents = await eventStore.getAllEvents();
  let isOrdered = true;
  
  for (let i = 1; i < allEvents.length; i++) {
    const currentEvent = allEvents[i];
    const previousEvent = allEvents[i-1];
    if (currentEvent && previousEvent && currentEvent.timestamp < previousEvent.timestamp) {
      isOrdered = false;
      break;
    }
  }
  
  console.log(`Events are chronologically ordered: ${isOrdered ? '✅' : '❌'}`);
};

// Run all tests
const runTests = async () => {
  try {
    await testEventSourcing();
    await testAdvancedPatterns();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Execute if run directly
if (import.meta.main) {
  runTests();
}