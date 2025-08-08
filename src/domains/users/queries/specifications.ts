/**
 * User Domain: Query Specifications
 * 
 * Implementation of the Specification pattern for complex user queries.
 */

import type { ISpecification } from '../../../framework/core/query';
import type { UserState } from '../aggregates/user';

/**
 * Base specification for user queries
 */
abstract class UserSpecification implements ISpecification<UserState> {
  abstract isSatisfiedBy(user: UserState): boolean;

  and(other: ISpecification<UserState>): ISpecification<UserState> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<UserState>): ISpecification<UserState> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<UserState> {
    return new NotSpecification(this);
  }
}

/**
 * Composite specifications
 */
class AndSpecification extends UserSpecification {
  constructor(
    private readonly left: ISpecification<UserState>,
    private readonly right: ISpecification<UserState>
  ) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    return this.left.isSatisfiedBy(user) && this.right.isSatisfiedBy(user);
  }
}

class OrSpecification extends UserSpecification {
  constructor(
    private readonly left: ISpecification<UserState>,
    private readonly right: ISpecification<UserState>
  ) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    return this.left.isSatisfiedBy(user) || this.right.isSatisfiedBy(user);
  }
}

class NotSpecification extends UserSpecification {
  constructor(
    private readonly specification: ISpecification<UserState>
  ) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    return !this.specification.isSatisfiedBy(user);
  }
}

/**
 * Concrete specifications
 */

/**
 * Specification for active (non-deleted) users
 */
export class ActiveUserSpecification extends UserSpecification {
  isSatisfiedBy(user: UserState): boolean {
    return !user.deleted;
  }
}

/**
 * Specification for deleted users
 */
export class DeletedUserSpecification extends UserSpecification {
  isSatisfiedBy(user: UserState): boolean {
    return user.deleted;
  }
}

/**
 * Specification for users with verified email
 */
export class VerifiedEmailSpecification extends UserSpecification {
  isSatisfiedBy(user: UserState): boolean {
    return user.emailVerified;
  }
}

/**
 * Specification for users with unverified email
 */
export class UnverifiedEmailSpecification extends UserSpecification {
  isSatisfiedBy(user: UserState): boolean {
    return !user.emailVerified;
  }
}

/**
 * Specification for users with profile
 */
export class HasProfileSpecification extends UserSpecification {
  isSatisfiedBy(user: UserState): boolean {
    return !!user.profile && Object.keys(user.profile).length > 0;
  }
}

/**
 * Specification for users created within date range
 */
export class CreatedWithinSpecification extends UserSpecification {
  constructor(
    private readonly startDate: Date,
    private readonly endDate: Date
  ) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    const createdDate = new Date(user.createdAt);
    return createdDate >= this.startDate && createdDate <= this.endDate;
  }
}

/**
 * Specification for users matching email domain
 */
export class EmailDomainSpecification extends UserSpecification {
  constructor(private readonly domain: string) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    const emailDomain = (user.email as string).split('@')[1];
    return emailDomain === this.domain;
  }
}

/**
 * Specification for users matching name pattern
 */
export class NameMatchesSpecification extends UserSpecification {
  constructor(private readonly pattern: RegExp) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    return this.pattern.test(user.name as string);
  }
}

/**
 * Specification for users in a specific location
 */
export class LocationSpecification extends UserSpecification {
  constructor(private readonly location: string) {
    super();
  }

  isSatisfiedBy(user: UserState): boolean {
    return user.profile?.location?.toLowerCase() === this.location.toLowerCase();
  }
}

/**
 * Factory for common specifications
 */
export const UserSpecifications = {
  active: () => new ActiveUserSpecification(),
  deleted: () => new DeletedUserSpecification(),
  verifiedEmail: () => new VerifiedEmailSpecification(),
  unverifiedEmail: () => new UnverifiedEmailSpecification(),
  hasProfile: () => new HasProfileSpecification(),
  createdBetween: (start: Date, end: Date) => new CreatedWithinSpecification(start, end),
  emailDomain: (domain: string) => new EmailDomainSpecification(domain),
  nameMatches: (pattern: RegExp) => new NameMatchesSpecification(pattern),
  location: (location: string) => new LocationSpecification(location),
  
  /**
   * Complex specification examples
   */
  activeAndVerified: () => 
    new ActiveUserSpecification().and(new VerifiedEmailSpecification()),
  
  activeWithProfile: () =>
    new ActiveUserSpecification().and(new HasProfileSpecification()),
  
  recentlyCreatedAndUnverified: (daysAgo: number) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    return new CreatedWithinSpecification(startDate, new Date())
      .and(new UnverifiedEmailSpecification());
  },
  
  corporateUsers: (domain: string) =>
    new ActiveUserSpecification()
      .and(new EmailDomainSpecification(domain))
      .and(new VerifiedEmailSpecification()),
};

/**
 * Helper to apply specification to a collection
 */
export function filterBySpecification<T>(
  items: T[],
  specification: ISpecification<T>
): T[] {
  return items.filter(item => specification.isSatisfiedBy(item));
}