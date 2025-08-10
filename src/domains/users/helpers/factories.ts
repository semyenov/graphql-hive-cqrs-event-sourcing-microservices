import type * as Types from './types';

export const UserBrandedTypes = {
  userId: (id: string): Types.UserId => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID');
    }
    return id as Types.UserId;
  },
  email: (email: string): Types.Email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase() as Types.Email;
  },
  personName: (name: string): Types.PersonName => {
    if (!name || name.trim().length < 2 || name.length > 100) {
      throw new Error('Person name must be between 2 and 100 characters');
    }
    return name.trim() as Types.PersonName;
  },
  phoneNumber: (phone: string): Types.PhoneNumber => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone) || phone.length < 10) {
      throw new Error('Invalid phone number format');
    }
    return phone as Types.PhoneNumber;
  },
} as const; 