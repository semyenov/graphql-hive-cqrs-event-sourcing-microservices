/**
 * User Domain: Aggregate Tests
 * 
 * Tests for user aggregate behavior and event sourcing.
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import { UserAggregate } from '../aggregates/user';
import { BrandedTypes } from '../../../framework/core/branded';
import { UserBrandedTypes } from '../helpers/factories';
import { UserEventFactories } from '../events/factories';
import { UserEventTypes, UserEvent } from '../events/types';
import { TestFramework } from '../../../framework/testing/harness';
import { UserRepository } from '../aggregates/repository';

describe('UserAggregate', () => {
  const userId = BrandedTypes.aggregateId('user-123');
  let testFramework: TestFramework<UserEvent, UserAggregate>;
  let userRepository: UserRepository;

  beforeEach(async () => {
    testFramework = new TestFramework<UserEvent, UserAggregate>();
    await testFramework.setup();
    userRepository = new UserRepository(testFramework.eventStore);
  });
  
  describe('create', () => {
    test('should create a new user', async () => {
      const aggregate = new UserAggregate(userId);
      
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserCreated);
      expect(aggregate.state?.name).toBe(UserBrandedTypes.personName('John Doe'));
      expect(aggregate.state?.email).toBe(UserBrandedTypes.email('john@example.com'));
      expect(aggregate.state?.emailVerified).toBe(false);
      expect(aggregate.state?.deleted).toBe(false);
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should throw error if user already exists', async () => {
      const aggregate = new UserAggregate(userId);
      
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });

      await testFramework.saveAggregate(userRepository, aggregate);
      
      expect(() => {
        aggregate.create({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });
      }).toThrow('User already exists');
    });
  });
  
  describe('update', () => {
    test('should update user name', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      aggregate.update({ name: 'John Smith' });
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserUpdated);
      expect(aggregate.state?.name).toBe(UserBrandedTypes.personName('John Smith'));
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should update user email and reset verification', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.verifyEmail();
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      expect(aggregate.state?.emailVerified).toBe(true);
      
      aggregate.update({ email: 'newemail@example.com' });
      
      expect(aggregate.state?.email).toBe(UserBrandedTypes.email('newemail@example.com'));
      expect(aggregate.state?.emailVerified).toBe(false);
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should throw error if no updates provided', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      
      expect(() => {
        aggregate.update({});
      }).toThrow('No updates provided');
    });
    
    test('should throw error if user not found', async () => {
      const aggregate = new UserAggregate(userId);
      
      expect(() => {
        aggregate.update({ name: 'John Doe' });
      }).toThrow('User not found or deleted');
    });
  });
  
  describe('delete', () => {
    test('should delete user', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      aggregate.delete('Account closure requested');
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserDeleted);
      expect(aggregate.state?.deleted).toBe(true);
      expect(aggregate.isDeleted()).toBe(true);
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should throw error if user already deleted', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.delete();
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      expect(() => {
        aggregate.delete();
      }).toThrow('User not found or deleted');
    });
  });
  
  describe('verifyEmail', () => {
    test('should verify user email', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      aggregate.verifyEmail();
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserEmailVerified);
      expect(aggregate.state?.emailVerified).toBe(true);
      expect(aggregate.isEmailVerified()).toBe(true);
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should throw error if email already verified', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.verifyEmail();
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      expect(() => {
        aggregate.verifyEmail();
      }).toThrow('Email already verified');
    });
  });
  
  describe('updateProfile', () => {
    test('should update user profile', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      aggregate.updateProfile({
        bio: 'Software developer',
        avatar: 'https://example.com/avatar.jpg',
        location: 'New York',
      });
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserProfileUpdated);
      expect(aggregate.state?.profile?.bio).toBe('Software developer');
      expect(aggregate.state?.profile?.avatar).toBe('https://example.com/avatar.jpg');
      expect(aggregate.state?.profile?.location).toBe('New York');
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should merge profile updates', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.updateProfile({
        bio: 'Software developer',
        location: 'New York',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      aggregate.updateProfile({
        avatar: 'https://example.com/avatar.jpg',
      });
      
      expect(aggregate.state?.profile?.bio).toBe('Software developer');
      expect(aggregate.state?.profile?.avatar).toBe('https://example.com/avatar.jpg');
      expect(aggregate.state?.profile?.location).toBe('New York');
      await testFramework.saveAggregate(userRepository, aggregate);
    });
  });
  
  describe('event sourcing', () => {
    test('should rebuild state from events', async () => {
      const aggregate = new UserAggregate(userId);
      
      // Create events
      const events = [
        UserEventFactories.createUserCreated(userId, {
          name: 'John Doe',
          email: 'john@example.com',
        }),
        UserEventFactories.createUserUpdated(userId, BrandedTypes.eventVersion(2), {
          name: 'John Smith',
        }),
        UserEventFactories.createEmailVerified(userId, BrandedTypes.eventVersion(3)),
        UserEventFactories.createProfileUpdated(userId, BrandedTypes.eventVersion(4), {
          bio: 'Developer',
        }),
      ];
      
      // Load from history
      aggregate.loadFromHistory(events);
      
      // Verify state
      expect(aggregate.state?.name).toBe(UserBrandedTypes.personName('John Smith'));
      expect(aggregate.state?.email).toBe(UserBrandedTypes.email('john@example.com'));
      expect(aggregate.state?.emailVerified).toBe(true);
      expect(aggregate.state?.profile?.bio).toBe('Developer');
      expect(aggregate.version).toBe(4);
      expect(aggregate.uncommittedEvents).toHaveLength(0);
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('should create and load snapshot', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.verifyEmail();
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.markEventsAsCommitted();
      
      // Create snapshot
      const snapshot = aggregate.createSnapshot();
      
      expect(snapshot.aggregateId).toBe(userId);
      expect(snapshot.version).toBe(BrandedTypes.eventVersion(2));
      expect(snapshot.state).toEqual(aggregate.state!);
      
      // Load snapshot into new aggregate
      const newAggregate = new UserAggregate(userId);
      newAggregate.loadFromSnapshot(snapshot);
      
      expect(newAggregate.state).toEqual(aggregate.state);
      expect(newAggregate.version).toBe(2);
      await testFramework.saveAggregate(userRepository, newAggregate);
    });

    test('should apply events after snapshot', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({ name: 'Initial', email: 'initial@test.com' });
      await testFramework.saveAggregate(userRepository, aggregate);
      const snapshot = aggregate.createSnapshot();
      
      const newAggregate = new UserAggregate(userId);
      newAggregate.loadFromSnapshot(snapshot);

      const event = UserEventFactories.createUserUpdated(userId, BrandedTypes.eventVersion(2), { name: 'Updated' });
      newAggregate.applyEvent(event);

      expect(newAggregate.version).toBe(2);
      expect(newAggregate.state?.name).toBe(UserBrandedTypes.personName('Updated'));
      await testFramework.saveAggregate(userRepository, newAggregate);
    });
  });
  
  describe('queries', () => {
    test('getUser should return null for deleted user', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      aggregate.delete();
      
      expect(aggregate.getUser()).toBeNull();
      await testFramework.saveAggregate(userRepository, aggregate);
    });
    
    test('getUser should return user state for active user', async () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      await testFramework.saveAggregate(userRepository, aggregate);
      
      const user = aggregate.getUser();
      
      expect(user).not.toBeNull();
      expect(user?.name).toBe(UserBrandedTypes.personName('John Doe'));
      expect(user?.email).toBe(UserBrandedTypes.email('john@example.com'));
      await testFramework.saveAggregate(userRepository, aggregate);
    });
  });
});