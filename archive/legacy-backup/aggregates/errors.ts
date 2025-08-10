import { DomainError } from "../../../framework";

export class UserAlreadyExistsError extends DomainError {
  constructor() {
    super('User already exists');
    this.name = 'UserAlreadyExistsError';
  }
}

export class EmailAlreadyVerifiedError extends DomainError {
  constructor() {
    super('Email already verified');
    this.name = 'EmailAlreadyVerifiedError';
  }
} 