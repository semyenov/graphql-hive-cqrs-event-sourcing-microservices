import type { Brand } from '../../../framework/core/branded/types';

/**
 * Branded types for the User domain.
 */
export type UserId = Brand<string, 'UserId'>;
export type Email = Brand<string, 'Email'>;
export type PersonName = Brand<string, 'PersonName'>;
export type PhoneNumber = Brand<string, 'PhoneNumber'>; 