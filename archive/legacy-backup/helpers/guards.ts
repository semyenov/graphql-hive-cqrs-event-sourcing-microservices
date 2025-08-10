import type * as Types from './types';

export const UserBrandedTypeGuards = {
  isUserId: (value: unknown): value is Types.UserId => {
    return typeof value === 'string' && value.length > 0;
  },
  isEmail: (value: unknown): value is Types.Email => {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
  isPersonName: (value: unknown): value is Types.PersonName => {
    return typeof value === 'string' && 
           value.trim().length >= 2 && 
           value.length <= 100;
  },
  isPhoneNumber: (value: unknown): value is Types.PhoneNumber => {
    return typeof value === 'string' && 
           /^[\d\s\-\+\(\)]+$/.test(value) && 
           value.length >= 10;
  }
} 