/**
 * User Domain: Aggregate Tests
 * 
 * Tests for user aggregate behavior and event sourcing.
 */

import { test, expect, describe } from 'bun:test';
import { UserAggregate } from '../aggregates/user';
import { BrandedTypes } from '../../../framework/core/branded/factories';
import { UserEventFactories } from '../events/factories';
import { UserEventTypes } from '../events/types';

describe('UserAggregate', () => {
  const userId = BrandedTypes.aggregateId('user-123');
  
  describe('create', () => {
    test('should create a new user', () => {
      const aggregate = new UserAggregate(userId);
      
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserCreated);
      expect(aggregate.state?.name).toBe(BrandedTypes.personName('John Doe'));
      expect(aggregate.state?.email).toBe(BrandedTypes.email('john@example.com'));
      expect(aggregate.state?.emailVerified).toBe(false);
      expect(aggregate.state?.deleted).toBe(false);
    });
    
    test('should throw error if user already exists', () => {
      const aggregate = new UserAggregate(userId);
      
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      
      expect(() => {
        aggregate.create({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });
      }).toThrow('User already exists');
    });
  });
  
  describe('update', () => {
    test('should update user name', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.markEventsAsCommitted();
      
      aggregate.update({ name: 'John Smith' });
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserUpdated);
      expect(aggregate.state?.name).toBe(BrandedTypes.personName('John Smith'));
    });
    
    test('should update user email and reset verification', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.verifyEmail();
      aggregate.markEventsAsCommitted();
      
      expect(aggregate.state?.emailVerified).toBe(true);
      
      aggregate.update({ email: 'newemail@example.com' });
      
      expect(aggregate.state?.email).toBe(BrandedTypes.email('newemail@example.com'));
      expect(aggregate.state?.emailVerified).toBe(false);
    });
    
    test('should throw error if no updates provided', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      
      expect(() => {
        aggregate.update({});
      }).toThrow('No updates provided');
    });
    
    test('should throw error if user not found', () => {
      const aggregate = new UserAggregate(userId);
      
      expect(() => {
        aggregate.update({ name: 'John Doe' });
      }).toThrow('User not found or deleted');
    });
  });
  
  describe('delete', () => {
    test('should delete user', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.markEventsAsCommitted();
      
      aggregate.delete('Account closure requested');
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserDeleted);
      expect(aggregate.state?.deleted).toBe(true);
      expect(aggregate.isDeleted()).toBe(true);
    });
    
    test('should throw error if user already deleted', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.delete();
      aggregate.markEventsAsCommitted();
      
      expect(() => {
        aggregate.delete();
      }).toThrow('User not found or deleted');
    });
  });
  
  describe('verifyEmail', () => {
    test('should verify user email', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.markEventsAsCommitted();
      
      aggregate.verifyEmail();
      
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0].type).toBe(UserEventTypes.UserEmailVerified);
      expect(aggregate.state?.emailVerified).toBe(true);
      expect(aggregate.isEmailVerified()).toBe(true);
    });
    
    test('should throw error if email already verified', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.verifyEmail();
      aggregate.markEventsAsCommitted();
      
      expect(() => {
        aggregate.verifyEmail();
      }).toThrow('Email already verified');
    });
  });
  
  describe('updateProfile', () => {
    test('should update user profile', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
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
    });
    
    test('should merge profile updates', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.updateProfile({
        bio: 'Software developer',
        location: 'New York',
      });
      aggregate.markEventsAsCommitted();
      
      aggregate.updateProfile({
        avatar: 'https://example.com/avatar.jpg',
      });
      
      expect(aggregate.state?.profile?.bio).toBe('Software developer');
      expect(aggregate.state?.profile?.avatar).toBe('https://example.com/avatar.jpg');
      expect(aggregate.state?.profile?.location).toBe('New York');
    });
  });
  
  describe('event sourcing', () => {
    test('should rebuild state from events', () => {
      const aggregate = new UserAggregate(userId);
      
      // Create events
      const events = [
        UserEventFactories.createUserCreated(userId, {
          name: 'John Doe',
          email: 'john@example.com',
        }),
        UserEventFactories.createUserUpdated(userId, 2, {
          name: 'John Smith',
        }),
        UserEventFactories.createEmailVerified(userId, 3),
        UserEventFactories.createProfileUpdated(userId, 4, {
          bio: 'Developer',
        }),
      ];
      
      // Load from history
      aggregate.loadFromHistory(events);
      
      // Verify state
      expect(aggregate.state?.name).toBe(BrandedTypes.personName('John Smith'));
      expect(aggregate.state?.email).toBe(BrandedTypes.email('john@example.com'));
      expect(aggregate.state?.emailVerified).toBe(true);
      expect(aggregate.state?.profile?.bio).toBe('Developer');
      expect(aggregate.version).toBe(4);
      expect(aggregate.uncommittedEvents).toHaveLength(0);
    });
    
    test('should create and load snapshot', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.verifyEmail();
      aggregate.markEventsAsCommitted();
      
      // Create snapshot
      const snapshot = aggregate.createSnapshot();
      
      expect(snapshot.aggregateId).toBe(userId);
      expect(snapshot.version).toBe(BrandedTypes.eventVersion(2));
      expect(snapshot.state).toEqual(aggregate.state);
      
      // Load snapshot into new aggregate
      const newAggregate = new UserAggregate(userId);
      newAggregate.loadFromSnapshot(snapshot);
      
      expect(newAggregate.state).toEqual(aggregate.state);
      expect(newAggregate.version).toBe(2);
    });
  });
  
  describe('queries', () => {
    test('getUser should return null for deleted user', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      aggregate.delete();
      
      expect(aggregate.getUser()).toBeNull();
    });
    
    test('getUser should return user state for active user', () => {
      const aggregate = new UserAggregate(userId);
      aggregate.create({
        name: 'John Doe',
        email: 'john@example.com',
      });
      
      const user = aggregate.getUser();
      
      expect(user).not.toBeNull();
      expect(user?.name).toBe(BrandedTypes.personName('John Doe'));
      expect(user?.email).toBe(BrandedTypes.email('john@example.com'));
    });
  });
});